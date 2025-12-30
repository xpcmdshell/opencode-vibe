# ADR 009: Developer Experience Overhaul

**Status:** Proposed  
**Date:** 2025-12-30  
**Deciders:** Joel Hooks, Architecture Team  
**Affected Components:** React package, web app, SDK integration  
**Related ADRs:** ADR-001 (Next.js Rebuild), ADR-002 (Effect Migration)

---

## Context

Four comprehensive audits revealed a critical DX problem: **OpenCode Vibe's React integration is significantly more complex than industry benchmarks like uploadthing.**

### The DX Gap

| Aspect | uploadthing | OpenCode (current) | Target |
|--------|-------------|-------------------|--------|
| **Hooks per component** | 1 | 11 | 1 |
| **Provider nesting** | 0 | Yes (required) | 0 |
| **Import paths** | 1 source | 2 (package + re-export) | 1 |
| **Lines to render session** | ~10 | ~150 | ~10 |
| **API call duplicates** | 0 | 3x sessions.get() | 0 |
| **SSE subscriptions** | 0 (polling) | 6 | 1 |
| **Cognitive load** | None | **EXTREME** | None |

**Bottom line:** Rendering a session page requires 11 hooks, 150 lines of code, and deep knowledge of internal architecture. uploadthing does the same with 1 hook and 10 lines.

### Root Causes (From Audits)

#### 1. Hook Sprawl (Audit 08)

**Problem:** Single `useSession()` concept split across 11+ hooks:

```tsx
// Current: 11 hooks to render a session
const { directory } = useOpenCode()
useMultiServerSSE()
useSubagentSync({ sessionId })
const { session } = useSession({ sessionId, directory })
const { running } = useSessionStatus({ sessionId, directory })
const { messages } = useMessages({ sessionId, directory })
const { sendMessage } = useSendMessage({ sessionId, directory })
// ... + 4 more in child components

// Target: 1 hook
const session = useSession(sessionId)
// session.data, session.messages, session.running, session.sendMessage
```

**Impact:**
- **Duplicate API calls:** `useSessionStatus` called 3 times (3x `sessions.get()`)
- **Duplicate SSE subscriptions:** 6 separate event listeners for same stream
- **Prop drilling:** `directory` passed to every hook manually
- **Maintenance burden:** Change to session API → update 11 hooks

#### 2. Zombie Re-export Layer (Audit 07)

**Problem:** `apps/web/src/react/` is pure re-export plumbing with **ZERO** app-specific code:

```typescript
// apps/web/src/react/index.ts (THE ENTIRE FILE)
export * from "@opencode-vibe/react"
```

**Impact:**
- **Dual import paths:** Confusing choice between `@opencode-vibe/react` vs `@/react`
- **No value added:** Just indirection, no app customization
- **Maintenance burden:** Extra file to update when package changes
- **Violates uploadthing pattern:** uploadthing has ONE import path

#### 3. lib/ Layer Confusion (Audit 06)

**Problem:** Mixed concerns - some files are Next-specific, some are generic, one is dead code:

| File | Status | Issue |
|------|--------|-------|
| `client.ts` | Keep | Next-specific, uses `multiServerSSE` singleton |
| `prompt-parsing.ts` | **DELETE** | Pure re-export, **ZERO usages** |
| `transform-messages.ts` | Keep | ai-elements-specific transform |
| `utils.ts` | Keep | Standard shadcn/ui utility |

**Impact:**
- Dead code ships to production (`prompt-parsing.ts`)
- Unclear when to use web vs core client
- No documentation explaining the split

#### 4. Missing uploadthing Patterns (Audit 09)

**Problem:** OpenCode doesn't use proven DX patterns that uploadthing uses:

