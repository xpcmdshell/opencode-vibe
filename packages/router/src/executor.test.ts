import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { executeRoute, executeRequestHandler } from "./executor.js"
import { ValidationError, TimeoutError, HandlerError, MiddlewareError } from "./errors.js"
import type { Route, HandlerContext } from "./types.js"

/**
 * TDD: Write tests FIRST before implementing executor.ts
 * Test execution of routes with validation, middleware, and handlers
 */

describe("executeRoute", () => {
	it("validates input against schema", async () => {
		const inputSchema = Schema.Struct({
			name: Schema.String,
			age: Schema.Number,
		})

		const route: Route<{ name: string; age: number }, string> = {
			_config: {},
			_inputSchema: inputSchema as any,
			_middleware: [],
			_handler: async (ctx) => `Hello ${ctx.input.name}`,
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		const program = executeRoute(route, { name: "Alice", age: 30 }, sdk, signal)
		const result = await Effect.runPromise(program)

		expect(result).toBe("Hello Alice")
	})

	it("throws ValidationError for invalid input", async () => {
		const inputSchema = Schema.Struct({
			name: Schema.String,
			age: Schema.Number,
		})

		const route: Route<{ name: string; age: number }, string> = {
			_config: {},
			_inputSchema: inputSchema as any,
			_middleware: [],
			_handler: async (ctx) => `Hello ${ctx.input.name}`,
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		// Invalid input: age is string instead of number
		const program = executeRoute(route, { name: "Bob", age: "thirty" }, sdk, signal)
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "ValidationError",
				issues: expect.any(Array),
			})
		}
	})

	it("runs middleware chain in order", async () => {
		const executionOrder: string[] = []

		const middleware1 = async (ctx: HandlerContext, next: () => Promise<unknown>) => {
			executionOrder.push("middleware1-before")
			await next()
			executionOrder.push("middleware1-after")
		}

		const middleware2 = async (ctx: HandlerContext, next: () => Promise<unknown>) => {
			executionOrder.push("middleware2-before")
			await next()
			executionOrder.push("middleware2-after")
		}

		const route: Route<unknown, string> = {
			_config: {},
			_middleware: [middleware1, middleware2],
			_handler: async (ctx) => {
				executionOrder.push("handler")
				return "result"
			},
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		const program = executeRoute(route, {}, sdk, signal)
		await Effect.runPromise(program)

		expect(executionOrder).toEqual([
			"middleware1-before",
			"middleware2-before",
			"handler",
			"middleware2-after",
			"middleware1-after",
		])
	})

	it("throws MiddlewareError when middleware fails", async () => {
		const failingMiddleware = async (ctx: HandlerContext, next: () => Promise<unknown>) => {
			throw new Error("Middleware explosion")
		}

		const route: Route<unknown, string> = {
			_config: {},
			_middleware: [failingMiddleware],
			_handler: async () => "never reached",
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		const program = executeRoute(route, {}, sdk, signal)
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "MiddlewareError",
				cause: expect.objectContaining({ message: "Middleware explosion" }),
			})
		}
	})

	it("executes handler without input schema", async () => {
		const route: Route<unknown, number> = {
			_config: {},
			_middleware: [],
			_handler: async () => 42,
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		const program = executeRoute(route, null, sdk, signal)
		const result = await Effect.runPromise(program)

		expect(result).toBe(42)
	})

	it("passes context to middleware and handler", async () => {
		const route: Route<{ value: number }, number> = {
			_config: {},
			_middleware: [
				async (ctx, next) => {
					// Middleware can modify ctx
					ctx.ctx = { multiplier: 2 }
					return next()
				},
			],
			_handler: async (ctx) => {
				// Handler receives modified context
				return ctx.input.value * (ctx.ctx as any).multiplier
			},
		}

		const sdk = {} as any
		const signal = new AbortController().signal

		const program = executeRoute(route, { value: 10 }, sdk, signal)
		const result = await Effect.runPromise(program)

		expect(result).toBe(20)
	})
})

describe("executeRequestHandler", () => {
	it("executes handler and returns result", async () => {
		const handler = async (ctx: HandlerContext<number>) => {
			return ctx.input * 2
		}

		const context: HandlerContext<number> = {
			input: 21,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		const program = executeRequestHandler(handler, context, {})
		const result = await Effect.runPromise(program)

		expect(result).toBe(42)
	})

	it("throws TimeoutError after configured duration", async () => {
		const slowHandler = async (ctx: HandlerContext) => {
			await new Promise((resolve) => setTimeout(resolve, 200))
			return "too slow"
		}

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		// 50ms timeout
		const program = executeRequestHandler(slowHandler, context, {
			timeout: "50ms",
		})
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "TimeoutError",
				duration: "50ms",
			})
		}
	})

	it("retries on failure per retry config", async () => {
		let attemptCount = 0

		const flakyHandler = async (ctx: HandlerContext) => {
			attemptCount++
			if (attemptCount < 3) {
				throw new Error(`Attempt ${attemptCount} failed`)
			}
			return "success"
		}

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		// Linear retry: 2 retries (3 total attempts) with 10ms delay
		const program = executeRequestHandler(flakyHandler, context, {
			retry: { maxAttempts: 2, delay: "10ms" },
		})

		const result = await Effect.runPromise(program)
		expect(result).toBe("success")
		expect(attemptCount).toBe(3)
	})

	it("wraps handler errors in HandlerError", async () => {
		const buggyHandler = async (ctx: HandlerContext) => {
			throw new Error("Handler bug")
		}

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		const program = executeRequestHandler(buggyHandler, context, {})
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "HandlerError",
				cause: expect.objectContaining({ message: "Handler bug" }),
			})
		}
	})

	it("does not retry when retry config is 'none'", async () => {
		let attemptCount = 0

		const alwaysFailHandler = async (ctx: HandlerContext) => {
			attemptCount++
			throw new Error("Always fails")
		}

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		const program = executeRequestHandler(alwaysFailHandler, context, {
			retry: "none",
		})
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "HandlerError",
			})
		}

		// Should only attempt once (no retries)
		expect(attemptCount).toBe(1)
	})

	it("executes without timeout when not configured", async () => {
		const handler = async (ctx: HandlerContext) => {
			await new Promise((resolve) => setTimeout(resolve, 50))
			return "completed"
		}

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {},
		}

		const program = executeRequestHandler(handler, context, {})
		const result = await Effect.runPromise(program)

		expect(result).toBe("completed")
	})

	it("respects abort signal", async () => {
		const abortController = new AbortController()

		const handler = async (ctx: HandlerContext) => {
			// Simulate checking abort signal
			if (ctx.signal.aborted) {
				throw new Error("Aborted")
			}
			return "should not reach"
		}

		// Abort before execution
		abortController.abort()

		const context: HandlerContext = {
			input: null,
			sdk: {} as any,
			signal: abortController.signal,
			ctx: {},
		}

		const program = executeRequestHandler(handler, context, {})
		const result = await Effect.runPromise(Effect.either(program))

		expect(result._tag).toBe("Left")
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "HandlerError",
				cause: expect.objectContaining({ message: "Aborted" }),
			})
		}
	})
})
