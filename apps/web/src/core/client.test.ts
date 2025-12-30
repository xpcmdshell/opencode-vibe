/**
 * Tests for OpenCode client factory
 */

import { describe, expect, it } from "vitest"
import { createClient, OPENCODE_URL } from "./client"

describe("createClient", () => {
	it("creates client with default URL when no args", () => {
		const client = createClient()

		expect(client).toBeDefined()
		// Client should be using the OPENCODE_URL constant
	})

	it("creates client with directory parameter", () => {
		const client = createClient("/path/to/project")

		expect(client).toBeDefined()
	})

	it("creates client with directory and sessionId", () => {
		const client = createClient("/path/to/project", "session-123")

		expect(client).toBeDefined()
	})

	it("exports OPENCODE_URL constant", () => {
		expect(OPENCODE_URL).toBe("http://localhost:4056")
	})

	it("returns client with expected namespaces", () => {
		const client = createClient()

		expect(typeof client.session).toBe("object")
		expect(typeof client.provider).toBe("object")
	})
})

describe("regression prevention (from semantic memory)", () => {
	it("NEVER returns empty URL - lesson from semantic memory bd-0571d346", () => {
		// This is a regression test for a critical bug where changing the default
		// from "http://localhost:4056" to empty string broke the app.
		// See semantic memory: "Multi-server SSE discovery broke the app..."

		// Even if discovery returns nothing, client should work
		const client = createClient()
		expect(client).toBeDefined()

		// The URL constant should NEVER be empty
		expect(OPENCODE_URL).toBeTruthy()
		expect(OPENCODE_URL).not.toBe("")
		expect(OPENCODE_URL).toBe("http://localhost:4056")
	})
})
