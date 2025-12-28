# Multi-Server SSE Architecture

```
    🔍   ZERO CONFIG DISCOVERY   🔍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  lsof → verify → connect → merge
```

## The Big Idea

**Problem:** You have multiple OpenCode processes running on your machine:

- TUI sessions (`opencode tui` in different project dirs)
- Serve processes (`opencode serve` for web UI)
- Maybe some orphaned processes you forgot about

**Traditional approach:** Configure which servers to connect to, maintain URLs, handle stale config.

**Our approach:** Fuck configuration. Discover everything automatically using OS primitives.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     REACT COMPONENT                         │
│                  useMultiServerSSE()                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ starts/subscribes
                  ▼
┌─────────────────────────────────────────────────────────────┐
│               MultiServerSSE Manager                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Discovery Loop (every 5s)                            │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  1. GET /api/opencode-servers                │    │  │
│  │  │  2. Compare with active connections          │    │  │
│  │  │  3. Remove dead servers                      │    │  │
│  │  │  4. Connect to new servers                   │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Active Connections Map:                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ port 4096 → SSE stream → parse → emit status       │   │
│  │ port 5123 → SSE stream → parse → emit status       │   │
│  │ port 6421 → SSE stream → parse → emit status       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Callbacks: [fn1, fn2, ...] ← store.handleEvent            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTP GET every 5s
                  ▼
