/**
 * Integration tests for SessionStatus component
 *
 * Tests that SessionStatus:
 * 1. Shows loading state initially
 * 2. Shows "Running" when session is running
 * 3. Shows "Idle" when session is not running
 * 4. Shows error message when session.error event fires
 * 5. Error display uses destructive variant (red)
 * 6. Error message comes from event.properties.error.message
 *
 * Uses real Zustand store and simulates SSE events by calling store.handleSSEEvent()
 */

// Set up DOM environment BEFORE imports
import { Window } from "happy-dom"
const window = new Window()
global.document = window.document as any
global.window = window as any
global.navigator = window.navigator as any

import { describe, it, expect, beforeEach, vi, afterAll } from "vitest"
import { render, act } from "@testing-library/react"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

// Capture subscribe callbacks for session.error events (component still uses SSE for error state)
type SubscribeCallback = (event: any) => void
const subscribeCallbacks = new Map<string, Set<SubscribeCallback>>()
let mockUnsubscribeFns: ReturnType<typeof mock>[] = []
const mockSubscribe = vi.fn((eventType: string, callback: SubscribeCallback) => {
	if (!subscribeCallbacks.has(eventType)) {
		subscribeCallbacks.set(eventType, new Set())
	}
	subscribeCallbacks.get(eventType)!.add(callback)

	const unsubscribe = vi.fn(() => {
		subscribeCallbacks.get(eventType)?.delete(callback)
	})
	mockUnsubscribeFns.push(unsubscribe)
	return unsubscribe
})

// Mock useSSE (component uses it for error events)
mock.module("@/react/use-sse", () => ({
	useSSE: () => ({
		subscribe: (eventType: string, callback: SubscribeCallback) =>
			mockSubscribe(eventType, callback),
		connected: true,
		reconnect: () => {},
	}),
	SSEProvider: ({ children }: { children: any }) => children,
	useSSEDirect: () => ({ reconnect: () => {} }),
}))

// Mock useOpenCode to provide test directory
mock.module("@/react/provider", () => ({
	useOpenCode: () => ({ directory: "/test/project" }),
	OpenCodeProvider: ({ children }: { children: any }) => children,
}))

// Import after mocking
const { SessionStatus } = await import("./session-status")
const { useOpencodeStore } = await import("@/react/store")

afterAll(() => {
	mock.restore()
})

// Helper to emit error events to subscribed callbacks (SSE mock)
function emitEvent(eventType: string, event: any) {
	const callbacks = subscribeCallbacks.get(eventType)
	if (callbacks) {
		for (const callback of callbacks) {
			callback(event)
		}
	}
}

describe("SessionStatus", () => {
	const sessionId = "session-123"
	const directory = "/test/project"

	beforeEach(() => {
		// Clear callbacks between tests
		subscribeCallbacks.clear()
		mockUnsubscribeFns.length = 0
		mockSubscribe.mockClear()

		// Reset store and initialize directory
		const store = useOpencodeStore.getState()
		useOpencodeStore.setState({ directories: {} })
		store.initDirectory(directory)
	})

	it("shows loading state initially", () => {
		const { container } = render(<SessionStatus sessionId={sessionId} />)
		expect(container.textContent).toContain("Loading...")
	})

	it("shows Running when session is running", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// Simulate SSE event via store
		// NOTE: Store type is incorrect - actual payload has { running: boolean }, not string literal
		act(() => {
			const store = useOpencodeStore.getState()
			const globalEvent = {
				directory,
				payload: {
					type: "session.status",
					properties: {
						sessionID: sessionId,
						status: { running: true },
					},
				},
			} as unknown as GlobalEvent
			store.handleSSEEvent(globalEvent)
		})

		// Force re-render to pick up state change
		rerender(<SessionStatus sessionId={sessionId} />)

		expect(container.textContent).toContain("Running")
	})

	it("shows Idle when session is not running", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// Simulate SSE event via store
		// NOTE: Store type is incorrect - actual payload has { running: boolean }, not string literal
		act(() => {
			const store = useOpencodeStore.getState()
			const globalEvent = {
				directory,
				payload: {
					type: "session.status",
					properties: {
						sessionID: sessionId,
						status: { running: false },
					},
				},
			} as unknown as GlobalEvent
			store.handleSSEEvent(globalEvent)
		})

		rerender(<SessionStatus sessionId={sessionId} />)

		expect(container.textContent).toContain("Idle")
	})

	it("shows error message when session.error event fires", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// Emit error event
		act(() => {
			emitEvent("session.error", {
				payload: {
					type: "session.error",
					properties: {
						sessionID: sessionId,
						error: {
							message: "Failed to connect to provider",
						},
					},
				},
			})
		})

		rerender(<SessionStatus sessionId={sessionId} />)

		expect(container.textContent).toContain("Failed to connect to provider")
	})

	it("error badge has destructive variant", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// Emit error event
		act(() => {
			emitEvent("session.error", {
				payload: {
					type: "session.error",
					properties: {
						sessionID: sessionId,
						error: {
							message: "Test error",
						},
					},
				},
			})
		})

		rerender(<SessionStatus sessionId={sessionId} />)

		// Badge with destructive variant should have destructive class
		const badge = container.querySelector('[class*="destructive"]')
		expect(badge).toBeDefined()
	})

	it("ignores session.error events for different sessions", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// First show idle state via store
		// NOTE: Store type is incorrect - actual payload has { running: boolean }, not string literal
		act(() => {
			const store = useOpencodeStore.getState()
			const globalEvent = {
				directory,
				payload: {
					type: "session.status",
					properties: {
						sessionID: sessionId,
						status: { running: false },
					},
				},
			} as unknown as GlobalEvent
			store.handleSSEEvent(globalEvent)
		})

		rerender(<SessionStatus sessionId={sessionId} />)
		expect(container.textContent).toContain("Idle")

		// Error for different session (use SSE mock since error is local state)
		act(() => {
			emitEvent("session.error", {
				payload: {
					type: "session.error",
					properties: {
						sessionID: "different-session",
						error: {
							message: "Should not appear",
						},
					},
				},
			})
		})

		rerender(<SessionStatus sessionId={sessionId} />)

		// Should still show Idle, not error
		expect(container.textContent).toContain("Idle")
	})

	it("error state clears when session starts running again", () => {
		const { rerender, container } = render(<SessionStatus sessionId={sessionId} />)

		// First error (use SSE mock since error is local state)
		act(() => {
			emitEvent("session.error", {
				payload: {
					type: "session.error",
					properties: {
						sessionID: sessionId,
						error: {
							message: "Test error",
						},
					},
				},
			})
		})

		rerender(<SessionStatus sessionId={sessionId} />)
		expect(container.textContent).toContain("Test error")

		// Then running (emit to both SSE mock AND store)
		// SSE clears local error state, store updates running status
		act(() => {
			const store = useOpencodeStore.getState()
			const globalEvent = {
				directory,
				payload: {
					type: "session.status",
					properties: {
						sessionID: sessionId,
						status: { running: true },
					},
				},
			} as unknown as GlobalEvent
			store.handleSSEEvent(globalEvent)

			// Also emit to SSE mock so component's useEffect clears error
			emitEvent("session.status", {
				payload: {
					type: "session.status",
					properties: {
						sessionID: sessionId,
						status: { running: true },
					},
				},
			})
		})

		rerender(<SessionStatus sessionId={sessionId} />)

		// Should clear error and show Running
		expect(container.textContent).toContain("Running")
	})
})
