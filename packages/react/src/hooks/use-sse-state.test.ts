/**
 * Tests for useSSEState generic hook
 *
 * Tests pure logic - event filtering and state reduction.
 * NO DOM TESTING - we test the contract, not the React internals.
 */

import { describe, it, expect, vi } from "vitest"
import type { GlobalEvent } from "../types/events"
import { matchesEventType, matchesSessionId } from "../lib/sse-utils"

describe("useSSEState - pure logic tests", () => {
	describe("event type matching", () => {
		it("should match exact event type", () => {
			expect(matchesEventType("message.updated", "message.updated")).toBe(true)
			expect(matchesEventType("message.created", "message.updated")).toBe(false)
		})

		it("should match event type in array", () => {
			expect(matchesEventType("message.updated", ["message.updated", "message.removed"])).toBe(true)
			expect(matchesEventType("message.created", ["message.updated", "message.removed"])).toBe(
				false,
			)
		})

		it("should match wildcard event types", () => {
			expect(matchesEventType("message.updated", "message.*")).toBe(true)
			expect(matchesEventType("message.created", "message.*")).toBe(true)
			expect(matchesEventType("session.updated", "message.*")).toBe(false)
		})
	})

	describe("sessionId filtering", () => {
		it("should match events with correct sessionID", () => {
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: { sessionID: "session-123" },
				},
			}

			expect(matchesSessionId(event, "session-123")).toBe(true)
			expect(matchesSessionId(event, "session-456")).toBe(false)
		})

		it("should match all events when sessionId filter is undefined", () => {
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: { sessionID: "session-123" },
				},
			}

			expect(matchesSessionId(event, undefined)).toBe(true)
		})

		it("should not match events without sessionID property", () => {
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: {},
				},
			}

			expect(matchesSessionId(event, "session-123")).toBe(false)
			expect(matchesSessionId(event, undefined)).toBe(true)
		})
	})

	describe("state reduction logic", () => {
		it("should reduce state correctly with simple counter", () => {
			const reducer = (state: number, event: GlobalEvent) => {
				const props = event.payload.properties as { count?: number }
				return state + (props.count || 1)
			}

			let state = 0

			const event1: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "counter.increment",
					properties: { count: 5 },
				},
			}

			state = reducer(state, event1)
			expect(state).toBe(5)

			const event2: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "counter.increment",
					properties: { count: 3 },
				},
			}

			state = reducer(state, event2)
			expect(state).toBe(8)
		})

		it("should reduce complex state with accumulation", () => {
			type State = { count: number; events: string[] }

			const reducer = (state: State, event: GlobalEvent): State => {
				return {
					count: state.count + 1,
					events: [...state.events, event.payload.type],
				}
			}

			let state: State = { count: 0, events: [] }

			state = reducer(state, {
				directory: "/test",
				payload: { type: "message.created", properties: {} },
			})

			expect(state).toEqual({
				count: 1,
				events: ["message.created"],
			})

			state = reducer(state, {
				directory: "/test",
				payload: { type: "message.updated", properties: {} },
			})

			expect(state).toEqual({
				count: 2,
				events: ["message.created", "message.updated"],
			})
		})
	})

	describe("function-based event type filtering", () => {
		it("should work with custom type matcher", () => {
			const typeMatcher = (type: string) => type.startsWith("message.")

			expect(typeMatcher("message.updated")).toBe(true)
			expect(typeMatcher("message.created")).toBe(true)
			expect(typeMatcher("session.updated")).toBe(false)
		})
	})

	describe("combined filtering logic", () => {
		it("should combine event type and sessionId filtering", () => {
			const event: GlobalEvent = {
				directory: "/test",
				payload: {
					type: "message.updated",
					properties: { sessionID: "session-123" },
				},
			}

			// Type matches, sessionId matches
			expect(matchesEventType(event.payload.type, "message.*")).toBe(true)
			expect(matchesSessionId(event, "session-123")).toBe(true)

			// Type matches, sessionId doesn't match
			expect(matchesEventType(event.payload.type, "message.*")).toBe(true)
			expect(matchesSessionId(event, "session-456")).toBe(false)

			// Type doesn't match, sessionId matches
			expect(matchesEventType(event.payload.type, "session.*")).toBe(false)
			expect(matchesSessionId(event, "session-123")).toBe(true)
		})
	})
})
