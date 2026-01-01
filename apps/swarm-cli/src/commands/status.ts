/**
 * Status command - world state snapshot
 *
 * Shows current swarm status with aggregated world state.
 * Catches up on all events to build a complete picture.
 */

import { Effect } from "effect"
import { catchUpEventsDirect } from "@opencode-vibe/core/world"
import type { CommandContext } from "./index.js"
import { write, withLinks } from "../output.js"
import { discoverServers } from "../discovery.js"
import { WorldStateAggregator, formatWorldState, type RawSSEEvent } from "../world-state.js"

export async function run(context: CommandContext): Promise<void> {
	const { output } = context

	// Discover servers
	const servers = await discoverServers()

	if (servers.length === 0) {
		if (output.mode === "json") {
			const data = withLinks(
				{ servers: 0, discovered: [], world: null },
				{
					start: "cd ~/project && opencode",
					retry: "swarm-cli status",
				},
			)
			write(output, data)
		} else {
			console.log("✗ No OpenCode servers found")
			console.log("\nTo connect to a server:")
			console.log("  1. Start OpenCode:  cd ~/project && opencode")
			console.log("  2. Then run:        swarm-cli status")
			console.log("\nTIP: OpenCode must be running in a project directory")
		}
		return
	}

	// Build world state from events
	const aggregator = new WorldStateAggregator()

	if (output.mode === "pretty") {
		console.log(`🔍 Discovering world state from ${servers.length} server(s)...\n`)
	}

	try {
		// Catch up on all events from all servers
		// catchUpEventsDirect returns Effect<CatchUpResponse, Error>
		const response = await Effect.runPromise(catchUpEventsDirect(discoverServers))

		// Process all events from catch-up response
		for (const event of response.events) {
			const rawEvent: RawSSEEvent = {
				type: event.type,
				offset: event.offset,
				timestamp: event.timestamp,
				upToDate: event.upToDate,
				payload: event.payload as Record<string, unknown>,
			}
			aggregator.processEvent(rawEvent)
		}
	} catch (error) {
		// Catch-up might fail if servers are busy, but we can still show what we have
		if (output.mode === "pretty") {
			console.log(
				`⚠️  Some events may be missing: ${error instanceof Error ? error.message : "unknown error"}\n`,
			)
		}
	}

	// Get world state snapshot
	const world = aggregator.getSnapshot()

	if (output.mode === "json") {
		const data = withLinks(
			{
				servers: servers.length,
				discovered: servers.map((s) => ({
					port: s.port,
					pid: s.pid,
					directory: s.directory,
				})),
				world: {
					projects: world.projects.map((p) => ({
						directory: p.directory,
						sessionCount: p.sessions.length,
						activeCount: p.activeCount,
						totalMessages: p.totalMessages,
						sessions: p.sessions.slice(0, 5).map((s) => ({
							id: s.id,
							status: s.status,
							messageCount: s.messageCount,
							isStreaming: s.isStreaming,
						})),
					})),
					totalSessions: world.totalSessions,
					activeSessions: world.activeSessions,
					streamingSessions: world.streamingSessions,
					lastEventOffset: world.lastEventOffset,
				},
			},
			{
				watch: "swarm-cli watch",
				watchLive: "swarm-cli watch --cursor-file .cursor",
				filter: "swarm-cli status --project <path>",
			},
		)
		write(output, data)
	} else {
		// Pretty output with world state visualization
		console.log(formatWorldState(world))
		console.log("")
		console.log("Next steps:")
		console.log("  swarm-cli watch                    # Stream live events")
		console.log("  swarm-cli watch --cursor-file .cur # Persist cursor for resumption")
		console.log("  swarm-cli status --json            # Machine-readable output")
	}
}

export const description = "Show world state snapshot from all servers"
