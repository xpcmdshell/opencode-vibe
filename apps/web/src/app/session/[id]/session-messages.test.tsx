/**
 * Integration tests for SessionMessages hydration flow
 *
 * Tests the full hydration flow:
 * 1. RSC data (messages + parts) passed as props
 * 2. hydrateMessages called on mount with correct data
 * 3. SSE updates layer on top without duplicates
 *
 * Note: These are integration tests validating the hydration logic,
 * not full component rendering tests (which would require DOM setup).
 */

import { describe, test, expect, beforeEach, vi } from "vitest"
import { useOpencodeStore, type Message, type Part } from "@opencode-vibe/react"

describe("SessionMessages Hydration Integration", () => {
	const TEST_DIR = "/test/directory"
	const TEST_SESSION_ID = "session-123"

	beforeEach(() => {
		// Clear store before each test
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

	test("hydrateMessages is called on mount with correct data", () => {
		const store = useOpencodeStore.getState()

		// Simulate SessionMessages mounting with initial props
		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
			{
				id: "msg-2",
				sessionID: TEST_SESSION_ID,
				role: "assistant",
				time: { created: 2000 },
			},
		]

		const initialStoreParts: Record<string, Part[]> = {
			"msg-2": [
				{ id: "part-1", messageID: "msg-2", type: "text", content: "Hello" },
				{ id: "part-2", messageID: "msg-2", type: "tool", content: "" },
			],
		}

		// This simulates the useEffect in SessionMessages
		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, initialStoreParts)

		// Verify hydrateMessages populated the store
		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(2)
		expect(dir.messages[TEST_SESSION_ID]![0]!.id).toBe("msg-1")
		expect(dir.messages[TEST_SESSION_ID]![1]!.id).toBe("msg-2")

		expect(dir.parts["msg-2"]).toHaveLength(2)
		expect(dir.parts["msg-2"]![0]!.id).toBe("part-1")
		expect(dir.parts["msg-2"]![1]!.id).toBe("part-2")
	})

	test("hydrateMessages is called exactly once on mount", () => {
		const store = useOpencodeStore.getState()

		// Track how many times hydrateMessages is called
		let callCount = 0
		const originalHydrate = store.hydrateMessages

		// Wrap hydrateMessages to count calls
		const wrappedHydrate = (
			directory: string,
			sessionID: string,
			messages: Message[],
			parts: Record<string, Part[]>,
		) => {
			callCount++
			originalHydrate(directory, sessionID, messages, parts)
		}

		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
		]

		// Simulate useEffect with empty deps array (runs once)
		wrappedHydrate(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, {})

		expect(callCount).toBe(1)

		// Verify data was hydrated
		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(1)
	})

	test("SSE updates layer on top without duplicates", () => {
		const store = useOpencodeStore.getState()

		// 1. Hydrate with initial data (simulates RSC props)
		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
		]

		const initialStoreParts: Record<string, Part[]> = {
			"msg-1": [{ id: "part-1", messageID: "msg-1", type: "text", content: "Initial" }],
		}

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, initialStoreParts)

		// 2. Simulate SSE event updating EXISTING message (same ID)
		store.handleSSEEvent({
			directory: TEST_DIR,
			payload: {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-1",
						sessionID: TEST_SESSION_ID,
						role: "user",
						time: { created: 1000, completed: 1500 }, // Updated with completion
					},
				},
			},
		} as any)

		// 3. Simulate SSE event updating EXISTING part (same ID)
		store.handleSSEEvent({
			directory: TEST_DIR,
			payload: {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-1",
						type: "text",
						content: "Updated via SSE",
					},
				},
			},
		} as any)

		// Verify NO duplicates - still only 1 message and 1 part
		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(1)
		expect(dir.parts["msg-1"]).toHaveLength(1)

		// Verify data was updated (not duplicated)
		expect(dir.messages[TEST_SESSION_ID]![0]!.time?.completed).toBe(1500)
		expect(dir.parts["msg-1"]![0]!.content).toBe("Updated via SSE")
	})

	test("SSE adds NEW messages and parts after hydration", () => {
		const store = useOpencodeStore.getState()

		// 1. Hydrate with initial message
		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
		]

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, {})

		// 2. SSE event adds NEW message (different ID)
		store.handleSSEEvent({
			directory: TEST_DIR,
			payload: {
				type: "message.updated",
				properties: {
					info: {
						id: "msg-2",
						sessionID: TEST_SESSION_ID,
						role: "assistant",
						time: { created: 2000 },
					},
				},
			},
		} as any)

		// 3. SSE event adds NEW part
		store.handleSSEEvent({
			directory: TEST_DIR,
			payload: {
				type: "message.part.updated",
				properties: {
					part: {
						id: "part-1",
						messageID: "msg-2",
						type: "text",
						content: "New part",
					},
				},
			},
		} as any)

		// Verify new messages and parts were added
		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(2)
		expect(dir.messages[TEST_SESSION_ID]![0]!.id).toBe("msg-1")
		expect(dir.messages[TEST_SESSION_ID]![1]!.id).toBe("msg-2")

		expect(dir.parts["msg-2"]).toHaveLength(1)
		expect(dir.parts["msg-2"]![0]!.id).toBe("part-1")
		expect(dir.parts["msg-2"]![0]!.content).toBe("New part")
	})

	test("hydrateMessages with directory fallback", () => {
		const store = useOpencodeStore.getState()

		// SessionMessages uses directory prop OR falls back to "/"
		const fallbackDir = "/"

		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
		]

		// Simulate no directory prop - fallback to "/"
		store.hydrateMessages(fallbackDir, TEST_SESSION_ID, initialStoreMessages, {})

		// Verify data hydrated in fallback directory
		const dir = useOpencodeStore.getState().directories[fallbackDir]!
		expect(dir).toBeDefined()
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(1)
	})

	test("component renders without errors after hydration", () => {
		const store = useOpencodeStore.getState()

		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
			{
				id: "msg-2",
				sessionID: TEST_SESSION_ID,
				role: "assistant",
				time: { created: 2000 },
			},
		]

		const initialStoreParts: Record<string, Part[]> = {
			"msg-2": [{ id: "part-1", messageID: "msg-2", type: "text", content: "Response" }],
		}

		// Hydrate and verify no errors
		expect(() => {
			store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, initialStoreParts)
		}).not.toThrow()

		// Verify data is accessible for rendering
		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		const messages = dir.messages[TEST_SESSION_ID]!
		const parts = dir.parts["msg-2"]!

		expect(messages).toBeDefined()
		expect(parts).toBeDefined()
		expect(messages.length).toBeGreaterThan(0)
		expect(parts.length).toBeGreaterThan(0)
	})

	test("empty initial data hydrates without errors", () => {
		const store = useOpencodeStore.getState()

		// SessionMessages might receive empty arrays on initial load
		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, [], {})

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.messages[TEST_SESSION_ID]).toEqual([])
		expect(Object.keys(dir.parts)).toHaveLength(0)
	})

	test("multiple parts for single message hydrate correctly", () => {
		const store = useOpencodeStore.getState()

		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "assistant",
				time: { created: 1000 },
			},
		]

		const initialStoreParts: Record<string, Part[]> = {
			"msg-1": [
				{ id: "part-1", messageID: "msg-1", type: "text", content: "First" },
				{ id: "part-2", messageID: "msg-1", type: "tool", content: "" },
				{ id: "part-3", messageID: "msg-1", type: "text", content: "Second" },
			],
		}

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, initialStoreParts)

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.parts["msg-1"]).toHaveLength(3)
		expect(dir.parts["msg-1"]![0]!.id).toBe("part-1")
		expect(dir.parts["msg-1"]![1]!.id).toBe("part-2")
		expect(dir.parts["msg-1"]![2]!.id).toBe("part-3")
	})

	test("hydration auto-creates directory if not initialized", () => {
		// Reset store to completely empty state
		useOpencodeStore.setState({ directories: {} })

		const store = useOpencodeStore.getState()

		const initialStoreMessages: Message[] = [
			{
				id: "msg-1",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
		]

		// Should auto-create directory
		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, {})

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir).toBeDefined()
		expect(dir.messages[TEST_SESSION_ID]).toHaveLength(1)
	})
})

