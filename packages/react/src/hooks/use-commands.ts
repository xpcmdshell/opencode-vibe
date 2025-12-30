/**
 * useCommands - Hook for slash command registry
 *
 * Returns builtin and custom slash commands.
 * Builtin commands are hardcoded, custom commands fetched from API.
 *
 * @returns {
 *   commands: SlashCommand[] - all commands (builtin + custom)
 *   getSlashCommands: () => SlashCommand[] - filter to commands with triggers
 *   findCommand: (trigger: string) => SlashCommand | undefined - find by trigger
 *   loading: boolean - true while fetching custom commands
 *   error: Error | null - error from API fetch (null if no error)
 * }
 *
 * @example
 * ```tsx
 * const { commands, findCommand, loading, error } = useCommands()
 *
 * if (loading) return <Spinner />
 * if (error) console.warn("Failed to load custom commands:", error)
 *
 * const newCmd = findCommand("new") // Find /new command
 * ```
 */

import { useMemo, useCallback, useEffect, useState } from "react"
import type { SlashCommand } from "../types/prompt"
import { useOpenCode } from "../providers"

/**
 * Builtin slash commands
 */
const BUILTIN_COMMANDS: SlashCommand[] = [
	{
		id: "session.new",
		trigger: "new",
		title: "New Session",
		keybind: "mod+n",
		type: "builtin",
	},
	{
		id: "session.share",
		trigger: "share",
		title: "Share Session",
		keybind: "mod+shift+s",
		type: "builtin",
	},
	{
		id: "session.compact",
		trigger: "compact",
		title: "Compact Context",
		type: "builtin",
	},
]

/**
 * API response format for custom commands
 */
interface CustomCommandResponse {
	name: string
	description?: string
	template?: string
	agent?: string
	subtask?: boolean
}

/**
 * useCommands hook
 */
export function useCommands() {
	const { caller } = useOpenCode()
	const [customCommands, setCustomCommands] = useState<SlashCommand[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<Error | null>(null)

	// Fetch custom commands from API
	useEffect(() => {
		async function fetchCustomCommands() {
			try {
				setLoading(true)
				setError(null)

				const response = await caller("command.list", {})

				// Map API response to SlashCommand format
				const mapped: SlashCommand[] = (response ?? []).map((cmd: CustomCommandResponse) => ({
					id: `custom.${cmd.name}`,
					trigger: cmd.name,
					title: cmd.name,
					description: cmd.description,
					type: "custom" as const,
				}))

				setCustomCommands(mapped)
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err))
				setError(error)
				console.error("Failed to fetch custom commands:", error)
				// On error, set empty array so UI still works
				setCustomCommands([])
			} finally {
				setLoading(false)
			}
		}

		fetchCustomCommands()
	}, [caller])

	// Combine builtin + custom
	const commands = useMemo(() => [...BUILTIN_COMMANDS, ...customCommands], [customCommands])

	/**
	 * Get all slash commands (commands with triggers)
	 * Currently all commands have triggers, but this filters for safety
	 */
	const getSlashCommands = useCallback(() => {
		return commands.filter((cmd) => cmd.trigger)
	}, [commands])

	/**
	 * Find command by trigger string
	 * Case-sensitive match
	 */
	const findCommand = useCallback(
		(trigger: string) => {
			return commands.find((cmd) => cmd.trigger === trigger)
		},
		[commands],
	)

	return {
		commands,
		getSlashCommands,
		findCommand,
		loading,
		error,
	}
}
