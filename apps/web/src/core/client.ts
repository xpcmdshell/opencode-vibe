/**
 * OpenCode SDK client factory
 *
 * Creates a configured client for connecting to the OpenCode server.
 * Default server runs on localhost:4056.
 *
 * Smart routing: If a TUI or other opencode process is running for a directory,
 * requests are routed to that server instead of the default. This enables
 * sending messages to sessions running in TUIs!
 */

import { createOpencodeClient } from "@opencode-ai/sdk/client"
import { multiServerSSE } from "./multi-server-sse"

export type { OpencodeClient } from "@opencode-ai/sdk/client"

/**
 * Default OpenCode server URL
 * Can be overridden via NEXT_PUBLIC_OPENCODE_URL env var
 */
export const OPENCODE_URL = process.env.NEXT_PUBLIC_OPENCODE_URL ?? "http://localhost:4056"

/**
 * Create an OpenCode client instance
 *
 * Smart routing: Routes to the server that owns the session (if known),
 * otherwise falls back to directory-based routing, then default server.
 *
 * @param directory - Optional project directory for scoping requests
 * @param sessionId - Optional session ID for session-specific routing
 * @returns Configured OpencodeClient with all namespaces (session, provider, etc.)
 *
 * @example
 * ```ts
 * const client = createClient()
 * const sessions = await client.session.list()
 * ```
 *
 * @example With session routing (routes to server that owns the session)
 * ```ts
 * const client = createClient("/path/to/project", "ses_123")
 * await client.session.prompt({ ... }) // Goes to the server that owns ses_123!
 * ```
 */
export function createClient(directory?: string, sessionId?: string) {
	// Priority: session-specific routing > directory routing > default
	let discoveredUrl: string | undefined

	if (sessionId && directory) {
		discoveredUrl = multiServerSSE.getBaseUrlForSession(sessionId, directory)
	} else if (directory) {
		discoveredUrl = multiServerSSE.getBaseUrlForDirectory(directory)
	}

	const serverUrl = discoveredUrl ?? OPENCODE_URL

	return createOpencodeClient({
		baseUrl: serverUrl,
		directory,
	})
}

/**
 * Singleton client for global operations (no directory scoping)
 * Use createClient(directory) for project-scoped operations
 */
export const globalClient = createClient()
