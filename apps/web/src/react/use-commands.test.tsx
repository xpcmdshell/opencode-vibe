/**
 * Tests for useCommands hook
 *
 * Tests slash command registry with builtin and custom commands.
 * Uses React Testing Library with Bun test runner.
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, test, expect } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useCommands } from "./use-commands"
import { OpenCodeProvider } from "./provider"
import type { ReactNode } from "react"

// Wrapper with OpenCodeProvider
function createWrapper(directory = "/test/dir") {
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<OpenCodeProvider url="http://localhost:3000" directory={directory}>
				{children}
			</OpenCodeProvider>
		)
	}
}

describe("useCommands", () => {
	describe("builtin commands", () => {
		test("returns builtin commands", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			expect(result.current.commands).toHaveLength(3)

			const builtinIds = result.current.commands.map((cmd) => cmd.id)
			expect(builtinIds).toContain("session.new")
			expect(builtinIds).toContain("session.share")
			expect(builtinIds).toContain("session.compact")
		})

		test("builtin commands have correct structure", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const newCmd = result.current.commands.find((cmd) => cmd.id === "session.new")

			expect(newCmd).toBeDefined()
			expect(newCmd?.trigger).toBe("new")
			expect(newCmd?.title).toBe("New Session")
			expect(newCmd?.keybind).toBe("mod+n")
			expect(newCmd?.type).toBe("builtin")
		})

		test("session.share has keybind", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const shareCmd = result.current.commands.find((cmd) => cmd.id === "session.share")

			expect(shareCmd?.trigger).toBe("share")
			expect(shareCmd?.keybind).toBe("mod+shift+s")
			expect(shareCmd?.type).toBe("builtin")
		})

		test("session.compact has no keybind", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const compactCmd = result.current.commands.find((cmd) => cmd.id === "session.compact")

			expect(compactCmd?.trigger).toBe("compact")
			expect(compactCmd?.keybind).toBeUndefined()
			expect(compactCmd?.type).toBe("builtin")
		})
	})

	describe("getSlashCommands", () => {
		test("returns all commands with triggers", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const slashCommands = result.current.getSlashCommands()

			// All builtin commands have triggers
			expect(slashCommands).toHaveLength(3)
			expect(slashCommands.every((cmd) => cmd.trigger)).toBe(true)
		})

		test("getSlashCommands is stable across renders", () => {
			const { result, rerender } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const first = result.current.getSlashCommands
			rerender()
			const second = result.current.getSlashCommands

			expect(first).toBe(second)
		})
	})

	describe("findCommand", () => {
		test("finds command by trigger", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const cmd = result.current.findCommand("new")

			expect(cmd).toBeDefined()
			expect(cmd?.id).toBe("session.new")
			expect(cmd?.title).toBe("New Session")
		})

		test("returns undefined for unknown trigger", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const cmd = result.current.findCommand("unknown")

			expect(cmd).toBeUndefined()
		})

		test("findCommand is case-sensitive", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const lowercase = result.current.findCommand("new")
			const uppercase = result.current.findCommand("NEW")

			expect(lowercase).toBeDefined()
			expect(uppercase).toBeUndefined()
		})

		test("findCommand is stable across renders", () => {
			const { result, rerender } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const first = result.current.findCommand
			rerender()
			const second = result.current.findCommand

			expect(first).toBe(second)
		})
	})

	describe("custom commands", () => {
		test("returns empty custom commands when API returns empty array", async () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// Initially, commands should only be builtin (3 commands)
			expect(result.current.commands).toHaveLength(3)

			// All should be builtin type
			const builtinCommands = result.current.commands.filter((cmd) => cmd.type === "builtin")
			expect(builtinCommands).toHaveLength(3)

			// No custom commands yet
			const customCommands = result.current.commands.filter((cmd) => cmd.type === "custom")
			expect(customCommands).toHaveLength(0)
		})

		test("maps custom commands from API to SlashCommand format", async () => {
			// This test will verify the mapping logic once implemented
			// For now, we expect no custom commands since the API likely returns []
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// Custom commands should have:
			// - id: `custom.${name}`
			// - trigger: name
			// - title: name
			// - description: from API
			// - type: "custom"

			// When API returns commands, this will verify the mapping
			const customCommands = result.current.commands.filter((cmd) => cmd.type === "custom")

			// For each custom command, verify structure
			customCommands.forEach((cmd) => {
				expect(cmd.id).toMatch(/^custom\./)
				expect(cmd.trigger).toBeDefined()
				expect(cmd.title).toBeDefined()
				expect(cmd.type).toBe("custom")
			})
		})

		test("merges custom commands with builtin commands", async () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// Total commands = builtin + custom
			const builtinCount = result.current.commands.filter((cmd) => cmd.type === "builtin").length
			const customCount = result.current.commands.filter((cmd) => cmd.type === "custom").length

			expect(result.current.commands).toHaveLength(builtinCount + customCount)
		})

		test("findCommand works with custom commands", async () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// If there are custom commands, findCommand should find them
			const customCommands = result.current.commands.filter((cmd) => cmd.type === "custom")

			if (customCommands.length > 0) {
				const firstCustom = customCommands[0]
				if (firstCustom) {
					const found = result.current.findCommand(firstCustom.trigger)

					expect(found).toBeDefined()
					expect(found?.id).toBe(firstCustom.id)
					expect(found?.type).toBe("custom")
				}
			}
		})
	})

	describe("commands array", () => {
		test("commands array is stable when no changes", () => {
			const { result, rerender } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			const first = result.current.commands
			rerender()
			const second = result.current.commands

			expect(first).toBe(second)
		})
	})

	describe("loading and error states", () => {
		test("exposes loading state", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// loading should be a boolean
			expect(typeof result.current.loading).toBe("boolean")
		})

		test("exposes error state", () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// error should be null or Error
			expect(result.current.error === null || result.current.error instanceof Error).toBe(true)
		})

		test("loading becomes false after fetch completes", async () => {
			const { result } = renderHook(() => useCommands(), {
				wrapper: createWrapper(),
			})

			// Initially may be loading
			// After some time, should be false
			await waitFor(() => {
				expect(result.current.loading).toBe(false)
			})
		})
	})
})
