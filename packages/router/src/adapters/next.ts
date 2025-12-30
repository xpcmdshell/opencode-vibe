/**
 * Next.js adapter for Effect router
 * ADR 002 Layer 4 - Depends on router, executor, stream
 *
 * Provides:
 * - createNextHandler() - API route handler
 * - createAction() - Server Action wrapper
 */
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Cause from "effect/Cause"
import type { Router } from "../router.js"
import type { Route } from "../types.js"
import type { OpencodeClient } from "../client-types.js"
import { executeRoute } from "../executor.js"
import { executeStreamHandler, streamToReadable, streamToAsyncIterable } from "../stream.js"
import { RouteNotFoundError } from "../router.js"
import { ValidationError, TimeoutError, HandlerError, MiddlewareError } from "../errors.js"

/**
 * Options for createNextHandler
 */
export interface NextHandlerOptions {
	router: Router
	createContext: (req: Request) => Promise<{ sdk: OpencodeClient }>
}

/**
 * Options for createAction
 */
export interface ActionOptions {
	createContext: () => Promise<{ sdk: OpencodeClient }>
}

/**
 * Create a Next.js API route handler from a router
 *
 * @example
 * ```typescript
 * // app/api/router/route.ts
 * import { createNextHandler } from "@opencode-vibe/router/adapters/next"
 * import { router } from "./routes"
 *
 * const handler = createNextHandler({
 *   router,
 *   createContext: async (req) => ({
 *     sdk: createOpencodeClient({ baseUrl: "..." })
 *   })
 * })
 *
 * export { handler as GET, handler as POST }
 * ```
 */
export function createNextHandler(opts: NextHandlerOptions) {
	return async (req: Request): Promise<Response> => {
		const controller = new AbortController()

		// Abort on client disconnect
		req.signal.addEventListener("abort", () => controller.abort())

		try {
			// Parse route path from query params
			const url = new URL(req.url)
			const path = url.searchParams.get("path")

			if (!path) {
				return Response.json({ error: "Missing path parameter" }, { status: 400 })
			}

			// Resolve route
			let route: Route
			try {
				route = opts.router.resolve(path)
			} catch (error) {
				if (error instanceof RouteNotFoundError) {
					return Response.json({ error: "RouteNotFoundError", path }, { status: 404 })
				}
				throw error
			}

			// Create context
			const ctx = await opts.createContext(req)

			// Parse input from query params (GET) or body (POST)
			const input = await parseInput(req, url)

			// Execute route
			if (route._config.stream) {
				// Streaming route
				const streamEffect = executeStreamHandler(route, {
					input,
					sdk: ctx.sdk,
					signal: controller.signal,
					ctx: {},
				})

				const stream = await Effect.runPromise(streamEffect)
				const readable = streamToReadable(stream)

				// Convert to SSE format with abort handling
				let readerRef: ReadableStreamDefaultReader<unknown> | null = null

				const sseReadable = new ReadableStream({
					async start(streamController) {
						readerRef = readable.getReader()
						const encoder = new TextEncoder()

						try {
							while (true) {
								const { done, value } = await readerRef.read()
								if (done) break
								// Format as SSE
								const data = `data: ${JSON.stringify(value)}\n\n`
								streamController.enqueue(encoder.encode(data))
							}
							streamController.close()
						} catch (error) {
							streamController.error(error)
						}
					},
					cancel() {
						// Cancel the underlying readable when SSE stream is cancelled
						readerRef?.cancel()
						// Also abort the controller to trigger generator cleanup
						controller.abort()
					},
				})

				return new Response(sseReadable, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
					},
				})
			} else {
				// Request-response route
				const exit = await Effect.runPromiseExit(
					executeRoute(route, input, ctx.sdk, controller.signal),
				)

				if (Exit.isSuccess(exit)) {
					return Response.json(exit.value)
				} else {
					// Extract the actual error from the Cause
					const error = Cause.failureOption(exit.cause)
					if (error._tag === "Some") {
						return handleRouteError(error.value)
					}
					// Defect or interruption
					return Response.json(
						{ error: "InternalError", message: "Unknown error" },
						{ status: 500 },
					)
				}
			}
		} catch (error) {
			return handleRouteError(error)
		}
	}
}

/**
 * Create a Server Action from a route
 *
 * @example
 * ```typescript
 * // app/actions.ts
 * "use server"
 * import { createAction } from "@opencode-vibe/router/adapters/next"
 * import { routes } from "./routes"
 *
 * export const getSession = createAction(routes.session.get, {
 *   createContext: async () => ({
 *     sdk: createOpencodeClient({ baseUrl: "..." })
 *   })
 * })
 * ```
 */
export function createAction<TInput, TOutput>(
	route: Route<TInput, TOutput>,
	opts: ActionOptions,
): (input: TInput) => Promise<TOutput> {
	return async (input: TInput): Promise<TOutput> => {
		const controller = new AbortController()

		const ctx = await opts.createContext()

		if (route._config.stream) {
			// Return async iterable for streaming routes
			const streamEffect = executeStreamHandler(route, {
				input,
				sdk: ctx.sdk,
				signal: controller.signal,
				ctx: {},
			})

			const stream = await Effect.runPromise(streamEffect)
			return streamToAsyncIterable(stream) as TOutput
		}

		return Effect.runPromise(executeRoute(route, input, ctx.sdk, controller.signal))
	}
}

/**
 * Parse input from request
 * GET: query params (excluding 'path')
 * POST: JSON body
 */
async function parseInput(req: Request, url: URL): Promise<unknown> {
	if (req.method === "POST") {
		const contentType = req.headers.get("Content-Type")
		if (contentType?.includes("application/json")) {
			return req.json()
		}
	}

	// GET: extract query params (excluding 'path')
	const params: Record<string, string> = {}
	url.searchParams.forEach((value, key) => {
		if (key !== "path") {
			params[key] = value
		}
	})

	return Object.keys(params).length > 0 ? params : undefined
}

/**
 * Check if error has a specific Effect tag
 */
function hasTag(error: unknown, tag: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"_tag" in error &&
		(error as { _tag: string })._tag === tag
	)
}

/**
 * Convert route errors to HTTP responses
 * Effect errors use _tag property, not instanceof
 */
function handleRouteError(error: unknown): Response {
	// Effect errors have _tag property
	if (hasTag(error, "ValidationError")) {
		const err = error as ValidationError
		return Response.json({ error: "ValidationError", issues: err.issues }, { status: 400 })
	}

	if (hasTag(error, "TimeoutError")) {
		const err = error as TimeoutError
		return Response.json({ error: "TimeoutError", duration: err.duration }, { status: 504 })
	}

	if (hasTag(error, "HandlerError")) {
		const err = error as HandlerError
		return Response.json({ error: "HandlerError", message: String(err.cause) }, { status: 500 })
	}

	if (hasTag(error, "MiddlewareError")) {
		const err = error as MiddlewareError
		return Response.json({ error: "MiddlewareError", message: String(err.cause) }, { status: 500 })
	}

	// Unknown error
	return Response.json({ error: "InternalError", message: String(error) }, { status: 500 })
}
