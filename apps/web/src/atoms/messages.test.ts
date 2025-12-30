/**
 * Messages Atom Tests
 *
 * Tests for message list management with binary search insertion and SSE updates.
 * Following TDD: Write tests first, implement to make them pass.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { Binary } from "@/lib/binary"
import type { Message } from "@opencode-vibe/react"

/**
 * Factory for creating test messages with minimal fields
 */
function createMessage(id: string, sessionID: string, role = "user"): Message {
	return {
		id,
		sessionID,
		role,
		time: { created: Date.now() },
	}
}

describe("Binary search utilities", () => {
	it("should find existing message by ID", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-c", "session-1"),
			createMessage("msg-e", "session-1"),
		]

		const result = Binary.search(messages, "msg-c", (m) => m.id)

		expect(result.found).toBe(true)
		expect(result.index).toBe(1)
	})

	it("should return insertion index when message not found", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-c", "session-1"),
			createMessage("msg-e", "session-1"),
		]

		const result = Binary.search(messages, "msg-d", (m) => m.id)

		expect(result.found).toBe(false)
		expect(result.index).toBe(2) // Should insert between msg-c and msg-e
	})

	it("should insert message at correct position", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-c", "session-1"),
		]

		const newMessage = createMessage("msg-b", "session-1")
		const result = Binary.insert(messages, newMessage, (m) => m.id)

		expect(result).toHaveLength(3)
		expect(result[0]?.id).toBe("msg-a")
		expect(result[1]?.id).toBe("msg-b")
		expect(result[2]?.id).toBe("msg-c")
	})

	it("should maintain sorted order after multiple insertions", () => {
		let messages: Message[] = []

		// Insert in random order
		messages = Binary.insert(messages, createMessage("msg-e", "session-1"), (m) => m.id)
		messages = Binary.insert(messages, createMessage("msg-b", "session-1"), (m) => m.id)
		messages = Binary.insert(messages, createMessage("msg-d", "session-1"), (m) => m.id)
		messages = Binary.insert(messages, createMessage("msg-a", "session-1"), (m) => m.id)
		messages = Binary.insert(messages, createMessage("msg-c", "session-1"), (m) => m.id)

		// Verify sorted order
		expect(messages.map((m) => m.id)).toEqual(["msg-a", "msg-b", "msg-c", "msg-d", "msg-e"])
	})

	it("should handle insertion into empty array", () => {
		const messages: Message[] = []
		const newMessage = createMessage("msg-a", "session-1")

		const result = Binary.insert(messages, newMessage, (m) => m.id)

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe("msg-a")
	})

	it("should handle insertion at beginning", () => {
		const messages: Message[] = [
			createMessage("msg-b", "session-1"),
			createMessage("msg-c", "session-1"),
		]

		const newMessage = createMessage("msg-a", "session-1")
		const result = Binary.insert(messages, newMessage, (m) => m.id)

		expect(result[0]?.id).toBe("msg-a")
	})

	it("should handle insertion at end", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-b", "session-1"),
		]

		const newMessage = createMessage("msg-z", "session-1")
		const result = Binary.insert(messages, newMessage, (m) => m.id)

		expect(result[result.length - 1]?.id).toBe("msg-z")
	})
})

describe("Binary search performance", () => {
	it("should handle large message list efficiently (O(log n))", () => {
		// Create a large sorted array (10,000 messages)
		const messages: Message[] = []
		for (let i = 0; i < 10000; i++) {
			messages.push(createMessage(`msg-${String(i).padStart(5, "0")}`, "session-1"))
		}

		// Search should be fast (log2(10000) ≈ 13 iterations)
		const start = performance.now()
		const result = Binary.search(messages, "msg-05000", (m) => m.id)
		const elapsed = performance.now() - start

		expect(result.found).toBe(true)
		expect(elapsed).toBeLessThan(1) // Should be sub-millisecond
	})

	it("should handle insertion into large list efficiently", () => {
		// Create a large sorted array
		const messages: Message[] = []
		for (let i = 0; i < 1000; i++) {
			messages.push(createMessage(`msg-${String(i * 2).padStart(5, "0")}`, "session-1"))
		}

		// Insert should be fast
		const start = performance.now()
		const newMessage = createMessage("msg-00500", "session-1")
		Binary.insert(messages, newMessage, (m) => m.id)
		const elapsed = performance.now() - start

		expect(elapsed).toBeLessThan(5) // Binary search + splice should be fast
	})
})

describe("Message list operations", () => {
	it("should handle messages with ULID IDs (sortable)", () => {
		// ULIDs are lexicographically sortable by timestamp
		const messages: Message[] = [
			createMessage("01ARZ3NDEKTSV4RRFFQ69G5FAV", "session-1"), // Older
			createMessage("01HZ3NDEKTSV4RRFFQ69G5FAV", "session-1"), // Newer
		]

		// Binary search should work on ULID IDs
		const result = Binary.search(messages, "01ARZ3NDEKTSV4RRFFQ69G5FAV", (m) => m.id)
		expect(result.found).toBe(true)
		expect(result.index).toBe(0)
	})

	it("should maintain message immutability on insert", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-c", "session-1"),
		]

		const originalLength = messages.length
		const newMessage = createMessage("msg-b", "session-1")

		Binary.insert(messages, newMessage, (m) => m.id)

		// Original array should be unchanged (immutable operation)
		expect(messages).toHaveLength(originalLength)
	})

	it("should handle messages with different sessionIDs", () => {
		const messages: Message[] = [
			createMessage("msg-a", "session-1"),
			createMessage("msg-b", "session-2"),
			createMessage("msg-c", "session-1"),
		]

		// Binary search by ID should work regardless of sessionID
		const result = Binary.search(messages, "msg-b", (m) => m.id)
		expect(result.found).toBe(true)
		expect(messages[result.index]?.sessionID).toBe("session-2")
	})
})

// Note: Tests for useMessages hook will be added in future phase
// when integration with Zustand store is implemented.
// Current phase focuses on binary search utilities which are already tested above.
