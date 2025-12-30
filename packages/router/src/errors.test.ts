import { describe, it, expect } from "vitest"
import type { ParseIssue } from "effect/ParseResult"
import {
	RouteError,
	ValidationError,
	TimeoutError,
	HandlerError,
	StreamError,
	HeartbeatTimeoutError,
	MiddlewareError,
} from "./errors.js"

describe("RouteError", () => {
	it("has _tag 'RouteError'", () => {
		const err = new RouteError({ cause: "test" })
		expect(err._tag).toBe("RouteError")
	})

	it("stores route and cause", () => {
		const err = new RouteError({
			route: "session.get",
			cause: new Error("fail"),
		})
		expect(err.route).toBe("session.get")
		expect(err.cause).toBeInstanceOf(Error)
	})

	it("works without route (base error)", () => {
		const err = new RouteError({ cause: "generic failure" })
		expect(err._tag).toBe("RouteError")
		expect(err.cause).toBe("generic failure")
		expect(err.route).toBeUndefined()
	})
})

describe("ValidationError", () => {
	it("has _tag 'ValidationError'", () => {
		const err = new ValidationError({ issues: [] })
		expect(err._tag).toBe("ValidationError")
	})

	it("stores route and ParseIssue[]", () => {
		// ParseIssue is complex, just test that the error stores the issues array
		const issues = [] as ParseIssue[]
		const err = new ValidationError({ route: "session.get", issues })
		expect(err.route).toBe("session.get")
		expect(err.issues).toEqual(issues)
	})
})

describe("TimeoutError", () => {
	it("has _tag 'TimeoutError'", () => {
		const err = new TimeoutError({ duration: "5s" })
		expect(err._tag).toBe("TimeoutError")
	})

	it("stores route and duration string", () => {
		const err = new TimeoutError({ route: "stream.messages", duration: "30s" })
		expect(err.route).toBe("stream.messages")
		expect(err.duration).toBe("30s")
	})
})

describe("HandlerError", () => {
	it("has _tag 'HandlerError'", () => {
		const err = new HandlerError({ cause: "handler failed" })
		expect(err._tag).toBe("HandlerError")
	})

	it("stores route and cause", () => {
		const err = new HandlerError({
			route: "provider.list",
			cause: new Error("DB down"),
		})
		expect(err.route).toBe("provider.list")
		expect(err.cause).toBeInstanceOf(Error)
	})
})

describe("StreamError", () => {
	it("has _tag 'StreamError'", () => {
		const err = new StreamError({ cause: "stream broke" })
		expect(err._tag).toBe("StreamError")
	})

	it("stores route and cause", () => {
		const err = new StreamError({
			route: "event.stream",
			cause: new Error("Connection lost"),
		})
		expect(err.route).toBe("event.stream")
		expect(err.cause).toBeInstanceOf(Error)
	})
})

describe("HeartbeatTimeoutError", () => {
	it("has _tag 'HeartbeatTimeoutError'", () => {
		const err = new HeartbeatTimeoutError({ duration: "60s" })
		expect(err._tag).toBe("HeartbeatTimeoutError")
	})

	it("stores route and duration string", () => {
		const err = new HeartbeatTimeoutError({
			route: "sse.heartbeat",
			duration: "90s",
		})
		expect(err.route).toBe("sse.heartbeat")
		expect(err.duration).toBe("90s")
	})
})

describe("MiddlewareError", () => {
	it("has _tag 'MiddlewareError'", () => {
		const err = new MiddlewareError({ cause: "middleware failed" })
		expect(err._tag).toBe("MiddlewareError")
	})

	it("stores route and cause", () => {
		const err = new MiddlewareError({
			route: "session.create",
			cause: new Error("Auth middleware failed"),
		})
		expect(err.route).toBe("session.create")
		expect(err.cause).toBeInstanceOf(Error)
	})
})
