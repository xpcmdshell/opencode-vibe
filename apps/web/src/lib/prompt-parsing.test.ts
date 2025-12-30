import { describe, it, expect, beforeEach } from "vitest"
import { JSDOM } from "jsdom"
import {
	parseFromDOM,
	getCursorPosition,
	setCursorPosition,
	renderPartsToDOM,
	detectAtTrigger,
	detectSlashTrigger,
} from "./prompt-parsing"
import type { Prompt } from "@/types/prompt"

// Node type constants
const TEXT_NODE = 3
const ELEMENT_NODE = 1

describe("prompt-parsing", () => {
	let dom: JSDOM
	let document: Document
	let window: Window & typeof globalThis

	beforeEach(() => {
		dom = new JSDOM("<!DOCTYPE html><html><body></body></html>")
		document = dom.window.document
		window = dom.window as unknown as Window & typeof globalThis
		global.document = document
		global.window = window
	})

	describe("parseFromDOM", () => {
		it("should parse empty editor to single empty text part", () => {
			const editor = document.createElement("div")
			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "", start: 0, end: 0 }])
		})

		it("should parse plain text content", () => {
			const editor = document.createElement("div")
			editor.textContent = "Hello world"
			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Hello world", start: 0, end: 11 }])
		})

		it("should parse text with BR tag as newline", () => {
			const editor = document.createElement("div")
			editor.innerHTML = "Line 1<br>Line 2"
			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Line 1\nLine 2", start: 0, end: 13 }])
		})

		it("should parse DIV blocks with newlines between them", () => {
			const editor = document.createElement("div")
			const div1 = document.createElement("div")
			div1.textContent = "Block 1"
			const div2 = document.createElement("div")
			div2.textContent = "Block 2"
			editor.appendChild(div1)
			editor.appendChild(div2)

			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Block 1\nBlock 2", start: 0, end: 15 }])
		})

		it("should parse P blocks with newlines between them", () => {
			const editor = document.createElement("div")
			const p1 = document.createElement("p")
			p1.textContent = "Para 1"
			const p2 = document.createElement("p")
			p2.textContent = "Para 2"
			editor.appendChild(p1)
			editor.appendChild(p2)

			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Para 1\nPara 2", start: 0, end: 13 }])
		})

		it("should parse file attachment pill", () => {
			const editor = document.createElement("div")
			const pill = document.createElement("span")
			pill.dataset.type = "file"
			pill.dataset.path = "src/app.ts"
			pill.textContent = "@src/app.ts"
			pill.contentEditable = "false"
			editor.appendChild(pill)

			const result = parseFromDOM(editor)

			expect(result).toEqual([
				{
					type: "file",
					path: "src/app.ts",
					content: "@src/app.ts",
					start: 0,
					end: 11,
				},
			])
		})

		it("should parse mixed text and file attachments", () => {
			const editor = document.createElement("div")
			editor.innerHTML = "Fix the bug in "
			const pill = document.createElement("span")
			pill.dataset.type = "file"
			pill.dataset.path = "src/auth.ts"
			pill.textContent = "@src/auth.ts"
			pill.contentEditable = "false"
			editor.appendChild(pill)
			editor.appendChild(document.createTextNode(" please"))

			const result = parseFromDOM(editor)

			expect(result).toEqual([
				{ type: "text", content: "Fix the bug in ", start: 0, end: 15 },
				{
					type: "file",
					path: "src/auth.ts",
					content: "@src/auth.ts",
					start: 15,
					end: 27,
				},
				{ type: "text", content: " please", start: 27, end: 34 },
			])
		})

		it("should normalize CRLF to LF", () => {
			const editor = document.createElement("div")
			const text = document.createTextNode("Line 1\r\nLine 2")
			editor.appendChild(text)

			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Line 1\nLine 2", start: 0, end: 13 }])
		})

		it("should not add newline after last block", () => {
			const editor = document.createElement("div")
			const div = document.createElement("div")
			div.textContent = "Only block"
			editor.appendChild(div)

			const result = parseFromDOM(editor)

			expect(result).toEqual([{ type: "text", content: "Only block", start: 0, end: 10 }])
		})
	})

	describe("getCursorPosition", () => {
		it("should return 0 when no selection", () => {
			const editor = document.createElement("div")
			document.body.appendChild(editor)

			const pos = getCursorPosition(editor)

			expect(pos).toBe(0)
		})

		it("should return cursor position in text node", () => {
			const editor = document.createElement("div")
			const text = document.createTextNode("Hello world")
			editor.appendChild(text)
			document.body.appendChild(editor)

			const range = document.createRange()
			range.setStart(text, 5)
			range.collapse(true)
			const selection = window.getSelection()
			selection?.removeAllRanges()
			selection?.addRange(range)

			const pos = getCursorPosition(editor)

			expect(pos).toBe(5)
		})

		it("should count characters including file pill content", () => {
			const editor = document.createElement("div")
			const text1 = document.createTextNode("Fix ")
			const pill = document.createElement("span")
			pill.dataset.type = "file"
			pill.dataset.path = "app.ts"
			pill.textContent = "@app.ts"
			const text2 = document.createTextNode(" now")

			editor.appendChild(text1)
			editor.appendChild(pill)
			editor.appendChild(text2)
			document.body.appendChild(editor)

			// Cursor after "Fix @app.ts"
			const range = document.createRange()
			range.setStart(text2, 0)
			range.collapse(true)
			const selection = window.getSelection()
			selection?.removeAllRanges()
			selection?.addRange(range)

			const pos = getCursorPosition(editor)

			expect(pos).toBe(11) // "Fix " (4) + "@app.ts" (7)
		})
	})

	describe("setCursorPosition", () => {
		it("should set cursor in text node", () => {
			const editor = document.createElement("div")
			const text = document.createTextNode("Hello world")
			editor.appendChild(text)
			document.body.appendChild(editor)

			setCursorPosition(editor, 5)

			const selection = window.getSelection()
			expect(selection?.rangeCount).toBe(1)
			const range = selection?.getRangeAt(0)
			expect(range?.startContainer).toBe(text)
			expect(range?.startOffset).toBe(5)
			expect(range?.collapsed).toBe(true)
		})

		it("should set cursor after file pill when position is within pill", () => {
			const editor = document.createElement("div")
			const pill = document.createElement("span")
			pill.dataset.type = "file"
			pill.dataset.path = "app.ts"
			pill.textContent = "@app.ts"
			editor.appendChild(pill)
			document.body.appendChild(editor)

			setCursorPosition(editor, 3) // Within "@app.ts"

			const selection = window.getSelection()
			const range = selection?.getRangeAt(0)
			// Should place cursor after the pill
			expect(range?.startContainer).toBe(editor)
			expect(range?.collapsed).toBe(true)
		})

		it("should handle position across multiple nodes", () => {
			const editor = document.createElement("div")
			const text1 = document.createTextNode("Hello ")
			const text2 = document.createTextNode("world")
			editor.appendChild(text1)
			editor.appendChild(text2)
			document.body.appendChild(editor)

			setCursorPosition(editor, 8) // "Hello wo"

			const selection = window.getSelection()
			const range = selection?.getRangeAt(0)
			expect(range?.startContainer).toBe(text2)
			expect(range?.startOffset).toBe(2)
		})
	})

	describe("renderPartsToDOM", () => {
		it("should render empty parts as empty editor", () => {
			const editor = document.createElement("div")
			const parts: Prompt = [{ type: "text", content: "", start: 0, end: 0 }]

			renderPartsToDOM(editor, parts)

			expect(editor.textContent).toBe("")
		})

		it("should render text part as text node", () => {
			const editor = document.createElement("div")
			const parts: Prompt = [{ type: "text", content: "Hello", start: 0, end: 5 }]

			renderPartsToDOM(editor, parts)

			expect(editor.textContent).toBe("Hello")
			expect(editor.childNodes.length).toBe(1)
			expect(editor.childNodes[0]!.nodeType).toBe(TEXT_NODE)
		})

		it("should render file attachment as pill element", () => {
			const editor = document.createElement("div")
			const parts: Prompt = [
				{
					type: "file",
					path: "src/app.ts",
					content: "@src/app.ts",
					start: 0,
					end: 11,
				},
			]

			renderPartsToDOM(editor, parts)

			expect(editor.childNodes.length).toBe(1)
			const pill = editor.childNodes[0] as HTMLElement
			expect(pill.nodeType).toBe(ELEMENT_NODE)
			expect(pill.tagName).toBe("SPAN")
			expect(pill.dataset.type).toBe("file")
			expect(pill.dataset.path).toBe("src/app.ts")
			expect(pill.textContent).toBe("@src/app.ts")
			expect(pill.contentEditable).toBe("false")
		})

		it("should render file pill with styling classes", () => {
			const editor = document.createElement("div")
			const parts: Prompt = [
				{
					type: "file",
					path: "src/app.ts",
					content: "@src/app.ts",
					start: 0,
					end: 11,
				},
			]

			renderPartsToDOM(editor, parts)

			const pill = editor.childNodes[0] as HTMLElement
			const expectedClasses = [
				"inline-flex",
				"items-center",
				"px-1.5",
				"py-0.5",
				"mx-0.5",
				"bg-primary",
				"text-primary-foreground",
				"rounded",
				"text-sm",
				"font-mono",
			]

			for (const className of expectedClasses) {
				expect(pill.classList.contains(className)).toBe(true)
			}
		})

		it("should render mixed parts in order", () => {
			const editor = document.createElement("div")
			const parts: Prompt = [
				{ type: "text", content: "Check ", start: 0, end: 6 },
				{
					type: "file",
					path: "main.ts",
					content: "@main.ts",
					start: 6,
					end: 14,
				},
				{ type: "text", content: " file", start: 14, end: 19 },
			]

			renderPartsToDOM(editor, parts)

			expect(editor.textContent).toBe("Check @main.ts file")
			expect(editor.childNodes.length).toBe(3)
			expect(editor.childNodes[0]!.nodeType).toBe(TEXT_NODE)
			expect((editor.childNodes[1]! as HTMLElement).dataset.type).toBe("file")
			expect(editor.childNodes[2]!.nodeType).toBe(TEXT_NODE)
		})

		it("should clear existing content before rendering", () => {
			const editor = document.createElement("div")
			editor.innerHTML = "<span>Old content</span>"
			const parts: Prompt = [{ type: "text", content: "New", start: 0, end: 3 }]

			renderPartsToDOM(editor, parts)

			expect(editor.textContent).toBe("New")
			expect(editor.childNodes.length).toBe(1)
		})
	})

	describe("detectAtTrigger", () => {
		it("should detect @ at start of text", () => {
			const result = detectAtTrigger("@", 1)

			expect(result).toEqual({ match: true, query: "" })
		})

		it("should detect @ with query text", () => {
			const result = detectAtTrigger("@src/app", 8)

			expect(result).toEqual({ match: true, query: "src/app" })
		})

		it("should not detect @ mid-word", () => {
			const result = detectAtTrigger("email@domain", 12)

			expect(result).toEqual({ match: false, query: "" })
		})

		it("should detect @ after whitespace", () => {
			const result = detectAtTrigger("Fix @app.ts", 11)

			expect(result).toEqual({ match: true, query: "app.ts" })
		})

		it("should detect @ after newline", () => {
			const result = detectAtTrigger("Line 1\n@file", 12)

			expect(result).toEqual({ match: true, query: "file" })
		})

		it("should not match when cursor not at end of @query", () => {
			const result = detectAtTrigger("@src/app.ts", 4) // Cursor at "c"

			expect(result).toEqual({ match: false, query: "" })
		})

		it("should handle @ with no following text", () => {
			const result = detectAtTrigger("Check @ something", 7)

			expect(result).toEqual({ match: true, query: "" })
		})
	})

	describe("detectSlashTrigger", () => {
		it("should detect / at start of text", () => {
			const result = detectSlashTrigger("/")

			expect(result).toEqual({ match: true, query: "" })
		})

		it("should detect / with query text", () => {
			const result = detectSlashTrigger("/debug")

			expect(result).toEqual({ match: true, query: "debug" })
		})

		it("should not detect / mid-text", () => {
			const result = detectSlashTrigger("path/to/file")

			expect(result).toEqual({ match: false, query: "" })
		})

		it("should only match at start of line", () => {
			const result = detectSlashTrigger("text /command")

			expect(result).toEqual({ match: false, query: "" })
		})

		it("should match after newline", () => {
			const result = detectSlashTrigger("Line 1\n/commit")

			expect(result).toEqual({ match: true, query: "commit" })
		})

		it("should handle slash with spaces (no match for slash commands)", () => {
			const result = detectSlashTrigger("/ space")

			expect(result).toEqual({ match: true, query: " space" })
		})
	})
})
