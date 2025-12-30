/**
 * useParts - Bridge Promise API to React state with SSE updates
 *
 * Wraps parts.list from @opencode-vibe/core/api and manages React state.
 * Subscribes to SSE events for real-time updates when parts are created/updated.
 *
 * @example
 * ```tsx
 * function PartList({ sessionId }: { sessionId: string }) {
 *   const { parts, loading, error, refetch } = useParts({ sessionId })
 *
 *   if (loading) return <div>Loading parts...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {parts.map(p => <li key={p.id}>{p.type}</li>)}
 *     </ul>
 *   )
 * }
 * ```
 */

"use client"

import { parts } from "@opencode-vibe/core/api"
import type { Part } from "@opencode-vibe/core/types"
import { useSSEResource } from "./use-sse-resource"

export interface UsePartsOptions {
	/** Session ID to fetch parts for */
	sessionId: string
	/** Project directory (optional) */
	directory?: string
	/** Initial data from server (hydration) - skips initial fetch if provided */
	initialData?: Part[]
}

export interface UsePartsReturn {
	/** Array of parts, sorted by ID */
	parts: Part[]
	/** Loading state */
	loading: boolean
	/** Error if fetch failed */
	error: Error | null
	/** Refetch parts */
	refetch: () => void
}

/**
 * Hook to fetch part list with real-time SSE updates
 *
 * @param options - Options with sessionId and optional directory
 * @returns Object with parts, loading, error, and refetch
 */
export function useParts(options: UsePartsOptions): UsePartsReturn {
	const result = useSSEResource<Part>({
		fetcher: () => parts.list(options.sessionId, options.directory),
		eventType: "message.part.updated",
		sessionIdFilter: options.sessionId,
		getId: (part) => part.id,
		initialData: options.initialData,
	})

	return {
		parts: result.data,
		loading: result.loading,
		error: result.error,
		refetch: result.refetch,
	}
}
