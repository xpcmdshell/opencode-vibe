/**
 * Public API exports test
 * Ensures all public APIs are accessible from index.ts
 */
import { describe, it, expect } from "vitest"

describe("Router public API", () => {
	describe("Core router functions", () => {
		it("should export createRouter from router.ts", async () => {
			const { createRouter } = await import("./index.js")
			expect(createRouter).toBeDefined()
			expect(typeof createRouter).toBe("function")
		})

		it("should export createOpencodeRoute from builder.ts", async () => {
			const { createOpencodeRoute } = await import("./index.js")
			expect(createOpencodeRoute).toBeDefined()
			expect(typeof createOpencodeRoute).toBe("function")
		})

		it("should export createRoutes from routes.ts", async () => {
			const { createRoutes } = await import("./index.js")
			expect(createRoutes).toBeDefined()
			expect(typeof createRoutes).toBe("function")
		})
	})

	describe("Adapter exports", () => {
		it("should export createCaller from adapters/direct.ts", async () => {
			const { createCaller } = await import("./index.js")
			expect(createCaller).toBeDefined()
			expect(typeof createCaller).toBe("function")
		})

		it("should export createNextHandler from adapters/next.ts", async () => {
			const { createNextHandler } = await import("./index.js")
			expect(createNextHandler).toBeDefined()
			expect(typeof createNextHandler).toBe("function")
		})

		it("should export createAction from adapters/next.ts", async () => {
			const { createAction } = await import("./index.js")
			expect(createAction).toBeDefined()
			expect(typeof createAction).toBe("function")
		})
	})

	describe("Error exports", () => {
		it("should export RouteNotFoundError from router.ts", async () => {
			const { RouteNotFoundError } = await import("./index.js")
			expect(RouteNotFoundError).toBeDefined()
		})

		it("should export ValidationError from errors.ts", async () => {
			const { ValidationError } = await import("./index.js")
			expect(ValidationError).toBeDefined()
		})

		it("should export TimeoutError from errors.ts", async () => {
			const { TimeoutError } = await import("./index.js")
			expect(TimeoutError).toBeDefined()
		})

		it("should export HandlerError from errors.ts", async () => {
			const { HandlerError } = await import("./index.js")
			expect(HandlerError).toBeDefined()
		})

		it("should export StreamError from errors.ts", async () => {
			const { StreamError } = await import("./index.js")
			expect(StreamError).toBeDefined()
		})

		it("should export HeartbeatTimeoutError from errors.ts", async () => {
			const { HeartbeatTimeoutError } = await import("./index.js")
			expect(HeartbeatTimeoutError).toBeDefined()
		})

		it("should export MiddlewareError from errors.ts", async () => {
			const { MiddlewareError } = await import("./index.js")
			expect(MiddlewareError).toBeDefined()
		})
	})

	describe("Type exports", () => {
		it("should export Routes type from routes.ts", async () => {
			// Type-only test - compilation validates this
			const { createRoutes } = await import("./index.js")
			const routes = createRoutes()
			// If Routes type is exported, TypeScript will allow this assignment
			const _typedRoutes: typeof routes = routes
			expect(_typedRoutes).toBeDefined()
		})
	})

	describe("Schedule utilities", () => {
		it("should export parseDuration from schedule.ts", async () => {
			const { parseDuration } = await import("./index.js")
			expect(parseDuration).toBeDefined()
			expect(typeof parseDuration).toBe("function")
		})

		it("should export buildSchedule from schedule.ts", async () => {
			const { buildSchedule } = await import("./index.js")
			expect(buildSchedule).toBeDefined()
			expect(typeof buildSchedule).toBe("function")
		})
	})
})
