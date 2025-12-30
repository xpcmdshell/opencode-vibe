/**
 * Prompt types for OpenCode React package
 * Extracted from app layer to make package standalone
 */

export interface SlashCommand {
	id: string
	trigger?: string
	title: string
	description?: string
	keybind?: string
	type: "builtin" | "custom"
}

export type PromptPart =
	| { type: "text"; content: string; start: number; end: number }
	| { type: "file"; path: string; content: string; start: number; end: number }
	| {
			type: "image"
			path: string
			content: string
			start: number
			end: number
	  }

export type Prompt = PromptPart[]
