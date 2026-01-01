/**
 * World Stream - Reactive SSE consumer with async iterator
 *
 * Creates a handle for subscribing to world state changes via SSE.
 * Provides sync subscription API and async iterator for streaming.
 */

import { Effect, Stream, Schedule } from "effect"
import { MultiServerSSE } from "../sse/multi-server-sse.js"
import type { Message, Part, Session } from "../types/domain.js"
import type { GlobalEvent, SessionStatus } from "../types/events.js"
import { WorldStore } from "./atoms.js"
import type { WorldState, WorldStreamConfig, WorldStreamHandle } from "./types.js"
import { createClient } from "../client/index.js"
import { normalizeBackendStatus, type BackendSessionStatus } from "../types/sessions.js"
import type { EventOffset } from "./cursor.js"
import type { WorldEvent } from "./events.js"
import { createParser, type EventSourceParser } from "eventsource-parser"

/**
 * CatchUpResponse: bounded history query result
 *
 * Used by catchUpEvents to return a bounded set of historical events
 * with a cursor for resuming the stream.
 */
export interface CatchUpResponse {
	events: WorldEvent[]
	nextOffset: EventOffset | null
	upToDate: boolean
}

/**
 * Create a world stream from SSE events
 *
 * @example
 * ```typescript
 * const stream = createWorldStream({ baseUrl: "http://localhost:1999" })
 *
 * // Subscribe API
 * const unsub = stream.subscribe((world) => console.log(world))
 *
 * // Async iterator API
 * for await (const world of stream) {
 *   console.log(world.sessions.length)
 * }
 *
 * await stream.dispose()
 * ```
 */
export function createWorldStream(config: WorldStreamConfig = {}): WorldStreamHandle {
	const { baseUrl = "http://localhost:1999", autoReconnect = true } = config

	const store = new WorldStore()
	const sse = new MultiServerSSE()
	const asyncIteratorSubscribers = new Set<(state: WorldState) => void>()

	// Wire SSE events to store updates
	sse.onEvent((event: GlobalEvent) => {
		handleSSEEvent(event)
	})

	/**
	 * Bootstrap: Fetch initial data then start SSE connection
	 */
	async function bootstrap(): Promise<void> {
		try {
			store.setConnectionStatus("connecting")

			// Create client with explicit baseUrl for CLI usage
			const { createOpencodeClient } = await import("@opencode-ai/sdk/client")
			const client = createOpencodeClient({ baseUrl })

			// Fetch /session/list and /session/status in parallel
			const [sessionsResponse, statusResponse] = await Promise.all([
				client.session.list(),
				client.session.status(),
			])

			const sessions = sessionsResponse.data || []
			const backendStatusMap =
				(statusResponse.data as Record<string, BackendSessionStatus> | null) || {}

			// Normalize backend status format to SessionStatus
			const statusMap: Record<string, SessionStatus> = {}
			for (const [sessionId, backendStatus] of Object.entries(backendStatusMap)) {
				statusMap[sessionId] = normalizeBackendStatus(backendStatus)
			}

			// Populate store
			store.setSessions(sessions)
			store.setStatus(statusMap)

			// Mark as connected
			store.setConnectionStatus("connected")

			// Start SSE connection
			sse.start()
		} catch (error) {
			console.error("[WorldStream] Bootstrap failed:", error)
			store.setConnectionStatus("error")
		}
	}

	// Kick off bootstrap
	bootstrap()

	/**
	 * Handle incoming SSE events
	 */
	function handleSSEEvent(event: GlobalEvent): void {
		const { type, properties } = event.payload

		switch (type) {
			case "session.created":
			case "session.updated": {
				const session = properties as unknown as Session
				store.upsertSession(session)
				break
			}

			case "message.created":
			case "message.updated": {
				const message = properties as unknown as Message
				store.upsertMessage(message)
				break
			}

			case "part.created":
			case "part.updated": {
				const part = properties as unknown as Part
				store.upsertPart(part)
				break
			}

			case "session.status": {
				const { sessionID, status } = properties as {
					sessionID: string
					status: SessionStatus
				}
				store.updateStatus(sessionID, status)
				break
			}
		}
	}

	/**
	 * Subscribe to world state changes
	 */
	function subscribe(callback: (state: WorldState) => void): () => void {
		return store.subscribe(callback)
	}

	/**
	 * Get current world state snapshot
	 */
	async function getSnapshot(): Promise<WorldState> {
		return store.getState()
	}

	/**
	 * Async iterator for world state changes
	 */
	async function* asyncIterator(): AsyncIterableIterator<WorldState> {
		// Yield current state immediately
		yield store.getState()

		// Then yield on every change
		const queue: WorldState[] = []
		let resolveNext: ((state: WorldState) => void) | null = null

		const unsubscribe = store.subscribe((state) => {
			if (resolveNext) {
				resolveNext(state)
				resolveNext = null
			} else {
				queue.push(state)
			}
		})

		try {
			while (true) {
				if (queue.length > 0) {
					yield queue.shift()!
				} else {
					// Wait for next state
					const state = await new Promise<WorldState>((resolve) => {
						resolveNext = resolve
					})
					yield state
				}
			}
		} finally {
			unsubscribe()
		}
	}

	/**
	 * Clean up resources
	 */
	async function dispose(): Promise<void> {
		sse.stop()
		store.setConnectionStatus("disconnected")
		asyncIteratorSubscribers.clear()
	}

	return {
		subscribe,
		getSnapshot,
		[Symbol.asyncIterator]: asyncIterator,
		dispose,
	}
}

