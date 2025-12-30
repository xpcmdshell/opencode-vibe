import { describe, test, expect } from "vitest"
import type { ToolPart } from "@opencode-ai/sdk/client"
import { getToolContextLines, hasExpandableContent } from "./tool"

// Helper to create a minimal ToolPart for testing
function createToolPart(tool: string, state: ToolPart["state"]): ToolPart {
	return {
		id: "part-1",
		sessionID: "session-1",
		messageID: "message-1",
		type: "tool",
		callID: "call-1",
		tool,
		state,
	}
}

describe("getToolContextLines", () => {
	describe("read tool", () => {
		test("extracts filePath and line count from completed state", () => {
			const part = createToolPart("read", {
				status: "completed",
				input: { filePath: "src/components/Button.tsx" },
				output: "file contents",
				title: "245 lines",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/components/Button.tsx",
				secondary: "245 lines",
			})
		})

		test("extracts filePath without line count when title is missing", () => {
			const part = createToolPart("read", {
				status: "running",
				input: { filePath: "src/utils.ts" },
				metadata: {},
				time: { start: 0 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/utils.ts",
				secondary: null,
			})
		})

		test("handles missing filePath", () => {
			const part = createToolPart("read", {
				status: "pending",
				input: {},
				raw: "",
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: null,
				secondary: null,
			})
		})
	})

	describe("edit tool", () => {
		test("extracts filePath from input", () => {
			const part = createToolPart("edit", {
				status: "completed",
				input: { filePath: "src/index.ts", oldString: "foo", newString: "bar" },
				output: "success",
				title: "Edited 1 file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/index.ts",
				secondary: "1 change",
			})
		})

		test("handles multiple changes from title", () => {
			const part = createToolPart("edit", {
				status: "completed",
				input: { filePath: "src/index.ts", oldString: "foo", newString: "bar" },
				output: "success",
				title: "Edited 3 occurrences",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/index.ts",
				secondary: "3 changes",
			})
		})
	})

	describe("write tool", () => {
		test("shows 'New file' for new files", () => {
			const part = createToolPart("write", {
				status: "completed",
				input: { filePath: "src/new-file.ts", content: "export const x = 1" },
				output: "success",
				title: "Created file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/new-file.ts",
				secondary: "New file",
			})
		})

		test("shows size for existing files", () => {
			const part = createToolPart("write", {
				status: "completed",
				input: { filePath: "src/existing.ts", content: "x".repeat(1500) },
				output: "success",
				title: "Updated file",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "src/existing.ts",
				secondary: "1.5 KB",
			})
		})
	})

	describe("grep tool", () => {
		test("extracts pattern and path from input", () => {
			const part = createToolPart("grep", {
				status: "completed",
				input: { pattern: "useEffect", path: "src/" },
				output: "5 matches",
				title: "5 matches found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "useEffect in src/",
				secondary: "5 matches",
			})
		})

		test("handles no matches", () => {
			const part = createToolPart("grep", {
				status: "completed",
				input: { pattern: "foobar", path: "." },
				output: "",
				title: "No matches",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "foobar in .",
				secondary: "No matches",
			})
		})
	})

	describe("glob tool", () => {
		test("extracts pattern and file count", () => {
			const part = createToolPart("glob", {
				status: "completed",
				input: { pattern: "**/*.tsx" },
				output: "file1.tsx\nfile2.tsx\nfile3.tsx",
				title: "3 files found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "**/*.tsx",
				secondary: "3 files",
			})
		})
	})

	describe("bash tool", () => {
		test("truncates long commands", () => {
			const part = createToolPart("bash", {
				status: "completed",
				input: {
					command: "git commit -m 'this is a very long commit message that should be truncated'",
				},
				output: "success",
				title: "exit 0",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result.primary).toHaveLength(50)
			expect(result.primary).toMatch(/\.\.\.$/)
			expect(result.secondary).toBe("exit 0")
		})

		test("shows short commands as-is", () => {
			const part = createToolPart("bash", {
				status: "completed",
				input: { command: "ls -la" },
				output: "file list",
				title: "exit 0",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "ls -la",
				secondary: "exit 0",
			})
		})
	})

	describe("task tool", () => {
		test("returns null to delegate to SubagentCurrentActivity", () => {
			const part = createToolPart("task", {
				status: "running",
				input: { description: "Debug the auth flow" },
				metadata: {},
				time: { start: 0 },
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: "Debug the auth flow",
				secondary: null,
			})
		})
	})

	describe("unknown tools", () => {
		test("returns null for primary to avoid redundant display", () => {
			const part = createToolPart("custom_tool", {
				status: "pending",
				input: { foo: "bar" },
				raw: "",
			})

			const result = getToolContextLines(part)
			expect(result).toEqual({
				primary: null,
				secondary: null,
			})
		})
	})
})

describe("hasExpandableContent", () => {
	test("returns true for completed state with output", () => {
		const part = createToolPart("read", {
			status: "completed",
			input: { filePath: "test.ts" },
			output: "file contents",
			title: "Success",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(true)
	})

	test("returns true for error state with error message", () => {
		const part = createToolPart("read", {
			status: "error",
			input: { filePath: "test.ts" },
			error: "File not found",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(true)
	})

	test("returns false for pending state", () => {
		const part = createToolPart("read", {
			status: "pending",
			input: { filePath: "test.ts" },
			raw: "",
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})

	test("returns false for running state without output", () => {
		const part = createToolPart("read", {
			status: "running",
			input: { filePath: "test.ts" },
			metadata: {},
			time: { start: 0 },
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})

	test("returns false for completed state with empty string output", () => {
		const part = createToolPart("read", {
			status: "completed",
			input: { filePath: "test.ts" },
			output: "",
			title: "Success",
			metadata: {},
			time: { start: 0, end: 100 },
		})

		expect(hasExpandableContent(part.state)).toBe(false)
	})
})
