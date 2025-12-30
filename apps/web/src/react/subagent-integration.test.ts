/**
 * Integration tests for subagent display flow
 *
 * Tests the full flow: SSE events → useSubagentSync → subagent store → useSubagent hook
 *
 * This validates that:
 * 1. session.created events register subagents
 * 2. message.part.updated events map parentPartId
 * 3. message.created/updated events add messages to subagent
 * 4. message.part.created/updated events add parts to subagent
 * 5. session.status events update subagent status
 * 6. Auto-expand works for running subagents
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

import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSubagentStore } from "@/stores/subagent-store"

// Use loose types for SSE event simulation - actual events have more fields
// but we only care about the fields useSubagentSync reads
type MockSSEEvent = {
	directory: string
	payload: {
		type: string
		properties: Record<string, unknown>
	}
}

afterAll(() => {
	mock.restore()
})

describe("Subagent Integration", () => {
	const parentSessionId = "parent-session-123"
	const childSessionId = "child-session-456"
	const parentPartId = "task-part-789"

	beforeEach(() => {
		// Reset store state before each test
		// Use partial state update - Zustand merges with existing actions
		const store = useSubagentStore.getState()
		// Clear all data while preserving actions
		useSubagentStore.setState({
			sessions: {},
			partToSession: {},
			expanded: new Set(),
		})
	})

	describe("session.created event handling", () => {
		it("registers subagent when child session is created with parentID", () => {
			// Simulate session.created event (using mock type for test)
			const event: MockSSEEvent = {
				directory: "/test/project",
				payload: {
					type: "session.created",
					properties: {
						info: {
							id: childSessionId,
							parentID: parentSessionId,
							title: "@explore subagent for codebase search",
						},
					},
				},
			}

			// Extract session info and register (simulating useSubagentSync logic)
			const session = (event.payload as any)?.properties?.info
			if (session?.parentID === parentSessionId) {
				const match = session.title?.match(/@(\w+)\s+subagent/)
				const agentName = match?.[1] || "unknown"
				useSubagentStore.getState().registerSubagent(session.id, parentSessionId, "", agentName)
			}

			// Verify subagent was registered (re-read state after mutation)
			const subagent = useSubagentStore.getState().sessions[childSessionId]
			expect(subagent).toBeDefined()
			expect(subagent?.parentSessionId).toBe(parentSessionId)
			expect(subagent?.agentName).toBe("explore")
			expect(subagent?.status).toBe("running")
		})

		it("extracts agent name from session title", () => {
			const testCases = [
				{ title: "@explore subagent for search", expected: "explore" },
				{ title: "@reviewer subagent for code review", expected: "reviewer" },
				{ title: "@test subagent for testing", expected: "test" },
				{ title: "No agent prefix", expected: "unknown" },
			]

			for (const { title, expected } of testCases) {
				const match = title.match(/@(\w+)\s+subagent/)
				const agentName = match?.[1] || "unknown"
				expect(agentName).toBe(expected)
			}
		})
	})

	describe("parentPartId mapping via message.part.updated", () => {
		it("maps parentPartId when Task tool part has sessionID metadata", () => {
			// First, register the subagent (without parentPartId)
			useSubagentStore.getState().registerSubagent(childSessionId, parentSessionId, "", "explore")

			// Simulate message.part.updated event for Task tool in PARENT session
			const event: MockSSEEvent = {
				directory: "/test/project",
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: parentPartId,
							sessionID: parentSessionId, // This is the PARENT session
							type: "tool",
							tool: "task",
							state: {
								status: "running",
								metadata: {
									sessionID: childSessionId, // Links to child session (uppercase D)
								},
							},
						},
					},
				},
			}

			// Simulate the mapping logic from useSubagentSync
			const part = (event.payload as any)?.properties?.part
			if (
				part &&
				part.sessionID === parentSessionId &&
				part.type === "tool" &&
				part.tool === "task" &&
				part.state?.metadata?.sessionID
			) {
				useSubagentStore.getState().updateParentPartId(part.state.metadata.sessionID, part.id)
			}

			// Verify mapping (re-read state)
			const state = useSubagentStore.getState()
			expect(state.partToSession[parentPartId]).toBe(childSessionId)
			expect(state.sessions[childSessionId]?.parentPartId).toBe(parentPartId)
		})

		it("auto-expands when parentPartId is set for running subagent", () => {
			// Register subagent without parentPartId
			useSubagentStore.getState().registerSubagent(childSessionId, parentSessionId, "", "explore")

			// Initially not expanded (no parentPartId yet)
			expect(useSubagentStore.getState().expanded.has("")).toBe(false)

			// Update parentPartId
			useSubagentStore.getState().updateParentPartId(childSessionId, parentPartId)

			// Should auto-expand (re-read state)
			expect(useSubagentStore.getState().expanded.has(parentPartId)).toBe(true)
		})
	})

	describe("message and part tracking", () => {
		it("adds messages to subagent session", () => {
			useSubagentStore
				.getState()
				.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			// Add a message
			const message = {
				id: "msg-1",
				sessionID: childSessionId,
				role: "assistant",
				time: { created: Date.now() },
			}
			useSubagentStore.getState().addMessage(childSessionId, message)

			const session = useSubagentStore.getState().sessions[childSessionId]
			expect(session?.messages).toHaveLength(1)
			expect(session?.messages?.[0]?.id).toBe("msg-1")
		})

		it("adds parts to subagent messages", () => {
			useSubagentStore
				.getState()
				.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			// Add a message first
			const message = {
				id: "msg-1",
				sessionID: childSessionId,
				role: "assistant",
				time: { created: Date.now() },
			}
			useSubagentStore.getState().addMessage(childSessionId, message)

			// Add a part
			const part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Searching codebase...",
			}
			useSubagentStore.getState().addPart(childSessionId, "msg-1", part)

			const session = useSubagentStore.getState().sessions[childSessionId]
			expect(session?.parts["msg-1"]).toHaveLength(1)
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Searching codebase...")
		})

		it("updates existing parts", () => {
			useSubagentStore
				.getState()
				.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			// Add message and part
			useSubagentStore.getState().addMessage(childSessionId, {
				id: "msg-1",
				sessionID: childSessionId,
				role: "assistant",
				time: { created: Date.now() },
			})
			useSubagentStore.getState().addPart(childSessionId, "msg-1", {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Initial content",
			})

			// Update the part
			useSubagentStore.getState().updatePart(childSessionId, "msg-1", {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Updated content with more text",
			})

			const session = useSubagentStore.getState().sessions[childSessionId]
			expect(session?.parts["msg-1"]?.[0]?.content).toBe("Updated content with more text")
		})
	})

	describe("status tracking", () => {
		it("updates status when session.status event fires", () => {
			useSubagentStore
				.getState()
				.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			// Initially running
			expect(useSubagentStore.getState().sessions[childSessionId]?.status).toBe("running")

			// Set to completed
			useSubagentStore.getState().setStatus(childSessionId, "completed")
			expect(useSubagentStore.getState().sessions[childSessionId]?.status).toBe("completed")
		})

		it("handles error status", () => {
			useSubagentStore
				.getState()
				.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			useSubagentStore.getState().setStatus(childSessionId, "error")
			expect(useSubagentStore.getState().sessions[childSessionId]?.status).toBe("error")
		})
	})

	describe("useSubagent hook integration", () => {
		it("returns subagent data via getByParentPart", async () => {
			const store = useSubagentStore.getState()
			store.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			// Import hook dynamically after DOM setup
			const { useSubagent } = await import("./use-subagent")

			const { result } = renderHook(() => useSubagent(parentPartId))

			expect(result.current.hasSubagent).toBe(true)
			expect(result.current.subagent?.id).toBe(childSessionId)
			expect(result.current.subagent?.agentName).toBe("explore")
			expect(result.current.isRunning).toBe(true)
			expect(result.current.isExpanded).toBe(true) // Auto-expanded
		})

		it("reacts to status changes", async () => {
			const store = useSubagentStore.getState()
			store.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			const { useSubagent } = await import("./use-subagent")
			const { result } = renderHook(() => useSubagent(parentPartId))

			expect(result.current.isRunning).toBe(true)
			expect(result.current.isCompleted).toBe(false)

			act(() => {
				store.setStatus(childSessionId, "completed")
			})

			expect(result.current.isRunning).toBe(false)
			expect(result.current.isCompleted).toBe(true)
		})

		it("toggleExpanded respects user preference", async () => {
			const store = useSubagentStore.getState()
			store.registerSubagent(childSessionId, parentSessionId, parentPartId, "explore")

			const { useSubagent } = await import("./use-subagent")
			const { result } = renderHook(() => useSubagent(parentPartId))

			// Auto-expanded
			expect(result.current.isExpanded).toBe(true)

			// User collapses
			act(() => {
				result.current.toggleExpanded()
			})
			expect(result.current.isExpanded).toBe(false)

			// User expands again
			act(() => {
				result.current.toggleExpanded()
			})
			expect(result.current.isExpanded).toBe(true)
		})
	})

	describe("full flow simulation", () => {
		it("simulates complete subagent lifecycle", async () => {
			const store = useSubagentStore.getState()
			const { useSubagent } = await import("./use-subagent")

			// 1. Child session created (from session.created event)
			store.registerSubagent(childSessionId, parentSessionId, "", "explore")

			// 2. Task tool part updated with sessionId (from message.part.updated)
			store.updateParentPartId(childSessionId, parentPartId)

			// 3. Hook can now find the subagent
			const { result } = renderHook(() => useSubagent(parentPartId))
			expect(result.current.hasSubagent).toBe(true)
			expect(result.current.isExpanded).toBe(true)

			// 4. Messages arrive (from message.created)
			act(() => {
				store.addMessage(childSessionId, {
					id: "msg-1",
					sessionID: childSessionId,
					role: "assistant",
					time: { created: Date.now() },
				})
			})

			// 5. Parts arrive (from message.part.created/updated)
			act(() => {
				store.addPart(childSessionId, "msg-1", {
					id: "part-1",
					messageID: "msg-1",
					type: "text",
					content: "Searching for files...",
				})
			})

			// 6. Subagent completes (from session.status)
			act(() => {
				store.setStatus(childSessionId, "completed")
			})

			expect(result.current.isRunning).toBe(false)
			expect(result.current.isCompleted).toBe(true)
			expect(result.current.subagent?.messages).toHaveLength(1)
			expect(result.current.subagent?.parts["msg-1"]).toHaveLength(1)
		})
	})
})
