/**
 * useMessages - Hook for accessing messages with real-time updates
 *
 * Reads message data from Zustand store. Real-time updates are handled
 * automatically by OpenCodeProvider which subscribes to SSE events and
 * updates the store via handleSSEEvent().
 *
 * @example
 * ```tsx
 * function SessionView({ sessionId }: { sessionId: string }) {
 *   const messages = useMessages(sessionId)
 *
 *   return <div>{messages.map(msg => <Message key={msg.id} {...msg} />)}</div>
 * }
 * ```
 */

import { useOpencodeStore, type Message } from "../store"
import { useOpenCode } from "../providers"

/**
 * Empty messages constant to avoid re-rendering when no messages exist
 * Using a constant reference prevents new array creation on every render
 */
const EMPTY_MESSAGES: Message[] = []

/**
 * useMessages - Hook for accessing session messages with real-time updates
 *
 * Reads from Zustand store. Store is automatically updated by OpenCodeProvider's
 * SSE subscription which handles message.created, message.updated, and
 * message.part.updated events.
 *
 * @param sessionId - ID of the session to get messages for
 * @returns Array of messages for the session (reactive, updates automatically)
 *
 * @example
 * ```tsx
 * function MessageList({ sessionId }: { sessionId: string }) {
 *   const messages = useMessages(sessionId)
 *
 *   return (
 *     <div>
 *       {messages.map(msg => <MessageCard key={msg.id} message={msg} />)}
 *     </div>
 *   )
 * }
 * ```
 */
export function useMessages(sessionId: string): Message[] {
	const { directory } = useOpenCode()

	// Get messages from store (reactive - updates when store changes)
	// Return stable EMPTY_MESSAGES reference when no messages exist
	// Store is updated by OpenCodeProvider's SSE subscription
	const messages = useOpencodeStore(
		(state) => state.directories[directory]?.messages[sessionId] || EMPTY_MESSAGES,
	)

	return messages
}
