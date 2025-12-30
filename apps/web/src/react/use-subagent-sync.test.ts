/**
 * useSubagentSync Hook Tests
 *
 * Tests SSE-based synchronization of child agent sessions.
 * Per SUBAGENT_DISPLAY.md lines 494-584.
 */

// CRITICAL: Clear any mocks from other test files
import { mock } from "vitest"
mock.restore()

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, test, expect, beforeEach, afterAll } from "vitest"
import { renderHook } from "@testing-library/react"
import { useSubagentStore } from "@/stores/subagent-store"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

// Mock useSSE hook - track all subscriptions
const subscriptions: Array<{ eventType: string; callback: any }> = []
const originalSubscribeImpl = (eventType: string, callback: any) => {
	subscriptions.push({ eventType, callback })
	return () => {} // Unsubscribe function
}
const mockSubscribe = vi.fn(originalSubscribeImpl)

mock.module("./use-sse", () => ({
	useSSE: () => ({
		subscribe: mockSubscribe,
		connected: true,
		reconnect: () => {},
	}),
}))

// Import after mocking
const { useSubagentSync } = await import("./use-subagent-sync")

afterAll(() => {
	mock.restore()
})

describe("useSubagentSync", () => {
	const parentSessionId = "parent-session-123"

	// Helper to get callback for an event type
	const getCallback = (eventType: string) => {
		const sub = subscriptions.find((s) => s.eventType === eventType)
		return sub?.callback
	}

	beforeEach(() => {
		// Reset store state
		useSubagentStore.setState({
			sessions: {},
			partToSession: {},
			expanded: new Set(),
		})
		// Clear mock and subscriptions
		mockSubscribe.mockClear()
		mockSubscribe.mockImplementation(originalSubscribeImpl)
		subscriptions.length = 0
	})

	describe("session.created detection", () => {
		test("detects child session via parentID match", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			// Find the session.created subscription
			const sub = subscriptions.find((s) => s.eventType === "session.created")
			expect(sub).toBeDefined()

			const callback = sub?.callback
			expect(callback).toBeFunction()

			// Simulate session.created event with matching parentID
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-session-1",
							parentID: parentSessionId,
							title: "@TestAgent subagent task",
						},
					},
				} as any,
			}

			callback?.(event)

			// Verify child session was registered
			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session).toBeDefined()
			expect(session?.parentSessionId).toBe(parentSessionId)
			expect(session?.agentName).toBe("TestAgent")
			expect(session?.status).toBe("running")
		})

		test("ignores session without matching parentID", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionCreatedCall = getCallback("session.created")
			const callback = sessionCreatedCall

			// Different parent
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "other-session",
							parentID: "other-parent",
							title: "@OtherAgent subagent",
						},
					},
				} as any,
			}

			callback?.(event)

			// Verify session was NOT registered
			const state = useSubagentStore.getState()
			expect(state.sessions["other-session"]).toBeUndefined()
		})

		test("extracts agent name from session title", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionCreatedCall = getCallback("session.created")
			const callback = sessionCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-session-2",
							parentID: parentSessionId,
							title: "@BlueLake subagent working on auth",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-2"]
			expect(session?.agentName).toBe("BlueLake")
		})

		test("uses 'unknown' agent name when pattern doesn't match", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionCreatedCall = getCallback("session.created")
			const callback = sessionCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-session-3",
							parentID: parentSessionId,
							title: "No agent name in title",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-3"]
			expect(session?.agentName).toBe("unknown")
		})
	})

	describe("session.status tracking", () => {
		beforeEach(() => {
			// Pre-register a child session
			useSubagentStore
				.getState()
				.registerSubagent("child-session-1", parentSessionId, "part-1", "TestAgent")
		})

		test("sets status to completed when session becomes idle", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionStatusCall = getCallback("session.status")
			const callback = sessionStatusCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.status",
					properties: {
						sessionID: "child-session-1",
						status: {
							type: "idle",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.status).toBe("completed")
		})

		test("ignores status updates for non-child sessions", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionStatusCall = getCallback("session.status")
			const callback = sessionStatusCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.status",
					properties: {
						sessionID: "unrelated-session",
						status: {
							type: "idle",
						},
					},
				} as any,
			}

			// Should not throw
			callback?.(event)

			const state = useSubagentStore.getState()
			expect(state.sessions["unrelated-session"]).toBeUndefined()
		})

		test("ignores non-idle status updates", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const sessionStatusCall = getCallback("session.status")
			const callback = sessionStatusCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.status",
					properties: {
						sessionID: "child-session-1",
						status: {
							type: "running",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			// Should still be running (initial status)
			expect(session?.status).toBe("running")
		})
	})

	describe("message.created tracking", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-session-1", parentSessionId, "part-1", "TestAgent")
		})

		test("adds message to child session", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const messageCreatedCall = getCallback("message.created")
			const callback = messageCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.created",
					properties: {
						message: {
							id: "msg-1",
							sessionID: "child-session-1",
							role: "user",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.messages).toHaveLength(1)
			expect(session?.messages[0]?.id).toBe("msg-1")
		})

		test("ignores messages from non-child sessions", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const messageCreatedCall = getCallback("message.created")
			const callback = messageCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.created",
					properties: {
						message: {
							id: "msg-2",
							sessionID: "other-session",
							role: "user",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			// Only child-session-1 exists
			expect(Object.keys(state.sessions)).toHaveLength(1)
			expect(state.sessions["child-session-1"]?.messages).toHaveLength(0)
		})
	})

	describe("message.updated tracking", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-session-1", parentSessionId, "part-1", "TestAgent")
			useSubagentStore.getState().addMessage("child-session-1", {
				id: "msg-1",
				sessionID: "child-session-1",
				role: "assistant",
			})
		})

		test("updates existing message in child session", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const messageUpdatedCall = getCallback("message.updated")
			const callback = messageUpdatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: {
						message: {
							id: "msg-1",
							sessionID: "child-session-1",
							role: "assistant",
							finish: "stop",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.messages[0]?.finish).toBe("stop")
		})

		test("ignores updates for non-child sessions", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const messageUpdatedCall = getCallback("message.updated")
			const callback = messageUpdatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: {
						message: {
							id: "msg-999",
							sessionID: "other-session",
							role: "assistant",
						},
					},
				} as any,
			}

			// Should not throw
			callback?.(event)
		})
	})

	describe("message.part.created tracking", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-session-1", parentSessionId, "part-1", "TestAgent")
			useSubagentStore.getState().addMessage("child-session-1", {
				id: "msg-1",
				sessionID: "child-session-1",
				role: "assistant",
			})
		})

		test("adds part to child session message", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const partCreatedCall = getCallback("message.part.created")
			const callback = partCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.created",
					properties: {
						part: {
							id: "part-1",
							messageID: "msg-1",
							sessionID: "child-session-1",
							type: "text",
							content: "Hello",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.parts["msg-1"]).toHaveLength(1)
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Hello")
		})

		test("ignores parts from non-child sessions", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const partCreatedCall = getCallback("message.part.created")
			const callback = partCreatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.created",
					properties: {
						part: {
							id: "part-2",
							messageID: "msg-99",
							sessionID: "other-session",
							type: "text",
							content: "Ignored",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.parts["msg-99"]).toBeUndefined()
		})
	})

	describe("message.part.updated tracking", () => {
		beforeEach(() => {
			useSubagentStore
				.getState()
				.registerSubagent("child-session-1", parentSessionId, "part-1", "TestAgent")
			useSubagentStore.getState().addMessage("child-session-1", {
				id: "msg-1",
				sessionID: "child-session-1",
				role: "assistant",
			})
			useSubagentStore.getState().addPart("child-session-1", "msg-1", {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello",
			})
		})

		test("updates existing part in child session", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const partUpdatedCall = getCallback("message.part.updated")
			const callback = partUpdatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-1",
							messageID: "msg-1",
							sessionID: "child-session-1",
							type: "text",
							content: "Hello World",
						},
					},
				} as any,
			}

			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Hello World")
		})

		test("ignores part updates for non-child sessions", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			/* no-op */
			const partUpdatedCall = getCallback("message.part.updated")
			const callback = partUpdatedCall

			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-999",
							messageID: "msg-999",
							sessionID: "other-session",
							type: "text",
							content: "Ignored",
						},
					},
				} as any,
			}

			// Should not throw
			callback?.(event)

			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			// Original content unchanged
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Hello")
		})
	})

	describe("subscription cleanup", () => {
		test("returns unsubscribe functions for all event types", () => {
			const { unmount } = renderHook(() => useSubagentSync(parentSessionId))

			// Should subscribe to all event types
			const eventTypes = subscriptions.map((s) => s.eventType)

			expect(eventTypes).toContain("session.created")
			expect(eventTypes).toContain("session.status")
			expect(eventTypes).toContain("message.created")
			expect(eventTypes).toContain("message.updated")
			expect(eventTypes).toContain("message.part.created")
			expect(eventTypes).toContain("message.part.updated")

			// Verify cleanup doesn't throw
			unmount()
		})

		test("calls unsubscribe on cleanup", () => {
			const unsubscribeMock = vi.fn(() => {})
			mockSubscribe.mockImplementation(() => unsubscribeMock)

			const { unmount } = renderHook(() => useSubagentSync(parentSessionId))

			unmount()

			// Should have called unsubscribe for each subscription
			const subscriptionCount = mockSubscribe.mock.calls.length
			expect(unsubscribeMock).toHaveBeenCalledTimes(subscriptionCount)
		})
	})

	describe("parentPartId mapping fix", () => {
		test("should update parentPartId when Task tool part arrives after session.created", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			const sessionCreatedCallback = getCallback("session.created")
			const partUpdatedCallback = getCallback("message.part.updated")

			// Step 1: session.created fires FIRST (no part ID yet)
			const sessionCreatedEvent: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-session-1",
							parentID: parentSessionId,
							title: "@TestAgent subagent task",
						},
					},
				} as any,
			}
			sessionCreatedCallback?.(sessionCreatedEvent)

			// Verify child session registered with empty parentPartId
			let state = useSubagentStore.getState()
			let session = state.sessions["child-session-1"]
			expect(session).toBeDefined()
			expect(session?.parentPartId).toBe("")
			expect(state.partToSession["task-part-123"]).toBeUndefined()

			// Step 2: message.part.updated fires for PARENT session with Task tool
			const partUpdatedEvent: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "task-part-123",
							messageID: "parent-msg-1",
							sessionID: parentSessionId, // PARENT session, not child
							type: "tool",
							tool: "task",
							state: {
								metadata: {
									sessionID: "child-session-1", // References child session (uppercase D)
								},
								status: "running",
							},
						},
					},
				} as any,
			}
			partUpdatedCallback?.(partUpdatedEvent)

			// Verify parentPartId is now updated and mapping works
			state = useSubagentStore.getState()
			session = state.sessions["child-session-1"]
			expect(session?.parentPartId).toBe("task-part-123")
			expect(state.partToSession["task-part-123"]).toBe("child-session-1")

			// Verify getByParentPart works now
			const foundSession = useSubagentStore.getState().getByParentPart("task-part-123")
			expect(foundSession).toBeDefined()
			expect(foundSession?.id).toBe("child-session-1")
		})

		test("should ignore part.updated events that are not Task tools", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			const sessionCreatedCallback = getCallback("session.created")
			const partUpdatedCallback = getCallback("message.part.updated")

			// Register child session
			const sessionCreatedEvent: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-session-1",
							parentID: parentSessionId,
							title: "@TestAgent subagent task",
						},
					},
				} as any,
			}
			sessionCreatedCallback?.(sessionCreatedEvent)

			// Send non-task part update
			const partUpdatedEvent: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "text-part-456",
							messageID: "parent-msg-1",
							sessionID: parentSessionId,
							type: "text", // Not a tool
							content: "Hello world",
						},
					},
				} as any,
			}
			partUpdatedCallback?.(partUpdatedEvent)

			// Verify parentPartId still empty
			const state = useSubagentStore.getState()
			const session = state.sessions["child-session-1"]
			expect(session?.parentPartId).toBe("")
		})

		test("should ignore Task tool parts without metadata.sessionID", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			const partUpdatedCallback = getCallback("message.part.updated")

			// Task tool but missing metadata.sessionID
			const partUpdatedEvent: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "task-part-789",
							messageID: "parent-msg-1",
							sessionID: parentSessionId,
							type: "tool",
							tool: "task",
							state: {
								// No metadata.sessionID
								status: "running",
							},
						},
					},
				} as any,
			}
			partUpdatedCallback?.(partUpdatedEvent)

			// Should not throw, should be ignored
			const state = useSubagentStore.getState()
			expect(state.partToSession["task-part-789"]).toBeUndefined()
		})

		test("should handle multiple child sessions with different parent parts", () => {
			renderHook(() => useSubagentSync(parentSessionId))

			const sessionCreatedCallback = getCallback("session.created")
			const partUpdatedCallback = getCallback("message.part.updated")

			// Create two child sessions
			sessionCreatedCallback?.({
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-1",
							parentID: parentSessionId,
							title: "@Agent1 subagent",
						},
					},
				} as any,
			})

			sessionCreatedCallback?.({
				directory: "/test",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: "child-2",
							parentID: parentSessionId,
							title: "@Agent2 subagent",
						},
					},
				} as any,
			})

			// Send two task parts
			partUpdatedCallback?.({
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-1",
							messageID: "msg-1",
							sessionID: parentSessionId,
							type: "tool",
							tool: "task",
							state: { metadata: { sessionID: "child-1" } },
						},
					},
				} as any,
			})

			partUpdatedCallback?.({
				directory: "/test",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-2",
							messageID: "msg-2",
							sessionID: parentSessionId,
							type: "tool",
							tool: "task",
							state: { metadata: { sessionID: "child-2" } },
						},
					},
				} as any,
			})

			// Verify both mappings work
			const state = useSubagentStore.getState()
			expect(state.sessions["child-1"]?.parentPartId).toBe("part-1")
			expect(state.sessions["child-2"]?.parentPartId).toBe("part-2")
			expect(state.partToSession["part-1"]).toBe("child-1")
			expect(state.partToSession["part-2"]).toBe("child-2")
		})
	})
})
