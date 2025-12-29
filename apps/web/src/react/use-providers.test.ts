// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, test, mock, beforeEach } from "bun:test"
import { useProviders } from "./use-providers"

// Mock providers in SDK format (models as dictionary)
const mockProvidersSDK = [
	{
		id: "anthropic",
		name: "Anthropic",
		models: {
			"claude-sonnet-4-20250514": { name: "Claude Sonnet 4" },
			"claude-opus-4-20250514": { name: "Claude Opus 4" },
		},
	},
	{
		id: "openai",
		name: "OpenAI",
		models: {
			"gpt-4": { name: "GPT-4" },
			"gpt-3.5-turbo": { name: "GPT-3.5 Turbo" },
		},
	},
]

// Expected providers after transformation (models as array)
const mockProviders = [
	{
		id: "anthropic",
		name: "Anthropic",
		models: [
			{ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
			{ id: "claude-opus-4-20250514", name: "Claude Opus 4" },
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

// Mock the useOpenCode hook (default mock, overridden per-test)
mock.module("./provider", () => ({
	useOpenCode: mock(() => ({
		url: "http://localhost:3000",
		directory: "/test/directory",
		ready: true,
		sync: mock(() => Promise.resolve()),
		caller: mock(async () => ({
			all: mockProvidersSDK,
			default: mockProvidersSDK[0],
			connected: [],
		})),
	})),
}))

describe("useProviders", () => {
	beforeEach(() => {
		mock.restore()
	})

	test("should fetch providers on mount", async () => {
		const mockCaller = mock(async () => ({
			all: mockProvidersSDK,
			default: mockProvidersSDK[0],
			connected: [],
		}))

		mock.module("./provider", () => ({
			useOpenCode: mock(() => ({
				url: "http://localhost:3000",
				directory: "/test/directory",
				ready: true,
				sync: mock(() => Promise.resolve()),
				caller: mockCaller,
			})),
		}))

		const { result } = renderHook(() => useProviders())

		// Initially loading
		expect(result.current.isLoading).toBe(true)
		expect(result.current.providers).toEqual([])
		expect(result.current.error).toBeUndefined()

		// Wait for data to load
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.providers).toEqual(mockProviders)
		expect(result.current.error).toBeUndefined()
	})

	test("should handle errors", async () => {
		const mockError = new Error("Failed to fetch providers")
		const mockCaller = mock(async () => {
			throw mockError
		})

		mock.module("./provider", () => ({
			useOpenCode: mock(() => ({
				url: "http://localhost:3000",
				directory: "/test/directory",
				ready: true,
				sync: mock(() => Promise.resolve()),
				caller: mockCaller,
			})),
		}))

		const { result } = renderHook(() => useProviders())

		// Wait for error
		await waitFor(() => {
			expect(result.current.isLoading).toBe(false)
		})

		expect(result.current.providers).toEqual([])
		expect(result.current.error).toBe(mockError)
	})

	test("should call provider.list route via caller", async () => {
		const mockCaller = mock(async () => ({
			all: mockProvidersSDK,
			default: mockProvidersSDK[0],
			connected: [],
		}))

		mock.module("./provider", () => ({
			useOpenCode: mock(() => ({
				url: "http://localhost:3000",
				directory: "/test/directory",
				ready: true,
				sync: mock(() => Promise.resolve()),
				caller: mockCaller,
			})),
		}))

		renderHook(() => useProviders())

		await waitFor(() => {
			expect(mockCaller).toHaveBeenCalledWith("provider.list", {})
		})
	})

	test("should call provider.list only once on mount", async () => {
		const mockCaller = mock(async () => ({
			all: mockProvidersSDK,
			default: mockProvidersSDK[0],
			connected: [],
		}))

		mock.module("./provider", () => ({
			useOpenCode: mock(() => ({
				url: "http://localhost:3000",
				directory: "/test/directory",
				ready: true,
				sync: mock(() => Promise.resolve()),
				caller: mockCaller,
			})),
		}))

		const { rerender } = renderHook(() => useProviders())

		await waitFor(() => {
			expect(mockCaller).toHaveBeenCalledTimes(1)
		})

		// Rerender should not trigger refetch
		rerender()

		// Give it a moment to potentially trigger
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(mockCaller).toHaveBeenCalledTimes(1)
	})
})
