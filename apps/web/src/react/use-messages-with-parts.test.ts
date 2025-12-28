/**
 * Unit tests for useMessagesWithParts hook
 *
 * Tests that useMessagesWithParts:
 * 1. Returns messages with their parts combined from store
 * 2. Reacts to store updates (store updated by useMultiServerSSE)
 * 3. Isolates messages by directory
 */

// CRITICAL: Clear any mocks from other test files
import { mock } from "bun:test"
mock.restore()

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, it, expect, beforeEach, afterAll } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { useOpencodeStore, type Message, type Part } from "./store"

const TEST_DIRECTORY = "/test/project"
const TEST_SESSION_ID = "session-123"

// Mock useOpenCode provider (no HTTP needed)
mock.module("./provider", () => ({
	useOpenCode: () => ({
		directory: TEST_DIRECTORY,
		url: "http://localhost:4056",
		ready: true,
		sync: mock(() => Promise.resolve()),
	}),
	OpenCodeProvider: ({ children }: { children: any }) => children,
}))

// Import after mocking
const { useMessagesWithParts } = await import("./use-messages-with-parts")

afterAll(() => {
	mock.restore()
})

describe("useMessagesWithParts", () => {
	beforeEach(() => {
		// Reset store with DirectoryState structure
		useOpencodeStore.setState({
			directories: {
				[TEST_DIRECTORY]: {
					ready: false,
					sessions: [],
					sessionStatus: {},
					sessionLastActivity: {},
					sessionDiff: {},
					todos: {},
					messages: {},
					parts: {},
				},
			},
		})
	})

	it("returns empty array when no messages exist", () => {
		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))
		expect(result.current).toEqual([])
	})

	it("returns messages with their parts combined", () => {
		const store = useOpencodeStore.getState()

		// Add a message
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "user",
					},
				},
			})
		})

		// Add parts for the message
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						content: "Hello",
					},
				},
			})

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-2",
						messageID: "msg-1",
						type: "text",
						content: "World",
					},
				},
			})
		})

		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))

		expect(result.current).toHaveLength(1)
		expect(result.current[0].info.id).toBe("msg-1")
		expect(result.current[0].parts).toHaveLength(2)
		expect(result.current[0].parts[0].id).toBe("part-1")
		expect(result.current[0].parts[1].id).toBe("part-2")
	})

	it("returns messages without parts when no parts exist", () => {
		const store = useOpencodeStore.getState()

		// Add a message without parts
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "assistant",
					},
				},
			})
		})

		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))

		expect(result.current).toHaveLength(1)
		expect(result.current[0].info.id).toBe("msg-1")
		expect(result.current[0].parts).toEqual([])
	})

	it("only returns messages for the specified session", () => {
		const store = useOpencodeStore.getState()

		// Add message for our session
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "user",
					},
				},
			})
		})

		// Add message for different session
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-2",
						sessionID: "other-session",
						role: "user",
					},
				},
			})
		})

		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))

		expect(result.current).toHaveLength(1)
		expect(result.current[0].info.id).toBe("msg-1")
	})

	it("updates reactively when store changes", () => {
		const store = useOpencodeStore.getState()

		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))

		expect(result.current).toHaveLength(0)

		// Add a message
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "user",
					},
				},
			})
		})

		expect(result.current).toHaveLength(1)

		// Add a part
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						content: "Hello",
					},
				},
			})
		})

		expect(result.current[0].parts).toHaveLength(1)
	})

	it("updates parts reactively when they change", () => {
		const store = useOpencodeStore.getState()

		// Add message and initial part
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "assistant",
					},
				},
			})

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						text: "Hello",
					},
				},
			})
		})

		const { result } = renderHook(() => useMessagesWithParts(TEST_SESSION_ID))

		// Access via type assertion since SDK Part is a union type
		expect((result.current[0].parts[0] as any).text).toBe("Hello")

		// Update the part (simulating streaming)
		act(() => {
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						text: "Hello World",
					},
				},
			})
		})

		expect((result.current[0].parts[0] as any).text).toBe("Hello World")
	})
})
