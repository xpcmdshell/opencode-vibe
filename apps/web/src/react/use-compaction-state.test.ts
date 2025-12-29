/**
 * Unit tests for useCompactionState hook
 *
 * Tests that useCompactionState:
 * 1. Returns default state when no compaction in progress
 * 2. Reacts to store updates (store updated by provider's SSE subscription)
 * 3. Returns correct compaction progress states
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
const { useCompactionState } = await import("./use-compaction-state")

afterAll(() => {
	mock.restore()
})

describe("useCompactionState", () => {
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

	it("returns default state when no compaction in progress", () => {
		const { result } = renderHook(() => useCompactionState(sessionId))

		expect(result.current.isCompacting).toBe(false)
		expect(result.current.isAutomatic).toBe(false)
		expect(result.current.progress).toBe("complete")
		expect(result.current.startedAt).toBe(0)
	})

	it("returns compaction state from store", () => {
		// Set compaction state in store
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: true,
								isAutomatic: false,
								startedAt: 1234567890,
								progress: "generating",
							},
						},
					},
				},
			})
		})

		const { result } = renderHook(() => useCompactionState(sessionId))

		expect(result.current.isCompacting).toBe(true)
		expect(result.current.isAutomatic).toBe(false)
		expect(result.current.progress).toBe("generating")
		expect(result.current.startedAt).toBe(1234567890)
	})

	it("reacts to store updates (simulating provider's SSE updates)", () => {
		const { result } = renderHook(() => useCompactionState(sessionId))

		// Initially no compaction
		expect(result.current.isCompacting).toBe(false)
		expect(result.current.progress).toBe("complete")

		// Start compaction
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: true,
								isAutomatic: true,
								startedAt: 1234567890,
								progress: "pending",
							},
						},
					},
				},
			})
		})

		expect(result.current.isCompacting).toBe(true)
		expect(result.current.isAutomatic).toBe(true)
		expect(result.current.progress).toBe("pending")
		expect(result.current.startedAt).toBe(1234567890)

		// Update to generating
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: true,
								isAutomatic: true,
								startedAt: 1234567890,
								progress: "generating",
							},
						},
					},
				},
			})
		})

		expect(result.current.progress).toBe("generating")

		// Complete compaction
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: false,
								isAutomatic: true,
								startedAt: 1234567890,
								progress: "complete",
							},
						},
					},
				},
			})
		})

		expect(result.current.isCompacting).toBe(false)
		expect(result.current.progress).toBe("complete")
	})

	it("returns default state for session without compaction data", () => {
		// Set compaction for one session
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: true,
								isAutomatic: false,
								startedAt: 1234567890,
								progress: "generating",
							},
						},
					},
				},
			})
		})

		// Query different session
		const { result } = renderHook(() => useCompactionState("different-session"))

		expect(result.current.isCompacting).toBe(false)
		expect(result.current.isAutomatic).toBe(false)
		expect(result.current.progress).toBe("complete")
		expect(result.current.startedAt).toBe(0)
	})

	it("handles optional messageId field", () => {
		// Set compaction with messageId
		act(() => {
			useOpencodeStore.setState({
				directories: {
					[TEST_DIR]: {
						...useOpencodeStore.getState().directories[TEST_DIR]!,
						compaction: {
							[sessionId]: {
								isCompacting: true,
								isAutomatic: false,
								startedAt: 1234567890,
								progress: "generating",
								messageId: "msg-123",
							},
						},
					},
				},
			})
		})

		const { result } = renderHook(() => useCompactionState(sessionId))

		expect(result.current.isCompacting).toBe(true)
		// messageId is not exposed in return type, just verifying it doesn't break
	})
})