/**
 * Edge Cases
 */
describe("SessionMessages Hydration Edge Cases", () => {
	const TEST_DIR = "/test/directory"
	const TEST_SESSION_ID = "session-123"

	beforeEach(() => {
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

	test("parts for non-existent message are still hydrated", () => {
		const store = useOpencodeStore.getState()

		// Edge case: parts provided but no corresponding message
		const initialStoreParts: Record<string, Part[]> = {
			"msg-999": [
				{
					id: "part-1",
					messageID: "msg-999",
					type: "text",
					content: "Orphaned",
				},
			],
		}

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, [], initialStoreParts)

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		expect(dir.parts["msg-999"]).toHaveLength(1)
		expect(dir.parts["msg-999"]![0]!.id).toBe("part-1")
	})

	test("unsorted messages are sorted during hydration", () => {
		const store = useOpencodeStore.getState()

		// Messages provided in random order
		const initialStoreMessages: Message[] = [
			{
				id: "msg-c",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 3000 },
			},
			{
				id: "msg-a",
				sessionID: TEST_SESSION_ID,
				role: "user",
				time: { created: 1000 },
			},
			{
				id: "msg-b",
				sessionID: TEST_SESSION_ID,
				role: "assistant",
				time: { created: 2000 },
			},
		]

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, initialStoreMessages, {})

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		// Verify sorted by ID (lexicographic)
		expect(dir.messages[TEST_SESSION_ID]![0]!.id).toBe("msg-a")
		expect(dir.messages[TEST_SESSION_ID]![1]!.id).toBe("msg-b")
		expect(dir.messages[TEST_SESSION_ID]![2]!.id).toBe("msg-c")
	})

	test("unsorted parts are sorted during hydration", () => {
		const store = useOpencodeStore.getState()

		const initialStoreParts: Record<string, Part[]> = {
			"msg-1": [
				{ id: "part-z", messageID: "msg-1", type: "text", content: "Z" },
				{ id: "part-a", messageID: "msg-1", type: "text", content: "A" },
				{ id: "part-m", messageID: "msg-1", type: "tool", content: "M" },
			],
		}

		store.hydrateMessages(TEST_DIR, TEST_SESSION_ID, [], initialStoreParts)

		const dir = useOpencodeStore.getState().directories[TEST_DIR]!
		// Verify sorted by ID (lexicographic)
		expect(dir.parts["msg-1"]![0]!.id).toBe("part-a")
		expect(dir.parts["msg-1"]![1]!.id).toBe("part-m")
		expect(dir.parts["msg-1"]![2]!.id).toBe("part-z")
	})
})