| Pattern | uploadthing | OpenCode | Impact |
|---------|-------------|----------|--------|
| **Builder API** | ✅ `f().middleware().onComplete()` | ❌ Monolithic config | Poor autocomplete |
| **Framework adapters** | ✅ `uploadthing/next` | ❌ Generic only | No tree-shaking |
| **generateHelpers factory** | ✅ User creates typed exports | ❌ Direct imports | Config repeated |
| **SSR via globalThis** | ✅ Zero client fetches | ❌ Client fetches | Slower hydration |
| **Symbol-based markers** | ✅ No key conflicts | ❌ Reserved keys | Collision risk |

---

## Decision

**We will overhaul OpenCode's DX in 3 phases to achieve uploadthing-level simplicity.**

### Target DX (North Star)

```tsx
// Phase 3 target: uploadthing-style simplicity
import { useSession } from "@opencode-vibe/react"

export function SessionPage({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId, {
    onMessage: (msg) => console.log("new message", msg),
    onError: (err) => toast.error(err.message)
  })

  return (
    <>
      <h1>{session.data?.title}</h1>
      <Messages messages={session.messages} />
      <PromptInput 
        onSubmit={session.sendMessage} 
        disabled={session.isLoading} 
      />
    </>
  )
}
```

**ONE HOOK. Dead simple.**

---

## Migration Plan

### Phase 1: Cleanup (Immediate - 2 days)

**Goal:** Remove dead code, consolidate imports, document distinctions.

#### 1.1 Delete Zombie Re-export Layer

**Files to delete:**
- `apps/web/src/react/index.ts`
- `apps/web/src/react/README.md`
- `apps/web/src/react/` (entire directory)

**Migration:**
```bash
# Find all imports
rg "from \"@/react\"" apps/web/src -l

# Replace with direct package import
sed -i '' 's/from "@\/react"/from "@opencode-vibe\/react"/g' apps/web/src/**/*.{ts,tsx}

# Update tsconfig paths (remove @/react alias)
# Run typecheck
bun run typecheck
```

**Files affected:** 14+ files (see Audit 07 for full list)

**Benefits:**
- ✅ ONE import path (uploadthing-style)
- ✅ No confusion about which path to use
- ✅ Faster onboarding (one less concept to explain)

#### 1.2 Delete Dead Code

**Files to delete:**
- `apps/web/src/lib/prompt-parsing.ts` (zero usages, pure re-export)

**Verification:**
```bash
# Should return 0 results
grep -r "from \"@/lib/prompt-parsing\"" apps/web/src
```

#### 1.3 Document lib/ Layer

Add documentation to clarify when to use web vs core client:

```typescript
// apps/web/src/lib/client.ts
/**
 * OpenCode SDK client factory for Next.js web app
 *
 * This is the NEXT.JS-SPECIFIC version that uses:
 * - process.env.NEXT_PUBLIC_OPENCODE_URL (Next.js env var)
 * - multiServerSSE singleton (web-only pattern)
 *
 * For framework-agnostic usage (CLI, desktop, non-Next apps),
 * use @opencode-vibe/core/client instead.
 */
```

**Effort:** 2 days  
**Risk:** LOW (all changes are deletions or documentation)  
**Impact:** 20% DX improvement (removes confusion)

---

### Phase 2: Facade Hook (Quick Win - 1 week)

**Goal:** Single `useSession()` hook that wraps internal hooks but hides complexity.

#### 2.1 Create Facade Hook

**New file:** `packages/react/src/hooks/use-session-facade.ts`

