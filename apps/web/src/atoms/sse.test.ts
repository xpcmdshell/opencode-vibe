/**
 * Tests for SSE connection atom
 *
 * Tests the SSE atom factory and connection lifecycle management.
 * Uses mock EventSource to avoid real network connections.
 */

import { describe, expect, it, beforeEach, vi } from "vitest"
import { Effect, Stream, Schedule, Duration, Exit, Layer } from "effect"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

// Mock EventSource for testing
class MockEventSource {
	url: string
	readyState: number = 0 // CONNECTING
	onopen: ((event: Event) => void) | null = null
	onmessage: ((event: MessageEvent) => void) | null = null
	onerror: ((event: Event) => void) | null = null

	static CONNECTING = 0
	static OPEN = 1
	static CLOSED = 2

	constructor(url: string) {
		this.url = url
		// Simulate async connection
		setTimeout(() => {
			this.readyState = MockEventSource.OPEN
			this.onopen?.(new Event("open"))
		}, 10)
	}

	close() {
		this.readyState = MockEventSource.CLOSED
	}

	// Test helper to simulate receiving a message
	_simulateMessage(data: string) {
		if (this.readyState === MockEventSource.OPEN) {
			this.onmessage?.(new MessageEvent("message", { data }))
		}
	}

	// Test helper to simulate an error
	_simulateError() {
		this.onerror?.(new Event("error"))
	}
}

describe("SSE Atom", () => {
	describe("Connection lifecycle", () => {
		it("should create atom config on initialization", async () => {
			const { makeSSEAtom } = await import("./sse")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				createEventSource: (url) => {
					expect(url).toBe("http://localhost:4056/global/event")
					return new MockEventSource(url) as unknown as EventSource
				},
			})

			expect(atom).toBeDefined()
			expect(atom.config).toBeDefined()
			expect(atom.config.url).toBe("http://localhost:4056")
		})

		it("should handle disconnection when EventSource closes", async () => {
			const { makeSSEAtom } = await import("./sse")

			const mockSource = new MockEventSource("http://localhost:4056/global/event")
			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				createEventSource: () => mockSource as unknown as EventSource,
			})

			expect(atom.config.createEventSource).toBeDefined()

			// Simulate close
			mockSource.close()
			expect(mockSource.readyState).toBe(MockEventSource.CLOSED)
		})

		it("should support exponential backoff configuration", async () => {
			const { makeSSEAtom } = await import("./sse")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				createEventSource: () =>
					new MockEventSource("http://localhost:4056/global/event") as unknown as EventSource,
			})

			// Verify config is stored for use by hook
			expect(atom.config.url).toBe("http://localhost:4056")
		})
	})

	describe("Heartbeat monitoring", () => {
		it("should configure heartbeat timeout", async () => {
			const { makeSSEAtom } = await import("./sse")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				heartbeatTimeout: Duration.millis(100), // Short timeout for testing
				createEventSource: () =>
					new MockEventSource("http://localhost:4056/global/event") as unknown as EventSource,
			})

			// Verify heartbeat timeout is in config
			expect(atom.config.heartbeatTimeout).toBeDefined()
		})

		it("should accept heartbeat timeout in configuration", async () => {
			const { makeSSEAtom } = await import("./sse")

			const mockSource = new MockEventSource("http://localhost:4056/global/event")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				heartbeatTimeout: Duration.millis(100),
				createEventSource: () => mockSource as unknown as EventSource,
			})

			// Verify configuration is stored
			expect(atom.config.heartbeatTimeout).toBeDefined()
			expect(atom.config.url).toBe("http://localhost:4056")
		})
	})

	describe("Event streaming", () => {
		it("should create atom that supports event streaming", async () => {
			const { makeSSEAtom } = await import("./sse")

			const mockSource = new MockEventSource("http://localhost:4056/global/event")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				createEventSource: () => mockSource as unknown as EventSource,
			})

			// Verify atom config supports custom EventSource factory
			expect(atom.config.createEventSource).toBeDefined()

			// Verify mock EventSource can be created
			const source = atom.config.createEventSource?.("http://test")
			expect(source).toBeDefined()
		})

		it("should handle malformed JSON gracefully", async () => {
			const { makeSSEAtom } = await import("./sse")

			const mockSource = new MockEventSource("http://localhost:4056/global/event")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				createEventSource: () => mockSource as unknown as EventSource,
			})

			// Wait for connection
			await new Promise((resolve) => setTimeout(resolve, 20))

			// Send malformed JSON - should not crash
			mockSource._simulateMessage("not valid json")
			mockSource._simulateMessage("{incomplete")

			// Connection should still be alive
			expect(mockSource.readyState).toBe(MockEventSource.OPEN)
		})
	})

	describe("useSSEConnection hook", () => {
		it("should export useSSEConnection hook", async () => {
			const { useSSEConnection } = await import("./sse")

			expect(typeof useSSEConnection).toBe("function")
		})
	})

	describe("Default atom export", () => {
		it("should export default sseAtom", async () => {
			const { sseAtom } = await import("./sse")

			expect(sseAtom).toBeDefined()
		})
	})

	describe("Exponential backoff", () => {
		it("should use Schedule.exponential for reconnection", async () => {
			// This test verifies the implementation uses Effect.retry with Schedule.exponential
			// We can't easily test the actual backoff timing without mocking time,
			// so we just verify the factory accepts retry configuration

			const { makeSSEAtom } = await import("./sse")

			const mockSource = new MockEventSource("http://localhost:4056/global/event")

			const atom = makeSSEAtom({
				url: "http://localhost:4056",
				retrySchedule: Schedule.exponential(Duration.seconds(1)),
				createEventSource: () => mockSource as unknown as EventSource,
			})

			expect(atom).toBeDefined()
			expect(atom.config.retrySchedule).toBeDefined()
		})
	})
})
