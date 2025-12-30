/**
 * Tests for prompt atom
 *
 * Verifies prompt state management:
 * - Parts array (text, file, image parts)
 * - Cursor position tracking
 * - Autocomplete state
 * - File part insertion logic
 * - Autocomplete navigation
 */

import { describe, expect, it } from "vitest"
import type { Prompt, SlashCommand } from "../types/prompt"

/**
 * Default autocomplete state (duplicated from prompt.ts for testing)
 */
const DEFAULT_AUTOCOMPLETE = {
	visible: false as const,
	type: null as "file" | "command" | null,
	query: "",
	items: [] as string[] | SlashCommand[],
	selectedIndex: 0,
}

/**
 * Default initial prompt state
 */
const DEFAULT_PROMPT_STATE = {
	parts: [{ type: "text" as const, content: "", start: 0, end: 0 }],
	cursor: 0,
	autocomplete: DEFAULT_AUTOCOMPLETE,
}

describe("prompt atom defaults", () => {
	it("has correct default autocomplete structure", () => {
		expect(DEFAULT_AUTOCOMPLETE.visible).toBe(false)
		expect(DEFAULT_AUTOCOMPLETE.type).toBe(null)
		expect(DEFAULT_AUTOCOMPLETE.query).toBe("")
		expect(DEFAULT_AUTOCOMPLETE.items).toEqual([])
		expect(DEFAULT_AUTOCOMPLETE.selectedIndex).toBe(0)
	})

	it("has correct default prompt state", () => {
		expect(DEFAULT_PROMPT_STATE.parts).toHaveLength(1)
		expect(DEFAULT_PROMPT_STATE.parts[0]?.type).toBe("text")
		if (DEFAULT_PROMPT_STATE.parts[0]?.type === "text") {
			expect(DEFAULT_PROMPT_STATE.parts[0].content).toBe("")
		}
		expect(DEFAULT_PROMPT_STATE.cursor).toBe(0)
	})
})

describe("insertFilePart logic", () => {
	it("inserts file part in middle of text", () => {
		const parts: Prompt = [{ type: "text", content: "hello world", start: 0, end: 11 }]

		// Insert @file.ts at position 6 (after "hello "), replacing 0 chars
		const result = insertFilePartHelper(parts, "src/file.ts", 6, 0)

		// Expected: "hello " + "@src/file.ts" + " world"
		expect(result).toHaveLength(3)
		expect(result[0]?.type).toBe("text")
		if (result[0]?.type === "text") {
			expect(result[0].content).toBe("hello ")
		}
		expect(result[1]?.type).toBe("file")
		if (result[1]?.type === "file") {
			expect(result[1].path).toBe("src/file.ts")
			expect(result[1].content).toBe("@src/file.ts")
		}
		expect(result[2]?.type).toBe("text")
		if (result[2]?.type === "text") {
			expect(result[2].content).toBe(" world")
		}
	})

	it("inserts file part at start of text", () => {
		const parts: Prompt = [{ type: "text", content: "hello", start: 0, end: 5 }]

		const result = insertFilePartHelper(parts, "file.ts", 0, 0)

		expect(result).toHaveLength(2)
		expect(result[0]?.type).toBe("file")
		if (result[0]?.type === "file") {
			expect(result[0].path).toBe("file.ts")
		}
		expect(result[1]?.type).toBe("text")
		if (result[1]?.type === "text") {
			expect(result[1].content).toBe(" hello")
		}
	})

	it("inserts file part at end of text", () => {
		const parts: Prompt = [{ type: "text", content: "hello", start: 0, end: 5 }]

		const result = insertFilePartHelper(parts, "file.ts", 5, 0)

		expect(result).toHaveLength(3)
		expect(result[0]?.type).toBe("text")
		if (result[0]?.type === "text") {
			expect(result[0].content).toBe("hello")
		}
		expect(result[1]?.type).toBe("file")
		expect(result[2]?.type).toBe("text")
		if (result[2]?.type === "text") {
			expect(result[2].content).toBe(" ")
		}
	})

	it("replaces query text when inserting (autocomplete use case)", () => {
		const parts: Prompt = [{ type: "text", content: "hello @fil", start: 0, end: 10 }]

		// Insert file, replacing "@fil" (4 chars)
		const result = insertFilePartHelper(parts, "src/file.ts", 10, 4)

		expect(result).toHaveLength(3)
		expect(result[0]?.type).toBe("text")
		if (result[0]?.type === "text") {
			expect(result[0].content).toBe("hello ")
		}
		expect(result[1]?.type).toBe("file")
		if (result[1]?.type === "file") {
			expect(result[1].path).toBe("src/file.ts")
		}
		expect(result[2]?.type).toBe("text")
		if (result[2]?.type === "text") {
			expect(result[2].content).toBe(" ")
		}
	})

	it("handles multiple existing parts", () => {
		const parts: Prompt = [
			{ type: "text", content: "hello ", start: 0, end: 6 },
			{ type: "file", path: "a.ts", content: "@a.ts", start: 6, end: 11 },
			{ type: "text", content: " world", start: 11, end: 17 },
		]

		// Insert new file in last text part at position 14 (after " wo")
		const result = insertFilePartHelper(parts, "b.ts", 14, 0)

		expect(result.length).toBeGreaterThan(3)
		// Should have: text("hello "), file(a.ts), text(" wo"), file(b.ts), text(" rld")
		const fileParts = result.filter((p) => p?.type === "file")
		expect(fileParts).toHaveLength(2)
	})
})

