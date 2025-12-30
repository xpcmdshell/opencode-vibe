/**
 * useSession - Bridge Promise API to React state with SSE updates
 *
 * Wraps sessions.get from @opencode-vibe/core/api and manages React state.
 * Subscribes to SSE events for real-time updates when session is updated.
 *
 * @example
 * ```tsx
 * function SessionView({ sessionId }: { sessionId: string }) {
 *   const { session, loading, error, refetch } = useSession({ sessionId })
 *
 *   if (loading) return <div>Loading session...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!session) return <div>Session not found</div>
 *
 *   return <div>{session.title}</div>
 * }
 * ```
 */

"use client"

import { useMemo } from "react"
import { sessions } from "@opencode-vibe/core/api"
import type { Session } from "@opencode-vibe/core/types"
import { useSSEResource } from "./use-sse-resource"

export interface UseSessionOptions {
	/** Session ID to fetch */
	sessionId: string
	/** Project directory (optional) */
	directory?: string
}

export interface UseSessionReturn {
	/** Session data or null if not found */
	session: Session | null
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch session */
	refetch: () => void
}

/**
 * Hook to fetch a single session with real-time SSE updates
 *
 * Uses useSSEResource internally for fetch + SSE pattern.
 * Extracts single session from array result.
 *
 * @param options - Options with sessionId and optional directory
 * @returns Object with session, loading, error, and refetch
 */
export function useSession(options: UseSessionOptions): UseSessionReturn {
	const { data, loading, error, refetch } = useSSEResource<Session>({
		fetcher: async () => {
			const session = await sessions.get(options.sessionId, options.directory)
			// Wrap single result in array for useSSEResource
			return session ? [session] : []
		},
		eventType: ["session.created", "session.updated"],
		sessionIdFilter: options.sessionId,
		getId: (session) => session.id,
		initialData: [],
		enabled: true,
	})

	// Extract single session from array, filter out archived sessions
	const session = useMemo(() => {
		const firstSession = data[0] ?? null

		// Handle archived sessions (treat as deleted)
		if (firstSession?.time?.archived) {
			return null
		}

		return firstSession
	}, [data])

	return {
		session,
		loading,
		error,
		refetch,
	}
}
