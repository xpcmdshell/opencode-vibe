/**
 * useContextUsage - Hook to track context token usage for a session
 *
 * Reads context usage from Zustand store. Real-time updates are handled automatically
 * by OpenCodeProvider which subscribes to context usage SSE events and
 * updates the store via handleSSEEvent().
 *
 * @example
 * ```tsx
 * function ContextIndicator({ sessionId }: { sessionId: string }) {
 *   const { used, limit, percentage, isNearLimit } = useContextUsage(sessionId)
 *
 *   return (
 *     <div>
 *       <Progress value={percentage} />
 *       {isNearLimit && <Badge variant="warning">Near Limit</Badge>}
 *       <span>{formatTokens(used)} / {formatTokens(limit)}</span>
 *     </div>
 *   )
 * }
 * ```
 */

import { useOpencodeStore } from "../store"
import { useOpenCode } from "../providers"
import { useShallow } from "zustand/react/shallow"

/**
 * Context usage state
 */
export interface ContextUsageState {
	/** Number of tokens used */
	used: number
	/** Maximum tokens allowed */
	limit: number
	/** Percentage of context used (0-100) */
	percentage: number
	/** Remaining tokens available */
	remaining: number
	/** Whether context usage is near the limit (>80%) */
	isNearLimit: boolean
	/** Token breakdown by type */
	tokens: {
		input: number
		output: number
		cached: number
	}
}

/**
 * Default state when no usage data is available
 */
const DEFAULT_STATE: ContextUsageState = {
	used: 0,
	limit: 0,
	percentage: 0,
	remaining: 0,
	isNearLimit: false,
	tokens: { input: 0, output: 0, cached: 0 },
}

/**
 * useContextUsage - Get context token usage from store (automatically updates via SSE)
 *
 * @param sessionId - The session ID to track
 * @returns ContextUsageState with usage metrics
 */
export function useContextUsage(sessionId: string): ContextUsageState {
	const { directory } = useOpenCode()

	// Get context usage from store (reactive - updates when store changes)
	// Store is updated by OpenCodeProvider's SSE subscription to context usage events
	// Use useShallow for performance (prevents re-renders when nested objects have same values)
	return useOpencodeStore(
		useShallow((state) => {
			const usage = state.directories[directory]?.contextUsage[sessionId]

			// If no usage data in store yet, return default values
			if (!usage) {
				return DEFAULT_STATE
			}

			// Return usage data with calculated remaining
			return {
				used: usage.used,
				limit: usage.limit,
				percentage: usage.percentage,
				remaining: usage.limit - usage.used,
				isNearLimit: usage.isNearLimit,
				tokens: usage.tokens,
			}
		}),
	)
}

/**
 * formatTokens - Format token count for display
 *
 * Converts large numbers to human-readable format with k/M suffixes
 *
 * @param n - Number of tokens
 * @returns Formatted string (e.g., "156k", "1.5M")
 *
 * @example
 * ```ts
 * formatTokens(500)      // "500"
 * formatTokens(1500)     // "1.5k"
 * formatTokens(156000)   // "156.0k"
 * formatTokens(1500000)  // "1.5M"
 * ```
 */
export function formatTokens(n: number): string {
	if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
	return n.toString()
}
