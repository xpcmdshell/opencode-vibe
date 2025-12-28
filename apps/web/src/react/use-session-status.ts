/**
 * useSessionStatus - Hook to track session running/idle status
 *
 * Reads status from Zustand store. Real-time updates are handled automatically
 * by OpenCodeProvider which subscribes to session.status SSE events and
 * updates the store via handleSSEEvent().
 *
 * @example
 * ```tsx
 * function SessionIndicator({ sessionId }: { sessionId: string }) {
 *   const { running, isLoading } = useSessionStatus(sessionId)
 *
 *   if (isLoading) return <Spinner />
 *   return running ? <Badge>Running</Badge> : <Badge>Idle</Badge>
 * }
 * ```
 */

import { useOpencodeStore } from "./store"
import { useOpenCode } from "./provider"

/**
 * Session status state
 */
export interface SessionStatus {
	/** Whether the session is currently running (AI generating response) */
	running: boolean
	/** Whether we're still waiting for the first status event */
	isLoading: boolean
}

/**
 * useSessionStatus - Get session status from store (automatically updates via SSE)
 *
 * @param sessionId - The session ID to track
 * @returns SessionStatus with running and isLoading states
 */
export function useSessionStatus(sessionId: string): SessionStatus {
	const { directory } = useOpenCode()

	// Get status from store (reactive - updates when store changes)
	// Store is updated by OpenCodeProvider's SSE subscription to session.status events
	const status = useOpencodeStore((state) => {
		const sessionStatus = state.directories[directory]?.sessionStatus[sessionId]
		return sessionStatus
	})

	// If no status in store yet, it's loading
	const isLoading = status === undefined
	// Status is now a string: "running", "pending", "completed", "error"
	const running = status === "running" || status === "pending"

	return { running, isLoading }
}