/**
 * catchUpEvents: Fetch bounded history of events
 *
 * Returns historical events from the given offset (or beginning if none).
 * The last event in the response includes upToDate: true.
 *
 * Pattern: Durable Streams catch-up phase
 *
 * @param offset - Optional offset to resume from
 * @returns Effect yielding CatchUpResponse
 *
 * @example
 * ```typescript
 * const response = await Effect.runPromise(catchUpEvents())
 * console.log(response.events.length) // Historical events
 * console.log(response.upToDate) // true when caught up
 * ```
 */
export function catchUpEvents(offset?: EventOffset): Effect.Effect<CatchUpResponse> {
	return Effect.gen(function* (_) {
		// Fetch initial state from all discovered servers
		const sse = new MultiServerSSE()
		const servers = sse.getDiscoveredServers()

		if (servers.length === 0) {
			// No servers discovered yet - return empty catch-up
			return {
				events: [],
				nextOffset: null,
				upToDate: true,
			}
		}

		// Create client and fetch session data from all servers in parallel
		const { createOpencodeClient } = yield* _(
			Effect.promise(() => import("@opencode-ai/sdk/client")),
		)

		const events: WorldEvent[] = []
		let offsetCounter = offset ? Number.parseInt(offset as string, 10) : 0

		// Fetch from each server
		for (const server of servers) {
			const client = createOpencodeClient({ baseUrl: `/api/opencode/${server.port}` })

			const [sessionsResponse, statusResponse] = yield* _(
				Effect.promise(() => Promise.all([client.session.list(), client.session.status()])),
			)

			const sessions = sessionsResponse.data || []
			const backendStatusMap =
				(statusResponse.data as Record<string, BackendSessionStatus> | null) || {}

			// Convert sessions to synthetic WorldEvent[]
			for (const session of sessions) {
				offsetCounter++
				const isLast = false // We'll reconstruct the last one separately
				events.push({
					type: "session.created",
					offset: String(offsetCounter).padStart(10, "0") as EventOffset,
					timestamp: Date.now(),
					upToDate: isLast,
					payload: {
						id: session.id,
						projectKey: server.directory,
					},
				})
			}

			// Convert status data to synthetic events
			for (const [sessionId, backendStatus] of Object.entries(backendStatusMap)) {
				const status = normalizeBackendStatus(backendStatus)
				offsetCounter++
				events.push({
					type: "session.updated",
					offset: String(offsetCounter).padStart(10, "0") as EventOffset,
					timestamp: Date.now(),
					upToDate: false,
					payload: {
						id: sessionId,
						status: status,
					},
				})
			}
		}

		// Reconstruct last event with upToDate: true
		if (events.length > 0) {
			const lastEvent = events[events.length - 1]
			events[events.length - 1] = {
				...lastEvent,
				upToDate: true,
			}
		}

		return {
			events,
			nextOffset: events.length > 0 ? events[events.length - 1].offset : null,
			upToDate: true,
		}
	})
}

