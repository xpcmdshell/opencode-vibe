import { describe, expect, test, beforeEach } from "bun:test"
import { useOpencodeStore } from "./store"

/**
 * Test types matching OpenCode API responses
 */
type Session = {
	id: string
	title: string
	directory: string
	parentID?: string
	time: {
		created: number
		updated: number
		archived?: number
	}
}

type Message = {
	id: string
	sessionID: string
	role: string
	time?: { created: number; completed?: number }
}

type Part = {
	id: string
	messageID: string
	type: string
	content: string
}

type SessionStatus = "pending" | "running" | "completed" | "error"

type Todo = {
	id: string
	sessionID: string
	content: string
	completed: boolean
}

type FileDiff = {
	path: string
	additions: number
	deletions: number
}

const TEST_DIRECTORY = "/test"

describe("OpencodeStore", () => {
	// Reset store before each test to avoid state leakage
	beforeEach(() => {
		useOpencodeStore.setState({
			directories: {},
		})
	})

	describe("Initial State", () => {
		test("starts with empty directories", () => {
			const store = useOpencodeStore.getState()
			expect(Object.keys(store.directories)).toHaveLength(0)
		})

		test("initDirectory creates empty DirectoryState", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// Re-fetch state after mutation
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.ready).toBe(false)
			expect(dir.sessions).toEqual([])
			expect(dir.sessionStatus).toEqual({})
			expect(dir.sessionDiff).toEqual({})
			expect(dir.todos).toEqual({})
			expect(dir.messages).toEqual({})
			expect(dir.parts).toEqual({})
		})

		test("initDirectory is idempotent (no-op if already exists)", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})

			// Call initDirectory again
			store.initDirectory(TEST_DIRECTORY)

			// Data should still be there
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.sessions).toHaveLength(1)
		})
	})

	describe("handleEvent - session.created", () => {
		test("inserts new session in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const sessionC: Session = {
				id: "session-c",
				title: "Session C",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			const sessionA: Session = {
				id: "session-a",
				title: "Session A",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			const sessionB: Session = {
				id: "session-b",
				title: "Session B",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: sessionC },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: sessionA },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: sessionB },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(3)
			expect(sessions[0].id).toBe("session-a")
			expect(sessions[1].id).toBe("session-b")
			expect(sessions[2].id).toBe("session-c")
		})

		test("auto-creates directory if not initialized", () => {
			const store = useOpencodeStore.getState()

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: session },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.sessions).toHaveLength(1)
		})
	})

	describe("handleEvent - session.updated", () => {
		test("inserts new session in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const sessionC: Session = {
				id: "session-c",
				title: "Session C",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			const sessionA: Session = {
				id: "session-a",
				title: "Session A",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			const sessionB: Session = {
				id: "session-b",
				title: "Session B",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: sessionC },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: sessionA },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: sessionB },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(3)
			expect(sessions[0].id).toBe("session-a")
			expect(sessions[1].id).toBe("session-b")
			expect(sessions[2].id).toBe("session-c")
		})

		test("updates existing session", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Original Title",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})

			const updatedSession: Session = {
				...session,
				title: "Updated Title",
				time: { ...session.time, updated: Date.now() + 1000 },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: updatedSession },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(1)
			expect(sessions[0].title).toBe("Updated Title")
		})

		test("removes archived session", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "To Archive",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})

			const archivedSession: Session = {
				...session,
				time: { ...session.time, archived: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: archivedSession },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(0)
		})

		test("auto-creates directory if not initialized", () => {
			const store = useOpencodeStore.getState()

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.sessions).toHaveLength(1)
		})
	})

	describe("handleEvent - session.status", () => {
		test("stores session status", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.status",
				properties: { sessionID: "session-1", status: "running" },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.sessionStatus["session-1"]).toBe("running")
		})
	})

	describe("handleEvent - session.diff", () => {
		test("stores session diff", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const diff: FileDiff[] = [{ path: "src/app.ts", additions: 10, deletions: 5 }]

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.diff",
				properties: { sessionID: "session-1", diff },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.sessionDiff["session-1"]).toEqual(diff)
		})
	})

	describe("handleEvent - session.deleted", () => {
		test("removes session by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session1: Session = {
				id: "session-1",
				title: "First",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}
			const session2: Session = {
				id: "session-2",
				title: "Second",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: session1 },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.created",
				properties: { info: session2 },
			})

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.deleted",
				properties: { sessionID: "session-1" },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(1)
			expect(sessions[0].id).toBe("session-2")
		})

		test("no-op when session not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.deleted",
				properties: { sessionID: "non-existent" },
			})

			// Should not throw
			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(0)
		})

		test("auto-creates directory if not initialized", () => {
			const store = useOpencodeStore.getState()

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.deleted",
				properties: { sessionID: "session-1" },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			// Deleting non-existent session on new directory is no-op
			expect(dir.sessions).toHaveLength(0)
		})
	})

	describe("handleEvent - message.updated", () => {
		test("inserts new message in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messageC: Message = {
				id: "msg-c",
				sessionID: "session-1",
				role: "user",
			}
			const messageA: Message = {
				id: "msg-a",
				sessionID: "session-1",
				role: "user",
			}
			const messageB: Message = {
				id: "msg-b",
				sessionID: "session-1",
				role: "assistant",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: messageC },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: messageA },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: messageB },
			})

			const messages = useOpencodeStore.getState().directories[TEST_DIRECTORY].messages["session-1"]
			expect(messages).toHaveLength(3)
			expect(messages[0].id).toBe("msg-a")
			expect(messages[1].id).toBe("msg-b")
			expect(messages[2].id).toBe("msg-c")
		})

		test("updates existing message", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const message: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: message },
			})

			const updatedMessage: Message = {
				...message,
				role: "assistant",
				time: { created: Date.now(), completed: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: updatedMessage },
			})

			const messages = useOpencodeStore.getState().directories[TEST_DIRECTORY].messages["session-1"]
			expect(messages).toHaveLength(1)
			expect(messages[0].role).toBe("assistant")
		})
	})

	describe("handleEvent - message.removed", () => {
		test("removes message by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const msg1: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}
			const msg2: Message = {
				id: "msg-2",
				sessionID: "session-1",
				role: "assistant",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: msg1 },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.updated",
				properties: { info: msg2 },
			})

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.removed",
				properties: { sessionID: "session-1", messageID: "msg-1" },
			})

			const messages = useOpencodeStore.getState().directories[TEST_DIRECTORY].messages["session-1"]
			expect(messages).toHaveLength(1)
			expect(messages[0].id).toBe("msg-2")
		})
	})

	describe("handleEvent - message.part.updated", () => {
		test("inserts new part in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const partC: Part = {
				id: "part-c",
				messageID: "msg-1",
				type: "text",
				content: "C",
			}
			const partA: Part = {
				id: "part-a",
				messageID: "msg-1",
				type: "text",
				content: "A",
			}
			const partB: Part = {
				id: "part-b",
				messageID: "msg-1",
				type: "text",
				content: "B",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: partC },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: partA },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: partB },
			})

			const parts = useOpencodeStore.getState().directories[TEST_DIRECTORY].parts["msg-1"]
			expect(parts).toHaveLength(3)
			expect(parts[0].id).toBe("part-a")
			expect(parts[1].id).toBe("part-b")
			expect(parts[2].id).toBe("part-c")
		})

		test("updates existing part", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const part: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Original",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part },
			})

			const updatedPart: Part = {
				...part,
				content: "Updated",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: updatedPart },
			})

			const parts = useOpencodeStore.getState().directories[TEST_DIRECTORY].parts["msg-1"]
			expect(parts).toHaveLength(1)
			expect(parts[0].content).toBe("Updated")
		})
	})

	describe("handleEvent - message.part.removed", () => {
		test("removes part by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const part1: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "A",
			}
			const part2: Part = {
				id: "part-2",
				messageID: "msg-1",
				type: "text",
				content: "B",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: part1 },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: part2 },
			})

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.removed",
				properties: { messageID: "msg-1", partID: "part-1" },
			})

			const parts = useOpencodeStore.getState().directories[TEST_DIRECTORY].parts["msg-1"]
			expect(parts).toHaveLength(1)
			expect(parts[0].id).toBe("part-2")
		})
	})

	describe("handleEvent - todo.updated", () => {
		test("stores todos for session", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const todos: Todo[] = [
				{
					id: "todo-1",
					sessionID: "session-1",
					content: "Task 1",
					completed: false,
				},
				{
					id: "todo-2",
					sessionID: "session-1",
					content: "Task 2",
					completed: true,
				},
			]

			store.handleEvent(TEST_DIRECTORY, {
				type: "todo.updated",
				properties: { sessionID: "session-1", todos },
			})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.todos["session-1"]).toEqual(todos)
		})
	})

	describe("setSessionReady", () => {
		test("sets ready flag for directory", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY].ready).toBe(false)

			store.setSessionReady(TEST_DIRECTORY, true)
			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY].ready).toBe(true)
		})
	})

	describe("setSessions", () => {
		test("sets sessions array sorted by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const sessions: Session[] = [
				{
					id: "session-c",
					title: "C",
					directory: TEST_DIRECTORY,
					time: { created: 3, updated: 3 },
				},
				{
					id: "session-a",
					title: "A",
					directory: TEST_DIRECTORY,
					time: { created: 1, updated: 1 },
				},
				{
					id: "session-b",
					title: "B",
					directory: TEST_DIRECTORY,
					time: { created: 2, updated: 2 },
				},
			]

			store.setSessions(TEST_DIRECTORY, sessions)

			const sorted = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sorted).toHaveLength(3)
			expect(sorted[0].id).toBe("session-a")
			expect(sorted[1].id).toBe("session-b")
			expect(sorted[2].id).toBe("session-c")
		})
	})

	describe("setMessages", () => {
		test("sets messages array sorted by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messages: Message[] = [
				{ id: "msg-c", sessionID: "session-1", role: "user" },
				{ id: "msg-a", sessionID: "session-1", role: "user" },
				{ id: "msg-b", sessionID: "session-1", role: "assistant" },
			]

			store.setMessages(TEST_DIRECTORY, "session-1", messages)

			const sorted = useOpencodeStore.getState().directories[TEST_DIRECTORY].messages["session-1"]
			expect(sorted).toHaveLength(3)
			expect(sorted[0].id).toBe("msg-a")
			expect(sorted[1].id).toBe("msg-b")
			expect(sorted[2].id).toBe("msg-c")
		})
	})

	describe("setParts", () => {
		test("sets parts array sorted by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const parts: Part[] = [
				{ id: "part-c", messageID: "msg-1", type: "text", content: "C" },
				{ id: "part-a", messageID: "msg-1", type: "text", content: "A" },
				{ id: "part-b", messageID: "msg-1", type: "text", content: "B" },
			]

			store.setParts(TEST_DIRECTORY, "msg-1", parts)

			const sorted = useOpencodeStore.getState().directories[TEST_DIRECTORY].parts["msg-1"]
			expect(sorted).toHaveLength(3)
			expect(sorted[0].id).toBe("part-a")
			expect(sorted[1].id).toBe("part-b")
			expect(sorted[2].id).toBe("part-c")
		})
	})

	describe("Binary Search Correctness", () => {
		test("handles ULID-compatible IDs (lexicographic sorting)", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// ULIDs sort lexicographically by timestamp
			const session1: Session = {
				id: "01HX0000000000000000000000", // Earlier timestamp
				title: "First",
				directory: TEST_DIRECTORY,
				time: { created: 1, updated: 1 },
			}
			const session2: Session = {
				id: "01HX0000000000000000000001", // Later timestamp
				title: "Second",
				directory: TEST_DIRECTORY,
				time: { created: 2, updated: 2 },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session2 },
			})
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session1 },
			})

			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions[0].id).toBe("01HX0000000000000000000000")
			expect(sessions[1].id).toBe("01HX0000000000000000000001")
		})

		test("immutability - original arrays not modified", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			const beforeSessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})
			const afterSessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions

			// Different array references (immutable)
			expect(beforeSessions).not.toBe(afterSessions)
			expect(beforeSessions).toHaveLength(0)
			expect(afterSessions).toHaveLength(1)
		})
	})

	describe("Edge Cases", () => {
		test("handleEvent on non-existent directory auto-creates it", () => {
			const store = useOpencodeStore.getState()

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "session.updated",
				properties: { info: session },
			})

			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY]).toBeDefined()
			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions).toHaveLength(1)
		})

		test("setSessionReady on non-existent directory is no-op", () => {
			const store = useOpencodeStore.getState()
			store.setSessionReady("/non-existent", true)

			expect(useOpencodeStore.getState().directories["/non-existent"]).toBeUndefined()
		})

		test("setSessions on non-existent directory is no-op", () => {
			const store = useOpencodeStore.getState()
			store.setSessions("/non-existent", [])

			expect(useOpencodeStore.getState().directories["/non-existent"]).toBeUndefined()
		})
	})

	// ═══════════════════════════════════════════════════════════════
	// CONVENIENCE METHODS - Session
	// ═══════════════════════════════════════════════════════════════
	describe("getSession", () => {
		test("returns session by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Test Session",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.addSession(TEST_DIRECTORY, session)

			const result = useOpencodeStore.getState().getSession(TEST_DIRECTORY, "session-1")
			expect(result).toEqual(session)
		})

		test("returns undefined when session not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const result = useOpencodeStore.getState().getSession(TEST_DIRECTORY, "non-existent")
			expect(result).toBeUndefined()
		})

		test("returns undefined when directory does not exist", () => {
			const result = useOpencodeStore.getState().getSession("/non-existent", "session-1")
			expect(result).toBeUndefined()
		})
	})

	describe("getSessions", () => {
		test("returns all sessions for directory", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const sessions: Session[] = [
				{
					id: "session-a",
					title: "A",
					directory: TEST_DIRECTORY,
					time: { created: 1, updated: 1 },
				},
				{
					id: "session-b",
					title: "B",
					directory: TEST_DIRECTORY,
					time: { created: 2, updated: 2 },
				},
			]

			sessions.forEach((s) => store.addSession(TEST_DIRECTORY, s))

			const result = useOpencodeStore.getState().getSessions(TEST_DIRECTORY)
			expect(result).toHaveLength(2)
			expect(result[0].id).toBe("session-a")
			expect(result[1].id).toBe("session-b")
		})

		test("returns empty array when no sessions", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const result = useOpencodeStore.getState().getSessions(TEST_DIRECTORY)
			expect(result).toEqual([])
		})

		test("returns empty array when directory does not exist", () => {
			const result = useOpencodeStore.getState().getSessions("/non-existent")
			expect(result).toEqual([])
		})
	})

	describe("addSession", () => {
		test("adds session in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const sessionC: Session = {
				id: "session-c",
				title: "C",
				directory: TEST_DIRECTORY,
				time: { created: 3, updated: 3 },
			}
			const sessionA: Session = {
				id: "session-a",
				title: "A",
				directory: TEST_DIRECTORY,
				time: { created: 1, updated: 1 },
			}

			store.addSession(TEST_DIRECTORY, sessionC)
			store.addSession(TEST_DIRECTORY, sessionA)

			const sessions = useOpencodeStore.getState().getSessions(TEST_DIRECTORY)
			expect(sessions).toHaveLength(2)
			expect(sessions[0].id).toBe("session-a")
			expect(sessions[1].id).toBe("session-c")
		})

		test("auto-creates directory if not exists", () => {
			const store = useOpencodeStore.getState()

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.addSession(TEST_DIRECTORY, session)

			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY]).toBeDefined()
			expect(useOpencodeStore.getState().getSessions(TEST_DIRECTORY)).toHaveLength(1)
		})
	})

	describe("updateSession", () => {
		test("updates existing session with updater function", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Original",
				directory: TEST_DIRECTORY,
				time: { created: 1, updated: 1 },
			}

			store.addSession(TEST_DIRECTORY, session)

			store.updateSession(TEST_DIRECTORY, "session-1", (draft) => {
				draft.title = "Updated"
				draft.time.updated = 2
			})

			const updated = useOpencodeStore.getState().getSession(TEST_DIRECTORY, "session-1")
			expect(updated?.title).toBe("Updated")
			expect(updated?.time.updated).toBe(2)
		})

		test("no-op when session not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.updateSession(TEST_DIRECTORY, "non-existent", (draft) => {
				draft.title = "Should not crash"
			})

			// Should not throw, just be a no-op
			expect(useOpencodeStore.getState().getSessions(TEST_DIRECTORY)).toHaveLength(0)
		})
	})

	describe("removeSession", () => {
		test("removes session by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session1: Session = {
				id: "session-1",
				title: "First",
				directory: TEST_DIRECTORY,
				time: { created: 1, updated: 1 },
			}
			const session2: Session = {
				id: "session-2",
				title: "Second",
				directory: TEST_DIRECTORY,
				time: { created: 2, updated: 2 },
			}

			store.addSession(TEST_DIRECTORY, session1)
			store.addSession(TEST_DIRECTORY, session2)

			store.removeSession(TEST_DIRECTORY, "session-1")

			const sessions = useOpencodeStore.getState().getSessions(TEST_DIRECTORY)
			expect(sessions).toHaveLength(1)
			expect(sessions[0].id).toBe("session-2")
		})

		test("no-op when session not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.removeSession(TEST_DIRECTORY, "non-existent")

			// Should not throw
			expect(useOpencodeStore.getState().getSessions(TEST_DIRECTORY)).toHaveLength(0)
		})
	})

	// ═══════════════════════════════════════════════════════════════
	// CONVENIENCE METHODS - Message
	// ═══════════════════════════════════════════════════════════════
	describe("getMessages", () => {
		test("returns all messages for session", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messages: Message[] = [
				{ id: "msg-a", sessionID: "session-1", role: "user" },
				{ id: "msg-b", sessionID: "session-1", role: "assistant" },
			]

			messages.forEach((m) => store.addMessage(TEST_DIRECTORY, m))

			const result = useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")
			expect(result).toHaveLength(2)
			expect(result[0].id).toBe("msg-a")
			expect(result[1].id).toBe("msg-b")
		})

		test("returns empty array when no messages for session", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const result = useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")
			expect(result).toEqual([])
		})

		test("returns empty array when directory does not exist", () => {
			const result = useOpencodeStore.getState().getMessages("/non-existent", "session-1")
			expect(result).toEqual([])
		})
	})

	describe("addMessage", () => {
		test("adds message in sorted order", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const msgC: Message = {
				id: "msg-c",
				sessionID: "session-1",
				role: "user",
			}
			const msgA: Message = {
				id: "msg-a",
				sessionID: "session-1",
				role: "user",
			}

			store.addMessage(TEST_DIRECTORY, msgC)
			store.addMessage(TEST_DIRECTORY, msgA)

			const messages = useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")
			expect(messages).toHaveLength(2)
			expect(messages[0].id).toBe("msg-a")
			expect(messages[1].id).toBe("msg-c")
		})

		test("auto-creates directory if not exists", () => {
			const store = useOpencodeStore.getState()

			const message: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}

			store.addMessage(TEST_DIRECTORY, message)

			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY]).toBeDefined()
			expect(useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")).toHaveLength(1)
		})
	})

	describe("updateMessage", () => {
		test("updates existing message with updater function", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const message: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
				time: { created: 1 },
			}

			store.addMessage(TEST_DIRECTORY, message)

			store.updateMessage(TEST_DIRECTORY, "session-1", "msg-1", (draft) => {
				draft.role = "assistant"
				if (draft.time) {
					draft.time.completed = 2
				}
			})

			const messages = useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")
			expect(messages[0].role).toBe("assistant")
			expect(messages[0].time?.completed).toBe(2)
		})

		test("no-op when message not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.updateMessage(TEST_DIRECTORY, "session-1", "non-existent", (draft) => {
				draft.role = "Should not crash"
			})

			// Should not throw
			expect(useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")).toHaveLength(0)
		})
	})

	describe("removeMessage", () => {
		test("removes message by id", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const msg1: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}
			const msg2: Message = {
				id: "msg-2",
				sessionID: "session-1",
				role: "assistant",
			}

			store.addMessage(TEST_DIRECTORY, msg1)
			store.addMessage(TEST_DIRECTORY, msg2)

			store.removeMessage(TEST_DIRECTORY, "session-1", "msg-1")

			const messages = useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")
			expect(messages).toHaveLength(1)
			expect(messages[0].id).toBe("msg-2")
		})

		test("no-op when message not found", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.removeMessage(TEST_DIRECTORY, "session-1", "non-existent")

			// Should not throw
			expect(useOpencodeStore.getState().getMessages(TEST_DIRECTORY, "session-1")).toHaveLength(0)
		})
	})

	// ═══════════════════════════════════════════════════════════════
	// MEMOIZED SELECTORS (tested via direct selector logic)
	// ═══════════════════════════════════════════════════════════════
	describe("usePartSummary selector logic", () => {
		// Helper function that extracts the selector logic for testing
		// This mirrors what usePartSummary does but can be tested without React hooks
		const getPartSummary = (directory: string, messageId: string, partId: string) => {
			const state = useOpencodeStore.getState()
			const parts = state.directories[directory]?.parts[messageId]
			if (!parts) return undefined

			const part = parts.find((p) => p.id === partId)
			if (!part || part.type !== "tool") {
				return undefined
			}

			const partState = part.state as
				| { status: string; metadata?: { summary?: string } }
				| undefined
			if (!partState || partState.status === "pending") {
				return undefined
			}

			return partState.metadata?.summary
		}

		test("returns undefined for non-existent part", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const summary = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")
			expect(summary).toBeUndefined()
		})

		test("returns undefined for non-tool parts", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const textPart: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Hello",
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: textPart },
			})

			const summary = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")
			expect(summary).toBeUndefined()
		})

		test("returns undefined for pending tool parts", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const toolPart: any = {
				id: "part-1",
				messageID: "msg-1",
				type: "tool",
				content: "",
				state: {
					status: "pending",
					metadata: {},
				},
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: toolPart },
			})

			const summary = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")
			expect(summary).toBeUndefined()
		})

		test("returns summary for completed tool parts", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const toolPart: any = {
				id: "part-1",
				messageID: "msg-1",
				type: "tool",
				content: "",
				state: {
					status: "completed",
					metadata: {
						summary: "Task completed successfully",
					},
				},
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: toolPart },
			})

			const summary = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")
			expect(summary).toBe("Task completed successfully")
		})

		test("returns same value when summary unchanged (primitive value equality)", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const toolPart: any = {
				id: "part-1",
				messageID: "msg-1",
				type: "tool",
				content: "",
				state: {
					status: "completed",
					metadata: {
						summary: "Original summary",
					},
				},
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: toolPart },
			})

			// Get summary twice - should return same value
			// (Zustand's Object.is will see these as equal because strings are primitives)
			const summary1 = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")
			const summary2 = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")

			expect(summary1).toBe("Original summary")
			expect(summary2).toBe("Original summary")
			// Primitive values - same value means same reference
			expect(summary1).toBe(summary2)
		})

		test("returns different value when summary changes", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const toolPart: any = {
				id: "part-1",
				messageID: "msg-1",
				type: "tool",
				content: "",
				state: {
					status: "completed",
					metadata: {
						summary: "Original summary",
					},
				},
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: toolPart },
			})

			const summary1 = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")

			// Update summary
			const updatedPart: any = {
				...toolPart,
				state: {
					status: "completed",
					metadata: {
						summary: "Updated summary",
					},
				},
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "message.part.updated",
				properties: { part: updatedPart },
			})

			const summary2 = getPartSummary(TEST_DIRECTORY, "msg-1", "part-1")

			expect(summary1).toBe("Original summary")
			expect(summary2).toBe("Updated summary")
			expect(summary1).not.toBe(summary2)
		})
	})

	describe("Provider/Project Events", () => {
		test("handles provider.updated event (logs only, no state change)", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// Mock console.log to verify it's called
			const originalLog = console.log
			const logCalls: any[] = []
			console.log = (...args: any[]) => {
				logCalls.push(args)
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "provider.updated",
				properties: { id: "provider-1", name: "Test Provider" },
			})

			// Restore console.log
			console.log = originalLog

			// Verify log was called with expected args
			expect(logCalls.some((call) => call[0] === "[SSE] provider.updated:")).toBe(true)

			// Note: No state change expected until DirectoryState has providers array
		})

		test("handles project.updated event (logs only, no state change)", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// Mock console.log to verify it's called
			const originalLog = console.log
			const logCalls: any[] = []
			console.log = (...args: any[]) => {
				logCalls.push(args)
			}

			store.handleEvent(TEST_DIRECTORY, {
				type: "project.updated",
				properties: { id: "project-1", name: "Test Project" },
			})

			// Restore console.log
			console.log = originalLog

			// Verify log was called with expected args
			expect(logCalls.some((call) => call[0] === "[SSE] project.updated:")).toBe(true)

			// Note: No state change expected until DirectoryState has projects array
		})
	})

	// ═══════════════════════════════════════════════════════════════
	// SSE EVENT HANDLER (GlobalEvent wrapper)
	// ═══════════════════════════════════════════════════════════════
	describe("handleSSEEvent", () => {
		test("auto-creates directory if missing (prevents dropped events)", () => {
			const store = useOpencodeStore.getState()
			// Do NOT call initDirectory - verify events aren't dropped for uninitialized directories

			const session: Session = {
				id: "session-1",
				title: "Test Session",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			// Simulate GlobalEvent from SSE arriving for a directory not yet initialized
			// This happens when:
			// 1. SSE connection establishes before directory is bootstrapped
			// 2. SSE event arrives for a different project directory
			// 3. Race condition between bootstrap and first SSE event
			const globalEvent: any = {
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.created",
					properties: { info: session },
				},
			}

			// BEFORE: directory should not exist
			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY]).toBeUndefined()

			// Call handleSSEEvent - should NOT drop the event silently
			store.handleSSEEvent(globalEvent)

			// AFTER: directory auto-created with empty initial state
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.ready).toBe(false) // Not bootstrapped yet
			expect(dir.sessions).toHaveLength(1) // Session from SSE event was added (NOT dropped)
			expect(dir.sessionStatus).toEqual({})
			expect(dir.sessionDiff).toEqual({})
			expect(dir.todos).toEqual({})
			expect(dir.messages).toEqual({})
			expect(dir.parts).toEqual({})
		})

		test("handles session.status event for uninitialized directory", () => {
			const store = useOpencodeStore.getState()
			// Specific scenario: green dot indicators rely on session.status events
			// If directory doesn't exist when session.status arrives, indicator won't show

			const globalEvent: any = {
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.status",
					properties: {
						sessionID: "session-1",
						status: "running" as SessionStatus,
					},
				},
			}

			// BEFORE: no directory
			expect(useOpencodeStore.getState().directories[TEST_DIRECTORY]).toBeUndefined()

			// Receive session.status event via SSE
			store.handleSSEEvent(globalEvent)

			// AFTER: directory created, status stored (green dot can render)
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.sessionStatus["session-1"]).toBe("running")
		})

		test("routes GlobalEvent to handleEvent with correct directory and payload", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Test Session",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			// Simulate GlobalEvent from SSE
			// biome-ignore lint: using `as any` to bypass strict SDK types in tests
			const globalEvent: any = {
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.created",
					properties: { info: session },
				},
			}

			store.handleSSEEvent(globalEvent)

			// Verify session was added
			const sessions = useOpencodeStore.getState().directories[TEST_DIRECTORY].sessions
			expect(sessions).toHaveLength(1)
			expect(sessions[0].id).toBe("session-1")
		})

		test("handles multiple event types via GlobalEvent", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			const message: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}

			// Session created
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.created",
					properties: { info: session },
				},
			} as any)

			// Message updated
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.updated",
					properties: { info: message },
				},
			} as any)

			// Session status
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.status",
					properties: { sessionID: "session-1", status: "running" },
				},
			} as any)

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.sessions).toHaveLength(1)
			expect(dir.messages["session-1"]).toHaveLength(1)
			expect(dir.sessionStatus["session-1"]).toBe("running")
		})

		test("auto-creates directory from GlobalEvent", () => {
			const store = useOpencodeStore.getState()

			const session: Session = {
				id: "session-1",
				title: "Test",
				directory: TEST_DIRECTORY,
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "session.created",
					properties: { info: session },
				},
			} as any)

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.sessions).toHaveLength(1)
		})

		test("handles events from different directories", () => {
			const store = useOpencodeStore.getState()

			const session1: Session = {
				id: "session-1",
				title: "Project A",
				directory: "/project-a",
				time: { created: Date.now(), updated: Date.now() },
			}

			const session2: Session = {
				id: "session-2",
				title: "Project B",
				directory: "/project-b",
				time: { created: Date.now(), updated: Date.now() },
			}

			store.handleSSEEvent({
				directory: "/project-a",
				payload: {
					type: "session.created",
					properties: { info: session1 },
				},
			} as any)

			store.handleSSEEvent({
				directory: "/project-b",
				payload: {
					type: "session.created",
					properties: { info: session2 },
				},
			} as any)

			const dirA = useOpencodeStore.getState().directories["/project-a"]
			const dirB = useOpencodeStore.getState().directories["/project-b"]

			expect(dirA.sessions).toHaveLength(1)
			expect(dirA.sessions[0].id).toBe("session-1")
			expect(dirB.sessions).toHaveLength(1)
			expect(dirB.sessions[0].id).toBe("session-2")
		})

		test("messages from different directories do not leak", () => {
			const store = useOpencodeStore.getState()

			// Create messages in two different directories with same session ID
			// This simulates the leak scenario where multi-server SSE forwards
			// events from different projects
			const message1: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
			}

			const message2: Message = {
				id: "msg-2",
				sessionID: "session-1", // Same session ID, different directory
				role: "assistant",
			}

			store.handleSSEEvent({
				directory: "/project-a",
				payload: {
					type: "message.updated",
					properties: { info: message1 },
				},
			} as any)

			store.handleSSEEvent({
				directory: "/project-b",
				payload: {
					type: "message.updated",
					properties: { info: message2 },
				},
			} as any)

			// Each directory should only have its own message
			const dirA = useOpencodeStore.getState().directories["/project-a"]
			const dirB = useOpencodeStore.getState().directories["/project-b"]

			expect(dirA.messages["session-1"]).toHaveLength(1)
			expect(dirA.messages["session-1"][0].id).toBe("msg-1")
			expect(dirB.messages["session-1"]).toHaveLength(1)
			expect(dirB.messages["session-1"][0].id).toBe("msg-2")

			// Cross-check: project-a should NOT have project-b's message
			expect(dirA.messages["session-1"].some((m) => m.id === "msg-2")).toBe(false)
			expect(dirB.messages["session-1"].some((m) => m.id === "msg-1")).toBe(false)
		})
	})

	// ═══════════════════════════════════════════════════════════════
	// HYDRATION - Server-side initial data
	// ═══════════════════════════════════════════════════════════════
	describe("hydrateMessages", () => {
		test("populates empty store with messages and parts", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messages: Message[] = [
				{ id: "msg-1", sessionID: "session-1", role: "user" },
				{ id: "msg-2", sessionID: "session-1", role: "assistant" },
			]

			const parts: Record<string, Part[]> = {
				"msg-2": [
					{ id: "part-1", messageID: "msg-2", type: "text", content: "Hello" },
					{ id: "part-2", messageID: "msg-2", type: "tool", content: "" },
				],
			}

			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, parts)

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]

			// Verify messages hydrated
			expect(dir.messages["session-1"]).toHaveLength(2)
			expect(dir.messages["session-1"][0].id).toBe("msg-1")
			expect(dir.messages["session-1"][1].id).toBe("msg-2")

			// Verify parts hydrated
			expect(dir.parts["msg-2"]).toHaveLength(2)
			expect(dir.parts["msg-2"][0].id).toBe("part-1")
			expect(dir.parts["msg-2"][1].id).toBe("part-2")
		})

		test("sorts messages by ID", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messages: Message[] = [
				{ id: "msg-c", sessionID: "session-1", role: "user" },
				{ id: "msg-a", sessionID: "session-1", role: "user" },
				{ id: "msg-b", sessionID: "session-1", role: "assistant" },
			]

			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, {})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.messages["session-1"][0].id).toBe("msg-a")
			expect(dir.messages["session-1"][1].id).toBe("msg-b")
			expect(dir.messages["session-1"][2].id).toBe("msg-c")
		})

		test("sorts parts by ID for each message", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const parts: Record<string, Part[]> = {
				"msg-1": [
					{ id: "part-c", messageID: "msg-1", type: "text", content: "C" },
					{ id: "part-a", messageID: "msg-1", type: "text", content: "A" },
					{ id: "part-b", messageID: "msg-1", type: "tool", content: "B" },
				],
			}

			store.hydrateMessages(TEST_DIRECTORY, "session-1", [], parts)

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.parts["msg-1"][0].id).toBe("part-a")
			expect(dir.parts["msg-1"][1].id).toBe("part-b")
			expect(dir.parts["msg-1"][2].id).toBe("part-c")
		})

		test("auto-creates directory if not exists", () => {
			const store = useOpencodeStore.getState()
			// Do NOT call initDirectory - verify auto-creation

			const messages: Message[] = [{ id: "msg-1", sessionID: "session-1", role: "user" }]

			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, {})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir).toBeDefined()
			expect(dir.messages["session-1"]).toHaveLength(1)
		})

		test("SSE events do not duplicate hydrated messages", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// 1. Hydrate with initial message
			const messages: Message[] = [{ id: "msg-1", sessionID: "session-1", role: "user" }]
			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, {})

			// 2. Receive SSE event for SAME message ID
			const sseMessage: Message = {
				id: "msg-1",
				sessionID: "session-1",
				role: "user",
				time: { created: Date.now() }, // Updated with timestamp
			}

			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.updated",
					properties: { info: sseMessage },
				},
			} as any)

			// Should NOT duplicate - still only 1 message
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.messages["session-1"]).toHaveLength(1)
			expect(dir.messages["session-1"][0].time?.created).toBe(sseMessage.time?.created)
		})

		test("SSE events add NEW messages after hydration", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// 1. Hydrate with initial message
			const messages: Message[] = [{ id: "msg-1", sessionID: "session-1", role: "user" }]
			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, {})

			// 2. Receive SSE event for NEW message ID
			const newMessage: Message = {
				id: "msg-2",
				sessionID: "session-1",
				role: "assistant",
			}

			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.updated",
					properties: { info: newMessage },
				},
			} as any)

			// Should add new message
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.messages["session-1"]).toHaveLength(2)
			expect(dir.messages["session-1"][0].id).toBe("msg-1")
			expect(dir.messages["session-1"][1].id).toBe("msg-2")
		})

		test("SSE events do not duplicate hydrated parts", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// 1. Hydrate with initial parts
			const parts: Record<string, Part[]> = {
				"msg-1": [
					{
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						content: "Original",
					},
				],
			}
			store.hydrateMessages(TEST_DIRECTORY, "session-1", [], parts)

			// 2. Receive SSE event for SAME part ID (updated content)
			const ssePart: Part = {
				id: "part-1",
				messageID: "msg-1",
				type: "text",
				content: "Updated",
			}

			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.part.updated",
					properties: { part: ssePart },
				},
			} as any)

			// Should NOT duplicate - still only 1 part
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.parts["msg-1"]).toHaveLength(1)
			expect(dir.parts["msg-1"][0].content).toBe("Updated")
		})

		test("SSE events add NEW parts after hydration", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// 1. Hydrate with initial part
			const parts: Record<string, Part[]> = {
				"msg-1": [{ id: "part-1", messageID: "msg-1", type: "text", content: "First" }],
			}
			store.hydrateMessages(TEST_DIRECTORY, "session-1", [], parts)

			// 2. Receive SSE event for NEW part ID
			const newPart: Part = {
				id: "part-2",
				messageID: "msg-1",
				type: "tool",
				content: "",
			}

			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.part.updated",
					properties: { part: newPart },
				},
			} as any)

			// Should add new part
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.parts["msg-1"]).toHaveLength(2)
			expect(dir.parts["msg-1"][0].id).toBe("part-1")
			expect(dir.parts["msg-1"][1].id).toBe("part-2")
		})

		test("hydrate then SSE - messages and parts both deduplicate correctly", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			// 1. Hydrate with initial data
			const messages: Message[] = [
				{ id: "msg-1", sessionID: "session-1", role: "user" },
				{ id: "msg-2", sessionID: "session-1", role: "assistant" },
			]
			const parts: Record<string, Part[]> = {
				"msg-2": [
					{
						id: "part-1",
						messageID: "msg-2",
						type: "text",
						content: "Original text",
					},
					{ id: "part-2", messageID: "msg-2", type: "tool", content: "" },
				],
			}
			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, parts)

			// 2. SSE updates existing message
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.updated",
					properties: {
						info: {
							id: "msg-2",
							sessionID: "session-1",
							role: "assistant",
							time: { created: 123, completed: 456 },
						},
					},
				},
			} as any)

			// 3. SSE updates existing part
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-1",
							messageID: "msg-2",
							type: "text",
							content: "Updated via SSE",
						},
					},
				},
			} as any)

			// 4. SSE adds NEW message
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.updated",
					properties: {
						info: {
							id: "msg-3",
							sessionID: "session-1",
							role: "user",
						},
					},
				},
			} as any)

			// 5. SSE adds NEW part
			store.handleSSEEvent({
				directory: TEST_DIRECTORY,
				payload: {
					type: "message.part.updated",
					properties: {
						part: {
							id: "part-3",
							messageID: "msg-2",
							type: "text",
							content: "New part",
						},
					},
				},
			} as any)

			// Verify final state
			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]

			// Messages: 2 hydrated + 1 new = 3 total (no duplicates)
			expect(dir.messages["session-1"]).toHaveLength(3)
			expect(dir.messages["session-1"][0].id).toBe("msg-1")
			expect(dir.messages["session-1"][1].id).toBe("msg-2")
			expect(dir.messages["session-1"][1].time?.completed).toBe(456) // Updated
			expect(dir.messages["session-1"][2].id).toBe("msg-3")

			// Parts: 2 hydrated + 1 new = 3 total (no duplicates)
			expect(dir.parts["msg-2"]).toHaveLength(3)
			expect(dir.parts["msg-2"][0].id).toBe("part-1")
			expect(dir.parts["msg-2"][0].content).toBe("Updated via SSE") // Updated
			expect(dir.parts["msg-2"][1].id).toBe("part-2")
			expect(dir.parts["msg-2"][2].id).toBe("part-3")
		})

		test("handles empty messages and parts arrays", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			store.hydrateMessages(TEST_DIRECTORY, "session-1", [], {})

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.messages["session-1"]).toEqual([])
			expect(Object.keys(dir.parts)).toHaveLength(0)
		})

		test("handles parts for multiple messages", () => {
			const store = useOpencodeStore.getState()
			store.initDirectory(TEST_DIRECTORY)

			const messages: Message[] = [
				{ id: "msg-1", sessionID: "session-1", role: "user" },
				{ id: "msg-2", sessionID: "session-1", role: "assistant" },
				{ id: "msg-3", sessionID: "session-1", role: "assistant" },
			]

			const parts: Record<string, Part[]> = {
				"msg-2": [{ id: "part-a", messageID: "msg-2", type: "text", content: "A" }],
				"msg-3": [
					{ id: "part-b", messageID: "msg-3", type: "text", content: "B" },
					{ id: "part-c", messageID: "msg-3", type: "tool", content: "" },
				],
			}

			store.hydrateMessages(TEST_DIRECTORY, "session-1", messages, parts)

			const dir = useOpencodeStore.getState().directories[TEST_DIRECTORY]
			expect(dir.messages["session-1"]).toHaveLength(3)
			expect(dir.parts["msg-2"]).toHaveLength(1)
			expect(dir.parts["msg-3"]).toHaveLength(2)
			expect(dir.parts["msg-1"]).toBeUndefined() // msg-1 has no parts
		})
	})
})
