/**
 * Parts Atom Tests
 *
 * Tests for part list management with binary search insertion and SSE updates.
 * Following TDD: Write tests first, implement to make them pass.
 */

import { describe, it, expect } from "vitest"
import { Binary } from "@/lib/binary"
import type { Part } from "@opencode-vibe/react"

/**
 * Factory for creating test parts with minimal fields
 */
function createPart(id: string, messageID: string, type = "text", content = ""): Part {
	return {
		id,
		messageID,
		type,
		content,
	}
}

describe("Binary search utilities for parts", () => {
	it("should find existing part by ID", () => {
		const parts: Part[] = [
			createPart("part-a", "msg-1"),
			createPart("part-c", "msg-1"),
			createPart("part-e", "msg-1"),
		]

		const result = Binary.search(parts, "part-c", (p) => p.id)

		expect(result.found).toBe(true)
		expect(result.index).toBe(1)
	})

	it("should return insertion index when part not found", () => {
		const parts: Part[] = [
			createPart("part-a", "msg-1"),
			createPart("part-c", "msg-1"),
			createPart("part-e", "msg-1"),
		]

		const result = Binary.search(parts, "part-d", (p) => p.id)

		expect(result.found).toBe(false)
		expect(result.index).toBe(2) // Should insert between part-c and part-e
	})

	it("should insert part at correct position", () => {
		const parts: Part[] = [createPart("part-a", "msg-1"), createPart("part-c", "msg-1")]

		const newPart = createPart("part-b", "msg-1")
		const result = Binary.insert(parts, newPart, (p) => p.id)

		expect(result).toHaveLength(3)
		expect(result[0]?.id).toBe("part-a")
		expect(result[1]?.id).toBe("part-b")
		expect(result[2]?.id).toBe("part-c")
	})

	it("should maintain sorted order after multiple insertions", () => {
		let parts: Part[] = []

		// Insert in random order
		parts = Binary.insert(parts, createPart("part-e", "msg-1"), (p) => p.id)
		parts = Binary.insert(parts, createPart("part-b", "msg-1"), (p) => p.id)
		parts = Binary.insert(parts, createPart("part-d", "msg-1"), (p) => p.id)
		parts = Binary.insert(parts, createPart("part-a", "msg-1"), (p) => p.id)
		parts = Binary.insert(parts, createPart("part-c", "msg-1"), (p) => p.id)

		// Verify sorted order
		expect(parts.map((p) => p.id)).toEqual(["part-a", "part-b", "part-c", "part-d", "part-e"])
	})

	it("should handle insertion into empty array", () => {
		const parts: Part[] = []
		const newPart = createPart("part-a", "msg-1")

		const result = Binary.insert(parts, newPart, (p) => p.id)

		expect(result).toHaveLength(1)
		expect(result[0]?.id).toBe("part-a")
	})

	it("should handle insertion at beginning", () => {
		const parts: Part[] = [createPart("part-b", "msg-1"), createPart("part-c", "msg-1")]

		const newPart = createPart("part-a", "msg-1")
		const result = Binary.insert(parts, newPart, (p) => p.id)

		expect(result[0]?.id).toBe("part-a")
	})

	it("should handle insertion at end", () => {
		const parts: Part[] = [createPart("part-a", "msg-1"), createPart("part-b", "msg-1")]

		const newPart = createPart("part-z", "msg-1")
		const result = Binary.insert(parts, newPart, (p) => p.id)

		expect(result[result.length - 1]?.id).toBe("part-z")
	})
})

describe("Binary search performance", () => {
	it("should handle large part list efficiently (O(log n))", () => {
		// Create a large sorted array (10,000 parts)
		const parts: Part[] = []
		for (let i = 0; i < 10000; i++) {
			parts.push(createPart(`part-${String(i).padStart(5, "0")}`, "msg-1"))
		}

		// Search should be fast (log2(10000) ≈ 13 iterations)
		const start = performance.now()
		const result = Binary.search(parts, "part-05000", (p) => p.id)
		const elapsed = performance.now() - start

		expect(result.found).toBe(true)
		expect(elapsed).toBeLessThan(1) // Should be sub-millisecond
	})

	it("should handle insertion into large list efficiently", () => {
		// Create a large sorted array
		const parts: Part[] = []
		for (let i = 0; i < 1000; i++) {
			parts.push(createPart(`part-${String(i * 2).padStart(5, "0")}`, "msg-1"))
		}

		// Insert should be fast
		const start = performance.now()
		const newPart = createPart("part-00500", "msg-1")
		Binary.insert(parts, newPart, (p) => p.id)
		const elapsed = performance.now() - start

		expect(elapsed).toBeLessThan(5) // Binary search + splice should be fast
	})
})

describe("Part list operations", () => {
	it("should handle parts with ULID IDs (sortable)", () => {
		// ULIDs are lexicographically sortable by timestamp
		const parts: Part[] = [
			createPart("01ARZ3NDEKTSV4RRFFQ69G5FAV", "msg-1"), // Older
			createPart("01HZ3NDEKTSV4RRFFQ69G5FAV", "msg-1"), // Newer
		]

		// Binary search should work on ULID IDs
		const result = Binary.search(parts, "01ARZ3NDEKTSV4RRFFQ69G5FAV", (p) => p.id)
		expect(result.found).toBe(true)
		expect(result.index).toBe(0)
	})

	it("should maintain part immutability on insert", () => {
		const parts: Part[] = [createPart("part-a", "msg-1"), createPart("part-c", "msg-1")]

		const originalLength = parts.length
		const newPart = createPart("part-b", "msg-1")

		Binary.insert(parts, newPart, (p) => p.id)

		// Original array should be unchanged (immutable operation)
		expect(parts).toHaveLength(originalLength)
	})

	it("should handle parts with different messageIDs", () => {
		const parts: Part[] = [
			createPart("part-a", "msg-1"),
			createPart("part-b", "msg-2"),
			createPart("part-c", "msg-1"),
		]

		// Binary search by ID should work regardless of messageID
		const result = Binary.search(parts, "part-b", (p) => p.id)
		expect(result.found).toBe(true)
		expect(parts[result.index]?.messageID).toBe("msg-2")
	})

	it("should handle parts with different types", () => {
		const parts: Part[] = [
			createPart("part-a", "msg-1", "text"),
			createPart("part-b", "msg-1", "tool_call"),
			createPart("part-c", "msg-1", "compaction"),
		]

		// Binary search should work regardless of type
		const result = Binary.search(parts, "part-b", (p) => p.id)
		expect(result.found).toBe(true)
		expect(parts[result.index]?.type).toBe("tool_call")
	})
})

describe("Part filtering by session", () => {
	it("should filter parts for a specific session via messageID lookup", () => {
		// In practice, we'd need to know which messages belong to which session
		// This test demonstrates the concept that parts are associated with messages
		const parts: Part[] = [
			createPart("part-a", "msg-session1-1"),
			createPart("part-b", "msg-session1-1"),
			createPart("part-c", "msg-session2-1"),
			createPart("part-d", "msg-session1-2"),
		]

		// Filter parts for session 1 (assuming message IDs contain session identifier)
		const session1Parts = parts.filter((p) => p.messageID.includes("session1"))

		expect(session1Parts).toHaveLength(3)
		expect(session1Parts.map((p) => p.id)).toEqual(["part-a", "part-b", "part-d"])
	})
})

// Note: Tests for useMessageParts hook will be added when implementing the hook
// Current phase focuses on binary search utilities which are already tested above.
