import type { Prompt, TextPart, FileAttachmentPart } from "@/types/prompt"

// Node type constants (for environments without DOM globals)
const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * Parse DOM tree from contenteditable editor into structured Prompt parts.
 * Walks the DOM recursively, extracting text content and file attachment pills.
 */
export function parseFromDOM(editorRef: HTMLDivElement): Prompt {
	const parts: Prompt = []
	let position = 0
	let buffer = ""

	const flushText = () => {
		const content = buffer.replace(/\r\n?/g, "\n")
		buffer = ""
		if (!content) return
		parts.push({
			type: "text",
			content,
			start: position,
			end: position + content.length,
		})
		position += content.length
	}

	const visit = (node: Node) => {
		if (node.nodeType === TEXT_NODE) {
			buffer += node.textContent ?? ""
			return
		}

		if (node.nodeType !== ELEMENT_NODE) return
		const el = node as HTMLElement

		// File pill element
		if (el.dataset.type === "file") {
			flushText()
			const content = el.textContent ?? ""
			parts.push({
				type: "file",
				path: el.dataset.path!,
				content,
				start: position,
				end: position + content.length,
			})
			position += content.length
			return
		}

		// Line break
		if (el.tagName === "BR") {
			buffer += "\n"
			return
		}

		// Recurse into children
		for (const child of Array.from(el.childNodes)) {
			visit(child)
		}
	}

	Array.from(editorRef.childNodes).forEach((child, index, arr) => {
		const isBlock =
			child.nodeType === ELEMENT_NODE && ["DIV", "P"].includes((child as HTMLElement).tagName)
		visit(child)
		if (isBlock && index < arr.length - 1) {
			buffer += "\n"
		}
	})

	flushText()

	if (parts.length === 0) {
		parts.push({ type: "text", content: "", start: 0, end: 0 })
	}

	return parts
}

/**
 * Get current cursor position as character offset from start of editor.
 * Uses Selection API to calculate position including file pills.
 */
export function getCursorPosition(parent: HTMLElement): number {
	const selection = window.getSelection()
	if (!selection || selection.rangeCount === 0) return 0

	const range = selection.getRangeAt(0)
	const preCaretRange = range.cloneRange()
	preCaretRange.selectNodeContents(parent)
	preCaretRange.setEnd(range.startContainer, range.startOffset)

	return preCaretRange.toString().length
}

/**
 * Set cursor position at specific character offset in editor.
 * Walks nodes to find correct position, handling text nodes and file pills.
 */
export function setCursorPosition(parent: HTMLElement, position: number): void {
	let remaining = position
	let node = parent.firstChild
	while (node) {
		const length = node.textContent?.length ?? 0
		const isText = node.nodeType === TEXT_NODE
		const isFile = node.nodeType === ELEMENT_NODE && (node as HTMLElement).dataset.type === "file"

		if (isText && remaining <= length) {
			const range = document.createRange()
			const selection = window.getSelection()
			range.setStart(node, remaining)
			range.collapse(true)
			selection?.removeAllRanges()
			selection?.addRange(range)
			return
		}

		if (isFile && remaining <= length) {
			const range = document.createRange()
			const selection = window.getSelection()
			range.setStartAfter(node)
			range.collapse(true)
			selection?.removeAllRanges()
			selection?.addRange(range)
			return
		}

		remaining -= length
		node = node.nextSibling
	}
}

/**
 * Render Prompt parts back to DOM, creating text nodes and file pill elements.
 * Clears existing content and rebuilds from parts array.
 */
export function renderPartsToDOM(editor: HTMLDivElement, parts: Prompt): void {
	editor.innerHTML = ""

	for (const part of parts) {
		if (part.type === "text") {
			const textNode = document.createTextNode(part.content)
			editor.appendChild(textNode)
		} else if (part.type === "file") {
			const pill = document.createElement("span")
			pill.dataset.type = "file"
			pill.dataset.path = part.path
			pill.textContent = part.content
			pill.contentEditable = "false"
			pill.className =
				"inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-primary text-primary-foreground rounded text-sm font-mono"
			editor.appendChild(pill)
		}
	}
}

/**
 * Detect @ trigger for file autocomplete.
 * Matches @ at word boundary with optional query text.
 */
export function detectAtTrigger(
	text: string,
	cursorPos: number,
): { match: boolean; query: string } {
	// Only match if cursor is at end of text segment
	const textBeforeCursor = text.slice(0, cursorPos)

	// Find last @ symbol
	const atIndex = textBeforeCursor.lastIndexOf("@")
	if (atIndex === -1) {
		return { match: false, query: "" }
	}

	// Check if @ is at word boundary (start or after whitespace/newline)
	if (atIndex > 0) {
		const charBefore = textBeforeCursor[atIndex - 1]
		if (!charBefore || !/[\s\n]/.test(charBefore)) {
			return { match: false, query: "" }
		}
	}

	// Extract query after @
	const query = textBeforeCursor.slice(atIndex + 1)

	// Check no whitespace after @ in the query (query continues to cursor)
	const textAfterCursor = text.slice(cursorPos)
	const firstCharAfter = textAfterCursor[0]
	if (textAfterCursor.length > 0 && firstCharAfter && !/[\s\n]/.test(firstCharAfter)) {
		// Cursor is mid-word, not at end
		return { match: false, query: "" }
	}

	return { match: true, query }
}

/**
 * Detect / trigger for slash commands.
 * Matches / only at start of line or after newline.
 */
export function detectSlashTrigger(text: string): {
	match: boolean
	query: string
} {
	// Match / at start or after newline
	const lines = text.split("\n")
	const lastLine = lines[lines.length - 1]

	if (!lastLine || !lastLine.startsWith("/")) {
		return { match: false, query: "" }
	}

	const query = lastLine.slice(1)
	return { match: true, query }
}
