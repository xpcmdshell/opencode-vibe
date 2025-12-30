/**
 * Sessions Atom (Phase 1 - Interim)
 *
 * React hook for session list management with cache invalidation.
 * Phase 1: Wrap SDK calls in hooks (simplified effect-atom pattern)
 * Phase 2: Full effect-atom migration when patterns are stable
 *
 * Provides:
 * - Session list fetching via SDK
 * - Cache invalidation on SSE events (session.created, session.updated, etc.)
 * - Error handling with empty fallback
 * - Sorted by updated time descending (newest first)
 *
 * @module atoms/sessions
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/core/client"
import type { Session } from "@opencode-vibe/react"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

/**
 * Session list state
 */
export interface SessionListState {
	/** List of sessions sorted by updated time descending */
	sessions: Session[]
	/** Whether initial fetch is in progress */
	loading: boolean
	/** Last error if fetch failed */
	error: Error | null
}

/**
 * Hook options
 */
export interface UseSessionListOptions {
	/** Project directory to fetch sessions for */
	directory?: string
	/** Optional SSE event to trigger cache invalidation */
	sseEvent?: GlobalEvent | null
}

/**
 * React hook to fetch and track session list with cache invalidation
 *
 * Features:
 * - Fetches sessions on mount
 * - Refetches when SSE session.* events occur
 * - Sorts by updated time descending (newest first)
 * - Falls back to empty array on error
 *
 * @param options - Hook options (directory, sseEvent)
 * @returns SessionListState with sessions, loading, error
 *
 * @example
 * ```tsx
 * const { sessions, loading, error } = useSessionList({
 *   directory: "/my/project",
 *   sseEvent: latestSSEEvent
 * })
 *
 * if (loading) return <div>Loading sessions...</div>
 * if (error) console.warn("Failed to load sessions:", error)
 *
 * return (
 *   <ul>
 *     {sessions.map(s => <li key={s.id}>{s.title}</li>)}
 *   </ul>
 * )
 * ```
 */
export function useSessionList(options: UseSessionListOptions = {}): SessionListState {
	const { directory, sseEvent } = options

	const [sessions, setSessions] = useState<Session[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Fetch sessions - stable reference via useCallback
	const fetchSessions = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const client = createClient(directory)
			const response = await client.session.list()

			// Sort by updated time descending (newest first)
			const sorted = (response.data || []).sort((a, b) => b.time.updated - a.time.updated)

			setSessions(sorted)
			setLoading(false)
		} catch (err) {
			const errorObj = err instanceof Error ? err : new Error(String(err))
			setError(errorObj)
			setSessions([]) // Fallback to empty array on error
			setLoading(false)
		}
	}, [directory])

	// Initial fetch on mount (and when directory changes)
	useEffect(() => {
		fetchSessions()
	}, [fetchSessions])

	// Cache invalidation: refetch when session.* events occur
	useEffect(() => {
		if (!sseEvent) return

		// Only refetch for session-related events
		// GlobalEvent.payload contains the actual event with { type, properties }
		if (sseEvent.payload.type.startsWith("session.")) {
			// Filter by directory if provided
			if (directory && sseEvent.directory !== directory) return

			fetchSessions()
		}
	}, [sseEvent, directory, fetchSessions])

	return { sessions, loading, error }
}
