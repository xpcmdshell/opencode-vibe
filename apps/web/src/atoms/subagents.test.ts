/**
 * Tests for subagents atom
 *
 * Tests verify:
 * - Subagent session registration and tracking
 * - Message and part management
 * - UI expansion state
 * - Parent part ID to session mapping
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest"
import { Window } from "happy-dom"
import { renderHook, act } from "@testing-library/react"
import { useSubagents } from "./subagents"
import type { Message, Part } from "@opencode-vibe/react"

// Set up happy-dom global environment
let happyWindow: Window
beforeAll(() => {
	happyWindow = new Window()
	Object.assign(global, {
		document: happyWindow.document,
		window: happyWindow,
		HTMLElement: happyWindow.HTMLElement,
		Element: happyWindow.Element,
		Node: happyWindow.Node,
	})
})

afterAll(() => {
	happyWindow.close()
})

describe("useSubagents", () => {
	const mockMessage: Message = {
		id: "msg-1",
		sessionID: "child-123",
		role: "user",
		time: { created: Date.now() },
	}

	const mockPart: Part = {
		id: "part-1",
		messageID: "msg-1",
		type: "text",
		content: "test part",
	}

	describe("registerSubagent", () => {
		test("registers a new subagent session", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			const session = result.current.sessions["child-123"]
			expect(session).toBeDefined()
			expect(session?.id).toBe("child-123")
			expect(session?.parentSessionId).toBe("parent-456")
			expect(session?.parentPartId).toBe("part-789")
			expect(session?.agentName).toBe("TestAgent")
			expect(session?.status).toBe("running")
			expect(session?.messages).toEqual([])
			expect(session?.parts).toEqual({})
		})

		test("auto-expands running subagent", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			expect(result.current.isExpanded("part-789")).toBe(true)
		})

		test("creates partToSession mapping", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			const session = result.current.getByParentPart("part-789")
			expect(session?.id).toBe("child-123")
		})
	})

	describe("updateParentPartId", () => {
		test("updates parent part ID for existing session", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-old", "TestAgent")
			})

			act(() => {
				result.current.updateParentPartId("child-123", "part-new")
			})

			const session = result.current.sessions["child-123"]
			expect(session?.parentPartId).toBe("part-new")

			const foundSession = result.current.getByParentPart("part-new")
			expect(foundSession?.id).toBe("child-123")
		})

		test("auto-expands when parent part ID is set for running session", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "", "TestAgent")
			})

			expect(result.current.isExpanded("part-new")).toBe(false)

			act(() => {
				result.current.updateParentPartId("child-123", "part-new")
			})

			expect(result.current.isExpanded("part-new")).toBe(true)
		})

		test("does not expand if session is not running", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "", "TestAgent")
				result.current.setStatus("child-123", "completed")
			})

			act(() => {
				result.current.updateParentPartId("child-123", "part-new")
			})

			expect(result.current.isExpanded("part-new")).toBe(false)
		})
	})

	describe("addMessage", () => {
		test("adds message to session", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			act(() => {
				result.current.addMessage("child-123", mockMessage)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.messages).toHaveLength(1)
			expect(session?.messages[0]).toEqual(mockMessage)
			expect(session?.parts[mockMessage.id]).toEqual([])
		})

		test("does nothing if session does not exist", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.addMessage("nonexistent", mockMessage)
			})

			expect(result.current.sessions["nonexistent"]).toBeUndefined()
		})
	})

	describe("updateMessage", () => {
		test("updates existing message", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
				result.current.addMessage("child-123", mockMessage)
			})

			const updatedMessage = { ...mockMessage, role: "assistant" }

			act(() => {
				result.current.updateMessage("child-123", updatedMessage)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.messages[0]?.role).toBe("assistant")
		})

		test("does nothing if message does not exist", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			const updatedMessage = { ...mockMessage, id: "nonexistent" }

			act(() => {
				result.current.updateMessage("child-123", updatedMessage)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.messages).toHaveLength(0)
		})
	})

	describe("addPart", () => {
		test("adds part to message", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
				result.current.addMessage("child-123", mockMessage)
			})

			act(() => {
				result.current.addPart("child-123", mockMessage.id, mockPart)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.parts[mockMessage.id]).toHaveLength(1)
			expect(session?.parts[mockMessage.id]?.[0]).toEqual(mockPart)
		})

		test("initializes parts array if message exists but has no parts", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			// Manually add session with message but no parts entry
			// This simulates an edge case
			act(() => {
				result.current.addPart("child-123", "msg-new", mockPart)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.parts["msg-new"]).toBeDefined()
			expect(session?.parts["msg-new"]).toHaveLength(1)
		})
	})

	describe("updatePart", () => {
		test("updates existing part", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
				result.current.addMessage("child-123", mockMessage)
				result.current.addPart("child-123", mockMessage.id, mockPart)
			})

			const updatedPart = { ...mockPart, content: "updated part" }

			act(() => {
				result.current.updatePart("child-123", mockMessage.id, updatedPart)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.parts[mockMessage.id]?.[0]?.content).toBe("updated part")
		})

		test("does nothing if part does not exist", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
				result.current.addMessage("child-123", mockMessage)
			})

			const updatedPart = { ...mockPart, id: "nonexistent" }

			act(() => {
				result.current.updatePart("child-123", mockMessage.id, updatedPart)
			})

			const session = result.current.sessions["child-123"]
			expect(session?.parts[mockMessage.id]).toEqual([])
		})
	})

	describe("setStatus", () => {
		test("updates session status", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			expect(result.current.sessions["child-123"]?.status).toBe("running")

			act(() => {
				result.current.setStatus("child-123", "completed")
			})

			expect(result.current.sessions["child-123"]?.status).toBe("completed")

			act(() => {
				result.current.setStatus("child-123", "error")
			})

			expect(result.current.sessions["child-123"]?.status).toBe("error")
		})
	})

	describe("toggleExpanded", () => {
		test("toggles expansion state", () => {
			const { result } = renderHook(() => useSubagents())

			expect(result.current.isExpanded("part-1")).toBe(false)

			act(() => {
				result.current.toggleExpanded("part-1")
			})

			expect(result.current.isExpanded("part-1")).toBe(true)

			act(() => {
				result.current.toggleExpanded("part-1")
			})

			expect(result.current.isExpanded("part-1")).toBe(false)
		})
	})

	describe("getByParentPart", () => {
		test("retrieves session by parent part ID", () => {
			const { result } = renderHook(() => useSubagents())

			act(() => {
				result.current.registerSubagent("child-123", "parent-456", "part-789", "TestAgent")
			})

			const session = result.current.getByParentPart("part-789")
			expect(session?.id).toBe("child-123")
		})

		test("returns undefined if parent part ID not found", () => {
			const { result } = renderHook(() => useSubagents())

			const session = result.current.getByParentPart("nonexistent")
			expect(session).toBeUndefined()
		})
	})
})
