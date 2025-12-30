/**
 * Stream handling with heartbeat timeout support
 * ADR 002 Layer 2 - Depends on types, errors, schedule
 */
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Duration from "effect/Duration"
import type { Route, HandlerContext } from "./types.js"
import { StreamError, HeartbeatTimeoutError } from "./errors.js"
import { parseDuration } from "./schedule.js"

/**
 * Execute a streaming route handler
 * Converts AsyncGenerator to Effect.Stream with optional heartbeat timeout
 *
 * @param route - Route configuration with streaming handler
 * @param ctx - Handler execution context
 * @returns Effect that yields an Effect.Stream
 *
 * @example
 * ```typescript
 * const route: Route<unknown, Event> = {
 *   _config: { stream: true, heartbeat: "60s" },
 *   _handler: async function* () {
 *     for await (const event of sdk.global.event()) {
 *       yield event
 *     }
 *   }
 * }
 *
 * const stream = await Effect.runPromise(executeStreamHandler(route, ctx))
 * ```
 */
export function executeStreamHandler<TInput, TOutput>(
	route: Route<TInput, TOutput>,
	ctx: HandlerContext<TInput, unknown>,
): Effect.Effect<Stream.Stream<TOutput, StreamError | HeartbeatTimeoutError>> {
	return Effect.gen(function* () {
		// Call handler to get async generator
		const generator = route._handler?.(ctx) as AsyncGenerator<TOutput, void, unknown>

		if (!generator) {
			throw new Error("Stream handler not defined")
		}

		// Convert AsyncGenerator to Effect.Stream
		let stream = Stream.fromAsyncIterable(
			generator,
			(e) => new StreamError({ route: undefined, cause: e }) as StreamError | HeartbeatTimeoutError,
		)

		// Apply heartbeat timeout (fail if no event within duration)
		if (route._config.heartbeat) {
			const heartbeatStr = route._config.heartbeat
			const heartbeatDuration = parseDuration(heartbeatStr)
			stream = Stream.timeoutFail(
				stream,
				() =>
					new HeartbeatTimeoutError({
						route: undefined,
						duration: heartbeatStr,
					}),
				Duration.millis(heartbeatDuration),
			)
		}

		// Interrupt on abort signal
		stream = Stream.interruptWhen(
			stream,
			Effect.async<void>((resume) => {
				ctx.signal.addEventListener("abort", () => resume(Effect.void))
			}),
		)

		return stream
	})
}

/**
 * Convert Effect.Stream to ReadableStream for browser/Next.js Response
 *
 * @param effectStream - Effect Stream to convert
 * @returns ReadableStream compatible with Response API
 *
 * @example
 * ```typescript
 * const stream = Stream.make(1, 2, 3)
 * const readable = streamToReadable(stream)
 *
 * return new Response(readable, {
 *   headers: { "Content-Type": "text/event-stream" }
 * })
 * ```
 */
export function streamToReadable<T>(effectStream: Stream.Stream<T, unknown>): ReadableStream<T> {
	let abortController: AbortController | null = null

	return new ReadableStream({
		async start(controller) {
			abortController = new AbortController()

			try {
				// Interrupt stream on abort signal
				const interruptibleStream = Stream.interruptWhen(
					effectStream,
					Effect.async<void>((resume) => {
						abortController!.signal.addEventListener("abort", () => resume(Effect.void))
					}),
				)

				// Run stream and enqueue chunks
				await Effect.runPromise(
					Stream.runForEach(interruptibleStream, (chunk) =>
						Effect.sync(() => controller.enqueue(chunk)),
					),
				)
				controller.close()
			} catch (error) {
				controller.error(error)
			}
		},
		cancel() {
			// Signal interruption to Effect stream
			abortController?.abort()
		},
	})
}

/**
 * Convert Effect.Stream to AsyncIterable for direct consumption
 *
 * @param effectStream - Effect Stream to convert
 * @returns AsyncIterable that can be used with for await...of
 *
 * @example
 * ```typescript
 * const stream = Stream.make(1, 2, 3)
 * const iterable = streamToAsyncIterable(stream)
 *
 * for await (const item of iterable) {
 *   console.log(item) // 1, 2, 3
 * }
 * ```
 */
export function streamToAsyncIterable<T>(
	effectStream: Stream.Stream<T, unknown>,
): AsyncIterable<T> {
	return {
		async *[Symbol.asyncIterator]() {
			const queue: T[] = []
			let done = false
			let error: unknown = null
			let resolve: (() => void) | null = null

			// Start consuming stream in background
			Effect.runPromise(
				Stream.runForEach(effectStream, (item) =>
					Effect.sync(() => {
						queue.push(item)
						resolve?.() // Wake up the iterator
						resolve = null
					}),
				),
			)
				.then(() => {
					done = true
					resolve?.()
				})
				.catch((e) => {
					error = e
					done = true
					resolve?.()
				})

			// Yield items as they arrive
			while (!done || queue.length > 0) {
				if (queue.length > 0) {
					yield queue.shift()!
				} else if (!done) {
					// Wait for next item
					await new Promise<void>((r) => {
						resolve = r
					})
				}
			}

			if (error) {
				throw error
			}
		},
	}
}
