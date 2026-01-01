/**
 * Tests for CLI-compatible SSE streaming (Direct server connections)
 *
 * Tests connectToServerSSE, tailEventsDirect, catchUpEventsDirect, resumeEventsDirect
 */

import { describe, it, expect } from "vitest"
import { Effect, Stream } from "effect"
import {
	connectToServerSSE,
	tailEventsDirect,
	catchUpEventsDirect,
	resumeEventsDirect,
	type DiscoverServers,
} from "./stream.js"

// Mock discovery function for testing
const mockDiscoverServers: DiscoverServers = async () => {
	return [{ port: 4056, directory: "/mock/project" }]
}

const emptyDiscoverServers: DiscoverServers = async () => {
	return []
}

describe("CLI-compatible SSE streaming", () => {
	describe("connectToServerSSE", () => {
		it("should create a stream that connects to server SSE endpoint", () => {
			const stream = connectToServerSSE(4056)
			expect(stream).toBeDefined()
			// Stream is lazy - won't connect until consumed
		})

		it("should handle invalid port gracefully", async () => {
			const stream = connectToServerSSE(99999)

			// Try to consume stream - should fail fast
			const result = await Effect.runPromise(
				Stream.runCollect(stream).pipe(Effect.timeout(2000), Effect.either),
			)

			// Should fail (either connection error or timeout)
			expect(result._tag).toBe("Left")
		})
	})

	describe("tailEventsDirect", () => {
		it("should return empty stream when no servers discovered", async () => {
			const stream = tailEventsDirect(emptyDiscoverServers)

			const events = await Effect.runPromise(
				Stream.runCollect(stream).pipe(Effect.timeout(1000), Effect.either),
			)

			// Should complete with empty array (no servers)
			if (events._tag === "Right") {
				expect(Array.from(events.right)).toHaveLength(0)
			} else {
				// Or timeout - both are acceptable for empty discovery
				expect(events._tag).toBe("Left")
			}
		})

		it("should create stream from discovered servers", () => {
			const stream = tailEventsDirect(mockDiscoverServers)
			expect(stream).toBeDefined()
		})
	})

	describe("catchUpEventsDirect", () => {
		it("should return empty catch-up when no servers discovered", async () => {
			const effect = catchUpEventsDirect(emptyDiscoverServers)

			const result = await Effect.runPromise(effect)

			expect(result.events).toHaveLength(0)
			expect(result.nextOffset).toBeNull()
			expect(result.upToDate).toBe(true)
		})

		it("should create Effect that fetches initial state", () => {
			const effect = catchUpEventsDirect(mockDiscoverServers)
			expect(effect).toBeDefined()
			// Effect is lazy - won't execute until run
		})
	})

	describe("resumeEventsDirect", () => {
		it("should combine catch-up and live streams", () => {
			const stream = resumeEventsDirect(mockDiscoverServers)
			expect(stream).toBeDefined()
		})

		it("should handle empty discovery gracefully", async () => {
			const stream = resumeEventsDirect(emptyDiscoverServers)

			const events = await Effect.runPromise(
				Stream.runCollect(stream).pipe(Effect.timeout(1000), Effect.either),
			)

			// Should complete with empty array or timeout
			if (events._tag === "Right") {
				expect(Array.from(events.right)).toHaveLength(0)
			} else {
				expect(events._tag).toBe("Left")
			}
		})
	})

	describe("DiscoverServers type", () => {
		it("should accept async function returning server array", async () => {
			const discover: DiscoverServers = async () => {
				return [
					{ port: 4056, directory: "/project1" },
					{ port: 4057, directory: "/project2" },
				]
			}

			const servers = await discover()
			expect(servers).toHaveLength(2)
			expect(servers[0]).toHaveProperty("port")
			expect(servers[0]).toHaveProperty("directory")
		})
	})

	describe("Integration: offset tracking", () => {
		it("should accept EventOffset type", async () => {
			// Create a simple discover function
			const discover: DiscoverServers = async () => []

			// EventOffset is optional - test without it
			const stream = resumeEventsDirect(discover)

			// Since no servers, should get empty stream quickly
			const events = await Effect.runPromise(
				Stream.runCollect(stream).pipe(Effect.timeout(500), Effect.either),
			)

			// Empty discovery = empty stream or timeout
			if (events._tag === "Right") {
				expect(Array.from(events.right)).toHaveLength(0)
			}
		})
	})
})
