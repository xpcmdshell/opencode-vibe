/**
 * useSSEState - Generic hook for SSE-driven state reduction
 *
 * Simpler than useSSEResource - no fetching, just event-driven state updates.
 * Subscribe to SSE events, filter by type and sessionId, reduce state with custom reducer.
 *
 * @example
 * ```tsx
 * // Count messages in a session
 * const messageCount = useSSEState({
 *   eventType: "message.*",
 *   sessionIdFilter: sessionId,
 *   reducer: (count, event) => {
 *     if (event.payload.type === "message.created") return count + 1
 *     if (event.payload.type === "message.removed") return count - 1
 *     return count
 *   },
 *   initialState: 0
 * })
 *
 * // Accumulate events
 * const events = useSSEState({
 *   eventType: ["message.updated", "part.updated"],
 *   reducer: (events, event) => [...events, event],
 *   initialState: []
 * })
 * ```
 */

"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { useMultiServerSSE } from "./use-multi-server-sse"
import { matchesEventType, matchesSessionId } from "../lib/sse-utils"
import type { GlobalEvent } from "../types/events"

export interface UseSSEStateOptions<T> {
	/**
	 * Event type filter
	 * - String: exact match ("message.updated")
	 * - String[]: match any in array (["message.updated", "message.removed"])
	 * - Function: custom matcher ((type) => type.startsWith("message."))
	 * - Wildcard: prefix match ("message.*" matches "message.updated", etc.)
	 */
	eventType: string | string[] | ((type: string) => boolean)

	/**
	 * Optional sessionId filter
	 * Events are only processed if payload.properties.sessionID matches
	 */
	sessionIdFilter?: string

	/**
	 * State reducer function
	 * Called with current state and event when a matching event arrives
	 */
	reducer: (state: T, event: GlobalEvent) => T

	/**
	 * Initial state value
	 */
	initialState: T

	/**
	 * Whether to subscribe to events (default: true)
	 * Set to false to pause event processing
	 */
	enabled?: boolean
}

/**
 * Subscribe to SSE events and reduce state with custom reducer
 *
 * Features:
 * - Event type filtering (exact, wildcard, function)
 * - Optional sessionId filtering
 * - Custom state reduction
 * - Conditional subscription via enabled flag
 * - Stable sessionId filtering across renders
 *
 * @param options - Configuration object
 * @returns Current state value
 */
export function useSSEState<T>(options: UseSSEStateOptions<T>): T {
	const { eventType, sessionIdFilter, reducer, initialState, enabled = true } = options

	// Track current state
	const [state, setState] = useState<T>(initialState)

	// Use ref for sessionIdFilter to maintain stable reference in onEvent callback
	// This prevents recreating the callback on every render when sessionIdFilter changes
	const sessionIdRef = useRef(sessionIdFilter)
	sessionIdRef.current = sessionIdFilter

	// Stable reducer ref to avoid recreating callback
	const reducerRef = useRef(reducer)
	reducerRef.current = reducer

	// Create event handler that filters and reduces state
	const onEvent = useCallback(
		(event: GlobalEvent) => {
			// Filter by event type
			let typeMatches = false
			if (typeof eventType === "function") {
				typeMatches = eventType(event.payload.type)
			} else {
				typeMatches = matchesEventType(event.payload.type, eventType)
			}

			if (!typeMatches) {
				return
			}

			// Filter by sessionId
			if (!matchesSessionId(event, sessionIdRef.current)) {
				return
			}

			// Reduce state
			setState((prevState) => reducerRef.current(prevState, event))
		},
		[eventType], // Only recreate if eventType changes (string/array comparison is stable)
	)

	// Subscribe to SSE events
	const sseOptions = useMemo(() => {
		if (!enabled) {
			return { onEvent: undefined }
		}
		return { onEvent }
	}, [enabled, onEvent])

	useMultiServerSSE(sseOptions)

	return state
}
