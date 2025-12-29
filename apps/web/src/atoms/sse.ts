/**
 * SSE Connection Atom (Phase 1 - Interim)
 *
 * React hooks for SSE connection management using Effect.Stream directly.
 * Phase 1: Wrap Effect Stream in hooks (use effect-atom patterns but simplified)
 * Phase 2: Full effect-atom migration when patterns are stable
 *
 * Provides:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat monitoring (60s timeout)
 * - Event streaming via Effect.Stream
 * - Factory pattern for testability
 *
 * @module atoms/sse
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { Effect, Stream, Schedule, Duration } from "effect"
import type { GlobalEvent } from "@opencode-ai/sdk/client"

/**
 * SSE connection state
 */
export interface SSEConnectionState {
	/** Whether SSE is currently connected */
	connected: boolean
	/** Latest event received */
	latestEvent: GlobalEvent | null
	/** Last connection error */
	error: Error | null
	/** Number of reconnection attempts */
	retryCount: number
}

/**
 * SSE Configuration
 */
export interface SSEConfig {
	/** Base URL for SSE endpoint (will append /global/event) */
	url: string
	/** Heartbeat timeout (default: 60s) */
	heartbeatTimeout?: Duration.Duration
	/** Retry schedule (default: exponential backoff) */
	retrySchedule?:
		| Schedule.Schedule<Duration.Duration, unknown, never>
		| Schedule.Schedule<number, unknown, number>
	/** Factory for creating EventSource (for testing) */
	createEventSource?: (url: string) => EventSource
}

/**
 * Default heartbeat timeout (60s = 2x server heartbeat of 30s)
 */
const DEFAULT_HEARTBEAT_TIMEOUT = Duration.seconds(60)

/**
 * Default retry schedule: exponential backoff starting at 3s, capping at 30s
 */
const DEFAULT_RETRY_SCHEDULE = Schedule.exponential(Duration.seconds(3))

/**
 * Create EventSource wrapper that converts to Effect.Stream
 *
 * @param url - SSE endpoint URL
 * @param createEventSource - EventSource factory (defaults to browser EventSource)
 * @param heartbeatTimeout - Timeout duration
 * @returns Stream of GlobalEvents
 */
function makeEventSourceStream(
	url: string,
	createEventSource: (url: string) => EventSource = (u) => new EventSource(u),
	heartbeatTimeout: Duration.Duration = DEFAULT_HEARTBEAT_TIMEOUT,
): Stream.Stream<GlobalEvent, Error> {
	return Stream.async<GlobalEvent, Error>((emit) => {
		const eventSource = createEventSource(url)
		let heartbeatTimer: NodeJS.Timeout | null = null

		// Reset heartbeat timer on each event
		const resetHeartbeat = () => {
			if (heartbeatTimer) {
				clearTimeout(heartbeatTimer)
			}
			heartbeatTimer = setTimeout(() => {
				emit.fail(new Error("SSE heartbeat timeout"))
				eventSource.close()
			}, Duration.toMillis(heartbeatTimeout))
		}

		eventSource.onopen = () => {
			resetHeartbeat()
		}

		eventSource.onmessage = (event: MessageEvent) => {
			resetHeartbeat()
			try {
				const data = JSON.parse(event.data) as GlobalEvent
				emit.single(data)
			} catch (error) {
				// Ignore malformed JSON - don't crash the stream
				console.warn("SSE: Failed to parse event data", error)
			}
		}

		eventSource.onerror = () => {
			if (heartbeatTimer) {
				clearTimeout(heartbeatTimer)
			}
			// EventSource error - emit error to stream
			emit.fail(new Error("SSE connection error"))
		}

		// Cleanup on stream end
		return Effect.sync(() => {
			if (heartbeatTimer) {
				clearTimeout(heartbeatTimer)
			}
			eventSource.close()
		})
	})
}

/**
 * Factory function to create SSE atom with injectable config (for testing)
 *
 * This returns an object that can be used to create hooks, maintaining
 * compatibility with the atom pattern while using hooks internally.
 *
 * @param config - SSE configuration
 * @returns Object with connection management
 */
export function makeSSEAtom(config: SSEConfig) {
	const {
		url,
		heartbeatTimeout = DEFAULT_HEARTBEAT_TIMEOUT,
		retrySchedule = DEFAULT_RETRY_SCHEDULE,
		createEventSource,
	} = config

	// For testing, we just need to return a stable object
	// The actual connection happens in the hook
	return {
		config: { url, heartbeatTimeout, retrySchedule, createEventSource },
	}
}

/**
 * Default SSE atom - connects to NEXT_PUBLIC_OPENCODE_URL or localhost:4056
 */
export const sseAtom = makeSSEAtom({
	url: process.env.NEXT_PUBLIC_OPENCODE_URL ?? "http://localhost:4056",
})

/**
 * React hook to access SSE connection state
 *
 * Manages SSE connection lifecycle using Effect.Stream with:
 * - Automatic reconnection via retry schedule
 * - Heartbeat monitoring
 * - Event streaming
 *
 * @param atomConfig - Optional atom config (defaults to sseAtom)
 * @returns SSEConnectionState
 *
 * @example
 * ```tsx
 * const connection = useSSEConnection()
 * console.log("Connected:", connection.connected)
 * console.log("Latest event:", connection.latestEvent)
 * ```
 */
export function useSSEConnection(
	atomConfig: ReturnType<typeof makeSSEAtom> = sseAtom,
): SSEConnectionState {
	const [state, setState] = useState<SSEConnectionState>({
		connected: false,
		latestEvent: null,
		error: null,
		retryCount: 0,
	})

	const cancelledRef = useRef(false)
	const retryCountRef = useRef(0)

	useEffect(() => {
		cancelledRef.current = false
		retryCountRef.current = 0

		const { url, heartbeatTimeout, createEventSource } = atomConfig.config

		const connect = async () => {
			while (!cancelledRef.current) {
				const endpoint = `${url}/global/event`

				try {
					// Create stream with heartbeat monitoring
					const stream = makeEventSourceStream(endpoint, createEventSource, heartbeatTimeout)

					// Mark as connected when stream starts
					if (!cancelledRef.current) {
						setState((prev) => ({
							...prev,
							connected: true,
							error: null,
							retryCount: 0,
						}))
						retryCountRef.current = 0
					}

					// Run the stream and update state on each event
					await Effect.runPromise(
						Stream.runForEach(stream, (event) =>
							Effect.sync(() => {
								if (!cancelledRef.current) {
									setState((prev) => ({
										...prev,
										latestEvent: event,
										connected: true,
										error: null,
									}))
								}
							}),
						),
					)
				} catch (error) {
					if (!cancelledRef.current) {
						retryCountRef.current++
						setState((prev) => ({
							...prev,
							connected: false,
							error: error instanceof Error ? error : new Error(String(error)),
							retryCount: retryCountRef.current,
						}))

						// Exponential backoff: 3s, 6s, 12s, 24s, capped at 30s
						const backoffMs = Math.min(3000 * 2 ** retryCountRef.current, 30000)
						await new Promise((resolve) => setTimeout(resolve, backoffMs))
					}
				}
			}
		}

		connect()

		return () => {
			cancelledRef.current = true
		}
	}, [atomConfig])

	return state
}
