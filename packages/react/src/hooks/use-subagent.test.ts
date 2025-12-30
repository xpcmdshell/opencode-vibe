/**
 * Unit tests for useSubagent hook
 *
 * Tests that useSubagent wraps subagent store selectors correctly:
 * 1. Returns subagent data by partId
 * 2. Returns isExpanded state
 * 3. Returns toggleExpanded action
 * 4. Returns derived values: hasSubagent, isRunning, isCompleted
 */

// CRITICAL: Clear any mocks from other test files
import { mock } from "vitest"
mock.restore()

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSubagentStore } from "../stores/subagent-store"
import type { Message, Part } from "../store"

// Import after DOM setup
const { useSubagent } = await import("./use-subagent")

afterAll(() => {
	mock.restore()
})

describe("useSubagent", () => {
	beforeEach(() => {
		// Reset store state before each test
		useSubagentStore.setState({
			sessions: {},
			partToSession: {},
			expanded: new Set(),
		})
	})

	it("returns undefined subagent when no session registered", () => {
		const { result } = renderHook(() => useSubagent("part-789"))

		expect(result.current.subagent).toBeUndefined()
		expect(result.current.hasSubagent).toBe(false)
		expect(result.current.isRunning).toBe(false)
		expect(result.current.isCompleted).toBe(false)
	})

	it("returns subagent data when session exists", () => {
		// Register a subagent
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		expect(result.current.subagent).toBeDefined()
		expect(result.current.subagent?.id).toBe("child-123")
		expect(result.current.subagent?.parentPartId).toBe("part-789")
		expect(result.current.subagent?.agentName).toBe("TestAgent")
		expect(result.current.hasSubagent).toBe(true)
	})

	it("returns isExpanded state reflecting store", () => {
		// Register a subagent (auto-expands because running)
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Auto-expanded because subagent is running
		expect(result.current.isExpanded).toBe(true)

		// Collapse via store
		act(() => {
			useSubagentStore.getState().toggleExpanded("part-789")
		})

		// Should now be collapsed
		expect(result.current.isExpanded).toBe(false)
	})

	it("toggleExpanded calls store action with correct partId", () => {
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Auto-expanded because running
		expect(result.current.isExpanded).toBe(true)

		// Call toggleExpanded from hook to collapse
		act(() => {
			result.current.toggleExpanded()
		})

		// Should be collapsed in store
		expect(useSubagentStore.getState().isExpanded("part-789")).toBe(false)
		expect(result.current.isExpanded).toBe(false)

		// Toggle again to expand
		act(() => {
			result.current.toggleExpanded()
		})

		// Should be expanded
		expect(useSubagentStore.getState().isExpanded("part-789")).toBe(true)
		expect(result.current.isExpanded).toBe(true)
	})

	it("returns isRunning=true when status is running", () => {
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Default status is "running"
		expect(result.current.isRunning).toBe(true)
		expect(result.current.isCompleted).toBe(false)
	})

	it("returns isCompleted=true when status is completed", () => {
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Change status to completed
		act(() => {
			useSubagentStore.getState().setStatus("child-123", "completed")
		})

		expect(result.current.isRunning).toBe(false)
		expect(result.current.isCompleted).toBe(true)
	})

	it("reacts to store updates for status changes", () => {
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Initially running
		expect(result.current.isRunning).toBe(true)

		// Set to error
		act(() => {
			useSubagentStore.getState().setStatus("child-123", "error")
		})

		expect(result.current.isRunning).toBe(false)
		expect(result.current.isCompleted).toBe(false)
	})

	it("returns different data for different partIds", () => {
		// Register two subagents
		act(() => {
			useSubagentStore.getState().registerSubagent("child-1", "parent-1", "part-1", "Agent1")
			useSubagentStore.getState().registerSubagent("child-2", "parent-2", "part-2", "Agent2")
		})

		const { result: result1 } = renderHook(() => useSubagent("part-1"))
		const { result: result2 } = renderHook(() => useSubagent("part-2"))

		expect(result1.current.subagent?.id).toBe("child-1")
		expect(result1.current.subagent?.agentName).toBe("Agent1")

		expect(result2.current.subagent?.id).toBe("child-2")
		expect(result2.current.subagent?.agentName).toBe("Agent2")
	})

	it("toggleExpanded only affects the specific partId", () => {
		// Register two subagents (both auto-expand because running)
		act(() => {
			useSubagentStore.getState().registerSubagent("child-1", "parent-1", "part-1", "Agent1")
			useSubagentStore.getState().registerSubagent("child-2", "parent-2", "part-2", "Agent2")
		})

		const { result: result1 } = renderHook(() => useSubagent("part-1"))
		const { result: result2 } = renderHook(() => useSubagent("part-2"))

		// Both auto-expanded
		expect(result1.current.isExpanded).toBe(true)
		expect(result2.current.isExpanded).toBe(true)

		// Collapse only part-1
		act(() => {
			result1.current.toggleExpanded()
		})

		expect(result1.current.isExpanded).toBe(false)
		expect(result2.current.isExpanded).toBe(true)
	})

	it("auto-expands when subagent starts running", () => {
		// Register a subagent (default status is "running")
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Should auto-expand because status is "running"
		expect(result.current.isExpanded).toBe(true)
		expect(result.current.isRunning).toBe(true)
	})

	it("stays expanded when subagent completes (user can collapse manually)", () => {
		// Register a subagent (auto-expands)
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Auto-expanded because running
		expect(result.current.isExpanded).toBe(true)
		expect(result.current.isRunning).toBe(true)

		// Subagent completes - stays expanded so user can see results
		act(() => {
			useSubagentStore.getState().setStatus("child-123", "completed")
		})

		expect(result.current.isExpanded).toBe(true)
		expect(result.current.isCompleted).toBe(true)

		// User can manually collapse
		act(() => {
			result.current.toggleExpanded()
		})
		expect(result.current.isExpanded).toBe(false)
	})

	it("auto-expands only once per subagent", () => {
		// Register a subagent
		act(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
		})

		const { result } = renderHook(() => useSubagent("part-789"))

		// Auto-expanded
		expect(result.current.isExpanded).toBe(true)

		// User manually collapses
		act(() => {
			result.current.toggleExpanded()
		})
		expect(result.current.isExpanded).toBe(false)

		// Status changes but should NOT re-expand (user preference respected)
		act(() => {
			useSubagentStore.getState().setStatus("child-123", "completed")
			useSubagentStore.getState().setStatus("child-123", "running")
		})

		// Should still be collapsed (user collapsed it)
		expect(result.current.isExpanded).toBe(false)
	})
})
