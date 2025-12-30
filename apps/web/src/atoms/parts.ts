/**
 * Parts Atom (Phase 5 - Zustand Replacement)
 *
 * React hook for message parts management with binary search insertion.
 * Phase 5: Extract from Zustand store to atom pattern
 * Future: Full effect-atom migration when patterns are stable
 *
 * Provides:
 * - Part list fetching via SDK (from session.messages)
 * - Binary search insertion for O(log n) updates
 * - SSE event handling (message.part.updated, message.part.created)
 * - Sorted by ID (ULIDs are lexicographically sortable)
 * - Filtered by sessionId (parts belong to messages in a session)
 *
 * @module atoms/parts
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/core/client"
import { Binary } from "@/lib/binary"
import type { Part } from "@opencode-vibe/react"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

/**
 * Part list state
 */
export interface PartListState {
	/** List of parts sorted by ID, filtered by sessionId */
	parts: Part[]
	/** Whether initial fetch is in progress */
	loading: boolean
	/** Last error if fetch failed */
	error: Error | null
}

/**
 * Hook options
 */
export interface UseMessagePartsOptions {
	/** Session ID to filter parts for */
	sessionId: string
	/** Project directory */
	directory?: string
	/** Optional SSE event to trigger updates */
	sseEvent?: GlobalEvent | null
}

/**
 * Factory function to create parts atom with injectable config (for testing)
 *
 * This returns a hook factory that can be configured with custom SSE event sources,
 * maintaining compatibility with the atom pattern.
 *
 * @param config - Parts atom configuration
 * @returns Hook factory
 *
 * @example
 * ```tsx
 * const partsAtom = makePartsAtom({ directory: "/my/project" })
 * const { parts, loading } = partsAtom.useMessageParts("session-123")
 * ```
 */
export function makePartsAtom(config: { directory?: string } = {}) {
	return {
		config,
		/**
		 * Hook to fetch and track parts for a session
		 */
		useMessageParts: (sessionId: string, sseEvent?: GlobalEvent | null) => {
			return useMessageParts({
				sessionId,
				directory: config.directory,
				sseEvent,
			})
		},
	}
}

/**
 * React hook to fetch and track message parts with binary search updates
 *
 * Features:
 * - Fetches parts from session.messages on mount
 * - Handles SSE message.part.updated events with binary search insertion
 * - Maintains sorted order by ID (O(log n) insertions)
 * - Filters parts to only include those belonging to messages in the session
 * - Falls back to empty array on error
 *
 * @param options - Hook options (sessionId, directory, sseEvent)
 * @returns PartListState with parts, loading, error
 *
 * @example
 * ```tsx
 * const { parts, loading, error } = useMessageParts({
 *   sessionId: "session-123",
 *   directory: "/my/project",
 *   sseEvent: latestSSEEvent
 * })
 *
 * if (loading) return <div>Loading parts...</div>
 * if (error) console.warn("Failed to load parts:", error)
 *
 * return (
 *   <ul>
 *     {parts.map(p => <li key={p.id}>{p.type}: {p.content}</li>)}
 *   </ul>
 * )
 * ```
 */
export function useMessageParts(options: UseMessagePartsOptions): PartListState {
	const { sessionId, directory, sseEvent } = options

	const [parts, setParts] = useState<Part[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Track message IDs for this session to filter parts
	const [messageIds, setMessageIds] = useState<Set<string>>(new Set())

	// Fetch parts via session.messages - stable reference via useCallback
	const fetchParts = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const client = createClient(directory)
			const response = await client.session.messages({
				path: { id: sessionId },
				query: { limit: 1000 }, // TODO: Pagination
			})

			// Extract parts from response (each item has { info: Message, parts: Part[] })
			// biome-ignore lint: API response type
			const responseData = (response.data || []) as any[]

			// Collect all message IDs for filtering
			const msgIds = new Set<string>()
			const allParts: Part[] = []

			for (const item of responseData) {
				const messageId = item.info?.id
				if (messageId) {
					msgIds.add(messageId)
					// Add parts from this message
					const messageParts = (item.parts || []) as Part[]
					allParts.push(...messageParts)
				}
			}

			// Sort by ID for binary search (ULIDs are lexicographically sortable)
			const sorted = allParts.sort((a, b) => a.id.localeCompare(b.id))

			setMessageIds(msgIds)
			setParts(sorted)
			setLoading(false)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			setParts([]) // Fallback to empty array on error
			setMessageIds(new Set())
			setLoading(false)
		}
	}, [sessionId, directory])

	// Initial fetch on mount (and when sessionId/directory changes)
	useEffect(() => {
		fetchParts()
	}, [fetchParts])

	// Handle SSE events: message.part.updated with binary search insertion
	useEffect(() => {
		if (!sseEvent) return

		const eventType = sseEvent.payload.type

		// Handle message.part.updated event (covers both create and update)
		if (eventType === "message.part.updated") {
			// biome-ignore lint: SDK event types
			const part = (sseEvent.payload as any).properties.part as Part
			const messageID = part.messageID

			// Only update if part belongs to a message in this session
			if (!messageIds.has(messageID)) return

			setParts((prevParts) => {
				const result = Binary.search(prevParts, part.id, (p) => p.id)

				if (result.found) {
					// Part exists - update it
					const updated = [...prevParts]
					updated[result.index] = part
					return updated
				}
				// Part doesn't exist - insert it
				return Binary.insert(prevParts, part, (p) => p.id)
			})
		}
	}, [sseEvent, messageIds])

	return { parts, loading, error }
}
