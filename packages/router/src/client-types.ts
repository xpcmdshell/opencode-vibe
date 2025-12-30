/**
 * Minimal OpencodeClient type definition for router package
 *
 * Router package is standalone with ZERO external dependencies except Effect.
 * This file defines the minimal interface the router expects from the SDK client.
 * The actual client implementation comes from @opencode-ai/sdk/client in the app.
 */

/**
 * Minimal OpencodeClient interface
 * Defines only the namespaces used by router routes
 */
export interface OpencodeClient {
	session: {
		list: () => Promise<{ data?: unknown[] }>
		get: (params: { path: { id: string } }) => Promise<{ data?: unknown }>
		create: (params: { body: unknown }) => Promise<{ data?: unknown }>
		delete: (params: { path: { id: string } }) => Promise<{ data?: unknown }>
		messages: (params: {
			path: { id: string }
			query: { limit?: number }
		}) => Promise<{ data?: unknown[] }>
		prompt: (params: unknown) => Promise<{ data?: unknown }>
		promptAsync: (params: unknown) => Promise<{ data?: unknown }>
		command: (params: unknown) => Promise<{ data?: unknown }>
	}
	command: {
		list: (params?: unknown) => Promise<{ data?: unknown[] }>
		execute?: (params: unknown) => Promise<{ data?: unknown }>
	}
	config: {
		get?: (params?: unknown) => Promise<{ data?: unknown }>
		update?: (params: unknown) => Promise<{ data?: unknown }>
		providers: (params?: unknown) => Promise<{ data?: unknown }>
	}
	global?: {
		status?: (params?: unknown) => Promise<{ data?: unknown }>
	}
}
