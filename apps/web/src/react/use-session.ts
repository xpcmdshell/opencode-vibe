/**
 * useSession - Hook for accessing session data with real-time updates
 *
 * Reads session data from Zustand store. Real-time updates are handled
 * automatically by OpenCodeProvider which subscribes to SSE events and
 * updates the store via handleSSEEvent().
 *
 * @example
 * ```tsx
 * function SessionView({ sessionId }: { sessionId: string }) {
 *   const session = useSession(sessionId)
 *
 *   if (!session) return <div>Session not found</div>
 *
 *   return <div>{session.title}</div>
 * }
 * ```
 */

import { useOpencodeStore, type Session } from "./store"
import { useOpenCode } from "./provider"
import { Binary } from "@/lib/binary"

/**
 * useSession - Get session from store (automatically updates via SSE)
 *
 * @param sessionId - ID of the session to retrieve
 * @returns Session object or undefined if not found
 */
export function useSession(sessionId: string): Session | undefined {
	const { directory } = useOpenCode()

	// Get session from store (reactive - updates when store changes)
	// Store is updated by OpenCodeProvider's SSE subscription
	const session = useOpencodeStore((state) => {
		const dir = state.directories[directory]
		if (!dir) return undefined
		const result = Binary.search(dir.sessions, sessionId, (s: Session) => s.id)
		return result.found ? dir.sessions[result.index] : undefined
	})

	return session
}
