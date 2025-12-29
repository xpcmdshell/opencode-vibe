/**
 * Unit tests for useSession hook
 *
 * Tests that useSession:
 * 1. Returns session from store
 * 2. Reacts to store updates (store updated by provider's SSE subscription)
 * 3. Re-exports useSessionList from atoms/sessions.ts (Phase 3b)
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
import { useOpencodeStore } from "./store"
import type { Session } from "./store"

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
const { useSession, useSessionList } = await import("./use-session")

afterAll(() => {
	mock.restore()
})

describe("useSession", () => {
	const TEST_DIR = "/test"
	const testSession: Session = {
		id: "session-123",
		title: "Test Session",
		directory: TEST_DIR,
		time: {
			created: Date.now(),
			updated: Date.now(),
		},
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

	it("returns undefined when session not in store", () => {
		const { result } = renderHook(() => useSession("nonexistent"))
		expect(result.current).toBeUndefined()
	})

	it("returns session from store", () => {
		// Add session to store
		act(() => {
			useOpencodeStore.getState().addSession(TEST_DIR, testSession)
		})

		const { result } = renderHook(() => useSession("session-123"))
		expect(result.current).toEqual(testSession)
	})

	it("reacts to store updates (simulating provider's SSE updates)", () => {
		// Add initial session
		act(() => {
			useOpencodeStore.getState().addSession(TEST_DIR, testSession)
		})

		const { result } = renderHook(() => useSession("session-123"))

		// Verify initial state
		expect(result.current?.title).toBe("Test Session")

		// Simulate store update (as provider would do via handleEvent)
		const updatedSession = {
			...testSession,
			title: "Updated Title",
			time: { ...testSession.time, updated: Date.now() + 1000 },
		}

		act(() => {
			useOpencodeStore.getState().addSession(TEST_DIR, updatedSession)
		})

		// Session should be updated
		expect(result.current?.title).toBe("Updated Title")
	})

	it("returns updated session from store after manual update", () => {
		act(() => {
			useOpencodeStore.getState().addSession(TEST_DIR, testSession)
		})

		const { result } = renderHook(() => useSession("session-123"))

		// Manually update store
		act(() => {
			useOpencodeStore.getState().updateSession(TEST_DIR, "session-123", (draft: Session) => {
				draft.title = "Manually Updated"
			})
		})

		expect(result.current?.title).toBe("Manually Updated")
	})

	it("returns undefined for different session IDs", () => {
		act(() => {
			useOpencodeStore.getState().addSession(TEST_DIR, testSession)
		})

		const { result } = renderHook(() => useSession("different-session"))
		expect(result.current).toBeUndefined()
	})

	it("re-exports useSessionList from atoms/sessions.ts", () => {
		// Verify that useSessionList is exported and is a function
		expect(useSessionList).toBeDefined()
		expect(typeof useSessionList).toBe("function")
	})
})
