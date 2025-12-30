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

import { useOpencodeStore, type Session, Binary } from "../store"
import { useOpenCode } from "../providers"

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

/**
 * useSessionList - Get session list from Zustand store with SSE sync
 *
 * Re-exported for Phase 3b migration. This hook reads from the same
 * Zustand store that's updated by OpenCodeProvider's SSE subscription.
 *
 * @param options - Options object with directory
 * @returns Object with sessions array, loading state, error state
 */
export function useSessionList(options?: { directory?: string }) {
	const context = useOpenCode()
	const directory = options?.directory ?? context.directory

	const sessions = useOpencodeStore((state) => {
		const dir = state.directories[directory]
		return dir?.sessions ?? []
	})

	return {
		sessions,
		loading: false, // SSE is always connected via provider
		error: null,
	}
}
