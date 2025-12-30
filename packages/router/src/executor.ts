/**
 * Route executor - runs routes with validation, middleware, and error handling
 * ADR 002 Layer 2 - Depends on types, errors, schedule
 */
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Duration from "effect/Duration"
import type { Route, HandlerContext, HandlerFn, RouteConfig } from "./types.js"
import { ValidationError, TimeoutError, HandlerError, MiddlewareError } from "./errors.js"
import { parseDuration, buildSchedule } from "./schedule.js"
import type { OpencodeClient } from "./client-types.js"

/**
 * Execute a route with full request lifecycle
 * 1. Validate input against schema
 * 2. Run middleware chain
 * 3. Execute handler with timeout/retry
 * 4. Return result
 */
export function executeRoute<TInput, TOutput>(
	route: Route<TInput, TOutput>,
	input: unknown,
	sdk: OpencodeClient,
	signal: AbortSignal,
): Effect.Effect<TOutput, ValidationError | MiddlewareError | HandlerError | TimeoutError> {
	return Effect.gen(function* () {
		// Step 1: Validate input if schema exists
		let validatedInput: TInput
		if (route._inputSchema) {
			const decoded = Schema.decodeUnknown(route._inputSchema)(input)
			const parseResult = yield* Effect.mapError(decoded, (error) => {
				// Convert Schema ParseError to ValidationError
				return new ValidationError({
					issues: error.issue ? [error.issue] : [],
				})
			})
			validatedInput = parseResult
		} else {
			validatedInput = input as TInput
		}

		// Step 2: Build context
		const context: HandlerContext<TInput> = {
			input: validatedInput,
			sdk,
			signal,
			ctx: {},
		}

		// Step 3: Execute handler with middleware wrapping
		if (!route._handler) {
			return yield* Effect.fail(new HandlerError({ cause: new Error("Route has no handler") }))
		}

		// Build handler execution Effect
		const handlerEffect = executeRequestHandler(route._handler, context, route._config)

		// Wrap with middleware if present
		let result: TOutput
		if (route._middleware.length > 0) {
			result = yield* executeWithMiddleware(route._middleware, context, handlerEffect)
		} else {
			result = yield* handlerEffect
		}

		return result
	})
}

/**
 * Execute Effect with middleware chain
 * Each middleware wraps the next, creating an onion-like execution
 */
function executeWithMiddleware<TInput, TOutput>(
	middleware: Array<
		(ctx: HandlerContext<TInput>, next: () => Promise<unknown>) => Promise<unknown>
	>,
	context: HandlerContext<TInput>,
	handlerEffect: Effect.Effect<TOutput, HandlerError | TimeoutError>,
): Effect.Effect<TOutput, MiddlewareError | HandlerError | TimeoutError> {
	return Effect.tryPromise({
		try: async () => {
			// Build middleware chain from right to left, with handler at the end
			let index = 0

			const dispatch = async (): Promise<unknown> => {
				if (index >= middleware.length) {
					// End of middleware chain - execute handler
					return Effect.runPromise(handlerEffect)
				}

				const currentMiddleware = middleware[index]
				if (!currentMiddleware) {
					throw new Error("Middleware not found at index")
				}
				index++

				return currentMiddleware(context, dispatch)
			}

			const result = await dispatch()
			return result as TOutput
		},
		catch: (error) => {
			// If error is already typed (from handler), preserve it
			if (error && typeof error === "object" && "_tag" in error) {
				if (error._tag === "HandlerError" || error._tag === "TimeoutError") {
					return error as HandlerError | TimeoutError
				}
			}
			return new MiddlewareError({
				cause: error,
			})
		},
	})
}

/**
 * Execute handler with timeout and retry logic
 */
export function executeRequestHandler<TInput, TOutput>(
	handler: HandlerFn<TInput, TOutput>,
	context: HandlerContext<TInput>,
	config: RouteConfig,
): Effect.Effect<TOutput, HandlerError | TimeoutError> {
	// Wrap handler execution in Effect
	const handlerEffect = Effect.tryPromise({
		try: async () => {
			const result = await handler(context)
			// If result is AsyncGenerator, we should return it as-is
			// The router layer will handle streaming separately
			return result as TOutput
		},
		catch: (error) =>
			new HandlerError({
				cause: error,
			}),
	})

	// Apply timeout if configured
	let effectWithTimeout: Effect.Effect<TOutput, HandlerError | TimeoutError> = handlerEffect
	if (config.timeout) {
		const timeoutMs = parseDuration(config.timeout)
		const timeoutDuration = Duration.millis(timeoutMs)

		// Use Effect.timeoutFail for proper timeout behavior
		effectWithTimeout = handlerEffect.pipe(
			Effect.timeoutFail({
				duration: timeoutDuration,
				onTimeout: () =>
					new TimeoutError({
						duration: config.timeout!,
					}),
			}),
		)
	}

	// Apply retry if configured
	let effectWithRetry = effectWithTimeout
	if (config.retry) {
		const schedule = buildSchedule(config.retry)
		// Convert defects to failures so retry logic can handle them
		effectWithRetry = effectWithTimeout.pipe(
			Effect.catchAllDefect((defect) => Effect.fail(new HandlerError({ cause: defect }))),
			Effect.retry(schedule),
		)
	}

	return effectWithRetry
}