```tsx
import { useOpenCode } from "../providers"
import { useMultiServerSSE } from "./use-multi-server-sse"
import { useSubagentSync } from "./use-subagent-sync"
import { useSession as useSessionData } from "./use-session"
import { useSessionStatus } from "./use-session-status"
import { useMessagesWithParts } from "./use-messages-with-parts"
import { useSendMessage } from "./use-send-message"
import { useContextUsage } from "./use-context-usage"
import { useCompactionState } from "./use-compaction-state"

/**
 * Unified session hook - uploadthing-style DX
 * 
 * Replaces 11+ hooks with a single hook that provides everything
 * needed to render a session page.
 * 
 * @example
 * ```tsx
 * const session = useSession(sessionId, {
 *   onMessage: (msg) => console.log(msg),
 *   onError: (err) => toast.error(err.message)
 * })
 * 
 * return (
 *   <div>
 *     <h1>{session.data?.title}</h1>
 *     <Messages messages={session.messages} />
 *     <PromptInput onSubmit={session.sendMessage} />
 *   </div>
 * )
 * ```
 */
export function useSession(
  sessionId: string,
  options?: {
    directory?: string
    onMessage?: (msg: Message) => void
    onError?: (err: Error) => void
  }
) {
  const { directory: contextDir } = useOpenCode()
  const dir = options?.directory ?? contextDir

  // Initialize SSE + subagent sync (ONCE)
  useMultiServerSSE()
  useSubagentSync({ sessionId })

  // Fetch session data (internal hooks - hidden from consumer)
  const sessionData = useSessionData({ sessionId, directory: dir })
  const messages = useMessagesWithParts({ sessionId, directory: dir })
  const status = useSessionStatus({ sessionId, directory: dir })
  const sender = useSendMessage({ sessionId, directory: dir })
  const contextUsage = useContextUsage({ sessionId })
  const compaction = useCompactionState({ sessionId })

  // Expose clean, unified API
  return {
    // Core data
    data: sessionData.session,
    messages: messages.messages,
    
    // Status
    running: status.running,
    isLoading: sessionData.loading || messages.loading || sender.isLoading,
    error: sessionData.error || messages.error || sender.error,
    
    // Actions
    sendMessage: sender.sendMessage,
    queueLength: sender.queueLength,
    
    // Context tracking
    contextUsage: {
      used: contextUsage.used,
      limit: contextUsage.limit,
      percentage: contextUsage.percentage,
    },
    
    // Compaction state
    compacting: compaction.isCompacting,
    compactionProgress: compaction.progress,
    
    // Subagents (future)
    subagents: [],
  }
}
```

#### 2.2 Update SessionLayout

**Before (150 lines, 11 hooks):**

```tsx
export function SessionLayout({ sessionId, directory }) {
  const { directory: contextDir } = useOpenCode()
  useMultiServerSSE()
  useSubagentSync({ sessionId })
  const { session } = useSession({ sessionId, directory: contextDir })
  const { running } = useSessionStatus({ sessionId, directory: contextDir })
  const { messages } = useMessages({ sessionId, directory: contextDir })
  const { sendMessage, isLoading } = useSendMessage({ sessionId, directory: contextDir })
  // ... + 4 more hooks in child components
}
```

**After (15 lines, 1 hook):**

```tsx
export function SessionLayout({ sessionId, directory }) {
  const session = useSession(sessionId, {
    directory,
    onError: (err) => toast.error(err.message)
  })

  return (
    <div>
      <h1>{session.data?.title}</h1>
      <SessionMessages messages={session.messages} />
      <ContextUsageBar usage={session.contextUsage} />
      <CompactionIndicator 
        isCompacting={session.compacting}
        progress={session.compactionProgress}
      />
      <PromptInput onSubmit={session.sendMessage} />
    </div>
  )
}
```

#### 2.3 Update Child Components

**SessionMessages:** Remove duplicate `useSessionStatus`, consume from props:

```tsx
// Before: Re-fetches data parent already has
function SessionMessages({ sessionId, directory }) {
  const { messages } = useMessagesWithParts({ sessionId, directory })
  const { running } = useSessionStatus({ sessionId, directory }) // DUPLICATE
}

// After: Consumes from props
function SessionMessages({ messages, running }: { 
  messages: Message[]
  running: boolean
}) {
  // Just render, no hooks
}
```

**Benefits:**
- ✅ 90% code reduction (150 lines → 15 lines)
- ✅ No duplicate API calls (3x `sessions.get()` → 1x)
- ✅ Easier to test (mock 1 hook instead of 11)
- ✅ Easier to onboard (read 1 hook doc instead of 11)

