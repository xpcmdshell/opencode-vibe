/**
 * Unit tests for useSessionStatus hook
 *
 * Tests that useSessionStatus:
 * 1. Returns initial state (not running, loading)
 * 2. Reacts to store updates (store updated by provider's SSE subscription)
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

import { describe, it, expect, beforeEach, mock, afterAll } from "bun:test"
import { renderHook, act } from "@testing-library/react"
import { useOpencodeStore } from "./store"

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
const { useSessionStatus } = await import("./use-session-status")

afterAll(() => {
	mock.restore()
})

describe("useSessionStatus", () => {
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
				},
			},
		})
	})

	it("returns initial state (not running, loading)", () => {
		const { result } = renderHook(() => useSessionStatus(sessionId))

		expect(result.current.running).toBe(false)
		expect(result.current.isLoading).toBe(true)
	})

	it("returns running state from store", () => {
		// Set status in store (as provider would do via handleEvent)
		act(() => {
			useOpencodeStore.getState().handleEvent(TEST_DIR, {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { running: true },
				},
			})
		})

		const { result } = renderHook(() => useSessionStatus(sessionId))

		expect(result.current.running).toBe(true)
		expect(result.current.isLoading).toBe(false)
	})

	it("reacts to store updates (simulating provider's SSE updates)", () => {
		const { result } = renderHook(() => useSessionStatus(sessionId))

		// Initially loading
		expect(result.current.running).toBe(false)
		expect(result.current.isLoading).toBe(true)

		// Simulate store update (as provider would do via handleEvent)
		act(() => {
			useOpencodeStore.getState().handleEvent(TEST_DIR, {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { running: true },
				},
			})
		})

		expect(result.current.running).toBe(true)
		expect(result.current.isLoading).toBe(false)

		// Update to not running
		act(() => {
			useOpencodeStore.getState().handleEvent(TEST_DIR, {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { running: false },
				},
			})
		})

		expect(result.current.running).toBe(false)
		expect(result.current.isLoading).toBe(false)
	})

	it("returns loading state for different session ID", () => {
		// Set status for one session
		act(() => {
			useOpencodeStore.getState().handleEvent(TEST_DIR, {
				type: "session.status",
				properties: {
					sessionID: sessionId,
					status: { running: true },
				},
			})
		})

		// Query different session
		const { result } = renderHook(() => useSessionStatus("different-session"))

		expect(result.current.running).toBe(false)
		expect(result.current.isLoading).toBe(true)
	})
})
