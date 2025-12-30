import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as Schedule from "effect/Schedule"
import { parseDuration, buildSchedule } from "./schedule.js"
import type { RetryConfig } from "./types.js"

describe("parseDuration", () => {
	it("parses '5s' to 5000ms", () => {
		expect(parseDuration("5s")).toBe(5000)
	})

	it("parses '100ms' to 100ms", () => {
		expect(parseDuration("100ms")).toBe(100)
	})

	it("parses '2m' to 120000ms", () => {
		expect(parseDuration("2m")).toBe(120000)
	})

	it("parses '1h' to 3600000ms", () => {
		expect(parseDuration("1h")).toBe(3600000)
	})

	it("handles zero values", () => {
		expect(parseDuration("0ms")).toBe(0)
		expect(parseDuration("0s")).toBe(0)
	})

	it("handles large numbers", () => {
		expect(parseDuration("999s")).toBe(999000)
		expect(parseDuration("5000ms")).toBe(5000)
	})
})

describe("buildSchedule", () => {
	describe("'none' preset", () => {
		it("returns Schedule that never retries", async () => {
			const schedule = buildSchedule("none")

			let attempts = 0
			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts === 1) {
						return yield* Effect.fail(new Error("First attempt fails"))
					}
					return "success"
				}),
				schedule,
			)

			// Should not retry, so only 1 attempt
			await Effect.runPromise(Effect.either(program))
			expect(attempts).toBe(1)
		})
	})

	describe("'exponential' preset", () => {
		it("retries with exponential backoff", async () => {
			const schedule = buildSchedule("exponential")

			let attempts = 0
			const startTime = Date.now()

			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts < 3) {
						return yield* Effect.fail(new Error(`Attempt ${attempts}`))
					}
					return "success"
				}),
				schedule,
			)

			const result = await Effect.runPromise(program)
			const duration = Date.now() - startTime

			expect(result).toBe("success")
			expect(attempts).toBe(3)
			// Exponential: 100ms, 200ms = ~300ms total (with some tolerance)
			expect(duration).toBeGreaterThan(250)
			expect(duration).toBeLessThan(500)
		})

		it("respects max attempts", async () => {
			const schedule = buildSchedule("exponential")

			let attempts = 0
			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					return yield* Effect.fail(new Error(`Attempt ${attempts}`))
				}),
				schedule,
			)

			await Effect.runPromise(Effect.either(program))

			// Default max is 3 retries = 4 total attempts
			expect(attempts).toBe(4)
		})
	})

	describe("'linear' preset", () => {
		it("retries with fixed delay", async () => {
			const schedule = buildSchedule("linear")

			let attempts = 0
			const startTime = Date.now()

			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts < 3) {
						return yield* Effect.fail(new Error(`Attempt ${attempts}`))
					}
					return "success"
				}),
				schedule,
			)

			const result = await Effect.runPromise(program)
			const duration = Date.now() - startTime

			expect(result).toBe("success")
			expect(attempts).toBe(3)
			// Linear: 100ms, 100ms = ~200ms total
			expect(duration).toBeGreaterThan(150)
			expect(duration).toBeLessThan(350)
		})
	})

	describe("custom config", () => {
		it("respects maxAttempts", async () => {
			const schedule = buildSchedule({
				maxAttempts: 2,
				delay: "50ms",
			})

			let attempts = 0
			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					return yield* Effect.fail(new Error(`Attempt ${attempts}`))
				}),
				schedule,
			)

			await Effect.runPromise(Effect.either(program))

			// maxAttempts: 2 = 2 retries after initial = 3 total
			expect(attempts).toBe(3)
		})

		it("respects custom delay", async () => {
			const schedule = buildSchedule({
				maxAttempts: 1,
				delay: "200ms",
			})

			let attempts = 0
			const startTime = Date.now()

			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts < 2) {
						return yield* Effect.fail(new Error(`Attempt ${attempts}`))
					}
					return "success"
				}),
				schedule,
			)

			await Effect.runPromise(program)
			const duration = Date.now() - startTime

			expect(attempts).toBe(2)
			// Should wait ~200ms
			expect(duration).toBeGreaterThan(180)
			expect(duration).toBeLessThan(350)
		})

		it("applies backoff multiplier when specified", async () => {
			const schedule = buildSchedule({
				maxAttempts: 2,
				delay: "100ms",
				backoff: 2,
			})

			let attempts = 0
			const startTime = Date.now()

			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts < 3) {
						return yield* Effect.fail(new Error(`Attempt ${attempts}`))
					}
					return "success"
				}),
				schedule,
			)

			await Effect.runPromise(program)
			const duration = Date.now() - startTime

			expect(attempts).toBe(3)
			// Backoff 2x: 100ms, 200ms = ~300ms
			expect(duration).toBeGreaterThan(250)
			expect(duration).toBeLessThan(500)
		})

		it("no backoff means linear delay", async () => {
			const schedule = buildSchedule({
				maxAttempts: 2,
				delay: "100ms",
			})

			let attempts = 0
			const startTime = Date.now()

			const program = Effect.retry(
				Effect.gen(function* () {
					attempts++
					if (attempts < 3) {
						return yield* Effect.fail(new Error(`Attempt ${attempts}`))
					}
					return "success"
				}),
				schedule,
			)

			await Effect.runPromise(program)
			const duration = Date.now() - startTime

			expect(attempts).toBe(3)
			// Linear: 100ms, 100ms = ~200ms
			expect(duration).toBeGreaterThan(150)
			expect(duration).toBeLessThan(350)
		})
	})
})
