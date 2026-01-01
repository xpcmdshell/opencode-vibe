/**
 * Watch command - live event stream with cursor resumption
 *
 * Streams events in real-time with durable cursor persistence.
 * Resumes from saved offset on restart.
 * Graceful shutdown on SIGINT (Ctrl+C).
 *
 * Usage:
 *   swarm-cli watch                           # Watch from now
 *   swarm-cli watch --since 12345             # Resume from offset
 *   swarm-cli watch --cursor-file .cursor     # Persist cursor
 *   swarm-cli watch --json                    # NDJSON output
 */

import { Stream, Effect } from "effect"
import { resumeEventsDirect, type EventOffset, type WorldEvent } from "@opencode-vibe/core/world"
import type { CommandContext } from "./index.js"
import { write, writeError, loadCursor, saveCursor, withLinks, formatNextSteps } from "../output.js"
import { discoverServers } from "../discovery.js"
import { WorldStateAggregator, formatWorldState, type RawSSEEvent } from "../world-state.js"

interface WatchOptions {
	since?: string // Cursor offset to resume from
	cursorFile?: string // Persist cursor after each event
	world?: boolean // Show aggregated world state instead of raw events
}

/**
 * Parse command-line arguments into options
 */
function parseArgs(args: string[]): WatchOptions {
	const options: WatchOptions = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		switch (arg) {
			case "--since":
				options.since = args[++i]
				break
			case "--cursor-file":
				options.cursorFile = args[++i]
				break
			case "--world":
			case "-w":
				options.world = true
				break
			case "--help":
			case "-h":
				showHelp()
				process.exit(0)
		}
	}

	return options
}

/**
 * Show command help
 */
function showHelp(): void {
	console.log(`
╔═════════════════════════════════════════╗
║      👁️  WATCH - Live Stream 👁️          ║
╚═════════════════════════════════════════╝

Stream events in real-time with cursor persistence.

Usage:
  swarm-cli watch [options]

Options:
  --since <offset>       Resume from cursor offset
  --cursor-file <path>   Persist cursor after each event
  --world, -w            Show aggregated world state (refreshes on each event)
  --json                 NDJSON output (machine-readable)
  --help, -h             Show this message

Cursor Persistence:
  The cursor file is updated after EACH event.
  On restart, watch resumes from the last saved offset.
  This prevents missing events during disconnections.

SIGINT Handling:
  Press Ctrl+C to gracefully stop the stream.
  The cursor is saved before exit.

Examples:
  swarm-cli watch --cursor-file .cursor --json
  swarm-cli watch --since 12345
  swarm-cli watch                    # Watch from now

Output:
  Each event includes: type, offset, timestamp, upToDate, payload
  The upToDate field signals catch-up completion (false → true).
`)
}

/**
 * Run the watch command
 */
export async function run(context: CommandContext): Promise<void> {
	const { args, output } = context
	const options = parseArgs(args)

	// Cursor file can come from global options OR command options
	const cursorFile = output.cursorFile || options.cursorFile

	// Load cursor from file if specified
	let savedOffset: EventOffset | undefined
	if (cursorFile) {
		const loaded = await loadCursor(cursorFile)
		if (loaded) {
			savedOffset = loaded as EventOffset
			if (output.mode === "pretty") {
				console.log(`Resuming from offset: ${savedOffset}\n`)
			}
		}
	} else if (options.since) {
		savedOffset = options.since as EventOffset
	}

	// Setup graceful shutdown
	let running = true
	process.on("SIGINT", () => {
		running = false
		if (output.mode === "pretty") {
			console.log("\n\nGracefully shutting down...")
		}
		process.exit(0)
	})

	try {
		if (output.mode === "pretty") {
			if (options.world) {
				console.log("Watching world state... (Ctrl+C to stop)\n")
			} else {
				console.log("Watching for events... (Ctrl+C to stop)\n")
			}
		}

		// Stream events with resumption using direct server connections
		const stream = resumeEventsDirect(discoverServers, savedOffset)

		// Create aggregator for --world mode
		const aggregator = options.world ? new WorldStateAggregator() : null
		let lastWorldUpdate = 0
		const WORLD_UPDATE_INTERVAL = 500 // Update world view at most every 500ms

		// Convert Effect Stream to runnable Effect and execute
		const program = Stream.runForEach(stream as any, (event: WorldEvent) =>
			Effect.promise(async () => {
				if (!running) return

				// World mode: aggregate events and show world state
				if (options.world && aggregator) {
					const rawEvent: RawSSEEvent = {
						type: event.type,
						offset: event.offset,
						timestamp: event.timestamp,
						upToDate: event.upToDate,
						payload: event.payload as Record<string, unknown>,
					}
					aggregator.processEvent(rawEvent)

					// Throttle world updates to avoid flickering
					const now = Date.now()
					if (now - lastWorldUpdate > WORLD_UPDATE_INTERVAL || event.upToDate) {
						lastWorldUpdate = now
						const world = aggregator.getSnapshot()

						if (output.mode === "json") {
							const worldWithLinks = withLinks(
								{
									...world,
									projects: world.projects.map((p) => ({
										directory: p.directory,
										sessionCount: p.sessions.length,
										activeCount: p.activeCount,
										totalMessages: p.totalMessages,
									})),
								},
								{
									resume: `swarm-cli watch --world --since ${event.offset}`,
									rawEvents: `swarm-cli watch --since ${event.offset}`,
									status: "swarm-cli status",
								},
							)
							write(output, worldWithLinks)
						} else {
							// Clear screen and redraw world state
							console.clear()
							console.log(formatWorldState(world))
							console.log("\nWatching for changes... (Ctrl+C to stop)")
						}
					}
				} else {
					// Raw event mode
					if (output.mode === "json") {
						const eventWithLinks = withLinks(event as Record<string, unknown>, {
							resume: `swarm-cli watch --since ${event.offset}`,
							persist: `swarm-cli watch --cursor-file .cursor`,
							query: `swarm-cli query --type ${event.type}`,
						})
						write(output, eventWithLinks)
					} else {
						write(output, event)
					}

					// Pretty mode: show upToDate transition with next steps
					if (output.mode === "pretty" && event.upToDate) {
						console.log("\n✓ Caught up! Now streaming live events...\n")
						console.log(
							formatNextSteps([
								"💾 Persist cursor: swarm-cli watch --cursor-file .cursor",
								"🌍 World view: swarm-cli watch --world",
								"📊 Status: swarm-cli status",
							]),
						)
					}
				}

				// Persist cursor if configured
				if (cursorFile) {
					try {
						await saveCursor(cursorFile, event.offset)
					} catch (err) {
						console.error(`[cursor] Failed to save: ${err}`)
					}
				}
			}),
		)

		await Effect.runPromise(program as any)
	} catch (error) {
		const errorDetails = {
			error: error instanceof Error ? error.message : String(error),
			...(output.mode === "json" && {
				_links: {
					retry: "swarm-cli watch --since 0",
					status: "swarm-cli status",
					help: "swarm-cli watch --help",
				},
			}),
		}
		writeError("Stream failed", errorDetails)

		if (output.mode === "pretty") {
			console.error(
				formatNextSteps([
					"🔄 Retry: swarm-cli watch --since 0",
					"📡 Check status: swarm-cli status",
					"❓ Get help: swarm-cli watch --help",
				]),
			)
		}
		process.exit(1)
	}
}

export const description = "Watch live event stream with cursor resumption"
