/**
 * PromptInput - Main rich text input component with @ and / autocomplete.
 *
 * Integrates Wave 2 work:
 * - usePromptStore for state management
 * - parseFromDOM/renderPartsToDOM for DOM <-> parts conversion
 * - detectAtTrigger/detectSlashTrigger for autocomplete detection
 * - useFileSearch for @ autocomplete
 * - useCommands for / autocomplete
 * - Autocomplete component for dropdown UI
 * - FilePill component for file rendering
 *
 * Key features:
 * - contenteditable div for rich text
 * - @ trigger shows file autocomplete
 * - / trigger at line start shows slash commands
 * - Arrow keys navigate autocomplete
 * - Enter/Tab select autocomplete
 * - Enter (no autocomplete) submits
 * - Escape closes autocomplete
 * - File pills are non-editable inline elements
 */

"use client"

import { useRef, useEffect, useCallback, type KeyboardEvent } from "react"
import { usePromptStore } from "@/stores/prompt-store"
import {
	parseFromDOM,
	renderPartsToDOM,
	getCursorPosition,
	setCursorPosition,
	detectAtTrigger,
	detectSlashTrigger,
} from "@/lib/prompt-parsing"
import { useFileSearch } from "@/react/use-file-search"
import { useCommands } from "@/react/use-commands"
import { Autocomplete } from "./Autocomplete"
import type { Prompt, SlashCommand } from "@/types/prompt"

export interface PromptInputProps {
	/** Session ID for context */
	sessionId?: string
	/** Callback when user submits (Enter key) */
	onSubmit?: (parts: Prompt) => void
	/** Placeholder text */
	placeholder?: string
	/** Disable input */
	disabled?: boolean
}

/**
 * Main prompt input component with autocomplete
 */
