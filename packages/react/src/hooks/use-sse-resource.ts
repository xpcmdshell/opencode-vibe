/**
 * useSSEResource - Generic hook for fetch + SSE + binary search pattern
 *
 * Combines initial data fetch with real-time SSE updates using efficient
 * binary search for O(log n) insert/update operations.
 *
 * Used as the foundation for useMessages, useParts, useSessions, etc.
 *
 * @example
 * ```tsx
 * interface Message {
 *   id: string
 *   content: string
 * }
 *
 * function MessageList({ sessionId }: { sessionId: string }) {
 *   const { data, loading, error } = useSSEResource<Message>({
 *     fetcher: () => client.message.list({ sessionId }),
 *     eventType: ["message.updated", "message.created"],
 *     sessionIdFilter: sessionId,
 *     getId: (msg) => msg.id
 *   })
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {data.map(msg => <li key={msg.id}>{msg.content}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

"use client"

import { useState, useRef, useMemo } from "react"
import { useFetch } from "./use-fetch"
import { useMultiServerSSE } from "./use-multi-server-sse"
import { matchesEventType, matchesSessionId, extractEventItem } from "../lib/sse-utils"
import { Binary } from "@opencode-vibe/core/utils"
import type { GlobalEvent } from "../types/events"

export interface UseSSEResourceOptions<T> {
	/** Async function to fetch initial data */
	fetcher: () => Promise<T[]>
	/** Event type(s) to listen for - supports exact match, array, or wildcard (e.g., "message.*") */
	eventType: string | string[]
	/** Optional sessionId to filter events by */
	sessionIdFilter?: string
	/** Function to extract unique ID from item */
	getId: (item: T) => string
	/** Initial data (optional) */
	initialData?: T[]
	/** Whether to enable fetching (default: true) */
	enabled?: boolean
}

export interface UseSSEResourceReturn<T> {
	/** Current data array (sorted by ID) */
	data: T[]
	/** Loading state from initial fetch */
	loading: boolean
	/** Error from initial fetch */
	error: Error | null
	/** Manually trigger refetch */
	refetch: () => void
	/** Ref tracking whether initial hydration is complete */
	hydratedRef: React.MutableRefObject<boolean>
}

/**
 * Generic hook for fetch + SSE + binary search pattern
 *
 * Flow:
 * 1. Fetch initial data via useFetch
 * 2. Subscribe to SSE events via useMultiServerSSE
 * 3. Filter events by type and sessionId
 * 4. Extract item from event payload
 * 5. Use Binary.search to check if item exists
 * 6. If found, update in place; if not, use Binary.insert
 * 7. Track hydration state to avoid processing SSE events before initial load
 *
 * @param options - Configuration options
 * @returns Object with data, loading, error, refetch, and hydratedRef
 */
export function useSSEResource<T>({
	fetcher,
	eventType,
	sessionIdFilter,
	getId,
	initialData = [],
	enabled = true,
}: UseSSEResourceOptions<T>): UseSSEResourceReturn<T> {
	// Track local state for SSE updates
	const [localData, setLocalData] = useState<T[]>(initialData)

	// Track hydration state - don't process SSE events until initial fetch completes
	const hydratedRef = useRef(false)

	// Fetch initial data
	const {
		data: fetchedData,
		loading,
		error,
		refetch,
	} = useFetch(fetcher, undefined, {
		initialData,
		enabled,
		onSuccess: (data) => {
			setLocalData(data)
			hydratedRef.current = true
		},
	})

	// Subscribe to SSE events
	useMultiServerSSE({
		onEvent: (event: GlobalEvent) => {
			// Don't process events until initial hydration is complete
			if (!hydratedRef.current) {
				return
			}

			// Filter by event type
			if (!matchesEventType(event.payload.type, eventType)) {
				return
			}

			// Filter by sessionId if provided
			if (!matchesSessionId(event, sessionIdFilter)) {
				return
			}

			// Extract item from event payload
			const item = extractEventItem(event.payload) as T | undefined
			if (!item) {
				return
			}

			// Get item ID
			const itemId = getId(item)

			// Update local data using binary search
			setLocalData((currentData) => {
				const { found, index } = Binary.search(currentData, itemId, getId)

				if (found) {
					// Update existing item
					const updated = [...currentData]
					updated[index] = item
					return updated
				}

				// Insert new item at correct position
				return Binary.insert(currentData, item, getId)
			})
		},
	})

	// Return current data (prefer localData for SSE updates, fallback to fetchedData during initial load)
	const data = useMemo(() => {
		return hydratedRef.current ? localData : fetchedData
	}, [localData, fetchedData])

	return {
		data,
		loading,
		error,
		refetch,
		hydratedRef,
	}
}
