/**
 * Messages Atom (Phase 1 - Interim)
 *
 * React hook for message list management with binary search insertion.
 * Phase 1: Wrap SDK calls in hooks with SSE cache invalidation
 * Phase 2: Full effect-atom migration when patterns are stable
 *
 * Provides:
 * - Message list fetching via SDK
 * - Binary search insertion for O(log n) updates
 * - SSE event handling (message.updated, message.created)
 * - Sorted by ID (ULIDs are lexicographically sortable)
 *
 * @module atoms/messages
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/core/client"
import { Binary } from "@/lib/binary"
import type { Message } from "@opencode-vibe/react"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

/**
 * Message list state
 */
export interface MessageListState {
	/** List of messages sorted by ID */
	messages: Message[]
	/** Whether initial fetch is in progress */
	loading: boolean
	/** Last error if fetch failed */
	error: Error | null
}

/**
 * Hook options
 */
export interface UseMessagesOptions {
	/** Session ID to fetch messages for */
	sessionId: string
	/** Project directory */
	directory?: string
	/** Optional SSE event to trigger updates */
	sseEvent?: GlobalEvent | null
}

/**
 * Factory function to create messages atom with injectable config (for testing)
 *
 * This returns a hook factory that can be configured with custom SSE event sources,
 * maintaining compatibility with the atom pattern.
 *
 * @param config - Messages atom configuration
 * @returns Hook factory
 *
 * @example
 * ```tsx
 * const messagesAtom = makeMessagesAtom({ directory: "/my/project" })
 * const { messages, loading } = messagesAtom.useMessages("session-123")
 * ```
 */
export function makeMessagesAtom(config: { directory?: string } = {}) {
	return {
		config,
		/**
		 * Hook to fetch and track messages for a session
		 */
		useMessages: (sessionId: string, sseEvent?: GlobalEvent | null) => {
			return useMessages({ sessionId, directory: config.directory, sseEvent })
		},
	}
}

/**
 * React hook to fetch and track messages with binary search updates
 *
 * Features:
 * - Fetches messages on mount
 * - Handles SSE message.updated events with binary search insertion
 * - Maintains sorted order by ID (O(log n) insertions)
 * - Falls back to empty array on error
 *
 * @param options - Hook options (sessionId, directory, sseEvent)
 * @returns MessageListState with messages, loading, error
 *
 * @example
 * ```tsx
 * const { messages, loading, error } = useMessages({
 *   sessionId: "session-123",
 *   directory: "/my/project",
 *   sseEvent: latestSSEEvent
 * })
 *
 * if (loading) return <div>Loading messages...</div>
 * if (error) console.warn("Failed to load messages:", error)
 *
 * return (
 *   <ul>
 *     {messages.map(m => <li key={m.id}>{m.role}: {m.id}</li>)}
 *   </ul>
 * )
 * ```
 */
export function useMessages(options: UseMessagesOptions): MessageListState {
	const { sessionId, directory, sseEvent } = options

	const [messages, setMessages] = useState<Message[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Fetch messages - stable reference via useCallback
	const fetchMessages = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const client = createClient(directory)
			const response = await client.session.messages({
				path: { id: sessionId },
				query: { limit: 1000 }, // TODO: Pagination
			})

			// Extract messages from response (each item has { info: Message, parts: Part[] })
			// biome-ignore lint: API response type
			const messageList = (response.data || []).map((m: any) => m.info as Message)

			// Sort by ID for binary search (ULIDs are lexicographically sortable)
			const sorted = messageList.sort((a, b) => a.id.localeCompare(b.id))

			setMessages(sorted)
			setLoading(false)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			setMessages([]) // Fallback to empty array on error
			setLoading(false)
		}
	}, [sessionId, directory])

	// Initial fetch on mount (and when sessionId/directory changes)
	useEffect(() => {
		fetchMessages()
	}, [fetchMessages])

	// Handle SSE events: message.updated with binary search insertion
	useEffect(() => {
		if (!sseEvent) return

		const eventType = sseEvent.payload.type

		// Handle message.updated event (covers both create and update)
		if (eventType === "message.updated") {
			const message = sseEvent.payload.properties.info as Message

			// Only update if message belongs to this session
			if (message.sessionID !== sessionId) return

			setMessages((prevMessages) => {
				const result = Binary.search(prevMessages, message.id, (m) => m.id)

				if (result.found) {
					// Message exists - update it
					const updated = [...prevMessages]
					updated[result.index] = message
					return updated
				}
				// Message doesn't exist - insert it
				return Binary.insert(prevMessages, message, (m) => m.id)
			})
		}

		// Handle message removal
		if (eventType === "message.removed") {
			const { sessionID, messageID } = sseEvent.payload.properties

			// Only update if message belongs to this session
			if (sessionID !== sessionId) return

			setMessages((prevMessages) => {
				const result = Binary.search(prevMessages, messageID, (m) => m.id)
				if (result.found) {
					const updated = [...prevMessages]
					updated.splice(result.index, 1)
					return updated
				}
				return prevMessages
			})
		}
	}, [sseEvent, sessionId])

	return { messages, loading, error }
}
