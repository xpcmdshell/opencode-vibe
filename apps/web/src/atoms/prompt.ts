/**
 * Prompt Input Atom (Phase 5 - Zustand Replacement)
 *
 * React hooks for prompt input state management.
 * Handles rich text parts, file attachments, and autocomplete state.
 *
 * Migrated from stores/prompt-store.ts (Zustand) to atoms pattern.
 *
 * @module atoms/prompt
 */

"use client"

import { useState, useCallback } from "react"
import type { Prompt, SlashCommand } from "../types/prompt"

/**
 * Default autocomplete state
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

/**
 * Prompt state interface
 */
interface PromptState {
	parts: Prompt
	cursor: number
	autocomplete: {
		visible: boolean
		type: "file" | "command" | null
		query: string
		items: string[] | SlashCommand[]
		selectedIndex: number
	}
}

/**
 * Prompt actions interface
 */
interface PromptActions {
	setParts: (parts: Prompt, cursor?: number) => void
	insertFilePart: (path: string, atPosition: number, replaceLength: number) => void
	showAutocomplete: (type: "file" | "command", query: string) => void
	hideAutocomplete: () => void
	setAutocompleteItems: (items: string[] | SlashCommand[]) => void
	navigateAutocomplete: (direction: "up" | "down") => void
	reset: () => void
}

/**
 * React hook for prompt input state management
 *
 * Provides state and actions for managing rich text prompt input
 * with file attachments and autocomplete.
 *
 * @returns Prompt state and actions
 *
 * @example
 * ```tsx
 * const prompt = usePrompt()
 * prompt.setParts([{ type: "text", content: "hello", start: 0, end: 5 }])
 * prompt.insertFilePart("src/app.ts", 5, 0)
 * ```
 */
export function usePrompt(): PromptState & PromptActions {
	const [state, setState] = useState<PromptState>(DEFAULT_PROMPT_STATE)

	const setParts = useCallback((parts: Prompt, cursor?: number) => {
		setState((prev) => ({
			...prev,
			parts,
			cursor: cursor ?? prev.cursor,
		}))
	}, [])

	const insertFilePart = useCallback((path: string, atPosition: number, replaceLength: number) => {
		setState((prev) => {
			const content = `@${path}`
			let charCount = 0
			const newParts: Prompt = []
			let newCursorPosition = atPosition

			for (const part of prev.parts) {
				if (part.type === "image") {
					// Image parts don't have start/end positions
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
					// This is the part to split
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

					// Calculate new cursor position:
					// before.length + content.length + 1 (trailing space)
					newCursorPosition = partStart + before.length + content.length + 1
				} else {
					newParts.push(part)
				}

				charCount = partEnd
			}

			return {
				...prev,
				parts: newParts,
				cursor: newCursorPosition,
			}
		})
	}, [])

	const showAutocomplete = useCallback((type: "file" | "command", query: string) => {
		setState((prev) => ({
			...prev,
			autocomplete: {
				visible: true,
				type,
				query,
				items: [],
				selectedIndex: 0,
			},
		}))
	}, [])

	const hideAutocomplete = useCallback(() => {
		setState((prev) => ({
			...prev,
			autocomplete: DEFAULT_AUTOCOMPLETE,
		}))
	}, [])

	const setAutocompleteItems = useCallback((items: string[] | SlashCommand[]) => {
		setState((prev) => ({
			...prev,
			autocomplete: {
				...prev.autocomplete,
				items,
			},
		}))
	}, [])

	const navigateAutocomplete = useCallback((direction: "up" | "down") => {
		setState((prev) => ({
			...prev,
			autocomplete: {
				...prev.autocomplete,
				selectedIndex:
					direction === "up"
						? Math.max(0, prev.autocomplete.selectedIndex - 1)
						: Math.min(prev.autocomplete.items.length - 1, prev.autocomplete.selectedIndex + 1),
			},
		}))
	}, [])

	const reset = useCallback(() => {
		setState(DEFAULT_PROMPT_STATE)
	}, [])

	return {
		...state,
		setParts,
		insertFilePart,
		showAutocomplete,
		hideAutocomplete,
		setAutocompleteItems,
		navigateAutocomplete,
		reset,
	}
}
