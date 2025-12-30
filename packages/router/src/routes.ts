/**
 * Route definitions for OpenCode
 * ADR 002 - Declarative route configuration with Effect-powered execution
 */
import * as Schema from "effect/Schema"
import { createOpencodeRoute } from "./builder.js"

/**
 * Message type from OpenCode API
 */
export interface Message {
	id: string
	sessionID: string
	role: string
	content?: string
	time?: { created: number; completed?: number }
	[key: string]: unknown
}

/**
 * Input schema for messages.list route
 * - sessionId: required string
 * - limit: optional positive number, defaults to 20
 */
const MessagesListInput = Schema.Struct({
	sessionId: Schema.String,
	limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
		default: () => 20,
	}),
})

/**
 * Input schema for session.get route
 * - id: required string
 */
const SessionGetInput = Schema.Struct({
	id: Schema.String,
})

/**
 * Input schema for session.list route
 * No parameters required
 */
const SessionListInput = Schema.Struct({})

/**
 * Input schema for session.create route
 * - title: optional string
 */
const SessionCreateInput = Schema.Struct({
	title: Schema.optional(Schema.String),
})

/**
 * Input schema for session.delete route
 * - id: required string
 */
const SessionDeleteInput = Schema.Struct({
	id: Schema.String,
})

/**
 * Input schema for session.promptAsync route
 * - sessionId: required string
 * - parts: required array of Part objects
 * - model: optional ModelSelection object
 */
const SessionPromptAsyncInput = Schema.Struct({
	sessionId: Schema.String,
	parts: Schema.Array(Schema.Unknown),
	model: Schema.optional(Schema.Unknown),
})

/**
 * Input schema for provider.list route
 * No parameters required
 */
const ProviderListInput = Schema.Struct({})

/**
 * Input schema for session.command route
 * - sessionId: required string
 * - command: required string (slash command name)
 * - arguments: required string (command arguments)
 * - agent: optional string (agent name)
 * - model: optional string (model selection)
 */
const SessionCommandInput = Schema.Struct({
	sessionId: Schema.String,
	command: Schema.String,
	arguments: Schema.String,
	agent: Schema.optional(Schema.String),
	model: Schema.optional(Schema.String),
})

/**
 * Input schema for command.list route
 * No parameters required
 */
const CommandListInput = Schema.Struct({})

/**
 * Create route definitions
 * Returns a nested object of routes that can be passed to createRouter()
 */
export function createRoutes() {
	const o = createOpencodeRoute()

	return {
		messages: {
			/**
			 * List messages for a session with pagination
			 *
			 * @param sessionId - Session ID to fetch messages for
			 * @param limit - Maximum number of messages to return (default: 20)
			 * @returns Array of messages (newest first based on API behavior)
			 *
			 * @example
			 * ```ts
			 * // Initial load - last 20 messages
			 * const messages = await caller("messages.list", { sessionId: "ses_123" })
			 *
			 * // Load more for infinite scroll
			 * const moreMessages = await caller("messages.list", {
			 *   sessionId: "ses_123",
			 *   limit: 50
			 * })
			 * ```
			 */
			list: o({ timeout: "30s" })
				.input(MessagesListInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.messages({
						path: { id: input.sessionId },
						query: { limit: input.limit },
					})
					return response.data ?? []
				}),
		},

		session: {
			/**
			 * Get a session by ID
			 *
			 * @param id - Session ID
			 * @returns Session object
			 */
			get: o({ timeout: "30s" })
				.input(SessionGetInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.get({
						path: { id: input.id },
					})
					return response.data
				}),

			/**
			 * List all sessions
			 *
			 * @returns Array of sessions
			 */
			list: o({ timeout: "10s" })
				.input(SessionListInput)
				.handler(async ({ sdk }) => {
					const response = await sdk.session.list()
					return response.data ?? []
				}),

			/**
			 * Create a new session
			 *
			 * @param title - Optional session title
			 * @returns Created session object
			 */
			create: o({ timeout: "30s" })
				.input(SessionCreateInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.create({
						body: input.title ? { title: input.title } : {},
					})
					return response.data
				}),

			/**
			 * Delete a session by ID
			 *
			 * @param id - Session ID to delete
			 * @returns void
			 */
			delete: o({ timeout: "10s" })
				.input(SessionDeleteInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.delete({
						path: { id: input.id },
					})
					return response.data
				}),

			/**
			 * Send a prompt to a session asynchronously (fire-and-forget)
			 *
			 * @param sessionId - Session ID
			 * @param parts - Array of message parts
			 * @param model - Optional model selection
			 * @returns void (fire-and-forget)
			 */
			promptAsync: o({ timeout: "5m" })
				.input(SessionPromptAsyncInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.promptAsync({
						path: { id: input.sessionId },
						body: {
							parts: input.parts as any,
							...(input.model ? { model: input.model as any } : {}),
						},
					})
					return response.data
				}),

			/**
			 * Execute a slash command in a session
			 *
			 * @param sessionId - Session ID
			 * @param command - Command name (without leading slash)
			 * @param arguments - Command arguments as string
			 * @param agent - Optional agent name
			 * @param model - Optional model selection
			 * @returns void (fire-and-forget)
			 */
			command: o({ timeout: "30s" })
				.input(SessionCommandInput)
				.handler(async ({ input, sdk }) => {
					const response = await sdk.session.command({
						path: { id: input.sessionId },
						body: {
							command: input.command,
							arguments: input.arguments,
							...(input.agent ? { agent: input.agent } : {}),
							...(input.model ? { model: input.model } : {}),
						},
					})
					return response.data
				}),
		},

		provider: {
			/**
			 * List all providers with connection status
			 *
			 * @returns Object with all providers, default provider, and connected provider IDs
			 */
			list: o({ timeout: "10s" })
				.input(ProviderListInput)
				.handler(async ({ sdk }) => {
					const response = await sdk.config.providers()
					return response.data
				}),
		},

		command: {
			/**
			 * List all custom commands
			 *
			 * @returns Array of custom command definitions
			 */
			list: o({ timeout: "10s" })
				.input(CommandListInput)
				.handler(async ({ sdk }) => {
					const response = await sdk.command.list()
					return response.data ?? []
				}),
		},
	}
}

/**
 * Type for the routes object
 */
export type Routes = ReturnType<typeof createRoutes>
