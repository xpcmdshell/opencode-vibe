/**
 * useCompactionState - Hook to track compaction state for a session
 *
 * Reads compaction state from Zustand store. Real-time updates are handled automatically
 * by OpenCodeProvider which subscribes to compaction SSE events and updates the store
 * via handleSSEEvent().
 *
 * @example
 * ```tsx
 * function CompactionIndicator({ sessionId }: { sessionId: string }) {
 *   const { isCompacting, progress, isAutomatic } = useCompactionState(sessionId)
 *
 *   if (!isCompacting) return null
 *   return (
 *     <div>
 *       {isAutomatic ? "Auto-" : ""}Compacting: {progress}
 *     </div>
 *   )
 * }
 * ```
 */

import { useOpencodeStore } from "./store"
import { useOpenCode } from "./provider"
import { useShallow } from "zustand/react/shallow"

/**
 * Compaction progress state
 */
export type CompactionProgress = "pending" | "generating" | "complete"

/**
 * Compaction state for a session
 */
export interface CompactionState {
	/** Whether compaction is currently in progress */
	isCompacting: boolean
	/** Whether this is an automatic compaction (vs manual trigger) */
	isAutomatic: boolean
	/** Current progress stage */
	progress: CompactionProgress
	/** Timestamp when compaction started (0 if no compaction) */
	startedAt: number
}

/**
 * Default state when no compaction is in progress
 */
const DEFAULT_STATE: CompactionState = {
	isCompacting: false,
	isAutomatic: false,
	progress: "complete",
	startedAt: 0,
}

/**
 * useCompactionState - Get compaction state from store (automatically updates via SSE)
 *
 * @param sessionId - The session ID to track
 * @returns CompactionState with isCompacting, isAutomatic, progress, and startedAt
 */
export function useCompactionState(sessionId: string): CompactionState {
	const { directory } = useOpenCode()

	return useOpencodeStore(
		useShallow((state) => {
			const compactionState = state.directories[directory]?.compaction[sessionId]

			// Return default state if no compaction data
			if (!compactionState) {
				return DEFAULT_STATE
			}

			// Return actual state from store
			return {
				isCompacting: compactionState.isCompacting,
				isAutomatic: compactionState.isAutomatic,
				progress: compactionState.progress,
				startedAt: compactionState.startedAt,
			}
		}),
	)
}
