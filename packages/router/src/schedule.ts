/**
 * Retry schedule builders
 * ADR 002 Layer 1 - Duration parsing and Schedule construction
 */
import * as Schedule from "effect/Schedule"
import * as Duration from "effect/Duration"
import type { Duration as DurationStr, RetryConfig } from "./types.js"

/**
 * Parse duration string to milliseconds
 * @example
 * parseDuration("5s") // 5000
 * parseDuration("100ms") // 100
 * parseDuration("2m") // 120000
 * parseDuration("1h") // 3600000
 */
export function parseDuration(duration: DurationStr): number {
	const match = duration.match(/^(\d+)(ms|s|m|h)$/)
	if (!match || !match[1] || !match[2]) {
		throw new Error(`Invalid duration format: ${duration}`)
	}

	const value = Number.parseInt(match[1], 10)
	const unit = match[2]

	switch (unit) {
		case "ms":
			return value
		case "s":
			return value * 1000
		case "m":
			return value * 60 * 1000
		case "h":
			return value * 60 * 60 * 1000
		default:
			throw new Error(`Unknown duration unit: ${unit}`)
	}
}

/**
 * Build Effect Schedule from retry configuration
 *
 * Presets:
 * - "none": No retries (fail immediately)
 * - "exponential": 100ms base, 2x backoff, 3 retries (100ms → 200ms → 400ms)
 * - "linear": 100ms fixed delay, 3 retries (100ms → 100ms → 100ms)
 *
 * Custom config:
 * - maxAttempts: number of retries (not including initial attempt)
 * - delay: base delay between retries (parsed with parseDuration)
 * - backoff: multiplier for exponential backoff (optional, defaults to linear)
 *
 * @example
 * // No retries
 * buildSchedule("none")
 *
 * // Exponential backoff
 * buildSchedule("exponential")
 *
 * // Linear retry
 * buildSchedule("linear")
 *
 * // Custom: 2 retries, 50ms delay, 2x backoff
 * buildSchedule({ maxAttempts: 2, delay: "50ms", backoff: 2 })
 */
export function buildSchedule(config: RetryConfig): Schedule.Schedule<unknown> {
	// Preset: no retries
	if (config === "none") {
		return Schedule.recurs(0)
	}

	// Preset: exponential backoff (100ms base, 2x multiplier, 3 retries)
	if (config === "exponential") {
		const base = Duration.millis(100)
		return Schedule.exponential(base).pipe(Schedule.compose(Schedule.recurs(3)))
	}

	// Preset: linear retry (100ms fixed, 3 retries)
	if (config === "linear") {
		const delay = Duration.millis(100)
		return Schedule.spaced(delay).pipe(Schedule.compose(Schedule.recurs(3)))
	}

	// Custom configuration
	const delayMs = parseDuration(config.delay)
	const baseDelay = Duration.millis(delayMs)

	// Exponential backoff if backoff multiplier specified
	if (config.backoff !== undefined) {
		const schedule = Schedule.exponential(baseDelay, config.backoff)
		return config.maxAttempts > 0
			? schedule.pipe(Schedule.compose(Schedule.recurs(config.maxAttempts)))
			: schedule
	}

	// Linear (fixed delay) otherwise
	const schedule = Schedule.spaced(baseDelay)
	return config.maxAttempts > 0
		? schedule.pipe(Schedule.compose(Schedule.recurs(config.maxAttempts)))
		: schedule
}