┌─────────────────────────────────────────────────────────────┐
│           Next.js API Route                                 │
│         /api/opencode-servers                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  lsof -iTCP -sTCP:LISTEN | grep 'bun|opencode'       │  │
│  │         ↓                                             │  │
│  │  Parse PIDs + Ports                                   │  │
│  │         ↓                                             │  │
│  │  For each port:                                       │  │
│  │    fetch(http://127.0.0.1:{port}/project, timeout=500)│  │
│  │         ↓                                             │  │
│  │  Return verified servers: [{port, pid}, ...]         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ lsof scans
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    OS PROCESS TABLE                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ PID 12345  bun run serve        127.0.0.1:4096      │   │
│  │ PID 67890  opencode tui         127.0.0.1:5123      │   │
│  │ PID 11223  opencode tui         127.0.0.1:6421      │   │
│  │ PID 44556  node webpack-dev     127.0.0.1:3000      │   │
│  │                                  ▲ (rejected)        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## The Discovery Flow

### Step 1: lsof Scan

```bash
lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E 'bun|opencode'
```

**What this does:**

- `-iTCP -sTCP:LISTEN` - Only TCP ports in LISTEN state
- `-P -n` - Show ports as numbers, no DNS lookups (fast)
- `grep 'bun|opencode'` - Only processes with "bun" or "opencode" in command

**Output example:**

```
bun     12345 joel   20u  IPv4 0x1234  0t0  TCP 127.0.0.1:4096 (LISTEN)
opencode 67890 joel  19u  IPv4 0x5678  0t0  TCP 127.0.0.1:5123 (LISTEN)
```

### Step 2: Verify with /project Endpoint

Can't trust grep alone - maybe it's a bun process that's not OpenCode.

```typescript
async function verifyOpencodeServer(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/project`, {
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

**The /project endpoint** is OpenCode-specific. If it responds 200, it's legit.

**Why timeout 500ms?** Dead processes can leave sockets hanging. We don't wait forever.

### Step 3: Return Verified Servers

```json
[
  { "port": 4096, "pid": 12345 },
  { "port": 5123, "pid": 67890 }
]
```

## SSE Connection Management

Once discovered, `MultiServerSSE` connects to each server:

```
For each port:
  ┌─────────────────────────────────────────┐
  │  fetch(http://127.0.0.1:{port}/global/event)
  │                                         │
  │  ┌───────────────────────────────────┐  │
  │  │  SSE Stream (never closes)        │  │
  │  │  ───────────────────────────────  │  │
  │  │  data: {"directory": "/foo", ...} │  │
  │  │  data: {"directory": "/bar", ...} │  │
  │  │  ...                              │  │
  │  └───────────────────────────────────┘  │
  │           ▼                             │
  │  EventSourceParserStream                │
  │           ▼                             │
  │  JSON.parse(event.data)                 │
  │           ▼                             │
  │  Filter session.status events           │
  │           ▼                             │
  │  emit({ directory, sessionID, status }) │
  └─────────────────────────────────────────┘
```

### Auto-Reconnect on Disconnect

```typescript
while (!aborted && this.started) {
  try {
    // Connect and read stream
    const response = await fetch(...)
    const reader = stream.getReader()
    while (!aborted) {
      const { done, value } = await reader.read()
      // ...
    }
  } catch (e) {
    if (aborted) break
    console.error(`Connection to port ${port} failed:`, e)
    await new Promise(r => setTimeout(r, 2000)) // Wait 2s, retry
  }
}
```

**Infinite loop until:**

- Connection is aborted (server removed)
- `multiServerSSE.stop()` is called

### Cleanup on Server Death

Every 5 seconds, discovery runs again:

```typescript
const servers = await fetch("/api/opencode-servers").json();
const activePorts = new Set(servers.map((s) => s.port));

// Remove connections to dead servers
for (const [port, controller] of this.connections) {
  if (!activePorts.has(port)) {
    console.log(`Server on port ${port} is gone, disconnecting`);
    controller.abort();
    this.connections.delete(port);
  }
}
```

**What this means:**

- Kill a TUI process → within 5s, connection is cleaned up
- Start a new serve → within 5s, connection is established

## Event Aggregation

Multiple servers, one unified stream:

```
┌──────────────────────────────────────────────────────────────┐
│  Server on port 4096 (project: /Users/joel/Code/foo)        │
│    emits: session.status for session abc123 → "running"     │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
         ┌─────────────────┐
         │ MultiServerSSE  │
         │  Aggregator     │
         └────────┬────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Server on port 5123 (project: /Users/joel/Code/bar)        │
│    emits: session.status for session def456 → "complete"    │
└──────────────────────────────────────────────────────────────┘

                 │
                 ▼
         Zustand Store
   ┌──────────────────────────┐
   │ directories: {           │
   │   "/Users/joel/Code/foo": { sessions: {...} } │
   │   "/Users/joel/Code/bar": { sessions: {...} } │
   │ }                        │
   └──────────────────────────┘
```

**Key insight:** Each event has a `directory` field. That's how we route updates to the right project state.

## The `useMultiServerSSE` Hook

Dead simple integration:

```tsx
import { useMultiServerSSE } from "@/react/use-multi-server-sse";

function ProjectsList() {
  useMultiServerSSE(); // That's it.

  // Store is automatically updated with session statuses from ALL servers
  const projects = useOpencodeStore((s) => s.directories);

  return (
    <div>
      {Object.entries(projects).map(([dir, state]) => (
        <ProjectCard key={dir} directory={dir} state={state} />
      ))}
    </div>
  );
}
```

**Lifecycle:**

1. **On mount:** `multiServerSSE.start()` begins discovery loop
2. **Subscribe:** Hook registers callback with manager
3. **On status update:** `store.handleEvent(directory, event)` updates Zustand
4. **On unmount:** Unsubscribe + `multiServerSSE.stop()`

## Why This Approach

### Local-First, Zero Config

No `.env` files, no hardcoded URLs, no stale configuration.

**Traditional approach:**

```env
# .env.local
OPENCODE_SERVERS=http://localhost:4096,http://localhost:5123
```

**Problems:**

- Port changes? Update config.
- Kill a server? Remove from config or get errors.
- New server? Add to config.
- Share config with team? Everyone has different ports.

**Our approach:**

```
# Nothing. Just works.
```

### Discovers Everything

**Scenario:** You ran `opencode tui` in 3 different project directories yesterday. Forgot about them. They're still running.

**Traditional approach:** You'd never know. Orphaned processes just sit there.

**Our approach:** Web UI shows all 3 projects. Click on any session and see the full history.

### Survives Process Churn

**Scenario:** TUI crashes, you restart it, port changes from 4096 → 4097.

**Traditional approach:**

- Web UI still connected to 4096 (dead port)
- Manual refresh required
- Or: complex health check + reconnect logic per URL

**Our approach:**

- Discovery loop runs every 5s
- Sees new port 4097, connects
- Sees old port 4096 gone, disconnects
- Web UI updates automatically

### Tailscale-Ready

This architecture assumes **network-level auth via Tailscale**.

No app-level OAuth, no JWT, no user sessions. If you can reach `127.0.0.1`, you're local. If you can reach the Tailscale IP, you're authorized.

The discovery API route runs on the Next.js server (also local), so it can exec `lsof` and see all processes.

## Troubleshooting

### "No servers discovered"

**Check 1:** Is anything actually running?

```bash
lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | grep -E 'bun|opencode'
```

Should show at least one process.

**Check 2:** Does `/project` endpoint work?

```bash
curl http://127.0.0.1:4096/project
```

Should return 200 with project info.

**Check 3:** Can the API route run `lsof`?

```bash
# In your Next.js dev server logs:
curl http://localhost:3000/api/opencode-servers
```

Should return JSON array of servers.

### "Connection keeps dropping"

**Symptom:** Logs show repeated disconnects/reconnects.

**Possible causes:**

1. **Server is actually crashing** - check OpenCode server logs
2. **Network proxy interfering** - SSE doesn't play nice with some proxies
3. **Browser timeout** - some browsers kill long-lived connections (Safari WebKit 60s timeout)

**Workaround for #3:** OpenCode servers send heartbeat events every 30s to keep connection alive.

### "Old server won't disconnect"

**Symptom:** Killed an OpenCode process, but web UI still shows it.

**Check:** Is the process actually dead?

```bash
ps aux | grep opencode
kill -9 <PID>
```

**Wait 5 seconds** for next discovery cycle.

If still stuck, check browser console for errors. Connection might be in a retry loop.

### "Events from one server clobber another"

**Symptom:** Session from project A shows status from project B.

**This should be impossible** because events have `directory` field. If you're seeing this:

1. Check that `event.directory` is unique per project
2. Check that store is keying by directory correctly
3. File a bug - this is a critical isolation failure

### "Discovery is slow"

**By design.** Discovery runs every 5 seconds to avoid hammering the OS.

If you need faster discovery (e.g., for tests), pass a custom interval:

```typescript
const manager = new MultiServerSSE(1000); // 1 second
```

**Trade-off:** More frequent `lsof` calls = more CPU usage.

## Implementation Details

### Why EventSourceParserStream?

Native `EventSource` API doesn't work for dynamic URLs (we discover ports at runtime).

We use `fetch()` with `Accept: text/event-stream` and parse manually with `EventSourceParserStream` from `eventsource-parser/stream`.

**Benefits:**

- Full control over reconnection logic
- Can abort connections with `AbortController`
- Works with dynamic URLs

### Why /global/event?

OpenCode has two event namespaces:

- `/global/event` - All events for all projects on this server
- `/<directory>/event` - Events for one specific project

We use `/global/event` because:

1. One connection per server (not one per project)
2. Server handles routing events by directory
3. Less connection overhead

### Why port + PID?

PID is logged for debugging. If discovery shows port 4096 but connection fails, you can:

```bash
ps aux | grep 12345  # Check if process is alive
lsof -p 12345        # See what ports it's actually using
```

### Why 127.0.0.1 not localhost?

Avoid DNS lookup overhead. `127.0.0.1` is guaranteed loopback on all systems.

## Data Flow Example

**Scenario:** User runs `opencode tui` in `/Users/joel/Code/myproject`, types a message, AI responds.

```
1. TUI starts, listens on port 4096
   ─────────────────────────────────────────────
2. Next.js web UI polls /api/opencode-servers
   GET /api/opencode-servers
   → lsof finds PID 12345, port 4096
   → verifies http://127.0.0.1:4096/project (200 OK)
   → returns [{ port: 4096, pid: 12345 }]
   ─────────────────────────────────────────────
3. MultiServerSSE connects to port 4096
   fetch("http://127.0.0.1:4096/global/event")
   ─────────────────────────────────────────────
4. User sends message in TUI
   TUI server emits:
   data: {
     "directory": "/Users/joel/Code/myproject",
     "payload": {
       "type": "session.status",
       "properties": {
         "sessionID": "abc123",
         "status": { "type": "running" }
       }
     }
   }
   ─────────────────────────────────────────────
5. MultiServerSSE receives event
   EventSourceParserStream parses SSE
   JSON.parse(event.data)
   handleEvent() filters for session.status
   emit({ directory, sessionID, status })
   ─────────────────────────────────────────────
6. useMultiServerSSE callback fires
   store.initDirectory("/Users/joel/Code/myproject")
   store.handleEvent(directory, {
     type: "session.status",
     properties: { sessionID: "abc123", status: { type: "running" } }
   })
   ─────────────────────────────────────────────
7. Zustand store updates
   directories["/Users/joel/Code/myproject"].sessions["abc123"].status = "running"
   ─────────────────────────────────────────────
8. React component re-renders
   <SessionStatus sessionID="abc123" status="running" />
```

**Total latency:** <50ms from server emit to UI update.

## ASCII Art Gallery

Because why not.

```
    🌐
   ╱│╲
  ╱ │ ╲
 🖥  🖥  🖥
TUI TUI Serve

All discovered, all connected, all in sync.
```

```
┌─────────────────────────────────────────────┐
│  "It just works"                            │
│   - Todd Howard                             │
│   - Also this SSE architecture              │
└─────────────────────────────────────────────┘
```

```
      lsof
       │
       ▼
    ┌─────┐
    │ 🔍  │ verify
    └──┬──┘
       │
       ▼
    ┌─────┐
    │ 🔌  │ connect
    └──┬──┘
       │
       ▼
    ┌─────┐
    │ 🔄  │ merge
    └─────┘
       │
       ▼
     Store
```

---

**Built with chaos, documented with care.**

_For questions, complaints, or ASCII art submissions, see: Joel_
