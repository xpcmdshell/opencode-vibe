import { describe, expect, it, beforeAll, afterEach } from "vitest"
import { Window } from "happy-dom"
import { render, cleanup } from "@testing-library/react"
import type { Part } from "@opencode-vibe/react"
import { PartRenderer } from "./part-renderer"

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

describe("PartRenderer", () => {
	it("renders text parts", () => {
		const part: Part = {
			id: "part-1",
			messageID: "msg-1",
			type: "text",
			content: "Hello world",
		}

		const { container } = render(<PartRenderer part={part} />)

		const textDiv = container.querySelector("div")
		expect(textDiv).not.toBeNull()
		expect(textDiv?.textContent).toBe("Hello world")
		expect(textDiv?.className).toContain("whitespace-pre-wrap")
	})

	it("renders multiline text with whitespace preserved", () => {
		const part: Part = {
			id: "part-2",
			messageID: "msg-1",
			type: "text",
			content: "Line 1\n  Line 2 with spaces\nLine 3",
		}

		const { container } = render(<PartRenderer part={part} />)

		const textDiv = container.querySelector("div")
		expect(textDiv?.textContent).toBe("Line 1\n  Line 2 with spaces\nLine 3")
		expect(textDiv?.className).toContain("whitespace-pre-wrap")
	})

	it("renders tool parts with status and tool name", () => {
		const part: Part = {
			id: "part-3",
			messageID: "msg-1",
			type: "tool",
			content: "",
			tool: "read",
			state: {
				status: "completed",
				title: "Read package.json",
			},
		}

		const { container } = render(<PartRenderer part={part} />)

		const toolDiv = container.querySelector(".bg-muted\\/30")
		expect(toolDiv).not.toBeNull()
		expect(toolDiv?.textContent).toContain("✓") // completed icon
		expect(toolDiv?.textContent).toContain("read")
		expect(toolDiv?.textContent).toContain("Read package.json")
	})

	it("renders tool parts with running status", () => {
		const part: Part = {
			id: "part-4",
			messageID: "msg-1",
			type: "tool",
			content: "",
			tool: "grep",
			state: {
				status: "running",
			},
		}

		const { container } = render(<PartRenderer part={part} />)

		const toolDiv = container.querySelector(".bg-muted\\/30")
		expect(toolDiv).not.toBeNull()
		expect(toolDiv?.textContent).toContain("⏳") // running icon
		expect(toolDiv?.textContent).toContain("grep")

		// Running tools should have animate-pulse
		const icon = container.querySelector(".animate-pulse")
		expect(icon).not.toBeNull()
	})

	it("renders tool parts with pending status", () => {
		const part: Part = {
			id: "part-5",
			messageID: "msg-1",
			type: "tool",
			content: "",
			tool: "edit",
			state: {
				status: "pending",
			},
		}

		const { container } = render(<PartRenderer part={part} />)

		const toolDiv = container.querySelector(".bg-muted\\/30")
		expect(toolDiv).not.toBeNull()
		expect(toolDiv?.textContent).toContain("◯") // pending icon
		expect(toolDiv?.textContent).toContain("edit")
	})

	it("renders tool parts without title gracefully", () => {
		const part: Part = {
			id: "part-6",
			messageID: "msg-1",
			type: "tool",
			content: "",
			tool: "bash",
			state: {
				status: "completed",
				// no title
			},
		}

		const { container } = render(<PartRenderer part={part} />)

		const toolDiv = container.querySelector(".bg-muted\\/30")
		expect(toolDiv).not.toBeNull()
		expect(toolDiv?.textContent).toContain("✓")
		expect(toolDiv?.textContent).toContain("bash")
		// Should not crash without title
	})

	it("renders unknown part types as null", () => {
		const part: Part = {
			id: "part-7",
			messageID: "msg-1",
			type: "unknown-type",
			content: "",
		}

		const { container } = render(<PartRenderer part={part} />)

		// Should render nothing for unknown types
		expect(container.children.length).toBe(0)
	})

	it("handles tool parts with error status", () => {
		const part: Part = {
			id: "part-8",
			messageID: "msg-1",
			type: "tool",
			content: "",
			tool: "write",
			state: {
				status: "error",
				title: "Failed to write file",
			},
		}

		const { container } = render(<PartRenderer part={part} />)

		const toolDiv = container.querySelector(".bg-muted\\/30")
		expect(toolDiv).not.toBeNull()
		expect(toolDiv?.textContent).toContain("◯") // error treated as pending icon
		expect(toolDiv?.textContent).toContain("write")
		expect(toolDiv?.textContent).toContain("Failed to write file")
	})
})
