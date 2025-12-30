import { describe, test, expect, beforeAll, afterEach } from "vitest"
import { Window } from "happy-dom"
import { render, cleanup } from "@testing-library/react"
import { Tool } from "./tool"
import type { ToolPart } from "@opencode-ai/sdk/client"

// Set up DOM for React component tests
beforeAll(() => {
	const window = new Window()
	// @ts-ignore - happy-dom types don't match perfectly
	global.document = window.document
	// @ts-ignore
	global.window = window
})

afterEach(() => {
	cleanup()
})

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

// Helper to query text content (avoids screen import issue)
function getByText(container: HTMLElement, text: string): Element | null {
	// Simple recursive search through textContent
	const elements = container.querySelectorAll("*")
	for (const el of elements) {
		// Check direct text nodes only (not nested)
		for (const child of el.childNodes) {
			if (child.nodeType === 3 && child.textContent?.includes(text)) {
				return el
			}
		}
	}
	return null
}

describe("ToolCard (enhanced 3-line display)", () => {
	describe("read tool", () => {
		test("renders 3 lines: tool name, filePath, line count", () => {
			const part = createToolPart("read", {
				status: "completed",
				input: { filePath: "src/components/Button.tsx" },
				output: "file contents here...",
				title: "245 lines",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Line 1: Tool name
			expect(getByText(container, "read")).toBeDefined()

			// Line 2: File path
			expect(getByText(container, "src/components/Button.tsx")).toBeDefined()

			// Line 3: Line count
			expect(getByText(container, "245 lines")).toBeDefined()

			// Status icon (completed = checkmark)
			const svg = container.querySelector('svg[class*="text-green"]')
			expect(svg).toBeDefined()
		})
	})

	describe("grep tool", () => {
		test("renders pattern and match count", () => {
			const part = createToolPart("grep", {
				status: "completed",
				input: { pattern: "useEffect", path: "src/" },
				output: "match results",
				title: "5 matches found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			expect(getByText(container, "grep")).toBeDefined()
			expect(getByText(container, "useEffect in src/")).toBeDefined()
			expect(getByText(container, "5 matches")).toBeDefined()
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

			const { container } = render(<Tool toolPart={part} />)

			expect(getByText(container, "No matches")).toBeDefined()
		})
	})

	describe("bash tool", () => {
		test("truncates long commands", () => {
			const longCommand =
				"git commit -m 'this is a very long commit message that should be truncated'"
			const part = createToolPart("bash", {
				status: "completed",
				input: { command: longCommand },
				output: "success",
				title: "exit 0",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Should show truncated command (50 chars max)
			const commandEl = container.querySelector('[title*="git commit"]')
			expect(commandEl?.textContent?.length).toBeLessThanOrEqual(50)
			expect(commandEl?.textContent).toMatch(/\.\.\.$/)

			// Should show exit code
			expect(getByText(container, "exit 0")).toBeDefined()
		})
	})

	describe("status icons", () => {
		test("pending shows empty circle", () => {
			const part = createToolPart("read", {
				status: "pending",
				input: { filePath: "test.ts" },
				raw: "",
			})

			const { container } = render(<Tool toolPart={part} />)

			// Look for CircleIcon (pending)
			const svg = container.querySelector('svg[class*="text-muted"]')
			expect(svg).toBeDefined()
		})

		test("running shows animated clock", () => {
			const part = createToolPart("read", {
				status: "running",
				input: { filePath: "test.ts" },
				metadata: {},
				time: { start: 0 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Look for ClockIcon with animate-pulse
			const svg = container.querySelector('svg[class*="animate-pulse"]')
			expect(svg).toBeDefined()
		})

		test("completed shows green checkmark", () => {
			const part = createToolPart("read", {
				status: "completed",
				input: { filePath: "test.ts" },
				output: "success",
				title: "100 lines",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Look for CheckCircleIcon with green color
			const svg = container.querySelector('svg[class*="text-green"]')
			expect(svg).toBeDefined()
		})

		test("error shows red X", () => {
			const part = createToolPart("read", {
				status: "error",
				input: { filePath: "test.ts" },
				error: "File not found",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Look for XCircleIcon with red color
			const svg = container.querySelector('svg[class*="text-red"]')
			expect(svg).toBeDefined()
		})
	})

	describe("collapsible behavior", () => {
		test("renders collapsible trigger and content", () => {
			const part = createToolPart("read", {
				status: "completed",
				input: { filePath: "test.ts", limit: 100 },
				output: "file contents",
				title: "50 lines",
				metadata: {},
				time: { start: 0, end: 100 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Should have a collapsible trigger
			const trigger = container.querySelector('button[class*="flex"]')
			expect(trigger).toBeDefined()

			// Should have chevron icon
			const chevron = container.querySelector('svg[class*="transition-transform"]')
			expect(chevron).toBeDefined()
		})
	})

	describe("edge cases", () => {
		test("handles missing primary context", () => {
			const part = createToolPart("custom_tool", {
				status: "pending",
				input: {},
				raw: "",
			})

			const { container } = render(<Tool toolPart={part} />)

			// Should still render tool name
			expect(getByText(container, "custom_tool")).toBeDefined()
		})

		test("handles empty secondary context with nbsp", () => {
			const part = createToolPart("glob", {
				status: "running",
				input: { pattern: "**/*.ts" },
				metadata: {},
				time: { start: 0 },
			})

			const { container } = render(<Tool toolPart={part} />)

			// Should render pattern
			expect(getByText(container, "**/*.ts")).toBeDefined()

			// Should have non-breaking space for secondary (no title yet)
			const secondary = container.querySelector(".text-xs")
			expect(secondary?.textContent).toBe("\u00A0")
		})
	})
})
