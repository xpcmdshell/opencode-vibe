/**
 * Tests for createRouter and route resolution
 * ADR 002 Layer 3 - Router factory and path resolution
 */
import { describe, it, expect } from "vitest"
import { createRouter, RouteNotFoundError } from "./router.js"
import { createOpencodeRoute } from "./builder.js"
import { Schema } from "effect"

describe("createRouter", () => {
	it("creates router from nested route object", () => {
		const o = createOpencodeRoute()

		const routes = {
			session: {
				get: o({ timeout: "30s" }).handler(async ({ input }) => ({
					id: input as string,
				})),
			},
		}

		const router = createRouter(routes)

		expect(router).toBeDefined()
		expect(typeof router.resolve).toBe("function")
	})

	describe("Router.resolve", () => {
		const o = createOpencodeRoute()

		const routes = {
			session: {
				get: o({ timeout: "30s" }).handler(async () => ({ id: "session-1" })),
				list: o({ timeout: "30s" }).handler(async () => []),
			},
			subscribe: {
				events: o({ stream: true }).handler(async function* () {
					yield { type: "event" }
				}),
			},
			nested: {
				deep: {
					route: o().handler(async () => "deep"),
				},
			},
		}

		const router = createRouter(routes)

		it("resolves 'session.get' to correct route", () => {
			const route = router.resolve("session.get")

			expect(route).toBeDefined()
			expect(route._config.timeout).toBe("30s")
			expect(route._handler).toBeDefined()
		})

		it("resolves 'session.list' to correct route", () => {
			const route = router.resolve("session.list")

			expect(route).toBeDefined()
			expect(route._config.timeout).toBe("30s")
		})

		it("resolves deeply nested 'subscribe.events' to correct route", () => {
			const route = router.resolve("subscribe.events")

			expect(route).toBeDefined()
			expect(route._config.stream).toBe(true)
		})

		it("resolves triple-nested 'nested.deep.route' to correct route", () => {
			const route = router.resolve("nested.deep.route")

			expect(route).toBeDefined()
			expect(route._handler).toBeDefined()
		})

		it("throws RouteNotFoundError for invalid path", () => {
			expect(() => router.resolve("invalid.path")).toThrow(RouteNotFoundError)
		})

		it("throws RouteNotFoundError for partial valid path", () => {
			expect(() => router.resolve("session")).toThrow(RouteNotFoundError)
		})

		it("throws RouteNotFoundError for empty path", () => {
			expect(() => router.resolve("")).toThrow(RouteNotFoundError)
		})

		it("handles single-segment paths", () => {
			const simpleRoutes = {
				health: o().handler(async () => "ok"),
			}
			const simpleRouter = createRouter(simpleRoutes)

			const route = simpleRouter.resolve("health")
			expect(route).toBeDefined()
		})

		it("ignores non-route objects in nested structure", () => {
			const mixedRoutes = {
				session: {
					get: o().handler(async () => "ok"),
					metadata: { version: "1.0" }, // Not a route, should be ignored
				},
			}
			const mixedRouter = createRouter(mixedRoutes)

			// Should resolve the route
			const route = mixedRouter.resolve("session.get")
			expect(route).toBeDefined()

			// Should not create a route for metadata
			expect(() => mixedRouter.resolve("session.metadata")).toThrow(RouteNotFoundError)
		})
	})
})
