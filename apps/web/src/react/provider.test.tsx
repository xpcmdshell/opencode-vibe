/**
 * OpenCodeProvider Tests - Verify caller integration
 *
 * Tests that OpenCodeProvider:
 * 1. Creates a caller from router + SDK
 * 2. Exposes caller via context
 * 3. Makes caller available through useOpenCode hook
 */

// Set up DOM environment for React Testing Library
import { Window } from "happy-dom"
const window = new Window()
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.document = window.document
// @ts-ignore - happy-dom types don't perfectly match DOM types, but work at runtime
globalThis.window = window

import { describe, it, expect, afterEach, beforeEach } from "vitest"
import { renderHook, waitFor, cleanup } from "@testing-library/react"
import { OpenCodeProvider, useOpenCode } from "./provider"
import type { ReactNode } from "react"

// Clean up after each test to prevent state leakage
afterEach(() => {
	cleanup()
})

// Reset any global state before each test
beforeEach(() => {
	// Clear any potential cached modules
	// This ensures clean state when running with other tests
})

/**
 * Test wrapper that provides OpenCodeProvider context
 */
function createWrapper(url = "http://localhost:3000", directory = "/test/dir") {
	return ({ children }: { children: ReactNode }) => (
		<OpenCodeProvider url={url} directory={directory}>
			{children}
		</OpenCodeProvider>
	)
}

describe("OpenCodeProvider - Caller Integration", () => {
	it("should expose caller in context", async () => {
		const { result } = renderHook(() => useOpenCode(), {
			wrapper: createWrapper(),
		})

		// Wait for provider to initialize
		await waitFor(() => {
			expect(result.current.ready).toBe(true)
		})

		// Caller should be available in context
		expect(result.current.caller).toBeDefined()
		expect(typeof result.current.caller).toBe("function")
	})

	it("should create caller with SDK scoped to directory", async () => {
		const directory = "/custom/project/path"
		const { result } = renderHook(() => useOpenCode(), {
			wrapper: createWrapper("http://localhost:3000", directory),
		})

		await waitFor(() => {
			expect(result.current.ready).toBe(true)
		})

		// Caller should exist
		expect(result.current.caller).toBeDefined()

		// Context should have correct directory
		expect(result.current.directory).toBe(directory)
	})

	it("should allow calling routes through caller", async () => {
		const { result } = renderHook(() => useOpenCode(), {
			wrapper: createWrapper(),
		})

		await waitFor(() => {
			expect(result.current.ready).toBe(true)
		})

		// Caller should be callable (actual route execution tested in router tests)
		expect(result.current.caller).toBeDefined()
		expect(typeof result.current.caller).toBe("function")

		// Type check - caller signature should match Caller type
		// caller<TOutput>(path: string, input: unknown): Promise<TOutput>
		const caller = result.current.caller
		expect(caller.length).toBe(2) // Should accept 2 parameters
	})
})
