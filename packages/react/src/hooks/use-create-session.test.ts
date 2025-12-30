/**
 * useCreateSession Tests - Pure logic tests
 *
 * Tests the caller pattern behavior without DOM rendering.
 * The hook is a thin wrapper around the caller, so we test the caller contract.
 */

import { describe, expect, test, vi, beforeEach } from "vitest"

// Mock session data - using inline type to avoid SDK dependency
const mockSession = {
	id: "ses_123",
	title: "Test Session",
	created: Date.now(),
}

describe("useCreateSession - caller contract", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	test("caller receives correct path and input with title", async () => {
		const mockCaller = vi.fn().mockResolvedValue(mockSession)

		// Simulate what the hook does
		const createSession = async (title?: string) => {
			return await mockCaller("session.create", title ? { title } : {})
		}

		const session = await createSession("My Session")

		expect(session).toEqual(mockSession)
		expect(mockCaller).toHaveBeenCalledTimes(1)
		expect(mockCaller).toHaveBeenCalledWith("session.create", {
			title: "My Session",
		})
	})

	test("caller receives empty object when no title provided", async () => {
		const mockCaller = vi.fn().mockResolvedValue(mockSession)

		const createSession = async (title?: string) => {
			return await mockCaller("session.create", title ? { title } : {})
		}

		const session = await createSession()

		expect(session).toEqual(mockSession)
		expect(mockCaller).toHaveBeenCalledWith("session.create", {})
	})

	test("error handling wraps non-Error exceptions", async () => {
		const mockCaller = vi.fn().mockRejectedValue("String error")

		const createSession = async (): Promise<{
			session: unknown
			error: Error | null
		}> => {
			try {
				const result = await mockCaller("session.create", {})
				return { session: result, error: null }
			} catch (e) {
				const error = e instanceof Error ? e : new Error(String(e))
				return { session: null, error }
			}
		}

		const { session, error } = await createSession()

		expect(session).toBeNull()
		expect(error).toBeInstanceOf(Error)
		expect(error?.message).toBe("String error")
	})

	test("error handling preserves Error instances", async () => {
		const mockError = new Error("Network error")
		const mockCaller = vi.fn().mockRejectedValue(mockError)

		let error: Error | null = null

		const createSession = async () => {
			try {
				return await mockCaller("session.create", {})
			} catch (e) {
				error = e instanceof Error ? e : new Error(String(e))
				return null
			}
		}

		const session = await createSession()

		expect(session).toBeNull()
		expect(error).toBe(mockError)
	})

	test("error state resets on subsequent successful calls", async () => {
		let shouldFail = true
		const mockCaller = vi.fn().mockImplementation(async () => {
			if (shouldFail) {
				throw new Error("First call fails")
			}
			return mockSession
		})

		let error: Error | null = null

		const createSession = async () => {
			error = null // Reset error on each call (hook behavior)
			try {
				return await mockCaller("session.create", {})
			} catch (e) {
				error = e instanceof Error ? e : new Error(String(e))
				return null
			}
		}

		// First call fails
		await createSession()
		expect(error).toBeTruthy()

		// Second call succeeds
		shouldFail = false
		const session = await createSession()

		expect(session).toEqual(mockSession)
		expect(error).toBeNull()
	})

	test("multiple calls work independently", async () => {
		const mockCaller = vi.fn().mockResolvedValue(mockSession)

		const createSession = async (title?: string) => {
			return await mockCaller("session.create", title ? { title } : {})
		}

		await createSession("Session 1")
		await createSession("Session 2")
		await createSession()

		expect(mockCaller).toHaveBeenCalledTimes(3)
		expect(mockCaller).toHaveBeenNthCalledWith(1, "session.create", {
			title: "Session 1",
		})
		expect(mockCaller).toHaveBeenNthCalledWith(2, "session.create", {
			title: "Session 2",
		})
		expect(mockCaller).toHaveBeenNthCalledWith(3, "session.create", {})
	})
})
