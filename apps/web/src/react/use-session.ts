/**
 * useSession - Hook for accessing session data with real-time updates
 *
 * Provides two APIs:
 * 1. useSession(id) - Get single session from Zustand store (legacy during migration)
 * 2. useSessionList(options) - Get session list from atoms/sessions.ts with SSE sync
 *
 * @example Single session (Zustand store)
 * ```tsx
 * function SessionView({ sessionId }: { sessionId: string }) {
 *   const session = useSession(sessionId)
 *
 *   if (!session) return <div>Session not found</div>
 *
 *   return <div>{session.title}</div>
 * }
 * ```
 *
 * @example Session list (atoms pattern)
 * ```tsx
 * function SessionList({ directory }: { directory: string }) {
 *   const { sessions, loading, error } = useSessionList({ directory })
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) console.warn("Failed to load sessions:", error)
 *
 *   return (
 *     <ul>
 *       {sessions.map(s => <li key={s.id}>{s.title}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

import { useOpencodeStore, type Session } from "./store"
import { useOpenCode } from "./provider"
import { Binary } from "@/lib/binary"

// Re-export atoms/sessions.ts for convenience (Phase 3b: Effect atom migration)
export {
	useSessionList,
	type SessionListState,
	type UseSessionListOptions,
} from "@/atoms/sessions"

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