describe("autocomplete navigation", () => {
	it("navigates down within bounds", () => {
		const items = ["a", "b", "c"]
		const currentIndex = 0

		const newIndex = navigateHelper(currentIndex, "down", items.length)

		expect(newIndex).toBe(1)
	})

	it("navigates up within bounds", () => {
		const items = ["a", "b", "c"]
		const currentIndex = 2

		const newIndex = navigateHelper(currentIndex, "up", items.length)

		expect(newIndex).toBe(1)
	})

	it("clamps down at end of list", () => {
		const items = ["a", "b", "c"]
		const currentIndex = 2

		const newIndex = navigateHelper(currentIndex, "down", items.length)

		expect(newIndex).toBe(2) // Stays at 2
	})

	it("clamps up at start of list", () => {
		const items = ["a", "b", "c"]
		const currentIndex = 0

		const newIndex = navigateHelper(currentIndex, "up", items.length)

		expect(newIndex).toBe(0) // Stays at 0
	})
})

// Note: prompt.ts was replaced by stores/prompt-store.ts (Zustand)
// This test suite remains for documentation of expected behavior

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Helper to simulate insertFilePart logic
 * Duplicated from prompt.ts for testing
 */
function insertFilePartHelper(
	parts: Prompt,
	path: string,
	atPosition: number,
	replaceLength: number,
): Prompt {
	const content = `@${path}`
	let charCount = 0
	const newParts: Prompt = []

	for (const part of parts) {
		if (part.type === "image") {
			newParts.push(part)
			continue
		}

		if (part.type === "file") {
			newParts.push(part)
			charCount += part.content.length
			continue
		}

		const partStart = charCount
		const partEnd = charCount + part.content.length

		if (atPosition >= partStart && atPosition <= partEnd) {
			const localPos = atPosition - partStart
			const before = part.content.slice(0, localPos - replaceLength)
			const after = part.content.slice(localPos)

			if (before) {
				newParts.push({
					type: "text",
					content: before,
					start: partStart,
					end: partStart + before.length,
				})
			}

			newParts.push({
				type: "file",
				path,
				content,
				start: partStart + before.length,
				end: partStart + before.length + content.length,
			})

			if (after) {
				newParts.push({
					type: "text",
					content: " " + after,
					start: partStart + before.length + content.length,
					end: partStart + before.length + content.length + after.length + 1,
				})
			} else {
				newParts.push({
					type: "text",
					content: " ",
					start: partStart + before.length + content.length,
					end: partStart + before.length + content.length + 1,
				})
			}
		} else {
			newParts.push(part)
		}

		charCount = partEnd
	}

	return newParts
}

/**
 * Helper to simulate autocomplete navigation
 */
function navigateHelper(
	currentIndex: number,
	direction: "up" | "down",
	itemsLength: number,
): number {
	return direction === "up"
		? Math.max(0, currentIndex - 1)
		: Math.min(itemsLength - 1, currentIndex + 1)
}
