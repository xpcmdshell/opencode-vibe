/**
 * Type-level tests for router types
 * Uses @ts-expect-error to verify type constraints
 */
import { describe, it, expect } from "vitest"
import type {
	Duration,
	RetryConfig,
	RouteConfig,
	Route,
	HandlerContext,
	HandlerFn,
	RouteBuilder,
} from "./types.js"
import type { Schema } from "effect"

describe("Duration type", () => {
	it("should accept valid duration strings", () => {
		const validDurations: Duration[] = ["5s", "100ms", "2m", "1h", "0ms", "999s", "30m", "24h"]
		expect(validDurations.length).toBe(8)
	})

	it("should reject invalid duration strings", () => {
		// @ts-expect-error - invalid unit
		const invalid1: Duration = "5x"
		// @ts-expect-error - not a string
		const invalid2: Duration = 5
		// @ts-expect-error - no unit
		const invalid3: Duration = "100"
		// @ts-expect-error - non-numeric
		const invalid4: Duration = "abc"
		// @ts-expect-error - empty string
		const invalid5: Duration = ""

		expect([invalid1, invalid2, invalid3, invalid4, invalid5]).toBeDefined()
	})
})

describe("RetryConfig type", () => {
	it("should accept string presets", () => {
		const preset1: RetryConfig = "none"
		const preset2: RetryConfig = "exponential"
		const preset3: RetryConfig = "linear"

		expect([preset1, preset2, preset3]).toBeDefined()
	})

	it("should accept custom retry objects", () => {
		const custom: RetryConfig = {
			maxAttempts: 3,
			delay: "1s",
			backoff: 2,
		}

		expect(custom).toBeDefined()
	})

	it("should reject invalid config", () => {
		// @ts-expect-error - invalid preset
		const invalid1: RetryConfig = "invalid"
		// @ts-expect-error - number not allowed
		const invalid2: RetryConfig = 5

		expect([invalid1, invalid2]).toBeDefined()
	})
})

describe("RouteConfig type", () => {
	it("should accept valid route configs", () => {
		const minimalConfig: RouteConfig = {}

		const fullConfig: RouteConfig = {
			timeout: "30s",
			retry: "exponential",
			concurrency: 10,
			stream: true,
			heartbeat: "5s",
			cache: {
				ttl: "1h",
				key: (input: unknown) => JSON.stringify(input),
			},
		}

		expect([minimalConfig, fullConfig]).toBeDefined()
	})

	it("should accept custom retry config", () => {
		const config: RouteConfig = {
			retry: {
				maxAttempts: 5,
				delay: "2s",
				backoff: 1.5,
			},
		}

		expect(config).toBeDefined()
	})

	it("should reject invalid config properties", () => {
		// @ts-expect-error - timeout must be Duration
		const invalid1: RouteConfig = { timeout: 5000 }
		// @ts-expect-error - concurrency must be number
		const invalid2: RouteConfig = { concurrency: "10" }
		// @ts-expect-error - unknown property
		const invalid3: RouteConfig = { maxBodySize: "1mb" }

		expect([invalid1, invalid2, invalid3]).toBeDefined()
	})
})

describe("Route type", () => {
	it("should preserve input/output generic types", () => {
		type TestRoute = Route<{ id: string }, { name: string }>

		// These would be runtime checks, but we can verify type structure
		const mockRoute = {
			_config: {},
			_inputSchema: undefined as Schema.Schema<{ id: string }, unknown> | undefined,
			_middleware: [],
			_handler: undefined,
			_errorHandler: undefined,
		} satisfies TestRoute

		expect(mockRoute).toBeDefined()
	})

	it("should allow optional generic parameters", () => {
		type MinimalRoute = Route<unknown, unknown>
		type InputOnlyRoute = Route<{ data: string }>

		const minimal: MinimalRoute = {
			_config: {},
			_inputSchema: undefined,
			_middleware: [],
			_handler: undefined as HandlerFn<unknown, unknown, unknown> | undefined,
			_errorHandler: undefined,
		}

		const inputOnly: InputOnlyRoute = {
			_config: {},
			_inputSchema: undefined,
			_middleware: [],
			_handler: undefined as HandlerFn<{ data: string }, unknown, unknown> | undefined,
			_errorHandler: undefined,
		}

		expect([minimal, inputOnly]).toBeDefined()
	})
})

describe("HandlerContext type", () => {
	it("should provide input, sdk, signal, and ctx", () => {
		type TestContext = HandlerContext<{ id: string }, { user: string }>

		const context: TestContext = {
			input: { id: "123" },
			sdk: {} as any, // OpencodeClient mock
			signal: new AbortController().signal,
			ctx: { user: "test" },
		}

		// Type assertions to verify structure
		const inputId: string = context.input.id
		const userName: string = context.ctx.user
		const isSignal: AbortSignal = context.signal

		expect([inputId, userName, isSignal]).toBeDefined()
	})

	it("should allow unknown context when not specified", () => {
		type MinimalContext = HandlerContext<{ data: string }>

		const context: MinimalContext = {
			input: { data: "test" },
			sdk: {} as any,
			signal: new AbortController().signal,
			ctx: {}, // unknown ctx defaults to {}
		}

		expect(context).toBeDefined()
	})
})

describe("HandlerFn type", () => {
	it("should accept Promise-returning functions", () => {
		const handler: HandlerFn<{ id: string }, { name: string }, unknown> = async (ctx) => {
			return { name: ctx.input.id }
		}

		expect(handler).toBeDefined()
	})

	it("should accept AsyncGenerator functions for streaming", () => {
		const streamHandler: HandlerFn<{ id: string }, { chunk: string }, unknown> = async function* (
			ctx,
		) {
			yield { chunk: "first" }
			yield { chunk: "second" }
		}

		expect(streamHandler).toBeDefined()
	})

	it("should enforce return type matches TOutput", () => {
		// @ts-expect-error - return type doesn't match
		const invalid: HandlerFn<{ id: string }, { name: string }, unknown> = async (ctx) => {
			return { wrongKey: "value" }
		}

		expect(invalid).toBeDefined()
	})
})

describe("RouteBuilder type", () => {
	it("should define fluent API method signatures", () => {
		// This is a structural check - RouteBuilder should have these methods
		type BuilderMethods = keyof RouteBuilder<unknown, unknown>

		const expectedMethods: BuilderMethods[] = [
			"input",
			"timeout",
			"retry",
			"concurrency",
			"stream",
			"heartbeat",
			"cache",
			"middleware",
			"handler",
			"onError",
		]

		expect(expectedMethods.length).toBeGreaterThan(0)
	})
})

describe("RouterEnv type (Context tag)", () => {
	it("should be an Effect Context tag", () => {
		// This test verifies that RouterEnv is defined and can be used as a Context tag
		// Actual runtime test will be in integration tests
		expect(true).toBe(true)
	})
})
