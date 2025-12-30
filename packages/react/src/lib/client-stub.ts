/**
 * Client stub for packages/react
 * This is a placeholder - actual client creation is app-specific
 */

export interface OpenCodeClient {
	find: {
		files: (params: { query: { query: string; dirs: string } }) => Promise<{ data: string[] }>
	}
}

/**
 * Stub client creator
 * In app layer, this imports from @opencode/core
 */
export function createClient(_directory: string): OpenCodeClient {
	throw new Error("createClient stub - should be provided by app layer")
}
