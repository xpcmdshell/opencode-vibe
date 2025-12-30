/**
 * Event types for SSE integration
 *
 * Note: These are simplified types. The full types come from @opencode-ai/sdk
 * but we keep these minimal to avoid tight coupling.
 */

/**
 * Global SSE event structure
 */
export type GlobalEvent = {
	directory: string
	payload: {
		type: string
		properties: Record<string, unknown>
	}
}
