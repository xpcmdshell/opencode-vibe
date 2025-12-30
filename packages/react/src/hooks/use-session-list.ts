/**
 * useSessionList - Bridge Promise API to React state
 *
 * Wraps sessions.list from @opencode-vibe/core/api and manages React state.
 * Provides loading, error, and data states for session list.
 *
 * @example
 * ```tsx
 * function SessionList({ directory }: { directory?: string }) {
 *   const { sessions, loading, error, refetch } = useSessionList({ directory })
 *
 *   if (loading) return <div>Loading sessions...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {sessions.map(s => <li key={s.id}>{s.title}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

"use client"

import { sessions } from "@opencode-vibe/core/api"
import type { Session } from "@opencode-vibe/core/types"
import { useFetch } from "./use-fetch"

export interface UseSessionListOptions {
	/** Project directory (optional) */
	directory?: string
}

export interface UseSessionListReturn {
	/** Array of sessions, sorted by updated time descending */
	sessions: Session[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch sessions */
	refetch: () => void
}

/**
 * Hook to fetch session list using Promise API from core
 *
 * @param options - Options with optional directory
 * @returns Object with sessions, loading, error, and refetch
 */
export function useSessionList(options: UseSessionListOptions = {}): UseSessionListReturn {
	const { data, loading, error, refetch } = useFetch(
		(dir: string | undefined) => sessions.list(dir),
		options.directory,
		{ initialData: [] },
	)

	return {
		sessions: data,
		loading,
		error,
		refetch,
	}
}
