/**
 * MSW test setup
 *
 * Configures MSW server to intercept HTTP requests during tests.
 * Import this in test files that need HTTP mocking.
 */

import { setupServer } from "msw/node"
import { handlers } from "./msw-handlers"
import { beforeAll, afterEach, afterAll } from "bun:test"

export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => {
	server.listen({ onUnhandledRequest: "warn" })
})

// Reset handlers after each test to prevent test pollution
afterEach(() => {
	server.resetHandlers()
})

// Clean up after all tests
afterAll(() => {
	server.close()
})