export function PromptInput({ sessionId, onSubmit, placeholder, disabled }: PromptInputProps) {
	const editorRef = useRef<HTMLDivElement>(null)

	// Store state
	const {
		parts,
		cursor,
		autocomplete,
		setParts,
		showAutocomplete,
		hideAutocomplete,
		setAutocompleteItems,
		navigateAutocomplete,
		insertFilePart,
		reset,
	} = usePromptStore()

	// Hooks for autocomplete data
	const { files } = useFileSearch(autocomplete.type === "file" ? autocomplete.query : "")
	const { getSlashCommands } = useCommands()

	// Update autocomplete items when data changes
	useEffect(() => {
		if (autocomplete.type === "file") {
			setAutocompleteItems(files)
		} else if (autocomplete.type === "command") {
			const commands = getSlashCommands()
			// Filter by query
			const filtered = commands.filter((cmd) => cmd.trigger.startsWith(autocomplete.query))
			setAutocompleteItems(filtered)
		}
	}, [autocomplete.type, autocomplete.query, files, getSlashCommands, setAutocompleteItems])

	// Render parts to DOM when store changes
	useEffect(() => {
		if (!editorRef.current) return

		// Only re-render if DOM doesn't match store
		const currentParts = parseFromDOM(editorRef.current)
		const partsMatch =
			currentParts.length === parts.length &&
			currentParts.every((part, i) => {
				const storePart = parts[i]
				if (part.type !== storePart.type) return false
				if (part.type === "text" && storePart.type === "text") {
					return part.content === storePart.content
				}
				if (part.type === "file" && storePart.type === "file") {
					return part.path === storePart.path && part.content === storePart.content
				}
				return false
			})

		if (!partsMatch) {
			renderPartsToDOM(editorRef.current, parts)
			setCursorPosition(editorRef.current, cursor)
		}
	}, [parts, cursor])

	/**
	 * Handle input event - parse DOM and detect triggers
	 */
	const handleInput = useCallback(() => {
		if (!editorRef.current) return

		// Parse DOM to get updated parts
		const newParts = parseFromDOM(editorRef.current)
		const cursorPos = getCursorPosition(editorRef.current)

		// Update store
		setParts(newParts, cursorPos)

		// Detect triggers for autocomplete
		// Get full text content for trigger detection
		const text = newParts
			.map((p) => {
				if (p.type === "text" || p.type === "file") {
					return p.content
				}
				return ""
			})
			.join("")

		// Check for @ trigger (file autocomplete)
		const atResult = detectAtTrigger(text, cursorPos)
		if (atResult.match) {
			showAutocomplete("file", atResult.query)
			return
		}

		// Check for / trigger (slash commands) - only at line start
		const slashResult = detectSlashTrigger(text)
		if (slashResult.match) {
			showAutocomplete("command", slashResult.query)
			return
		}

		// No triggers, hide autocomplete
		hideAutocomplete()
	}, [setParts, showAutocomplete, hideAutocomplete])

	/**
	 * Handle autocomplete selection
	 */
	const selectAutocompleteItem = useCallback(() => {
		if (!autocomplete.visible || autocomplete.items.length === 0) return
		if (!editorRef.current) return

		const item = autocomplete.items[autocomplete.selectedIndex]

		if (autocomplete.type === "file" && typeof item === "string") {
			// Insert file part
			const path = item
			const cursorPos = getCursorPosition(editorRef.current)
			const replaceLength = autocomplete.query.length + 1 // +1 for @

			insertFilePart(path, cursorPos, replaceLength)

			// Move cursor after file pill + space
			const newCursorPos = cursorPos - replaceLength + `@${path}`.length + 1
			setTimeout(() => {
				if (editorRef.current) {
					setCursorPosition(editorRef.current, newCursorPos)
					editorRef.current.focus()
				}
			}, 0)
		} else if (autocomplete.type === "command" && typeof item === "object" && "trigger" in item) {
			// Replace slash command trigger with selected command
			const cmd = item as SlashCommand
			const text = parts
				.map((p) => {
					if (p.type === "text" || p.type === "file") return p.content
					return ""
				})
				.join("")
			const newText = text.replace(`/${autocomplete.query}`, `/${cmd.trigger} `)

			setParts([{ type: "text", content: newText, start: 0, end: newText.length }])

			setTimeout(() => {
				if (editorRef.current) {
					setCursorPosition(editorRef.current, newText.length)
					editorRef.current.focus()
				}
			}, 0)
		}

		hideAutocomplete()
	}, [autocomplete, parts, insertFilePart, hideAutocomplete, setParts])

	/**
	 * Handle keyboard events
	 */
	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			// If autocomplete is visible, handle navigation and selection
			if (autocomplete.visible) {
				if (e.key === "ArrowDown") {
					e.preventDefault()
					navigateAutocomplete("down")
					return
				}
				if (e.key === "ArrowUp") {
					e.preventDefault()
					navigateAutocomplete("up")
					return
				}
				if (e.key === "Enter" || e.key === "Tab") {
					e.preventDefault()
					selectAutocompleteItem()
					return
				}
				if (e.key === "Escape") {
					e.preventDefault()
					hideAutocomplete()
					return
				}
			}

			// Handle submit (Enter without Shift)
			if (e.key === "Enter" && !e.shiftKey && !autocomplete.visible) {
				e.preventDefault()

				// Submit if not empty
				const hasContent = parts.some((p) => {
					if (p.type === "text") return p.content.trim().length > 0
					if (p.type === "file") return true
					return false
				})

				if (hasContent && onSubmit) {
					onSubmit(parts)
					reset()

					// Clear DOM
					if (editorRef.current) {
						editorRef.current.innerHTML = ""
					}
				}
			}
		},
		[
			autocomplete,
			parts,
			navigateAutocomplete,
			selectAutocompleteItem,
			hideAutocomplete,
			onSubmit,
			reset,
		],
	)

	return (
		<div className="relative w-full">
			<Autocomplete
				type={autocomplete.type}
				items={autocomplete.items}
				selectedIndex={autocomplete.selectedIndex}
				onSelect={(item) => {
					// Set selected index and trigger selection
					const index = autocomplete.items.findIndex((i) => {
						if (typeof i === "string" && typeof item === "string") return i === item
						if (typeof i === "object" && typeof item === "object") return i.id === item.id
						return false
					})
					if (index !== -1) {
						usePromptStore.setState((state) => ({
							autocomplete: { ...state.autocomplete, selectedIndex: index },
						}))
						selectAutocompleteItem()
					}
				}}
			/>

			{/* biome-ignore lint/a11y/useSemanticElements: contenteditable div is required for rich text input with inline file pills */}
			<div
				ref={editorRef}
				contentEditable={!disabled}
				suppressContentEditableWarning
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				data-placeholder={placeholder}
				tabIndex={0}
				aria-label={placeholder || "Enter your prompt"}
				aria-multiline="true"
				role="textbox"
				className="min-h-[100px] p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
			/>
		</div>
	)
}
