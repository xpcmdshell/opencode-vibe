---
"@opencode-vibe/core": minor
"@opencode-vibe/react": minor
---

feat: ADR-016 Core Layer Responsibility Model - Smart Boundaries

```
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║   ┌─────────────────────────────────────────────────────┐    ║
    ║   │  BEFORE: React does everything                      │    ║
    ║   │  ┌───────────────────────────────────────────────┐  │    ║
    ║   │  │  REACT (bloated 840 LOC business logic)       │  │    ║
    ║   │  │  • Status computation                         │  │    ║
    ║   │  │  • Data joining                               │  │    ║
    ║   │  │  • Token formatting                           │  │    ║
    ║   │  │  • SSE normalization                          │  │    ║
    ║   │  └───────────────────────────────────────────────┘  │    ║
    ║   │                      ▼                              │    ║
    ║   │  ┌───────────────────────────────────────────────┐  │    ║
    ║   │  │  CORE (thin wrapper + 4,377 LOC dead router)  │  │    ║
    ║   │  └───────────────────────────────────────────────┘  │    ║
    ║   └─────────────────────────────────────────────────────┘    ║
    ║                                                              ║
    ║                          ⬇️  ⬇️  ⬇️                           ║
    ║                                                              ║
    ║   ┌─────────────────────────────────────────────────────┐    ║
    ║   │  AFTER: Smart Boundaries                            │    ║
    ║   │  ┌───────────────────────────────────────────────┐  │    ║
    ║   │  │  REACT (lean - UI binding only)               │  │    ║
    ║   │  │  • Hooks call Core APIs                       │  │    ║
    ║   │  │  • Never imports Effect                       │  │    ║
    ║   │  └───────────────────────────────────────────────┘  │    ║
    ║   │                      ▼                              │    ║
    ║   │  ┌───────────────────────────────────────────────┐  │    ║
    ║   │  │  CORE (smart boundary)                        │  │    ║
    ║   │  │  • StatusService     • ContextService         │  │    ║
    ║   │  │  • MessageService    • Format utils           │  │    ║
    ║   │  │  • SSE normalization • Promise APIs           │  │    ║
    ║   │  └───────────────────────────────────────────────┘  │    ║
    ║   └─────────────────────────────────────────────────────┘    ║
    ║                                                              ║
    ║   📉 -4,377 LOC (dead router deleted)                        ║
    ║   📉 -840 LOC moved from React to Core                       ║
    ║   ✅ Effect isolated - React never imports Effect            ║
    ║   ✅ Reusable - CLI/TUI can use Core APIs                    ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
```

> "These responsibilities should tell a story of the high-level purpose
> and design of your system. Refactor the model so that the responsibilities
> of each domain object fit neatly within stated responsibility."
> — Eric Evans, Domain-Driven Design

## What Changed

### Core Layer (`@opencode-vibe/core`)

**New Effect Services:**
- `StatusService` - Session status computation (3-source logic)
- `MessageService` - Messages + Parts join (eliminates client-side joins)
- `ContextService` - Token usage computation

**New APIs:**
- `sessions.getStatus()` - Computed session status
- `sessions.listWithStatus()` - Sessions with status pre-joined
- `messages.listWithParts()` - Messages with parts pre-joined
- `prompt.convertToApiParts()` - Prompt transformation

**New Utils:**
- `formatRelativeTime()` - "5m ago" formatting (SSR-safe)
- `formatTokens()` - "1.5K" token formatting
- `normalizeStatus()` - SSE status normalization

**Deleted:**
- `packages/core/src/router/` - 4,377 LOC of dead code (0 invocations)

### React Layer (`@opencode-vibe/react`)

**Simplified Hooks:**
- `useSessionStatus` - Now uses Core's StatusService
- `useMessagesWithParts` - Reads from SSE-populated store
- `useContextUsage` - Reads from SSE-populated store
- `useSendMessage` - Uses Core's prompt.convertToApiParts

**Effect Isolation:**
- React NEVER imports Effect types
- All Effect programs wrapped with `runWithRuntime()`
- Promise-based APIs at the boundary

## Migration

No breaking changes. Existing code continues to work.

Internal refactor moves computation from React to Core for:
- Better reusability (CLI, TUI, mobile can use Core)
- Better testability (pure Effect programs)
- Better performance (pre-computed data)
