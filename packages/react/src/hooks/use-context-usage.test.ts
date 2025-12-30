/**
 * Unit tests for useContextUsage hook
 *
 * Tests that useContextUsage:
 * 1. Returns initial state (no usage data)
 * 2. Returns context usage from store
 * 3. Reacts to store updates
 * 4. Uses useShallow for performance optimization
 * 5. formatTokens helper formats numbers correctly
 *
 * NOTE: SSE subscriptions are handled by OpenCodeProvider, not by this hook.
 * This hook simply reads from the store which is updated automatically.
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, it, expect, beforeEach, vi, afterAll } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOpencodeStore } from "../store"

// Mock useOpenCode provider (no HTTP needed)
mock.module("../providers", () => ({
	useOpenCode: () => ({
		directory: "/test",
		url: "http://localhost:4056",
		ready: true,
		sync: vi.fn(() => Promise.resolve()),
	}),
	OpenCodeProvider: ({ children }: { children: any }) => children,
}))

// Import after mocking
const { useContextUsage, formatTokens } = await import("./use-context-usage")

afterAll(() => {
	mock.restore()
})

describe("useContextUsage", () => {
	const TEST_DIR = "/test"
	const sessionId = "session-123"

	beforeEach(() => {
		// Reset store with DirectoryState structure
		useOpencodeStore.setState({
			directories: {
				[TEST_DIR]: {
					ready: false,
					sessions: [],
					sessionStatus: {},
					sessionLastActivity: {},
					sessionDiff: {},
					todos: {},
					messages: {},
					parts: {},
					contextUsage: {},
					compaction: {},
					modelLimits: {},
				},
			},
		})
	})

	it("returns initial state (no usage data)", () => {
		const { result } = renderHook(() => useContextUsage(sessionId))

		expect(result.current.used).toBe(0)
		expect(result.current.limit).toBe(0)
		expect(result.current.percentage).toBe(0)
		expect(result.current.remaining).toBe(0)
		expect(result.current.isNearLimit).toBe(false)
		expect(result.current.tokens).toEqual({ input: 0, output: 0, cached: 0 })
	})

	it("returns context usage from store", () => {
		// Set context usage in store (as provider would do via handleEvent)
		act(() => {
			useOpencodeStore.setState((state) => {
				state.directories[TEST_DIR]!.contextUsage[sessionId] = {
					used: 50000,
					limit: 200000,
					percentage: 25,
					isNearLimit: false,
					tokens: { input: 30000, output: 15000, cached: 5000 },
					lastUpdated: Date.now(),
				}
			})
		})

		const { result } = renderHook(() => useContextUsage(sessionId))

		expect(result.current.used).toBe(50000)
		expect(result.current.limit).toBe(200000)
		expect(result.current.percentage).toBe(25)
		expect(result.current.remaining).toBe(150000)
		expect(result.current.isNearLimit).toBe(false)
		expect(result.current.tokens).toEqual({
			input: 30000,
			output: 15000,
			cached: 5000,
		})
	})

	it("reacts to store updates (simulating provider's SSE updates)", () => {
		const { result } = renderHook(() => useContextUsage(sessionId))

		// Initially no data
		expect(result.current.used).toBe(0)
		expect(result.current.limit).toBe(0)

		// Simulate store update (as provider would do via handleEvent)
		act(() => {
			useOpencodeStore.setState((state) => {
				state.directories[TEST_DIR]!.contextUsage[sessionId] = {
					used: 100000,
					limit: 200000,
					percentage: 50,
					isNearLimit: false,
					tokens: { input: 60000, output: 30000, cached: 10000 },
					lastUpdated: Date.now(),
				}
			})
		})

		expect(result.current.used).toBe(100000)
		expect(result.current.limit).toBe(200000)
		expect(result.current.percentage).toBe(50)
		expect(result.current.remaining).toBe(100000)

		// Update to near limit
		act(() => {
			useOpencodeStore.setState((state) => {
				state.directories[TEST_DIR]!.contextUsage[sessionId] = {
					used: 180000,
					limit: 200000,
					percentage: 90,
					isNearLimit: true,
					tokens: { input: 120000, output: 50000, cached: 10000 },
					lastUpdated: Date.now(),
				}
			})
		})

		expect(result.current.used).toBe(180000)
		expect(result.current.percentage).toBe(90)
		expect(result.current.isNearLimit).toBe(true)
		expect(result.current.remaining).toBe(20000)
	})

	it("returns initial state for different session ID", () => {
		// Set context usage for one session
		act(() => {
			useOpencodeStore.setState((state) => {
				state.directories[TEST_DIR]!.contextUsage[sessionId] = {
					used: 50000,
					limit: 200000,
					percentage: 25,
					isNearLimit: false,
					tokens: { input: 30000, output: 15000, cached: 5000 },
					lastUpdated: Date.now(),
				}
			})
		})

		// Query different session
		const { result } = renderHook(() => useContextUsage("different-session"))

		expect(result.current.used).toBe(0)
		expect(result.current.limit).toBe(0)
		expect(result.current.percentage).toBe(0)
	})

	it("calculates remaining tokens correctly", () => {
		act(() => {
			useOpencodeStore.setState((state) => {
				state.directories[TEST_DIR]!.contextUsage[sessionId] = {
					used: 75000,
					limit: 100000,
					percentage: 75,
					isNearLimit: true,
					tokens: { input: 50000, output: 20000, cached: 5000 },
					lastUpdated: Date.now(),
				}
			})
		})

		const { result } = renderHook(() => useContextUsage(sessionId))

		expect(result.current.remaining).toBe(25000)
	})
})

describe("formatTokens", () => {
	it("formats numbers < 1000 as-is", () => {
		expect(formatTokens(0)).toBe("0")
		expect(formatTokens(500)).toBe("500")
		expect(formatTokens(999)).toBe("999")
	})

	it("formats thousands with k suffix", () => {
		expect(formatTokens(1000)).toBe("1.0k")
		expect(formatTokens(1500)).toBe("1.5k")
		expect(formatTokens(50000)).toBe("50.0k")
		expect(formatTokens(156000)).toBe("156.0k")
		expect(formatTokens(999999)).toBe("1000.0k")
	})

	it("formats millions with M suffix", () => {
		expect(formatTokens(1000000)).toBe("1.0M")
		expect(formatTokens(1500000)).toBe("1.5M")
		expect(formatTokens(2000000)).toBe("2.0M")
		expect(formatTokens(10500000)).toBe("10.5M")
	})

	it("rounds to 1 decimal place", () => {
		expect(formatTokens(1234)).toBe("1.2k")
		expect(formatTokens(1567)).toBe("1.6k")
		expect(formatTokens(1234567)).toBe("1.2M")
	})
})
