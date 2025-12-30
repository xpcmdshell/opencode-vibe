/**
 * useMessages - Bridge Promise API to React state with SSE updates
 *
 * Wraps messages.list from @opencode-vibe/core/api and manages React state.
 * Subscribes to SSE events for real-time updates when messages are created/updated.
 *
 * @example
 * ```tsx
 * function MessageList({ sessionId }: { sessionId: string }) {
 *   const { messages, loading, error, refetch } = useMessages({ sessionId })
 *
 *   if (loading) return <div>Loading messages...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {messages.map(m => <li key={m.id}>{m.role}: {m.id}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

"use client"

import { messages } from "@opencode-vibe/core/api"
import type { Message } from "@opencode-vibe/core/types"
import { useSSEResource } from "./use-sse-resource"

export interface UseMessagesOptions {
	/** Session ID to fetch messages for */
	sessionId: string
	/** Project directory (optional) */
	directory?: string
	/** Initial data from server (hydration) - skips initial fetch if provided */
	initialData?: Message[]
}

export interface UseMessagesReturn {
	/** Array of messages, sorted by ID */
	messages: Message[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch messages */
	refetch: () => void
}

/**
 * Hook to fetch message list with real-time SSE updates
 *
 * @param options - Options with sessionId and optional directory
 * @returns Object with messages, loading, error, and refetch
 */
export function useMessages(options: UseMessagesOptions): UseMessagesReturn {
	const result = useSSEResource<Message>({
		fetcher: () => messages.list(options.sessionId, options.directory),
		eventType: "message.updated",
		sessionIdFilter: options.sessionId,
		getId: (msg) => msg.id,
		initialData: options.initialData,
	})

	return {
		messages: result.data,
		loading: result.loading,
		error: result.error,
		refetch: result.refetch,
	}
}
