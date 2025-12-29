/**
 * useCreateSession Tests - TDD: Caller-based implementation
 *
 * RED phase: Tests define expected behavior after migration to caller pattern
 * Current implementation uses old SDK pattern (tests will FAIL)
 * Next: Implement caller pattern to make tests pass (GREEN)
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { renderHook, waitFor, cleanup } from "@testing-library/react"
import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test"
import { useCreateSession } from "./use-create-session"
import type { Session } from "@opencode-ai/sdk/client"

// Clean up after each test
afterEach(() => {
	cleanup()
	mock.restore()
})

// Mock session data
const mockSession = {
	id: "ses_123",
	title: "Test Session",
	created: Date.now(),
} as unknown as Session

describe("useCreateSession - caller integration", () => {
	beforeEach(() => {
		mock.restore()
	})

	test("should call session.create via caller with title", async () => {
		const mockCaller = mock(async (path: string, input: unknown) => {
			expect(path).toBe("session.create")
			expect(input).toEqual({ title: "My Session" })
			return mockSession
		})

		// Mock useOpenCode to return our test caller
		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result } = renderHook(() => useCreateSession())

		// Initially not creating
		expect(result.current.isCreating).toBe(false)
		expect(result.current.error).toBeNull()

		// Create session with title
		const session = await result.current.createSession("My Session")

		// Should return unwrapped session (no .data access needed)
		expect(session).toEqual(mockSession)
		expect(mockCaller).toHaveBeenCalledTimes(1)
		expect(mockCaller).toHaveBeenCalledWith("session.create", {
			title: "My Session",
		})

		// Should reset loading state
		await waitFor(() => {
			expect(result.current.isCreating).toBe(false)
		})
		expect(result.current.error).toBeNull()
	})

	test("should call session.create via caller without title", async () => {
		const mockCaller = mock(async (path: string, input: unknown) => {
			expect(path).toBe("session.create")
			expect(input).toEqual({}) // No title = empty object
			return mockSession
		})

		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result } = renderHook(() => useCreateSession())

		const session = await result.current.createSession()

		expect(session).toEqual(mockSession)
		expect(mockCaller).toHaveBeenCalledTimes(1)
		expect(mockCaller).toHaveBeenCalledWith("session.create", {})
	})

	test("should handle caller errors", async () => {
		const mockError = new Error("Network error")
		const mockCaller = mock(async () => {
			throw mockError
		})

		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result } = renderHook(() => useCreateSession())

		const session = await result.current.createSession("Test")

		// Should return null on error
		expect(session).toBeNull()

		// Should set error state
		await waitFor(() => {
			expect(result.current.error).toEqual(mockError)
		})
		expect(result.current.isCreating).toBe(false)
	})

	test("should handle non-Error exceptions", async () => {
		const mockCaller = mock(async () => {
			throw "String error"
		})

		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result } = renderHook(() => useCreateSession())

		const session = await result.current.createSession("Test")

		expect(session).toBeNull()

		await waitFor(() => {
			expect(result.current.error).toBeInstanceOf(Error)
			expect(result.current.error?.message).toBe("String error")
		})
	})

	test("should reset error state on subsequent calls", async () => {
		let shouldFail = true
		const mockCaller = mock(async () => {
			if (shouldFail) {
				throw new Error("First call fails")
			}
			return mockSession
		})

		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result } = renderHook(() => useCreateSession())

		// First call fails
		await result.current.createSession("Test")
		await waitFor(() => {
			expect(result.current.error).toBeTruthy()
		})

		// Second call succeeds
		shouldFail = false
		const session = await result.current.createSession("Test 2")

		expect(session).toEqual(mockSession)
		await waitFor(() => {
			expect(result.current.error).toBeNull()
		})
	})

	test("should maintain stable callback reference when directory doesn't change", () => {
		const mockCaller = mock(async () => mockSession)

		mock.module("@/react/provider", () => ({
			useOpenCode: () => ({
				caller: mockCaller,
				directory: "/test/project",
				url: "http://localhost:3000",
				ready: true,
			}),
		}))

		const { result, rerender } = renderHook(() => useCreateSession())

		const firstCallback = result.current.createSession

		// Rerender
		rerender()

		// Callback should be the same reference (thanks to useCallback with [caller] deps)
		expect(result.current.createSession).toBe(firstCallback)
	})
})