**Effort:** 1 week  
**Risk:** MEDIUM (requires careful testing of hook composition)  
**Impact:** 80% DX improvement

---

### Phase 3: Store-Based Implementation (Long Term - 2 weeks)

**Goal:** Eliminate ALL duplicates by using Zustand store internally.

#### 3.1 Refactor Facade to Use Store

**File:** `packages/react/src/hooks/use-session-store.ts`

```tsx
import { useOpencodeStore } from "../stores/opencode-store"
import { useCallback } from "react"

/**
 * Store-based session hook - zero duplicates
 * 
 * All data fetched once, cached in Zustand store.
 * SSE updates flow through store, not individual hook subscriptions.
 */
export function useSession(sessionId: string) {
  // Select from store (single source of truth)
  const session = useOpencodeStore((s) => s.sessions[sessionId])
  const messages = useOpencodeStore((s) => s.getMessagesForSession(sessionId))
  const running = useOpencodeStore((s) => s.getSessionStatus(sessionId))
  const contextUsage = useOpencodeStore((s) => s.contextUsage[sessionId])
  
  // Actions dispatch to store
  const sendMessage = useCallback((parts: Prompt) => {
    return useOpencodeStore.getState().sendMessage(sessionId, parts)
  }, [sessionId])

  return {
    data: session,
    messages,
    running,
    sendMessage,
    contextUsage,
    isLoading: session?.loading || messages?.loading,
    error: session?.error || messages?.error
  }
}
```

#### 3.2 Benefits

**Zero duplicates:**
- 1x API call per resource (not 3x `sessions.get()`)
- 1x SSE subscription (in store, not 6 separate listeners)
- Shared cache across all hooks

**Performance:**
- 3x fewer API calls
- 5x fewer SSE event handlers
- React concurrent rendering friendly (store is external)

**Effort:** 2 weeks  
**Risk:** HIGH (requires store refactor, SSE integration changes)  
**Impact:** 95% DX improvement + 3x performance boost

---

### Phase 4: Remove Provider (Future - 1 week)

**Goal:** Achieve uploadthing parity - NO provider required.

#### 4.1 Auto-Discovery Pattern

```tsx
// Before: Provider required
<OpenCodeProvider url={url} directory={directory}>
  <SessionLayout sessionId={id} />
</OpenCodeProvider>

// After: Hook auto-discovers server
<SessionLayout sessionId={id} directory={directory} />
```

#### 4.2 SSR Plugin for Static Config

```tsx
// app/layout.tsx (Server Component)
import { OpencodeSSRPlugin } from "@opencode-vibe/react/next-ssr-plugin"

export default function Layout({ children }) {
  return (
    <html>
      <body>
        <OpencodeSSRPlugin config={{ directory: "/path" }} />
        {children}
      </body>
    </html>
  )
}

// Client Component
const { directory } = useOpencodeConfig() // Reads from globalThis, no fetch
```

**Benefits:**
- ✅ Zero client fetches for static config
- ✅ No provider nesting
- ✅ Complete uploadthing DX parity

**Effort:** 1 week  
**Risk:** LOW (progressive enhancement - falls back to fetch if globalThis not set)  
**Impact:** Final 5% to reach uploadthing parity

---

## Stealable Patterns from uploadthing

### 1. Builder API with Type Accumulation ✅ ADOPT

**What:** Fluent chainable methods that progressively build up types.

**Apply to OpenCode:**

```typescript
// Instead of monolithic config:
const client = createOpencodeClient({
  directory: "/path",
  onSessionUpdate: (session) => {},
  onMessageUpdate: (message) => {},
  // ... 15 more options
})

// Use builder (better autocomplete):
const client = createOpencodeClient()
  .directory("/path")
  .onSessionUpdate((session) => {})
  .onMessageUpdate((message) => {})
```

