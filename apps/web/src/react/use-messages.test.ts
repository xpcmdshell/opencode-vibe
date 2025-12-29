/**
 * Unit tests for useMessages hook
 *
 * Tests that useMessages:
 * 1. Returns messages from store for a session
 * 2. Reacts to store updates (store updated by provider's SSE subscription)
 *
 * NOTE: SSE subscriptions are handled by OpenCodeProvider, not by this hook.
 * This hook simply reads from the store which is updated automatically.
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
import { useOpencodeStore, type Message } from "./store"

// Mock useOpenCode provider (no HTTP needed)
mock.module("./provider", () => ({
	useOpenCode: () => ({
		directory: "/test",
		url: "http://localhost:4056",
		ready: true,
		sync: mock(() => Promise.resolve()),
	}),
	OpenCodeProvider: ({ children }: { children: any }) => children,
}))

// Import after mocking
const { useMessages } = await import("./use-messages")

afterAll(() => {
	mock.restore()
})

describe("useMessages", () => {
	const TEST_DIR = "/test"
	const sessionId = "session-123"

	const testMessage1: Message = {
		id: "msg-001",
		sessionID: sessionId,
		role: "user",
		time: { created: Date.now() - 1000 },
	}

	const testMessage2: Message = {
		id: "msg-002",
		sessionID: sessionId,
		role: "assistant",
		time: { created: Date.now() },
	}

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

	it("returns empty array when no messages in store", () => {
		const { result } = renderHook(() => useMessages(sessionId))
		expect(result.current).toEqual([])
	})

	it("returns messages from store for session", () => {
		// Add messages to store
		act(() => {
			useOpencodeStore.getState().addMessage(TEST_DIR, testMessage1)
			useOpencodeStore.getState().addMessage(TEST_DIR, testMessage2)
		})

		const { result } = renderHook(() => useMessages(sessionId))
		expect(result.current).toHaveLength(2)
		expect(result.current[0]).toEqual(testMessage1)
		expect(result.current[1]).toEqual(testMessage2)
	})

	it("reacts to store updates (simulating provider's SSE updates)", () => {
		const { result } = renderHook(() => useMessages(sessionId))

		// Initially empty
		expect(result.current).toHaveLength(0)

		// Simulate store update (as provider would do via handleEvent)
		act(() => {
			useOpencodeStore.getState().addMessage(TEST_DIR, testMessage1)
		})

		// Message should appear
		expect(result.current).toHaveLength(1)
		expect(result.current[0]).toEqual(testMessage1)
	})

	it("returns updated messages from store after manual update", () => {
		act(() => {
			useOpencodeStore.getState().addMessage(TEST_DIR, testMessage1)
		})

		const { result } = renderHook(() => useMessages(sessionId))

		// Manually update store
		act(() => {
			useOpencodeStore
				.getState()
				.updateMessage(TEST_DIR, sessionId, testMessage1.id, (draft: Message) => {
					draft.role = "system"
				})
		})

		expect(result.current[0].role).toBe("system")
	})

	it("returns empty array for sessions with no messages", () => {
		act(() => {
			useOpencodeStore.getState().addMessage(TEST_DIR, testMessage1)
		})

		const { result } = renderHook(() => useMessages("different-session"))
		expect(result.current).toEqual([])
	})

	it("returns stable empty array reference when no messages", () => {
		const { result, rerender } = renderHook(() => useMessages(sessionId))

		const firstEmptyArray = result.current
		expect(firstEmptyArray).toEqual([])

		rerender()

		const secondEmptyArray = result.current
		// Should be the same reference (EMPTY_MESSAGES constant)
		expect(secondEmptyArray).toBe(firstEmptyArray)
	})
})
