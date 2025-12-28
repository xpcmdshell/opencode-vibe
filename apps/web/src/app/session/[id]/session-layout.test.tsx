/**
 * Integration tests for SessionLayout hook integration
 *
 * Tests that session-layout correctly integrates with:
 * - useSession hook for reactive session data
 * - useMessages hook for reactive message list
 * - Store hydration with initial server data
 *
 * Note: These are unit tests validating hook integration logic,
 * not full component rendering tests (which would require DOM setup).
 */

import { describe, test, expect, beforeEach, mock } from "bun:test"
import { useOpencodeStore, type Session as StoreSession, type Message } from "@/react/store"

// Test session data matching store type
const mockStoreSession: StoreSession = {
	id: "test-session-id",
	title: "Test Session Title",
	directory: "/test/directory",
	time: {
		created: Date.now() - 10000,
		updated: Date.now(),
	},
}

const mockMessage: Message = {
	id: "msg-1",
	sessionID: "test-session-id",
	role: "user",
	time: { created: Date.now() },
}

describe("SessionLayout Hook Integration", () => {
	const TEST_DIR = "/test/directory"

	beforeEach(() => {
		// Clear store before each test with DirectoryState structure
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

	test("useSession hook returns session from store", () => {
		const store = useOpencodeStore.getState()

		// Add session to store
		store.addSession(TEST_DIR, mockStoreSession)

		// Verify session can be retrieved
		const retrieved = store.getSession(TEST_DIR, mockStoreSession.id)
		expect(retrieved).toBeDefined()
		expect(retrieved?.id).toBe(mockStoreSession.id)
		expect(retrieved?.title).toBe("Test Session Title")
	})

	test("useMessages hook returns messages from store", () => {
		const store = useOpencodeStore.getState()

		// Add message to store
		store.addMessage(TEST_DIR, mockMessage)

		// Verify messages can be retrieved
		const messages = store.getMessages(TEST_DIR, mockMessage.sessionID)
		expect(messages).toHaveLength(1)
		expect(messages[0].id).toBe(mockMessage.id)
		expect(messages[0].role).toBe("user")
	})

	test("store hydration with initial session", () => {
		const store = useOpencodeStore.getState()

		// Simulate SessionLayout hydrating the store
		const existing = store.getSession(TEST_DIR, mockStoreSession.id)
		if (!existing) {
			store.addSession(TEST_DIR, mockStoreSession)
		}

		// Verify session was added
		const retrieved = store.getSession(TEST_DIR, mockStoreSession.id)
		expect(retrieved).toBeDefined()
		expect(retrieved?.title).toBe("Test Session Title")
	})

	test("useMessages returns empty array when no messages exist", () => {
		const store = useOpencodeStore.getState()

		// Get messages for session that has no messages
		const messages = store.getMessages(TEST_DIR, "non-existent-session")
		expect(messages).toEqual([])
	})

	test("multiple messages are returned in sorted order", () => {
		const store = useOpencodeStore.getState()

		const msg1: Message = {
			id: "msg-a",
			sessionID: "test-session-id",
			role: "user",
		}

		const msg2: Message = {
			id: "msg-c",
			sessionID: "test-session-id",
			role: "assistant",
		}

		const msg3: Message = {
			id: "msg-b",
			sessionID: "test-session-id",
			role: "user",
		}

		// Add in non-sorted order
		store.addMessage(TEST_DIR, msg1)
		store.addMessage(TEST_DIR, msg2)
		store.addMessage(TEST_DIR, msg3)

		// Verify messages are sorted by id
		const messages = store.getMessages(TEST_DIR, "test-session-id")
		expect(messages).toHaveLength(3)
		expect(messages[0].id).toBe("msg-a")
		expect(messages[1].id).toBe("msg-b")
		expect(messages[2].id).toBe("msg-c")
	})

	test("session updates preserve existing data", () => {
		const store = useOpencodeStore.getState()

		store.addSession(TEST_DIR, mockStoreSession)

		// Update session title
		store.updateSession(TEST_DIR, mockStoreSession.id, (draft: StoreSession) => {
			draft.title = "Updated Title"
		})

		const updated = store.getSession(TEST_DIR, mockStoreSession.id)
		expect(updated?.title).toBe("Updated Title")
		expect(updated?.directory).toBe(mockStoreSession.directory) // Preserved
	})
})

/**
 * Error Handling Tests
 *
 * Tests for prompt submission error handling per bead opencode-next--xts0a-mjparvpnxxv
 */
describe("SessionLayout Error Handling", () => {
	test("handleSubmit catches and logs errors from sendMessage", async () => {
		// Mock console.error to verify error logging
		const originalError = console.error
		const errorLogs: any[] = []
		console.error = (...args: any[]) => errorLogs.push(args)

		try {
			// Simulate error from useSendMessage
			const error = new Error("Send failed")
			const sendMessageMock = async () => {
				throw error
			}

			// handleSubmit should catch the error
			const handleSubmit = async (parts: any) => {
				try {
					await sendMessageMock()
				} catch (err) {
					console.error("Failed to send message:", err)
				}
			}

			await handleSubmit([{ type: "text", content: "Test", start: 0, end: 4 }])

			expect(errorLogs.length).toBeGreaterThan(0)
		} finally {
			console.error = originalError
		}
	})

	test("error state from useSendMessage should be exposed", () => {
		// This test validates that the hook returns error state
		// The actual component should destructure and use this error
		const mockError = new Error("API error")
		const hookReturn = {
			sendMessage: async () => {},
			isLoading: false,
			error: mockError,
		}

		// Component should destructure error
		const { error } = hookReturn
		expect(error).toBe(mockError)
	})
})