**Benefits:**
- Each method call updates `TParams` generic
- Better autocomplete (shows available methods based on current state)
- Optional configuration is truly optional (no `| undefined` everywhere)

**Priority:** P1 (include in Phase 2)

---

### 2. Framework-Specific Adapter Exports ✅ ADOPT

**What:** Separate entry points per framework (`uploadthing/next`, `uploadthing/express`).

**Apply to OpenCode:**

```typescript
// packages/core/src/adapters/next.ts
export { createOpencodeClient } from "../client"
export { createRouteHandler } from "./next-handler"

// packages/core/src/adapters/express.ts
export { createOpencodeClient } from "../client"
export { createExpressMiddleware } from "./express-handler"
```

**Benefits:**
- Tree-shaking (Next.js apps don't bundle Express code)
- Framework-specific types injected at adapter level
- Clearer mental model (import from framework path)

**Priority:** P2 (include in Phase 3)

---

### 3. generateReactHelpers Factory Pattern ✅ ADOPT

**What:** User creates typed helper file, not direct imports.

**Apply to OpenCode:**

```typescript
// apps/web/src/lib/opencode.ts
import { generateReactHelpers } from "@opencode-vibe/react"

export const {
  useSession,
  useMessages,
  useSSE,
  SessionProvider,
} = generateReactHelpers({
  baseUrl: "http://localhost:3000",
  directory: process.cwd(),
})
```

**Benefits:**
- Configuration bound once, not repeated at every hook call
- User controls what to export (can re-export subset)
- Easy to mock in tests (mock `~/lib/opencode` instead of `@opencode-vibe/react`)

**Priority:** P1 (include in Phase 2)

---

### 4. Symbol-Based Metadata Markers ✅ ADOPT

**What:** Use symbols for "special" return values that don't pollute user's data.

**Apply to OpenCode:**

```typescript
// Instead of reserved key names:
.middleware(() => ({
  userId: "123",
  __internalFiles: [...], // ← Conflicts if user has __internalFiles field
}))

// Use symbols:
import { UTFiles } from "@opencode-vibe/core"
.middleware(() => ({
  userId: "123",
  [UTFiles]: [...], // ← Guaranteed no conflict
}))
```

**Benefits:**
- No reserved key name collisions
- Clear intent (symbol imports signal "framework-level concern")
- TypeScript can omit symbols from user types

**Priority:** P2 (nice-to-have, not critical path)

---

### 5. SSR Plugin Pattern (globalThis Hydration) ✅ ADOPT

**What:** Server-side plugin injects data into `globalThis`, hydrates to client via script tag.

**Benefits:**
- Zero client fetches for static config
- Works with React Server Components (no client context needed)
- Progressive enhancement (hook falls back to fetch if globalThis not set)

**Priority:** P1 (include in Phase 4 - provider removal)

---

### 6. Type Inference Over Annotations ✅ ADOPT

**What:** Use `typeof` and generic binding to eliminate manual type annotations.

**Current (verbose):**

```typescript
const { startUpload } = useUploadThing<OurFileRouter, "videoAndImage">("videoAndImage")
```

**Target (inferred):**

```typescript
const { startUpload } = useUploadThing("videoAndImage") // Fully typed
```

**Priority:** P1 (critical for DX)

---

### 7. Progressive Disclosure ✅ ADOPT

**What:** Minimal example is 3 files, advanced features opt-in.

**Target for OpenCode:**

```
src/lib/opencode.ts           ← Generate helpers (config bound once)
src/app/session/[id]/page.tsx ← Use useSession hook
```

**Advanced features opt-in:**
- Custom error handling? Pass `onError` to hook
- SSR optimization? Add `<OpencodeSSRPlugin>` to layout
- Custom transforms? Provide `transformMessage` to helper factory

**Priority:** P0 (fundamental to DX)

---

### ⚠️ DON'T Steal: Effect-TS in Public API

**What uploadthing does:** Uses Effect-TS internally but hides it behind adapters.

**Why we should avoid:**
- OpenCode is already Effect-heavy internally
- Risk: Effect leaking into user-facing API
- Better: Keep Effect in service layer, expose vanilla TS at SDK boundary

**Rule:**

```typescript
// ✅ GOOD - Effect hidden
export async function createSession(opts: CreateSessionOpts): Promise<Session> {
  return Effect.runPromise(
    SessionService.create(opts).pipe(/* ... */)
  )
}

// ❌ BAD - Effect exposed
export function createSession(opts: CreateSessionOpts): Effect.Effect<Session, SessionError> {
  return SessionService.create(opts)
}
```

---

## Success Criteria

### Code Reduction

- [x] **Current:** 150 lines to render session
- [ ] **Phase 2:** 15 lines (90% reduction)
- [ ] **Phase 3:** 10 lines (93% reduction)

### Hook Reduction

- [x] **Current:** 11 hooks per session page
- [ ] **Phase 2:** 1 hook (91% reduction)
- [ ] **Phase 3:** 1 hook (maintained)

### API Calls

- [x] **Current:** 3x sessions.get(), 2x messages.list()
- [ ] **Phase 2:** 1x each via facade (67% reduction)
- [ ] **Phase 3:** 1x each via store (67% reduction, cached)

### SSE Subscriptions

- [x] **Current:** 6 separate subscriptions
- [ ] **Phase 2:** 6 subscriptions (hidden in facade)
- [ ] **Phase 3:** 1 subscription (in store) (83% reduction)

### Import Paths

- [x] **Current:** 2 paths (`@opencode-vibe/react`, `@/react`)
- [ ] **Phase 1:** 1 path (delete re-export layer)

### Provider Nesting

- [x] **Current:** Required (`<OpenCodeProvider>`)
- [ ] **Phase 4:** Optional (auto-discovery fallback)

### DX Validation (Post-Phase 3)

- [ ] New contributor can render session in <5 minutes
- [ ] Zero questions about "which hook do I use?"
- [ ] No prop drilling of `directory`
- [ ] uploadthing-level simplicity achieved

---

## Migration Checklist

### Phase 1: Cleanup (Week 1)

- [ ] Delete `apps/web/src/react/` directory
- [ ] Update 14+ files: `@/react` → `@opencode-vibe/react`
- [ ] Delete `apps/web/src/lib/prompt-parsing.ts`
- [ ] Add documentation to `client.ts`, `transform-messages.ts`
- [ ] Update `tsconfig.json` (remove `@/react` alias)
- [ ] Run `bun run typecheck` - verify zero errors
- [ ] Run `bun test` - verify all tests pass
- [ ] Update `docs/AGENTS.md` - remove `apps/web/src/react/` references

### Phase 2: Facade Hook (Week 2-3)

- [ ] Create `use-session-facade.ts` in `packages/react/src/hooks/`
- [ ] Export from `packages/react/src/index.ts`
- [ ] Update `SessionLayout` to use facade (replace 7 hooks with 1)
- [ ] Update `SessionMessages` to consume props instead of hooks
- [ ] Remove duplicate `useSessionStatus` calls
- [ ] Add tests for facade hook
- [ ] Write migration guide for consumers
- [ ] Benchmark: verify API call reduction (3x → 1x)

### Phase 3: Store-Based (Week 4-5)

- [ ] Refactor facade to use Zustand store internally
- [ ] Move SSE subscription logic to store
- [ ] Add store selectors for all session data
- [ ] Update facade to select from store
- [ ] Add tests for store integration
- [ ] Benchmark: verify SSE subscription reduction (6 → 1)
- [ ] Benchmark: verify performance improvement (target: 3x faster)

### Phase 4: Remove Provider (Week 6)

- [ ] Implement auto-server-discovery in hooks
- [ ] Create `OpencodeSSRPlugin` for Next.js
- [ ] Add globalThis hydration for static config
- [ ] Make `OpenCodeProvider` optional
- [ ] Add progressive enhancement fallback
- [ ] Update docs to show provider-less usage
- [ ] Verify uploadthing DX parity

---

## Risks & Mitigations

### Risk: Breaking Changes for Consumers

**Mitigation:**
- Phase 1: Automated codemod for import path updates
- Phase 2: Facade is additive (old hooks still work)
- Phase 3: Facade API unchanged (internal refactor only)
- Gradual deprecation path (6 months warning)

### Risk: Store Refactor Complexity

**Mitigation:**
- Start with facade in Phase 2 (proves DX, low risk)
- Store refactor is internal only (no public API changes)
- Comprehensive tests before/after
- Feature flag for gradual rollout

### Risk: SSR Plugin Edge Cases

**Mitigation:**
- Progressive enhancement (falls back to client fetch)
- Test with Next.js Static Export
- Test with edge runtime
- Document limitations

---

## Related Work

- **ADR-001:** Next.js Rebuild - established need for better React patterns
- **ADR-002:** Effect Migration - effect layer separation
- **Audit 01:** SSE architecture - real-time sync foundation
- **Audit 02:** Feature parity - current capabilities to preserve
- **Audit 06:** lib/ layer - cleanup targets
- **Audit 07:** React re-exports - zombie layer to delete
- **Audit 08:** Hook sprawl - primary DX problem
- **Audit 09:** uploadthing research - proven patterns to steal

---

## Appendix: Full Hook Comparison

### Current (11 hooks, 150 lines)

```tsx
export function SessionLayout({ sessionId, directory }) {
  const { directory: contextDirectory } = useOpenCode()
  useMultiServerSSE()
  useSubagentSync({ sessionId })
  const { session } = useSession({ sessionId, directory: contextDirectory })
  const { running } = useSessionStatus({ sessionId, directory: contextDirectory })
  const { messages } = useMessages({ sessionId, directory: contextDirectory })
  const { sendMessage, isLoading, error, queueLength } = useSendMessage({
    sessionId,
    directory: contextDirectory
  })

  return (
    <div>
      <h1>{session?.title}</h1>
      <SessionMessages 
        sessionId={sessionId} 
        directory={contextDirectory}
      /> {/* +2 hooks: useMessagesWithParts, useSessionStatus */}
      <ContextUsageBar sessionId={sessionId} /> {/* +1 hook: useContextUsage */}
      <CompactionIndicator sessionId={sessionId} /> {/* +1 hook: useCompactionState */}
      <PromptInput onSubmit={sendMessage} disabled={isLoading} />
    </div>
  )
}
```

### Target (1 hook, 15 lines)

```tsx
export function SessionLayout({ sessionId, directory }) {
  const session = useSession(sessionId, {
    directory,
    onError: (err) => toast.error(err.message)
  })

  return (
    <div>
      <h1>{session.data?.title}</h1>
      <SessionMessages messages={session.messages} running={session.running} />
      <ContextUsageBar usage={session.contextUsage} />
      <CompactionIndicator 
        isCompacting={session.compacting}
        progress={session.compactionProgress}
      />
      <PromptInput onSubmit={session.sendMessage} disabled={session.isLoading} />
    </div>
  )
}
```

**90% code reduction. uploadthing-level simplicity achieved.**

---

## Conclusion

The current DX is 10x more complex than industry benchmarks. This overhaul brings OpenCode to uploadthing-level simplicity through:

1. **Phase 1 (2 days):** Delete zombie layer, clean up lib/, ONE import path
2. **Phase 2 (1 week):** Facade hook reduces 11 hooks → 1 hook
3. **Phase 3 (2 weeks):** Store-based implementation eliminates ALL duplicates
4. **Phase 4 (1 week):** Remove provider requirement, complete uploadthing parity

**Bottom line:** From 150 lines + 11 hooks → 15 lines + 1 hook. **90% reduction in complexity.**

The path forward is clear. The patterns are proven (uploadthing). The benefits are massive. Let's ship it.
