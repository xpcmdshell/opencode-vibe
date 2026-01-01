# Swarm CLI Streaming Example

This example shows how to use the new CLI-compatible SSE streaming in swarm-cli.

## Quick Start

```typescript
// apps/swarm-cli/src/commands/watch.ts (example)
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

export async function watchCommand() {
  console.log("🐝 Swarm Watch - Monitoring OpenCode servers")
  console.log("Press Ctrl+C to stop\n")

  // Create stream with CLI discovery
  const stream = resumeEventsDirect(discoverServers)

  // Consume stream
  await Effect.runPromise(
    Stream.runForEach(stream, (event) =>
      Effect.sync(() => {
        // Format event for CLI output
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] ${event.type} (${event.offset})`)
        
        if (event.upToDate) {
          console.log("✅ Caught up! Now streaming live events...\n")
        }
      })
    )
  )
}
```

## Integration with Existing CLI

The `discovery.ts` file already exists with the required `discoverServers()` function:

```typescript
// apps/swarm-cli/src/discovery.ts (already exists)
export interface DiscoveredServer {
  port: number
  pid: number
  directory: string
}

export async function discoverServers(): Promise<DiscoveredServer[]> {
  // Uses lsof to find running OpenCode servers
  // Verifies with /project/current endpoint
  // Returns array of discovered servers
}
```

## Example: Watch Command

```typescript
import { Command } from "commander"
import { Effect, Stream } from "effect"
import { resumeEventsDirect, type WorldEvent } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

export function createWatchCommand() {
  return new Command("watch")
    .description("Watch OpenCode servers for real-time events")
    .option("-f, --filter <type>", "Filter by event type (e.g., session.*, worker.*)")
    .option("-j, --json", "Output events as JSON")
    .action(async (options) => {
      const stream = resumeEventsDirect(discoverServers)

      // Apply filter if specified
      const filteredStream = options.filter
        ? stream.pipe(
            Stream.filter((event) => event.type.startsWith(options.filter))
          )
        : stream

      // Format output
      await Effect.runPromise(
        Stream.runForEach(filteredStream, (event) =>
          Effect.sync(() => {
            if (options.json) {
              console.log(JSON.stringify(event))
            } else {
              formatEvent(event)
            }
          })
        )
      )
    })
}

function formatEvent(event: WorldEvent) {
  const colors = {
    "session.created": "\x1b[32m", // Green
    "session.updated": "\x1b[33m", // Yellow
    "worker.spawned": "\x1b[36m", // Cyan
    "worker.completed": "\x1b[32m", // Green
    "worker.failed": "\x1b[31m", // Red
  }

  const color = colors[event.type] || "\x1b[37m"
  const reset = "\x1b[0m"

  console.log(
    `${color}[${event.offset}] ${event.type}${reset}`,
    JSON.stringify(event.payload, null, 2)
  )
}
```

## Example: Status Command

```typescript
import { Command } from "commander"
import { Effect } from "effect"
import { catchUpEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

export function createStatusCommand() {
  return new Command("status")
    .description("Show current status of all OpenCode servers")
    .action(async () => {
      console.log("📊 Fetching status from OpenCode servers...\n")

      const response = await Effect.runPromise(
        catchUpEventsDirect(discoverServers)
      )

      console.log(`Total events: ${response.events.length}`)
      console.log(`Next offset: ${response.nextOffset}`)
      console.log(`Up to date: ${response.upToDate}\n`)

      // Group events by type
      const byType = response.events.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      console.log("Events by type:")
      for (const [type, count] of Object.entries(byType)) {
        console.log(`  ${type}: ${count}`)
      }
    })
}
```

## Example: Tail Command (Live Only)

```typescript
import { Command } from "commander"
import { Effect, Stream } from "effect"
import { tailEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

export function createTailCommand() {
  return new Command("tail")
    .description("Tail live events (no catch-up)")
    .option("-n, --limit <number>", "Exit after N events", parseInt)
    .action(async (options) => {
      console.log("📡 Tailing live events...\n")

      const stream = tailEventsDirect(discoverServers)

      // Limit if specified
      const limitedStream = options.limit
        ? stream.pipe(Stream.take(options.limit))
        : stream

      let count = 0
      await Effect.runPromise(
        Stream.runForEach(limitedStream, (event) =>
          Effect.sync(() => {
            count++
            console.log(`${count}. [${event.type}]`, event.payload)
          })
        )
      )

      console.log(`\n✅ Received ${count} events`)
    })
}
```

## Example: Export Command (Save to File)

```typescript
import { Command } from "commander"
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"
import { createWriteStream } from "fs"

export function createExportCommand() {
  return new Command("export")
    .description("Export events to JSONL file")
    .argument("<file>", "Output file path")
    .option("-d, --duration <seconds>", "Export duration in seconds", parseInt)
    .action(async (file, options) => {
      console.log(`📝 Exporting events to ${file}...\n`)

      const output = createWriteStream(file, { flags: "a" })
      const stream = resumeEventsDirect(discoverServers)

      // Limit by duration if specified
      const limitedStream = options.duration
        ? stream.pipe(
            Stream.timeout(Effect.sleep(`${options.duration} seconds`))
          )
        : stream

      let count = 0
      await Effect.runPromise(
        Stream.runForEach(limitedStream, (event) =>
          Effect.sync(() => {
            output.write(JSON.stringify(event) + "\n")
            count++
            if (count % 100 === 0) {
              console.log(`Exported ${count} events...`)
            }
          })
        ).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              output.close()
              console.log(`\n✅ Exported ${count} events to ${file}`)
            })
          )
        )
      )
    })
}
```

## Registering Commands

```typescript
// apps/swarm-cli/src/main.ts
import { Command } from "commander"
import { createWatchCommand } from "./commands/watch.js"
import { createStatusCommand } from "./commands/status.js"
import { createTailCommand } from "./commands/tail.js"
import { createExportCommand } from "./commands/export.js"