/**
 * tailEvents: Unbounded live polling stream
 *
 * Subscribes to MultiServerSSE for real-time events.
 * Converts GlobalEvent → WorldEvent with monotonic offsets.
 *
 * Pattern: Durable Streams live/tail phase
 *
 * @param offset - Optional offset to start from (used for monotonic offset generation)
 * @returns Stream of WorldEvents
 *
 * @example
 * ```typescript
 * const stream = tailEvents()
 * for await (const event of stream) {
 *   console.log(event.type, event.offset)
 * }
 * ```
 */
export function tailEvents(offset?: EventOffset): Stream.Stream<WorldEvent> {
	return Stream.async<WorldEvent>((emit) => {
		const sse = new MultiServerSSE()
		let offsetCounter = offset ? Number.parseInt(offset as string, 10) : 0

		// Start SSE discovery and connections
		sse.start()

		// Subscribe to all SSE events
		const unsubscribe = sse.onEvent((event: GlobalEvent) => {
			// Convert GlobalEvent → WorldEvent
			const { type, properties } = event.payload

			// Filter for recognized event types
			if (
				!type.startsWith("session.") &&
				!type.startsWith("message.") &&
				!type.startsWith("part.")
			) {
				return
			}

			offsetCounter++
			const worldEvent: WorldEvent = {
				type: type as WorldEvent["type"],
				offset: String(offsetCounter).padStart(10, "0") as EventOffset,
				timestamp: Date.now(),
				upToDate: false,
				payload: properties as any, // Type is validated by event type discriminator
			}

			emit.single(worldEvent)
		})

		// Cleanup
		return Effect.sync(() => {
			unsubscribe()
			sse.stop()
		})
	})
}

/**
 * resumeEvents: Combined catch-up + live stream
 *
 * Implements the Durable Streams resume pattern:
 * 1. Catch-up: Fetch bounded history from savedOffset
 * 2. Live: Continuously poll for new events after catch-up
 *
 * Uses Stream.scan for offset tracking across both phases.
 * Uses Stream.concat to join catch-up history with live tail.
 *
 * @param savedOffset - Optional offset to resume from
 * @returns Stream of WorldEvents
 *
 * @example
 * ```typescript
 * const stream = resumeEvents("12345" as EventOffset)
 * for await (const event of stream) {
 *   if (event.upToDate) {
 *     console.log("Caught up! Now live...")
 *   }
 * }
 * ```
 */
export function resumeEvents(savedOffset?: EventOffset): Stream.Stream<WorldEvent> {
	// Phase 1: Catch-up (bounded history)
	const catchUpStream = Stream.fromEffect(catchUpEvents(savedOffset)).pipe(
		Stream.flatMap((response) => Stream.fromIterable(response.events)),
	)

	// Phase 2: Live tail (unbounded polling)
	// Extract nextOffset from catch-up response to start tail
	const liveStream = Stream.fromEffect(catchUpEvents(savedOffset)).pipe(
		Stream.flatMap((response) => tailEvents(response.nextOffset || savedOffset)),
	)

	// Concatenate: catch-up first, then live
	return Stream.concat(catchUpStream, liveStream).pipe(
		// Track offsets using scan
		Stream.scan(
			{ lastOffset: savedOffset, event: null as WorldEvent | null } as {
				lastOffset: EventOffset | undefined
				event: WorldEvent | null
			},
			(state, event) => ({
				lastOffset: event.offset,
				event: event,
			}),
		),
		// Map back to just events (scan adds tracking state)
		Stream.map(({ event }) => event!),
		// Filter out null events from initial scan state
		Stream.filter((event): event is WorldEvent => event !== null),
	)
}

