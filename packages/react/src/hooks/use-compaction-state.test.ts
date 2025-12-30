/**
 * Tests for useCompactionState hook
 *
 * NOTE: This hook will be migrated to useSSEState<T> in ADR 008.
 * These tests verify the current implementation's type structure and initial state.
 * Async SSE event tests are intentionally omitted - they're flaky with renderHook.
 * The pure function logic (event filtering, state reduction) is tested in sse-utils.test.ts.
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { useCompactionState } from "./use-compaction-state"
import type { CompactionState } from "./use-compaction-state"

// Mock the multiServerSSE singleton
vi.mock("@opencode-vibe/core/sse", () => {
	return {
		multiServerSSE: {
			start: vi.fn(),
			onEvent: vi.fn(() => () => {}),
			stop: vi.fn(),
		},
	}
})

describe("useCompactionState", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns default state initially", () => {
		const { result } = renderHook(() => useCompactionState({ sessionId: "test-session" }))

		expect(result.current).toEqual({
			isCompacting: false,
			isAutomatic: false,
			progress: "complete",
			startedAt: 0,
		})
	})

	it("returns same default state with directory option", () => {
		const { result } = renderHook(() =>
			useCompactionState({
				sessionId: "test-session",
				directory: "/test/path",
			}),
		)

		expect(result.current).toEqual({
			isCompacting: false,
			isAutomatic: false,
			progress: "complete",
			startedAt: 0,
		})
	})

	it("has correct type structure", () => {
		const { result } = renderHook(() => useCompactionState({ sessionId: "test-session" }))

		const state: CompactionState = result.current

		// Type assertions to ensure types are correct
		expect(typeof state.isCompacting).toBe("boolean")
		expect(typeof state.isAutomatic).toBe("boolean")
		expect(typeof state.startedAt).toBe("number")
		expect(["pending", "generating", "complete"]).toContain(state.progress)
	})
})