const program = new Command()
  .name("swarm")
  .description("OpenCode Swarm CLI")
  .version("1.0.0")

// Add streaming commands
program.addCommand(createWatchCommand())
program.addCommand(createStatusCommand())
program.addCommand(createTailCommand())
program.addCommand(createExportCommand())

program.parse()
```

## Error Handling

```typescript
import { Effect, Stream } from "effect"
import { resumeEventsDirect } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

async function robustWatch() {
  const stream = resumeEventsDirect(discoverServers)

  await Effect.runPromise(
    Stream.runForEach(stream, (event) =>
      Effect.sync(() => console.log(event))
    ).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          console.error("Stream failed:", error)
          process.exit(1)
        })
      )
    )
  )
}
```

## Offset Persistence

```typescript
import { readFileSync, writeFileSync } from "fs"
import { Effect, Stream } from "effect"
import { resumeEventsDirect, type EventOffset } from "@opencode-vibe/core/world"
import { discoverServers } from "../discovery.js"

const OFFSET_FILE = ".swarm-offset"

async function resumableWatch() {
  // Load saved offset
  let savedOffset: EventOffset | undefined
  try {
    savedOffset = readFileSync(OFFSET_FILE, "utf-8") as EventOffset
    console.log(`Resuming from offset: ${savedOffset}`)
  } catch {
    console.log("Starting from beginning")
  }

  const stream = resumeEventsDirect(discoverServers, savedOffset)

  let eventCount = 0
  await Effect.runPromise(
    Stream.runForEach(stream, (event) =>
      Effect.sync(() => {
        console.log(event.type)
        
        // Save offset every 10 events
        eventCount++
        if (eventCount % 10 === 0) {
          writeFileSync(OFFSET_FILE, event.offset)
        }
      })
    )
  )
}
```

## Testing

```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { catchUpEventsDirect, type DiscoverServers } from "@opencode-vibe/core/world"

describe("Swarm CLI streaming", () => {
  it("should fetch events from discovered servers", async () => {
    const mockDiscover: DiscoverServers = async () => [
      { port: 4056, directory: "/test" }
    ]

    const response = await Effect.runPromise(
      catchUpEventsDirect(mockDiscover)
    )

    expect(response).toBeDefined()
    expect(response.upToDate).toBe(true)
  })
})
```

## See Also

- [Core Package Documentation](../../packages/core/src/world/DIRECT_STREAMING_USAGE.md)
- [Effect Streams Guide](https://effect.website/docs/guides/streaming/streams)
- [ADR-018: Reactive World Stream](../../docs/adr/018-reactive-world-stream.md)
