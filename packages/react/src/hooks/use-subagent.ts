/**
 * Hook for accessing subagent data and UI state
 *
 * Wraps subagent store selectors to provide:
 * - subagent session data by parent part ID
 * - isExpanded state for UI
 * - toggleExpanded action
 * - derived values: hasSubagent, isRunning, isCompleted
 *
 * @example
 * const { subagent, isExpanded, toggleExpanded, hasSubagent, isRunning } = useSubagent(partId)
 */

import { useSubagentStore } from "../stores/subagent-store"

export function useSubagent(partId: string) {
	const subagent = useSubagentStore((s) => s.getByParentPart(partId))
	const isExpanded = useSubagentStore((s) => s.isExpanded(partId))
	const toggleExpanded = useSubagentStore((s) => s.toggleExpanded)

	return {
		subagent,
		isExpanded,
		toggleExpanded: () => toggleExpanded(partId),
		hasSubagent: !!subagent,
		isRunning: subagent?.status === "running",
		isCompleted: subagent?.status === "completed",
	}
}