// ============================================================================
// CLI-COMPATIBLE SSE STREAMING (Direct server connections)
// ============================================================================

/**
 * Injected discovery function type
 * CLI can inject its own discovery mechanism (e.g., lsof-based)
 */
export type DiscoverServers = () => Promise<Array<{ port: number; directory: string }>>

/**
 * connectToServerSSE: Direct SSE connection to OpenCode server
 *
 * Uses fetch with streaming (not EventSource - that's browser-only)
 * Parses SSE format with eventsource-parser
 * Emits GlobalEvent objects
 *
 * Pattern: Effect Stream from fetch ReadableStream
 *
 * @param port - Server port to connect to
 * @returns Stream of GlobalEvents
 *
 * @example
 * ```typescript
 * const stream = connectToServerSSE(4056)
 * await Effect.runPromise(
 *   Stream.runForEach(stream, (event) =>
 *     Effect.sync(() => console.log(event))
 *   )
 * )
 * ```
 */
export function connectToServerSSE(port: number): Stream.Stream<GlobalEvent, Error> {
	return Stream.async<GlobalEvent, Error>((emit) => {
		const url = `http://127.0.0.1:${port}/global/event`
		console.log(`[WorldStream] Connecting to SSE: ${url}`)

		let controller: AbortController | null = new AbortController()
		let parser: EventSourceParser | null = null

		// Create SSE parser
		parser = createParser({
			onEvent: (event) => {
				// eventsource-parser emits EventSourceMessage with 'event' field
				try {
					// Parse SSE data as GlobalEvent
					const globalEvent = JSON.parse(event.data) as GlobalEvent
					emit.single(globalEvent)
				} catch (error) {
					console.error("[WorldStream] Failed to parse SSE event:", error)
					emit.fail(error instanceof Error ? error : new Error(String(error)))
				}
			},
		})

		// Start fetch streaming
		Effect.runPromise(
			Effect.tryPromise({
				try: async () => {
					const response = await fetch(url, {
						headers: {
							Accept: "text/event-stream",
							"Cache-Control": "no-cache",
						},
						signal: controller?.signal,
					})

					if (!response.ok) {
						throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`)
					}

					if (!response.body) {
						throw new Error("SSE response has no body")
					}

					const reader = response.body.getReader()
					const decoder = new TextDecoder()

					while (true) {
						const { done, value } = await reader.read()
						if (done) break

						// Decode chunk and feed to parser
						const chunk = decoder.decode(value, { stream: true })
						parser?.feed(chunk)
					}
				},
				catch: (error) => {
					if (error instanceof Error && error.name === "AbortError") {
						// Graceful shutdown, not an error
						return new Error("Connection closed")
					}
					return error instanceof Error ? error : new Error(String(error))
				},
			}),
		).catch((error) => {
			console.error(`[WorldStream] SSE stream error for port ${port}:`, error)
			emit.fail(error instanceof Error ? error : new Error(String(error)))
		})

		// Cleanup function
		return Effect.sync(() => {
			console.log(`[WorldStream] Closing SSE connection: ${url}`)
			controller?.abort()
			controller = null
			parser = null
		})
	})
}

/**
 * tailEventsDirect: Direct live event stream from discovered servers
 *
 * CLI-compatible version of tailEvents that:
 * - Uses injected discovery function
 * - Connects directly to servers (no proxy)
 * - Merges streams from all servers
 * - Converts GlobalEvent → WorldEvent with monotonic offsets
 *
 * Pattern: Stream.mergeAll for multi-server fan-in
 *
 * @param discover - Discovery function to get servers
 * @param offset - Optional offset to start from
 * @returns Stream of WorldEvents
 *
 * @example
 * ```typescript
 * import { discoverServers } from "./discovery.js"
 *
 * const stream = tailEventsDirect(discoverServers)
 * for await (const event of stream) {
 *   console.log(event.type, event.offset)
 * }
 * ```
 */
export function tailEventsDirect(
	discover: DiscoverServers,
	offset?: EventOffset,
): Stream.Stream<WorldEvent, Error> {
	return Stream.fromEffect(
		Effect.tryPromise({
			try: () => discover(),
			catch: (error) => (error instanceof Error ? error : new Error(String(error))),
		}),
	).pipe(
		Stream.flatMap((servers) => {
			if (servers.length === 0) {
				console.log("[WorldStream] No servers discovered")
				return Stream.empty
			}

			console.log(
				`[WorldStream] Discovered ${servers.length} server(s): ${servers.map((s) => s.port).join(", ")}`,
			)

			// Create SSE stream for each server
			const serverStreams = servers.map((server) =>
				connectToServerSSE(server.port).pipe(
					// Retry on connection failure with exponential backoff
					Stream.retry(
						Schedule.exponential("1 second").pipe(
							Schedule.union(Schedule.spaced("30 seconds")), // Max 30s between retries
							Schedule.compose(Schedule.recurs(5)), // Max 5 retries
						),
					),
					// Add directory context to each event
					Stream.map((globalEvent) => ({ ...globalEvent, serverPort: server.port })),
				),
			)

			// Merge all server streams
			return Stream.mergeAll(serverStreams, { concurrency: "unbounded" })
		}),
		// Convert GlobalEvent → WorldEvent with monotonic offsets
		Stream.scan(
			{
				offsetCounter: offset ? Number.parseInt(offset as string, 10) : 0,
				event: null as GlobalEvent | null,
			},
			(state, globalEvent: GlobalEvent) => {
				return {
					offsetCounter: state.offsetCounter + 1,
					event: globalEvent,
				}
			},
		),
		Stream.map((state) => {
			if (!state.event) return null

			const { type, properties } = state.event.payload

			// Filter for recognized event types
			if (
				!type.startsWith("session.") &&
				!type.startsWith("message.") &&
				!type.startsWith("part.")
			) {
				return null
			}

			const worldEvent: WorldEvent = {
				type: type as WorldEvent["type"],
				offset: String(state.offsetCounter).padStart(10, "0") as EventOffset,
				timestamp: Date.now(),
				upToDate: false,
				payload: properties as any,
			}

			return worldEvent
		}),
		// Filter out null events (unrecognized types and initial state)
		Stream.filter((event): event is WorldEvent => event !== null),
	)
}

/**
 * catchUpEventsDirect: Direct fetch of initial state from discovered servers
 *
 * CLI-compatible version of catchUpEvents that:
 * - Uses injected discovery function
 * - Fetches directly from servers (no proxy)
 * - Converts /session/list + /session/status to synthetic WorldEvents
 *
 * @param discover - Discovery function to get servers
 * @param offset - Optional offset to resume from
 * @returns Effect yielding CatchUpResponse
 *
 * @example
 * ```typescript
 * import { discoverServers } from "./discovery.js"
 *
 * const response = await Effect.runPromise(catchUpEventsDirect(discoverServers))
 * console.log(response.events.length)
 * ```
 */
export function catchUpEventsDirect(
	discover: DiscoverServers,
	offset?: EventOffset,
): Effect.Effect<CatchUpResponse, Error> {
	return Effect.gen(function* (_) {
		// Discover servers
		const servers = yield* _(
			Effect.tryPromise({
				try: () => discover(),
				catch: (error) => (error instanceof Error ? error : new Error(String(error))),
			}),
		)

		if (servers.length === 0) {
			console.log("[WorldStream] No servers discovered for catch-up")
			return {
				events: [],
				nextOffset: null,
				upToDate: true,
			}
		}

		console.log(`[WorldStream] Catching up from ${servers.length} server(s)`)

		// Create SDK client
		const { createOpencodeClient } = yield* _(
			Effect.promise(() => import("@opencode-ai/sdk/client")),
		)

		const events: WorldEvent[] = []
		let offsetCounter = offset ? Number.parseInt(offset as string, 10) : 0

		// Fetch from each server
		for (const server of servers) {
			const client = createOpencodeClient({ baseUrl: `http://127.0.0.1:${server.port}` })

			const [sessionsResponse, statusResponse] = yield* _(
				Effect.tryPromise({
					try: () => Promise.all([client.session.list(), client.session.status()]),
					catch: (error) => (error instanceof Error ? error : new Error(String(error))),
				}),
			)

			const sessions = sessionsResponse.data || []
			const backendStatusMap =
				(statusResponse.data as Record<string, BackendSessionStatus> | null) || {}

			// Convert sessions to synthetic WorldEvents
			for (const session of sessions) {
				offsetCounter++
				events.push({
					type: "session.created",
					offset: String(offsetCounter).padStart(10, "0") as EventOffset,
					timestamp: Date.now(),
					upToDate: false,
					payload: {
						id: session.id,
						projectKey: server.directory,
					},
				})
			}

			// Convert status data to synthetic events
			for (const [sessionId, backendStatus] of Object.entries(backendStatusMap)) {
				const status = normalizeBackendStatus(backendStatus)
				offsetCounter++
				events.push({
					type: "session.updated",
					offset: String(offsetCounter).padStart(10, "0") as EventOffset,
					timestamp: Date.now(),
					upToDate: false,
					payload: {
						id: sessionId,
						status: status,
					},
				})
			}
		}

		// Mark last event with upToDate: true
		if (events.length > 0) {
			const lastEvent = events[events.length - 1]
			events[events.length - 1] = {
				...lastEvent,
				upToDate: true,
			}
		}

		return {
			events,
			nextOffset: events.length > 0 ? events[events.length - 1].offset : null,
			upToDate: true,
		}
	})
}

/**
 * resumeEventsDirect: Combined catch-up + live stream (CLI-compatible)
 *
 * CLI-compatible version of resumeEvents that:
 * - Uses injected discovery function
 * - Connects directly to servers (no proxy)
 * - Implements Durable Streams resume pattern
 *
 * Pattern: Stream.concat for catch-up → live sequencing
 *
 * @param discover - Discovery function to get servers
 * @param savedOffset - Optional offset to resume from
 * @returns Stream of WorldEvents
 *
 * @example
 * ```typescript
 * import { discoverServers } from "./discovery.js"
 *
 * const stream = resumeEventsDirect(discoverServers, savedOffset)
 * for await (const event of stream) {
 *   if (event.upToDate) {
 *     console.log("Caught up! Now live...")
 *   }
 *   console.log(event.type, event.offset)
 * }
 * ```
 */
export function resumeEventsDirect(
	discover: DiscoverServers,
	savedOffset?: EventOffset,
): Stream.Stream<WorldEvent, Error> {
	// Phase 1: Catch-up (bounded history)
	const catchUpStream = Stream.fromEffect(catchUpEventsDirect(discover, savedOffset)).pipe(
		Stream.flatMap((response) => Stream.fromIterable(response.events)),
	)

	// Phase 2: Live tail (unbounded polling)
	// Extract nextOffset from catch-up response to start tail
	const liveStream = Stream.fromEffect(catchUpEventsDirect(discover, savedOffset)).pipe(
		Stream.flatMap((response) => tailEventsDirect(discover, response.nextOffset || savedOffset)),
	)

	// Concatenate: catch-up first, then live
	return Stream.concat(catchUpStream, liveStream).pipe(
		// Track offsets using scan
		Stream.scan(
			{ lastOffset: savedOffset, event: null as WorldEvent | null } as {
				lastOffset: EventOffset | undefined
				event: WorldEvent | null
			},
			(state, event) => ({
				lastOffset: event.offset,
				event: event,
			}),
		),
		// Map back to just events (scan adds tracking state)
		Stream.map(({ event }) => event!),
		// Filter out null events from initial scan state
		Stream.filter((event): event is WorldEvent => event !== null),
	)
}
