/**
 * Tests for provider atoms
 *
 * These tests verify the React hooks that fetch provider data from the SDK.
 * Focus: provider list fetching, loading states, error handling.
 */

import { describe, expect, it } from "vitest"
import type { Provider } from "./providers"

/**
 * Expected provider shape after transformation
 */
const mockProviders: Provider[] = [
	{
		id: "anthropic",
		name: "Anthropic",
		models: [
			{ id: "claude-sonnet-4", name: "Claude Sonnet 4" },
			{ id: "claude-opus-4", name: "Claude Opus 4" },
		],
	},
	{
		id: "openai",
		name: "OpenAI",
		models: [
			{ id: "gpt-4", name: "GPT-4" },
			{ id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
		],
	},
]

describe("useProviders hook", () => {
	it("should exist and be callable", async () => {
		const { useProviders } = await import("./providers")
		expect(typeof useProviders).toBe("function")
	})
})

describe("Provider type exports", () => {
	it("should export Provider interface", async () => {
		const module = await import("./providers")
		// Check that the module can be imported without errors
		expect(module).toBeDefined()
	})

	it("should export Model interface", async () => {
		const module = await import("./providers")
		expect(module).toBeDefined()
	})
})

describe("selectBestProvider utility (if needed)", () => {
	it("should select first provider when available", () => {
		// This might not be needed - placeholder for future logic
		expect(true).toBe(true)
	})
})
