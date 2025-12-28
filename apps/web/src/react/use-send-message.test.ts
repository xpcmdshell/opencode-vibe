// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, test, mock, beforeEach } from "bun:test"
import { useSendMessage } from "./use-send-message"
import { createClient } from "@/core/client"
import type { Prompt } from "@/types/prompt"

// Mock the client module
mock.module("@/core/client", () => ({
	createClient: mock(() => ({
		session: {
			prompt: mock(async () => ({ data: {}, error: undefined })),
		},
	})),
}))

describe("useSendMessage", () => {
	beforeEach(() => {
		mock.restore()
	})

	test("returns sendMessage function, isLoading, and error state", () => {
		const { result } = renderHook(() =>
			useSendMessage({ sessionId: "ses_test", directory: "/test" }),
		)

		expect(result.current.sendMessage).toBeFunction()
		expect(result.current.isLoading).toBe(false)
		expect(result.current.error).toBeUndefined()
	})

	test("converts prompt parts to API format and sends", async () => {
		const mockPrompt = mock(async () => ({ data: {}, error: undefined }))
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() =>
			useSendMessage({ sessionId: "ses_123", directory: "/test" }),
		)

		const parts: Prompt = [
			{ type: "text", content: "Fix bug in ", start: 0, end: 11 },
			{
				type: "file",
				path: "src/auth.ts",
				content: "@src/auth.ts",
				start: 11,
				end: 23,
			},
		]
		await result.current.sendMessage(parts)

		expect(mockPrompt).toHaveBeenCalledTimes(1)
		// Verify API format conversion
		expect(mockPrompt).toHaveBeenCalledWith(
			expect.objectContaining({
				path: { id: "ses_123" },
				body: expect.objectContaining({
					parts: expect.arrayContaining([
						expect.objectContaining({
							type: "text",
							text: "Fix bug in ",
							id: expect.any(String),
						}),
						expect.objectContaining({
							type: "file",
							mime: "text/plain",
							url: "file:///test/src/auth.ts",
							filename: "auth.ts",
						}),
					]),
				}),
			}),
		)
	})

	test("sets isLoading to true during send, false after", async () => {
		const mockPrompt = mock(
			async () =>
				new Promise((resolve) => setTimeout(() => resolve({ data: {}, error: undefined }), 100)),
		)
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		expect(result.current.isLoading).toBe(false)

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]
		const sendPromise = result.current.sendMessage(parts)

		// Should be loading immediately
		await waitFor(() => {
			expect(result.current.isLoading).toBe(true)
		})

		await sendPromise

		// Should not be loading after completion
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})
	})

	test("sets error state when API call fails", async () => {
		const mockError = new Error("Network error")
		const mockPrompt = mock(async () => {
			throw mockError
		})
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]
		// Catch the error since sendMessage re-throws it
		try {
			await result.current.sendMessage(parts)
		} catch (err) {
			// Expected to throw
		}

		await waitFor(() => {
			expect(result.current.error).toBe(mockError)
		})
	})

	test("handles empty prompt array", async () => {
		const mockPrompt = mock(async () => ({ data: {}, error: undefined }))
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const emptyParts: Prompt = []
		await result.current.sendMessage(emptyParts)

		expect(mockPrompt).toHaveBeenCalledTimes(0)
	})

	test("creates new client when directory changes", async () => {
		const createClientMock = mock((dir?: string, sessionId?: string) => ({
			session: {
				prompt: mock(async () => ({ data: {}, error: undefined })),
			},
		}))

		mock.module("@/core/client", () => ({
			createClient: createClientMock,
		}))

		const { result, rerender } = renderHook(
			({ directory }) => useSendMessage({ sessionId: "ses_123", directory }),
			{ initialProps: { directory: "/dir1" } },
		)

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]
		await result.current.sendMessage(parts)
		expect(createClientMock).toHaveBeenCalledWith("/dir1", "ses_123")

		// Change directory
		rerender({ directory: "/dir2" })

		await result.current.sendMessage(parts)
		expect(createClientMock).toHaveBeenCalledWith("/dir2", "ses_123")
	})

	test("handles SDK response with error property", async () => {
		const mockPrompt = mock(async () => ({
			data: null,
			error: { message: "API error", code: 500 },
		}))
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]
		try {
			await result.current.sendMessage(parts)
		} catch (err) {
			// Expected to throw
			expect(err).toBeInstanceOf(Error)
			expect((err as Error).message).toBe("API error")
		}

		await waitFor(() => {
			expect(result.current.error).toBeDefined()
			expect(result.current.error?.message).toBe("API error")
		})
	})

	test("clears error on subsequent successful send", async () => {
		let shouldFail = true
		const mockPrompt = mock(async () => {
			if (shouldFail) {
				throw new Error("First attempt fails")
			}
			return { data: {}, error: undefined }
		})
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]

		// First attempt fails
		try {
			await result.current.sendMessage(parts)
		} catch (err) {
			// Expected
		}

		await waitFor(() => {
			expect(result.current.error).toBeDefined()
		})

		// Second attempt succeeds
		shouldFail = false
		await result.current.sendMessage(parts)

		await waitFor(() => {
			expect(result.current.error).toBeUndefined()
		})
	})

	test("queues messages when busy and processes them in order", async () => {
		const callOrder: string[] = []
		let resolveFirst: () => void
		const firstPromise = new Promise<void>((resolve) => {
			resolveFirst = resolve
		})

		const mockPrompt = mock(async (args: { body: { parts: Array<{ text?: string }> } }) => {
			const text = args.body.parts[0]?.text || "unknown"
			if (text === "first") {
				await firstPromise
			}
			callOrder.push(text)
			return { data: {}, error: undefined }
		})
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const first: Prompt = [{ type: "text", content: "first", start: 0, end: 5 }]
		const second: Prompt = [{ type: "text", content: "second", start: 0, end: 6 }]
		const third: Prompt = [{ type: "text", content: "third", start: 0, end: 5 }]

		// Send first message (will block)
		const firstSend = result.current.sendMessage(first)

		// Wait for first to start processing
		await waitFor(() => {
			expect(result.current.isLoading).toBe(true)
		})

		// Queue second and third while first is processing
		const secondSend = result.current.sendMessage(second)
		const thirdSend = result.current.sendMessage(third)

		// Check queue length - includes first (still processing) + second + third
		await waitFor(() => {
			expect(result.current.queueLength).toBe(3)
		})

		// Release first message
		resolveFirst!()

		// Wait for all to complete
		await Promise.all([firstSend, secondSend, thirdSend])

		// Verify order
		expect(callOrder).toEqual(["first", "second", "third"])

		// Wait for state to update
		await waitFor(() => {
			expect(result.current.queueLength).toBe(0)
			expect(result.current.isLoading).toBe(false)
		})
	})

	test("exposes queue length for UI feedback", async () => {
		let resolvePrompt: () => void
		const blockingPromise = new Promise<void>((resolve) => {
			resolvePrompt = resolve
		})

		const mockPrompt = mock(async () => {
			await blockingPromise
			return { data: {}, error: undefined }
		})
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		expect(result.current.queueLength).toBe(0)

		const parts: Prompt = [{ type: "text", content: "Test", start: 0, end: 4 }]

		// Start first message
		const firstSend = result.current.sendMessage(parts)
		await waitFor(() => expect(result.current.isLoading).toBe(true))

		// Queue more - first is still in queue being processed, so total = 3
		const secondSend = result.current.sendMessage(parts)
		const thirdSend = result.current.sendMessage(parts)

		await waitFor(() => {
			expect(result.current.queueLength).toBe(3)
		})

		// Release and let queue drain
		resolvePrompt!()
		await Promise.all([firstSend, secondSend, thirdSend])

		await waitFor(() => {
			expect(result.current.queueLength).toBe(0)
			expect(result.current.isLoading).toBe(false)
		})
	})

	test("continues processing queue even if one message fails", async () => {
		const callOrder: string[] = []
		let shouldFail = false

		const mockPrompt = mock(async (args: { body: { parts: Array<{ text?: string }> } }) => {
			const text = args.body.parts[0]?.text || "unknown"
			callOrder.push(text)
			if (shouldFail && text === "second") {
				throw new Error("Second message failed")
			}
			return { data: {}, error: undefined }
		})
		const mockClient = {
			session: { prompt: mockPrompt },
		}
		mock.module("@/core/client", () => ({
			createClient: mock(() => mockClient),
		}))

		const { result } = renderHook(() => useSendMessage({ sessionId: "ses_123" }))

		const first: Prompt = [{ type: "text", content: "first", start: 0, end: 5 }]
		const second: Prompt = [{ type: "text", content: "second", start: 0, end: 6 }]
		const third: Prompt = [{ type: "text", content: "third", start: 0, end: 5 }]

		// Send first, then queue second (will fail) and third
		await result.current.sendMessage(first)

		shouldFail = true
		const secondSend = result.current.sendMessage(second)
		const thirdSend = result.current.sendMessage(third)

		// Second will fail but third should still process
		try {
			await secondSend
		} catch {
			// Expected
		}
		await thirdSend

		// All three should have been attempted
		expect(callOrder).toEqual(["first", "second", "third"])
	})
})
