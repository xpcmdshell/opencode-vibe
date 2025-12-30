import { describe, it, expect, vi, beforeEach } from "vitest"
import * as Effect from "effect/Effect"
import { createRouter } from "./router.js"
import { createCaller } from "./adapters/direct.js"
import { createRoutes } from "./routes.js"
import type { OpencodeClient } from "./client-types.js"

/**
 * TDD: Tests for route definitions
 * Focus on messages.list route with pagination support
 */

describe("routes", () => {
	describe("messages.list", () => {
		it("fetches messages for a session with default limit", async () => {
			const mockMessages = [
				{ id: "msg_1", sessionID: "ses_123", role: "user", content: "Hello" },
				{
					id: "msg_2",
					sessionID: "ses_123",
					role: "assistant",
					content: "Hi there",
				},
			]

			const mockSdk = {
				session: {
					messages: vi.fn(async () => ({
						data: mockMessages,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockMessages>("messages.list", {
				sessionId: "ses_123",
			})

			expect(result).toEqual(mockMessages)
			expect(mockSdk.session.messages).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				query: { limit: 20 },
			})
		})

		it("fetches messages with custom limit", async () => {
			const mockMessages = Array.from({ length: 50 }, (_, i) => ({
				id: `msg_${i}`,
				sessionID: "ses_123",
				role: i % 2 === 0 ? "user" : "assistant",
				content: `Message ${i}`,
			}))

			const mockSdk = {
				session: {
					messages: vi.fn(async () => ({
						data: mockMessages,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockMessages>("messages.list", {
				sessionId: "ses_123",
				limit: 50,
			})

			expect(result).toEqual(mockMessages)
			expect(mockSdk.session.messages).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				query: { limit: 50 },
			})
		})

		it("returns empty array when no messages exist", async () => {
			const mockSdk = {
				session: {
					messages: vi.fn(async () => ({
						data: [],
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<unknown[]>("messages.list", {
				sessionId: "ses_empty",
			})

			expect(result).toEqual([])
		})

		it("validates sessionId is required", async () => {
			const mockSdk = {
				session: {
					messages: vi.fn(async () => ({ data: [] })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			// Should throw validation error when sessionId is missing
			await expect(caller("messages.list", {})).rejects.toThrow()
		})

		it("validates limit is a positive number", async () => {
			const mockSdk = {
				session: {
					messages: vi.fn(async () => ({ data: [] })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			// Negative limit should fail validation
			await expect(caller("messages.list", { sessionId: "ses_123", limit: -1 })).rejects.toThrow()
		})

		it("has 30s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("messages.list")

			expect(route._config.timeout).toBe("30s")
		})
	})

	describe("session.get", () => {
		it("fetches a session by id", async () => {
			const mockSession = {
				id: "ses_123",
				title: "Test Session",
				created: Date.now(),
			}

			const mockSdk = {
				session: {
					get: vi.fn(async () => ({
						data: mockSession,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockSession>("session.get", {
				id: "ses_123",
			})

			expect(result).toEqual(mockSession)
			expect(mockSdk.session.get).toHaveBeenCalledWith({
				path: { id: "ses_123" },
			})
		})

		it("validates id is required", async () => {
			const mockSdk = {
				session: {
					get: vi.fn(async () => ({ data: {} })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(caller("session.get", {})).rejects.toThrow()
		})

		it("has 30s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.get")

			expect(route._config.timeout).toBe("30s")
		})
	})

	describe("session.list", () => {
		it("fetches all sessions", async () => {
			const mockSessions = [
				{ id: "ses_1", title: "Session 1", created: Date.now() },
				{ id: "ses_2", title: "Session 2", created: Date.now() },
			]

			const mockSdk = {
				session: {
					list: vi.fn(async () => ({
						data: mockSessions,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockSessions>("session.list", {})

			expect(result).toEqual(mockSessions)
			expect(mockSdk.session.list).toHaveBeenCalledWith()
		})

		it("returns empty array when no sessions exist", async () => {
			const mockSdk = {
				session: {
					list: vi.fn(async () => ({
						data: [],
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<unknown[]>("session.list", {})

			expect(result).toEqual([])
		})

		it("has 10s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.list")

			expect(route._config.timeout).toBe("10s")
		})
	})

	describe("session.create", () => {
		it("creates a session with title", async () => {
			const mockSession = {
				id: "ses_new",
				title: "New Session",
				created: Date.now(),
			}

			const mockSdk = {
				session: {
					create: vi.fn(async () => ({
						data: mockSession,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockSession>("session.create", {
				title: "New Session",
			})

			expect(result).toEqual(mockSession)
			expect(mockSdk.session.create).toHaveBeenCalledWith({
				body: { title: "New Session" },
			})
		})

		it("creates a session without title", async () => {
			const mockSession = {
				id: "ses_new",
				title: undefined,
				created: Date.now(),
			}

			const mockSdk = {
				session: {
					create: vi.fn(async () => ({
						data: mockSession,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockSession>("session.create", {})

			expect(result).toEqual(mockSession)
			expect(mockSdk.session.create).toHaveBeenCalledWith({
				body: {},
			})
		})

		it("has 30s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.create")

			expect(route._config.timeout).toBe("30s")
		})
	})

	describe("session.delete", () => {
		it("deletes a session by id", async () => {
			const mockSdk = {
				session: {
					delete: vi.fn(async () => ({
						data: undefined,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<void>("session.delete", {
				id: "ses_123",
			})

			expect(result).toBeUndefined()
			expect(mockSdk.session.delete).toHaveBeenCalledWith({
				path: { id: "ses_123" },
			})
		})

		it("validates id is required", async () => {
			const mockSdk = {
				session: {
					delete: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(caller("session.delete", {})).rejects.toThrow()
		})

		it("has 10s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.delete")

			expect(route._config.timeout).toBe("10s")
		})
	})

	describe("session.promptAsync", () => {
		it("sends a prompt to a session", async () => {
			const mockParts = [{ type: "text", text: "Hello" }]

			const mockSdk = {
				session: {
					promptAsync: vi.fn(async () => ({
						data: undefined,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<void>("session.promptAsync", {
				sessionId: "ses_123",
				parts: mockParts,
			})

			expect(result).toBeUndefined()
			expect(mockSdk.session.promptAsync).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				body: { parts: mockParts },
			})
		})

		it("sends a prompt with model selection", async () => {
			const mockParts = [{ type: "text", text: "Hello" }]
			const mockModel = { provider: "anthropic", model: "claude-3-sonnet" }

			const mockSdk = {
				session: {
					promptAsync: vi.fn(async () => ({
						data: undefined,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<void>("session.promptAsync", {
				sessionId: "ses_123",
				parts: mockParts,
				model: mockModel,
			})

			expect(result).toBeUndefined()
			expect(mockSdk.session.promptAsync).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				body: { parts: mockParts, model: mockModel },
			})
		})

		it("validates sessionId is required", async () => {
			const mockSdk = {
				session: {
					promptAsync: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(caller("session.promptAsync", { parts: [] })).rejects.toThrow()
		})

		it("validates parts is required", async () => {
			const mockSdk = {
				session: {
					promptAsync: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(caller("session.promptAsync", { sessionId: "ses_123" })).rejects.toThrow()
		})

		it("has 5m timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.promptAsync")

			expect(route._config.timeout).toBe("5m")
		})
	})

	describe("provider.list", () => {
		it("fetches all providers with connection status", async () => {
			const mockProviders = {
				all: [
					{ id: "anthropic", name: "Anthropic" },
					{ id: "openai", name: "OpenAI" },
				],
				default: { id: "anthropic", name: "Anthropic" },
				connected: ["anthropic"],
			}

			const mockSdk = {
				config: {
					providers: vi.fn(async () => ({
						data: mockProviders,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockProviders>("provider.list", {})

			expect(result).toEqual(mockProviders)
			expect(mockSdk.config.providers).toHaveBeenCalledWith()
		})

		it("has 10s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("provider.list")

			expect(route._config.timeout).toBe("10s")
		})
	})

	describe("session.command", () => {
		it("executes a slash command without optional parameters", async () => {
			const mockSdk = {
				session: {
					command: vi.fn(async () => ({
						data: undefined,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<void>("session.command", {
				sessionId: "ses_123",
				command: "compact",
				arguments: "",
			})

			expect(result).toBeUndefined()
			expect(mockSdk.session.command).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				body: {
					command: "compact",
					arguments: "",
				},
			})
		})

		it("executes a slash command with agent and model", async () => {
			const mockSdk = {
				session: {
					command: vi.fn(async () => ({
						data: undefined,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<void>("session.command", {
				sessionId: "ses_123",
				command: "custom-command",
				arguments: "arg1 arg2",
				agent: "worker",
				model: "claude-3-sonnet",
			})

			expect(result).toBeUndefined()
			expect(mockSdk.session.command).toHaveBeenCalledWith({
				path: { id: "ses_123" },
				body: {
					command: "custom-command",
					arguments: "arg1 arg2",
					agent: "worker",
					model: "claude-3-sonnet",
				},
			})
		})

		it("validates sessionId is required", async () => {
			const mockSdk = {
				session: {
					command: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(
				caller("session.command", { command: "compact", arguments: "" }),
			).rejects.toThrow()
		})

		it("validates command is required", async () => {
			const mockSdk = {
				session: {
					command: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(
				caller("session.command", { sessionId: "ses_123", arguments: "" }),
			).rejects.toThrow()
		})

		it("validates arguments is required", async () => {
			const mockSdk = {
				session: {
					command: vi.fn(async () => ({ data: undefined })),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			await expect(
				caller("session.command", { sessionId: "ses_123", command: "compact" }),
			).rejects.toThrow()
		})

		it("has 30s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("session.command")

			expect(route._config.timeout).toBe("30s")
		})
	})

	describe("command.list", () => {
		it("fetches all custom commands", async () => {
			const mockCommands = [
				{ name: "custom1", description: "First custom command" },
				{ name: "custom2", description: "Second custom command" },
			]

			const mockSdk = {
				command: {
					list: vi.fn(async () => ({
						data: mockCommands,
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<typeof mockCommands>("command.list", {})

			expect(result).toEqual(mockCommands)
			expect(mockSdk.command.list).toHaveBeenCalledWith()
		})

		it("returns empty array when no custom commands exist", async () => {
			const mockSdk = {
				command: {
					list: vi.fn(async () => ({
						data: [],
					})),
				},
			} as unknown as OpencodeClient

			const routes = createRoutes()
			const router = createRouter(routes)
			const caller = createCaller(router, { sdk: mockSdk })

			const result = await caller<unknown[]>("command.list", {})

			expect(result).toEqual([])
		})

		it("has 10s timeout configured", async () => {
			const routes = createRoutes()
			const router = createRouter(routes)
			const route = router.resolve("command.list")

			expect(route._config.timeout).toBe("10s")
		})
	})
})
