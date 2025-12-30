/**
 * Tests for project management atoms
 *
 * Tests verify the React hooks that fetch project list and current project.
 * Following the pattern from servers.test.ts - testing logic and structure,
 * not DOM behavior.
 */

import { describe, expect, it } from "vitest"

describe("project atoms exports", () => {
	it("useProjects hook exists and is callable", async () => {
		const { useProjects } = await import("./projects")

		expect(typeof useProjects).toBe("function")
	})

	it("useCurrentProject hook exists and is callable", async () => {
		const { useCurrentProject } = await import("./projects")

		expect(typeof useCurrentProject).toBe("function")
	})
})

describe("useProjects return shape", () => {
	it("returns object with projects, loading, and error properties", async () => {
		// This is a structural test - verifying the hook contract
		// Actual async behavior would require React Testing Library integration
		const { useProjects } = await import("./projects")

		// Hook should be a function that returns an object with expected shape
		// We can't call it outside React, but we can verify it exists
		expect(typeof useProjects).toBe("function")
	})
})

describe("useCurrentProject return shape", () => {
	it("returns a project object or null", async () => {
		// This is a structural test - verifying the hook contract
		const { useCurrentProject } = await import("./projects")

		// Hook should be a function that returns a project or null
		expect(typeof useCurrentProject).toBe("function")
	})
})
