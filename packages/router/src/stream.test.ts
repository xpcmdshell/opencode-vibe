/**
 * Tests for stream.ts - Streaming + heartbeat support
 * TDD: RED phase - these tests should fail initially
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import * as Duration from "effect/Duration"
import { HeartbeatTimeoutError, StreamError } from "./errors.js"
import { executeStreamHandler, streamToReadable, streamToAsyncIterable } from "./stream.js"
import type { Route, HandlerContext } from "./types.js"

describe("executeStreamHandler", () => {
	let abortController: AbortController
	let ctx: HandlerContext<unknown, unknown>

	beforeEach(() => {
		abortController = new AbortController()
		ctx = {
			input: {},
			sdk: {} as any,
			signal: abortController.signal,
			ctx: {},
		}
	})

	afterEach(() => {
		abortController.abort()
	})

	it("yields events from async generator", async () => {
		// Mock route with streaming handler
		const route: Route<unknown, number> = {
			_config: { stream: true },
			_middleware: [],
			_handler: async function* () {
				yield 1
				yield 2
				yield 3
			},
		}

		const result = await Effect.runPromise(executeStreamHandler(route, ctx))
		const items = await Effect.runPromise(Stream.runCollect(result))

		expect(Array.from(items)).toEqual([1, 2, 3])
	})

	it("throws HeartbeatTimeoutError when no events within heartbeat duration", async () => {
		const route: Route<unknown, number> = {
			_config: { stream: true, heartbeat: "100ms" },
			_middleware: [],
			_handler: async function* () {
				yield 1
				// Delay longer than heartbeat
				await new Promise((resolve) => setTimeout(resolve, 200))
				yield 2
			},
		}

		const stream = await Effect.runPromise(executeStreamHandler(route, ctx))

		// Should fail with HeartbeatTimeoutError
		const result = await Effect.runPromise(Stream.runCollect(stream).pipe(Effect.flip))

		expect(result._tag).toBe("HeartbeatTimeoutError")
		expect((result as HeartbeatTimeoutError).duration).toBe("100ms")
	})

	it("stops when abort signal fires", async () => {
		const route: Route<unknown, number> = {
			_config: { stream: true },
			_middleware: [],
			_handler: async function* () {
				yield 1
				await new Promise((resolve) => setTimeout(resolve, 50))
				yield 2
				await new Promise((resolve) => setTimeout(resolve, 50))
				yield 3
			},
		}

		const stream = await Effect.runPromise(executeStreamHandler(route, ctx))

		// Abort after first item
		setTimeout(() => abortController.abort(), 25)

		const items = await Effect.runPromise(Stream.runCollect(stream))

		// Should only get first item before abort
		expect(Array.from(items).length).toBeLessThanOrEqual(1)
	})

	it("wraps generator errors in StreamError", async () => {
		const route: Route<unknown, number> = {
			_config: { stream: true },
			_middleware: [],
			_handler: async function* () {
				yield 1
				throw new Error("Generator failed")
			},
		}

		const stream = await Effect.runPromise(executeStreamHandler(route, ctx))

		const result = await Effect.runPromise(Stream.runCollect(stream).pipe(Effect.flip))

		expect(result._tag).toBe("StreamError")
		expect((result as StreamError).cause).toBeInstanceOf(Error)
	})
})

describe("streamToReadable", () => {
	it("converts Effect.Stream to ReadableStream", async () => {
		const effectStream = Stream.make(1, 2, 3)
		const readable = streamToReadable(effectStream)

		expect(readable).toBeInstanceOf(ReadableStream)

		const reader = readable.getReader()
		const chunks: number[] = []

		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			chunks.push(value)
		}

		expect(chunks).toEqual([1, 2, 3])
	})

	it("handles stream errors", async () => {
		const effectStream = Stream.fail(new Error("Stream failed"))
		const readable = streamToReadable(effectStream)

		const reader = readable.getReader()

		await expect(reader.read()).rejects.toThrow("Stream failed")
	})

	it("cancels Effect.Stream when ReadableStream is cancelled", async () => {
		let cancelled = false

		// Create infinite stream with cleanup hook
		const effectStream = Stream.repeatEffect(
			Effect.gen(function* () {
				yield* Effect.sleep(Duration.millis(10))
				return 1
			}),
		)

		// Track cancellation via finalization
		const streamWithCleanup = Stream.ensuring(
			effectStream,
			Effect.sync(() => {
				cancelled = true
			}),
		)

		const readable = streamToReadable(streamWithCleanup)
		const reader = readable.getReader()

		// Read one chunk
		await reader.read()

		// Cancel
		await reader.cancel()

		// Wait for cleanup
		await new Promise((resolve) => setTimeout(resolve, 100))

		expect(cancelled).toBe(true)
	})
})

describe("streamToAsyncIterable", () => {
	it("converts Effect.Stream to AsyncIterable", async () => {
		const effectStream = Stream.make(1, 2, 3)
		const iterable = streamToAsyncIterable(effectStream)

		const items: number[] = []
		for await (const item of iterable) {
			items.push(item)
		}

		expect(items).toEqual([1, 2, 3])
	})

	it("handles stream errors", async () => {
		const effectStream = Stream.fail(new Error("Stream failed"))
		const iterable = streamToAsyncIterable(effectStream)

		const iterate = async () => {
			for await (const _item of iterable) {
				// Should not reach here
			}
		}

		await expect(iterate()).rejects.toThrow("Stream failed")
	})

	it("allows breaking out of iteration", async () => {
		const effectStream = Stream.make(1, 2, 3, 4, 5)
		const iterable = streamToAsyncIterable(effectStream)

		const items: number[] = []
		for await (const item of iterable) {
			items.push(item)
			if (item === 3) break
		}

		expect(items).toEqual([1, 2, 3])
	})
})
