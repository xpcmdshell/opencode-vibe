/**
 * Tests for useMultiServerSSE hook
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { useMultiServerSSE } from "./use-multi-server-sse"
import { useOpencodeStore } from "./store"
import { multiServerSSE } from "@/core/multi-server-sse"

type EventCallback = (event: {
	directory: string
	payload: { type: string; properties: Record<string, unknown> }
}) => void

// Mock the multiServerSSE singleton
const startMock = vi.fn(() => {})
const stopMock = vi.fn(() => {})
const onEventMock = vi.fn((_cb: EventCallback) => vi.fn(() => {}))

Object.assign(multiServerSSE, {
	start: startMock,
	stop: stopMock,
	onEvent: onEventMock,
})

describe("useMultiServerSSE", () => {
	beforeEach(() => {
		// Reset mocks
		startMock.mockClear()
		stopMock.mockClear()
		onEventMock.mockClear()

		// Reset store state
		useOpencodeStore.setState({ directories: {} })
	})

	test("starts multi-server discovery on mount", () => {
		renderHook(() => useMultiServerSSE())

		expect(startMock).toHaveBeenCalled()
		expect(startMock.mock.calls.length).toBe(1)
	})

	test("subscribes to events on mount", () => {
		renderHook(() => useMultiServerSSE())

		expect(onEventMock).toHaveBeenCalled()
		expect(onEventMock.mock.calls.length).toBe(1)
		expect(typeof onEventMock.mock.calls[0]![0]).toBe("function")
	})

	test("initializes directory when event arrives", async () => {
		let eventCallback: EventCallback | undefined

		// Capture the callback passed to onEvent
		onEventMock.mockImplementation((cb: EventCallback) => {
			eventCallback = cb
			return vi.fn(() => {})
		})

		renderHook(() => useMultiServerSSE())

		// Simulate event
		const event = {
			directory: "/test/project",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-123",
					status: { type: "busy" },
				},
			},
		}

		eventCallback?.(event)

		await waitFor(() => {
			const state = useOpencodeStore.getState()
			expect(state.directories["/test/project"]).toBeDefined()
		})
	})

	test("updates store with session status via handleEvent", async () => {
		let eventCallback: EventCallback | undefined

		onEventMock.mockImplementation((cb: EventCallback) => {
			eventCallback = cb
			return vi.fn(() => {})
		})

		renderHook(() => useMultiServerSSE())

		const event = {
			directory: "/test/project",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-123",
					status: { type: "busy" },
				},
			},
		}

		eventCallback?.(event)

		await waitFor(() => {
			const state = useOpencodeStore.getState()
			expect(state.directories["/test/project"]?.sessionStatus["session-123"]).toBe("running")
		})
	})

	test("handles multiple events for different sessions", async () => {
		let eventCallback: EventCallback | undefined

		onEventMock.mockImplementation((cb: EventCallback) => {
			eventCallback = cb
			return vi.fn(() => {})
		})

		renderHook(() => useMultiServerSSE())

		// First event - session 1 running
		eventCallback?.({
			directory: "/test/project",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-1",
					status: { type: "busy" },
				},
			},
		})

		// Second event - session 2 completed
		eventCallback?.({
			directory: "/test/project",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-2",
					status: { type: "idle" },
				},
			},
		})

		await waitFor(() => {
			const state = useOpencodeStore.getState()
			expect(state.directories["/test/project"]?.sessionStatus["session-1"]).toBe("running")
			expect(state.directories["/test/project"]?.sessionStatus["session-2"]).toBe("completed")
		})
	})

	test("handles events across multiple directories", async () => {
		let eventCallback: EventCallback | undefined

		onEventMock.mockImplementation((cb: EventCallback) => {
			eventCallback = cb
			return vi.fn(() => {})
		})

		renderHook(() => useMultiServerSSE())

		// Event for project A
		eventCallback?.({
			directory: "/project-a",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-a",
					status: { type: "busy" },
				},
			},
		})

		// Event for project B
		eventCallback?.({
			directory: "/project-b",
			payload: {
				type: "session.status",
				properties: {
					sessionID: "session-b",
					status: { type: "idle" },
				},
			},
		})

		await waitFor(() => {
			const state = useOpencodeStore.getState()
			expect(state.directories["/project-a"]?.sessionStatus["session-a"]).toBe("running")
			expect(state.directories["/project-b"]?.sessionStatus["session-b"]).toBe("completed")
		})
	})

	test("unsubscribes on unmount but keeps singleton running", () => {
		const unsubscribeMock = vi.fn(() => {})
		onEventMock.mockReturnValue(unsubscribeMock)

		const { unmount } = renderHook(() => useMultiServerSSE())

		unmount()

		// Should unsubscribe this component's callback
		expect(unsubscribeMock).toHaveBeenCalled()
		// But NOT stop the singleton - other components may need it
		expect(stopMock).not.toHaveBeenCalled()
	})

	test("only sets up subscription once (stable across re-renders)", () => {
		const { rerender } = renderHook(() => useMultiServerSSE())

		const initialStartCalls = startMock.mock.calls.length
		const initialOnEventCalls = onEventMock.mock.calls.length

		expect(initialStartCalls).toBe(1)
		expect(initialOnEventCalls).toBe(1)

		// Trigger re-render
		rerender()

		// Should not call again
		expect(startMock.mock.calls.length).toBe(initialStartCalls)
		expect(onEventMock.mock.calls.length).toBe(initialOnEventCalls)
	})
})
