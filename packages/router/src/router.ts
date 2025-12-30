/**
 * Router factory and route resolution
 * ADR 002 Layer 3 - Depends on types.ts and builder.ts
 */
import { Data } from "effect"
import type { Route } from "./types.js"

/**
 * Error thrown when route path cannot be resolved
 */
export class RouteNotFoundError extends Data.TaggedError("RouteNotFoundError")<{
	path: string
}> {}

/**
 * Router instance
 * Provides route resolution by dot-notation path
 */
export interface Router {
	/**
	 * Resolve a route by path
	 * @param path - Dot-notation path (e.g., "session.get", "subscribe.events")
	 * @throws {RouteNotFoundError} if path doesn't resolve to a Route
	 */
	resolve(path: string): Route
}

/**
 * Type guard to check if value is a Route object
 * Checks for presence of Route-specific internal properties
 */
function isRoute(value: unknown): value is Route {
	return (
		typeof value === "object" &&
		value !== null &&
		"_config" in value &&
		"_middleware" in value &&
		typeof (value as Route)._config === "object" &&
		Array.isArray((value as Route)._middleware)
	)
}

/**
 * Recursively walk nested route object to build path-to-route map
 */
function flattenRoutes(obj: Record<string, unknown>, prefix = ""): Map<string, Route> {
	const map = new Map<string, Route>()

	for (const [key, value] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${key}` : key

		if (isRoute(value)) {
			map.set(path, value)
		} else if (typeof value === "object" && value !== null) {
			// Recurse into nested object
			const nestedRoutes = flattenRoutes(value as Record<string, unknown>, path)
			// Use Array.from to avoid downlevelIteration issues
			Array.from(nestedRoutes.entries()).forEach(([nestedPath, route]) => {
				map.set(nestedPath, route)
			})
		}
	}

	return map
}

/**
 * Create a router from nested route definitions
 *
 * @example
 * ```typescript
 * const o = createOpencodeRoute()
 *
 * const routes = {
 *   session: {
 *     get: o({ timeout: "30s" }).handler(async ({ sdk }) => sdk.session.get()),
 *     list: o({ timeout: "30s" }).handler(async ({ sdk }) => sdk.session.list()),
 *   },
 *   subscribe: {
 *     events: o({ stream: true }).handler(async function* ({ sdk }) {
 *       for await (const e of sdk.global.event()) yield e
 *     }),
 *   },
 * }
 *
 * const router = createRouter(routes)
 * const route = router.resolve("session.get")
 * ```
 */
export function createRouter(routes: Record<string, unknown>): Router {
	const routeMap = flattenRoutes(routes)

	return {
		resolve(path: string): Route {
			const route = routeMap.get(path)

			if (!route) {
				throw new RouteNotFoundError({ path })
			}

			return route
		},
	}
}
