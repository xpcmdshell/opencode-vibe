/**
 * Next.js adapter tests - TDD RED phase
 * Tests createNextHandler and createAction
 */
import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from "vitest"
import { createOpencodeRoute } from "../builder.js"
import { createRouter } from "../router.js"
import { createNextHandler, createAction } from "./next.js"
import { Schema } from "effect"

// Mock SDK client for testing
const createMockSdk = () => ({
	session: {
		get: vi.fn(async (id: any) => ({ id: String(id), title: "Test Session" })),
		list: vi.fn(async () => [{ id: "1", title: "Session 1" }]),
	},
	global: {
		event: vi.fn(async function* () {
			yield { type: "message", data: "hello" }
			yield { type: "message", data: "world" }
		}),
	},
})

describe("createNextHandler", () => {
	const o = createOpencodeRoute()

	describe("request-response routes", () => {
		test("handles GET request with query params", async () => {
			// Use any to bypass Schema type issues in tests
			const inputSchema = Schema.Struct({ id: Schema.String }) as any

			const routes = {
				session: {
					get: o({ timeout: "30s" })
						.input(inputSchema)
						.handler(async ({ input, sdk }) =>
							(sdk as any).session.get((input as { id: string }).id),
						),
				},
			}

			const router = createRouter(routes)
			const mockSdk = createMockSdk()

			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: mockSdk as any }),
			})

			// Simulate Next.js request
			const request = new Request("http://localhost/api/router?path=session.get&id=123", {
				method: "GET",
			})

			const response = await handler(request)

			expect(response.status).toBe(200)
			expect(response.headers.get("Content-Type")).toContain("application/json")

			const body = await response.json()
			expect(body).toEqual({ id: "123", title: "Test Session" })
			expect(mockSdk.session.get).toHaveBeenCalledWith("123")
		})

		test("handles POST request with JSON body", async () => {
			const inputSchema = Schema.Struct({ title: Schema.String }) as any

			const routes = {
				session: {
					create: o({ timeout: "30s" })
						.input(inputSchema)
						.handler(async ({ input }) => ({
							id: "new-id",
							title: (input as { title: string }).title,
						})),
				},
			}

			const router = createRouter(routes)
			const mockSdk = createMockSdk()

			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: mockSdk as any }),
			})

			const request = new Request("http://localhost/api/router?path=session.create", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "New Session" }),
			})

			const response = await handler(request)

			expect(response.status).toBe(200)
			const body = await response.json()
			expect(body).toEqual({ id: "new-id", title: "New Session" })
		})

		test("returns 404 for unknown route", async () => {
			const routes = {
				session: {
					get: o({ timeout: "30s" }).handler(async () => ({})),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			const request = new Request("http://localhost/api/router?path=unknown.route")

			const response = await handler(request)

			expect(response.status).toBe(404)
			const body = await response.json()
			expect(body.error).toBe("RouteNotFoundError")
		})

		test("returns 400 for validation error", async () => {
			const inputSchema = Schema.Struct({ id: Schema.String }) as any

			const routes = {
				session: {
					get: o({ timeout: "30s" })
						.input(inputSchema)
						.handler(async ({ input }) => ({
							id: (input as { id: string }).id,
						})),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			// Missing required 'id' parameter
			const request = new Request("http://localhost/api/router?path=session.get")

			const response = await handler(request)

			expect(response.status).toBe(400)
			const body = await response.json()
			expect(body.error).toBe("ValidationError")
		})

		test("returns 500 for handler error", async () => {
			const routes = {
				session: {
					fail: o({ timeout: "30s" }).handler(async () => {
						throw new Error("Handler exploded")
					}),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			const request = new Request("http://localhost/api/router?path=session.fail")

			const response = await handler(request)

			expect(response.status).toBe(500)
			const body = await response.json()
			expect(body.error).toBe("HandlerError")
		})

		test("returns 504 for timeout", async () => {
			const routes = {
				session: {
					slow: o({ timeout: "50ms" }).handler(async () => {
						await new Promise((r) => setTimeout(r, 200))
						return { done: true }
					}),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			const request = new Request("http://localhost/api/router?path=session.slow")

			const response = await handler(request)

			expect(response.status).toBe(504)
			const body = await response.json()
			expect(body.error).toBe("TimeoutError")
		})
	})

	describe("streaming routes", () => {
		test("returns SSE response for streaming route", async () => {
			const routes = {
				subscribe: {
					events: o({ stream: true, heartbeat: "60s" }).handler(async function* () {
						yield { type: "event", data: "one" }
						yield { type: "event", data: "two" }
					}),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			const request = new Request("http://localhost/api/router?path=subscribe.events")

			const response = await handler(request)

			expect(response.status).toBe(200)
			expect(response.headers.get("Content-Type")).toBe("text/event-stream")
			expect(response.headers.get("Cache-Control")).toBe("no-cache")
			expect(response.headers.get("Connection")).toBe("keep-alive")

			// Read stream
			const reader = response.body!.getReader()
			const decoder = new TextDecoder()
			const chunks: string[] = []

			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				chunks.push(decoder.decode(value))
			}

			// Should have SSE formatted events
			const text = chunks.join("")
			expect(text).toContain("data:")
		})

		test("aborts stream on client disconnect", async () => {
			let generatorAborted = false

			const routes = {
				subscribe: {
					events: o({ stream: true }).handler(async function* ({ signal }) {
						try {
							while (true) {
								yield { type: "ping" }
								await new Promise((r) => setTimeout(r, 100))
							}
						} finally {
							generatorAborted = true
						}
					}),
				},
			}

			const router = createRouter(routes)
			const handler = createNextHandler({
				router,
				createContext: async () => ({ sdk: createMockSdk() as any }),
			})

			const request = new Request("http://localhost/api/router?path=subscribe.events")

			const response = await handler(request)
			const reader = response.body!.getReader()

			// Read one chunk
			await reader.read()

			// Cancel the reader (simulates client disconnect)
			await reader.cancel()

			// Give time for cleanup
			await new Promise((r) => setTimeout(r, 100))

			expect(generatorAborted).toBe(true)
		})
	})
})

describe("createAction", () => {
	const o = createOpencodeRoute()

	test("creates callable action from route", async () => {
		const inputSchema = Schema.Struct({ id: Schema.String }) as any

		const route = o({ timeout: "30s" })
			.input(inputSchema)
			.handler(async ({ input }) => ({
				id: (input as { id: string }).id,
				found: true,
			}))

		const action = createAction(route, {
			createContext: async () => ({ sdk: createMockSdk() as any }),
		})

		const result = await action({ id: "test-123" })

		expect(result).toEqual({ id: "test-123", found: true })
	})

	test("validates input before execution", async () => {
		const inputSchema = Schema.Struct({ id: Schema.String }) as any

		const route = o({ timeout: "30s" })
			.input(inputSchema)
			.handler(async ({ input }) => ({ id: (input as { id: string }).id }))

		const action = createAction(route, {
			createContext: async () => ({ sdk: createMockSdk() as any }),
		})

		await expect(action({ wrong: "field" } as any)).rejects.toThrow()
	})

	test("returns async iterable for streaming route", async () => {
		const route = o({ stream: true }).handler(async function* () {
			yield { n: 1 }
			yield { n: 2 }
			yield { n: 3 }
		})

		const action = createAction(route, {
			createContext: async () => ({ sdk: createMockSdk() as any }),
		})

		const result = (await action({})) as unknown as AsyncIterable<{
			n: number
		}>
		const items: Array<{ n: number }> = []

		for await (const item of result) {
			items.push(item)
		}

		expect(items).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
	})

	test("respects timeout configuration", async () => {
		const route = o({ timeout: "50ms" }).handler(async () => {
			await new Promise((r) => setTimeout(r, 200))
			return { done: true }
		})

		const action = createAction(route, {
			createContext: async () => ({ sdk: createMockSdk() as any }),
		})

		await expect(action({})).rejects.toThrow()
	})
})
