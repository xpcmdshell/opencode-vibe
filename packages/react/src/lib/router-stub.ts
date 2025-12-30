/**
 * Router stub for packages/react
 * Real implementation comes from @opencode-vibe/router in app layer
 */

export type Caller = (path: string, input?: unknown) => Promise<any>

export function createCaller(): Caller {
	return async (_path: string, _input?: unknown) => {}
}
