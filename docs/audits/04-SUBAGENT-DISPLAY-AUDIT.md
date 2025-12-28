# Subagent Display Implementation Audit

```
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║   ┌─────────────────────────────────────────────────────┐    ║
    ║   │    🔍 SUBAGENT DISPLAY AUDIT 🔍                     │    ║
    ║   │                                                     │    ║
    ║   │    Current: COLLAPSED SUMMARIES ONLY                │    ║
    ║   │    Target:  FULL LIVE STREAMING                     │    ║
    ║   └─────────────────────────────────────────────────────┘    ║
    ║                                                               ║
    ║   Coverage: 15% vs Guide Recommendations                     ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
```

## Executive Summary

**Audit Date:** December 27, 2025  
**Target:** opencode-vibe (Next.js React client)  
**Baseline:** Official OpenCode SolidJS app  
**Guide:** `/docs/guides/SUBAGENT_DISPLAY.md`

### Current State

✅ **IMPLEMENTED (15%):**

- Task tool renders with collapsed summary view (lines 564-605 in `message-part.tsx`)
- Metadata.summary array tracked in task tool state
- Status detection for task tools in `session-turn.tsx` (lines 182-216)
- Basic child session detection via `parentID` filtering (SolidJS shows this pattern)

❌ **MISSING (85%):**

- No subagent store or state management
- No SSE subscription for child session events
- No expandable/collapsible UI for subagent output
- No real-time streaming of subagent tool calls
- No progress indicators for running subagents
- No nested subagent support
- No auto-expand for running subagents

---

## Coverage Analysis

### 1. Detection & Tracking (20% Coverage)

#### ✅ What Works

```tsx
// message-part.tsx:564-605
ToolRegistry.register({
  name: "task",
  render(props) {
    const summary = () =>
      (props.metadata.summary ?? []) as {
        id: string;
        tool: string;
        state: { status: string; title?: string };
      }[];

    return (
      <BasicTool icon="task" defaultOpen={true}>
        <For each={summary()}>
          {(item) => (
            <div data-slot="task-tool-item">
              <Icon name={info.icon} size="small" />
              <span data-slot="task-tool-title">{info.title}</span>
              <Show when={item.state.title}>
                <span data-slot="task-tool-subtitle">{item.state.title}</span>
              </Show>
            </div>
          )}
        </For>
      </BasicTool>
    );
  },
});
```

**Pattern Detection:**

```tsx
// session-turn.tsx:182-216
if (
  part.type === "tool" &&
  part.tool === "task" &&
  part.state &&
  "metadata" in part.state &&
  part.state.metadata?.sessionId &&
  part.state.status === "running"
) {
  currentTask = part as ToolPart;
}
```

#### ❌ What's Missing

**No Subagent Store:**

```tsx
// NEEDED: src/stores/subagent-store.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface SubagentSession {
  id: string
  parentSessionId: string
  parentPartId: string
  agentName: string
  status: "running" | "completed" | "error"
  messages: Message[]
  parts: Record<string, Part[]>
}

interface SubagentState {
  sessions: Record<string, SubagentSession>
  partToSession: Record<string, string>
  expanded: Set<string>

  registerSubagent: (childSessionId: string, ...) => void
  addMessage: (sessionId: string, message: Message) => void
  addPart: (sessionId: string, messageId: string, part: Part) => void
  toggleExpanded: (partId: string) => void
}

export const useSubagentStore = create<SubagentState>()(
  immer((set, get) => ({
    sessions: {},
    partToSession: {},
    expanded: new Set(),
    // ... actions
  }))
)
```

**No Child Session Detection:**

```tsx
// NEEDED: Detection in SSE handler
function isChildSession(session: Session, parentId: string): boolean {
  return session.parentID === parentId;
}

function isTaskToolWithSession(part: Part): boolean {
  return (
    part.type === "tool" &&
    part.tool === "task" &&
    "metadata" in part.state &&
    typeof part.state.metadata?.sessionId === "string"
  );
}
```

---

### 2. SSE Event Tracking (0% Coverage)

#### ❌ Completely Missing

**Current SSE Handler (session-messages.tsx:109-242):**

```tsx
// Only tracks parent session events
subscribe("message.updated", (event) => {
  if (info.sessionID !== sessionId) return;
  // ... handles parent session only
});

subscribe("message.part.updated", (event) => {
  if (part.sessionID !== sessionId) return;
  // ... handles parent session only
});
```

**What's Needed:**

```tsx
// NEEDED: Child session event subscription
useEffect(() => {
  // 1. Detect new child sessions
  const unsubSessionCreated = subscribe("session.created", (event) => {
    const session = properties.info as Session;
    if (session.parentID === parentSessionId) {
      const match = session.title.match(/@(\w+)\s+subagent/);
      const agentName = match?.[1] || "unknown";
      registerSubagent(session.id, parentSessionId, "", agentName);
    }
  });

  // 2. Track child messages
  const unsubMessageCreated = subscribe("message.created", (event) => {
    const message = properties.info as Message;
    if (childSessionIds.has(message.sessionID)) {
      addMessage(message.sessionID, message);
    }
  });

  // 3. Track child parts (CRITICAL FOR REAL-TIME)
  const unsubPartUpdated = subscribe("message.part.updated", (event) => {
    const part = properties.part as Part;
    if (childSessionIds.has(part.sessionID)) {
      updatePart(part.sessionID, part.messageID, part);
    }
  });

  // 4. Track completion
  const unsubSessionStatus = subscribe("session.status", (event) => {
    const { sessionID, status } = properties;
    if (childSessionIds.has(sessionID) && status.type === "idle") {
      setStatus(sessionID, "completed");
    }
  });

  return () => {
    unsubSessionCreated();
    unsubMessageCreated();
    unsubPartUpdated();
    unsubSessionStatus();
  };
}, [parentSessionId, childSessionIds]);
```

**Gap:** No tracking of child session lifecycle whatsoever.

---

### 3. State Management (10% Coverage)

#### ✅ What Works

- Task metadata.summary tracked (BasicTool receives props.metadata)
- Summary array structure matches guide expectations

#### ❌ What's Missing

- No expanded/collapsed state tracking
- No child session-to-parent part mapping
- No child session status tracking
- No child message/part storage

**SolidJS Pattern (for reference):**

```tsx
// SolidJS uses a reactive store via context
const data = useData();
const messages = createMemo(() => data.store.message[sessionID] ?? []);
const parts = createMemo(() => data.store.part[messageID] ?? []);
```

**React Equivalent Needed:**

```tsx
// Zustand store pattern
const childMessages = useSubagentStore(
  (s) => s.sessions[childSessionId]?.messages ?? [],
);
const childParts = useSubagentStore(
  (s) => s.sessions[childSessionId]?.parts[messageId] ?? [],
);
```

---

### 4. UI Components (20% Coverage)

#### ✅ What Works

```tsx
// Collapsed summary view (message-part.tsx:564-605)
<BasicTool icon="task" defaultOpen={true}>
  <For each={summary()}>
    {(item) => (
      <div data-slot="task-tool-item">
        <Icon name={info.icon} size="small" />
        <span data-slot="task-tool-title">{info.title}</span>
        <Show when={item.state.title}>
          <span data-slot="task-tool-subtitle">{item.state.title}</span>
        </Show>
      </div>
    )}
  </For>
</BasicTool>
```

#### ❌ What's Missing

**No Expandable Header:**

```tsx
// NEEDED: TaskToolPart.tsx
export function TaskToolPart({ part }: { part: ToolPart }) {
  const { subagent, isExpanded, toggleExpanded, isRunning } = useSubagent(
    part.id,
  );

  return (
    <div className="task-tool-part">
      {/* Header - always visible */}
      <button onClick={toggleExpanded} className="task-tool-header">
        <div className="task-tool-icon">
          {isRunning ? (
            <Loader className="animate-spin" />
          ) : isExpanded ? (
            <ChevronDown />
          ) : (
            <ChevronRight />
          )}
        </div>
        <div className="task-tool-info">
          <span className="task-tool-agent">@{input.subagent_type}</span>
          <span className="task-tool-description">{input.description}</span>
        </div>
        <StatusBadge status={part.state.status} />
      </button>

      {/* Collapsed summary (current behavior) */}
      {!isExpanded && <TaskSummary summary={summary} />}

      {/* MISSING: Expanded subagent view */}
      {isExpanded && subagent && <SubagentView subagent={subagent} />}
    </div>
  );
}
```

**No SubagentView Component:**

```tsx
// NEEDED: SubagentView.tsx
export function SubagentView({ subagent }: { subagent: SubagentSession }) {
  return (
    <div className="subagent-view">
      <div className="subagent-header">
        <span className="subagent-agent">@{subagent.agentName}</span>
        <StatusIndicator status={subagent.status} />
      </div>

      <div className="subagent-messages">
        {subagent.messages.map((message) => (
          <div key={message.id} className="subagent-message">
            {message.role === "assistant" && (
              <div className="subagent-parts">
                {(subagent.parts[message.id] || []).map((part) => (
                  <PartRenderer key={part.id} part={part} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {subagent.status === "running" && (
        <div className="subagent-running">
          <Loader className="animate-spin" />
          <span>Working...</span>
        </div>
      )}
    </div>
  );
}
```

**No PartRenderer for Child Parts:**

```tsx
// NEEDED: Render child tool calls, text, etc.
export function PartRenderer({ part }: { part: Part }) {
  switch (part.type) {
    case "text":
      return <TextPartView part={part} />;
    case "tool":
      return <ToolPartView part={part} />;
    case "reasoning":
      return <ReasoningPartView part={part} />;
    default:
      return null;
  }
}
```

---

### 5. Advanced Features (0% Coverage)

#### ❌ All Missing

**No Nested Subagent Support:**

- Can't handle subagents spawning their own subagents
- No depth tracking or recursion limits

**No Auto-Expand:**

```tsx
// NEEDED: useAutoExpandRunning.ts
export function useAutoExpandRunning() {
  const sessions = useSubagentStore((s) => s.sessions);
  const toggleExpanded = useSubagentStore((s) => s.toggleExpanded);

  useEffect(() => {
    for (const session of Object.values(sessions)) {
      if (session.status === "running" && !expanded.has(session.parentPartId)) {
        toggleExpanded(session.parentPartId);
      }
    }
  }, [sessions]);
}
```

**No Progress Indicators:**

```tsx
// NEEDED: SubagentProgress.tsx
export function SubagentProgress({ subagent }: { subagent: SubagentSession }) {
  const allParts = Object.values(subagent.parts).flat();
  const toolParts = allParts.filter((p) => p.type === "tool");

  const completed = toolParts.filter(
    (p) => p.state.status === "completed",
  ).length;
  const total = toolParts.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className="subagent-progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="progress-text">
        {completed}/{total} tools
      </span>
    </div>
  );
}
```

**No Streaming Text Support:**

- No delta accumulation for streaming child text parts
- No visual indication that child is actively streaming

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CURRENT (OPENCODE-VIBE)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SSE (session.messages.tsx)                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ subscribe("message.part.updated")                            │  │
│  │   └─► Filter: part.sessionID === parentSessionId             │  │
│  │       └─► Update local state (parent parts only)             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  Task Tool Renderer (message-part.tsx:564-605)                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ props.metadata.summary (collapsed view)                      │  │
│  │   └─► Show last 3 tools from summary array                   │  │
│  │   └─► No expand/collapse                                     │  │
│  │   └─► No child session subscription                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Child Session (INVISIBLE)                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Full messages, parts, streaming... never seen by user        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     NEEDED (GUIDE SPEC)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SSE (NEW: useSubagentSync hook)                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ subscribe("session.created")                                 │  │
│  │   └─► Detect: session.parentID === parentSessionId           │  │
│  │       └─► registerSubagent(childId, parentId, agentName)     │  │
│  │                                                               │  │
│  │ subscribe("message.part.updated")                            │  │
│  │   └─► Filter: childSessionIds.has(part.sessionID)            │  │
│  │       └─► updatePart(childSessionId, messageId, part)        │  │
│  │                                                               │  │
│  │ subscribe("session.status")                                  │  │
│  │   └─► Detect: status.type === "idle"                         │  │
│  │       └─► setStatus(childSessionId, "completed")             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  Subagent Store (Zustand + Immer)                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ sessions: { [childId]: SubagentSession }                     │  │
│  │ partToSession: { [parentPartId]: childSessionId }            │  │
│  │ expanded: Set<parentPartId>                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  TaskToolPart (NEW: expandable header)                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ const { subagent, isExpanded } = useSubagent(partId)         │  │
│  │                                                               │  │
│  │ [Header] Chevron + Agent + Status + Toggle                   │  │
│  │ [Collapsed] Summary (last 3 tools)                           │  │
│  │ [Expanded] <SubagentView subagent={subagent} />              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                      │
│  SubagentView (NEW: full child session renderer)                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Render child messages                                        │  │
│  │   └─► For each message.parts:                                │  │
│  │       └─► <PartRenderer part={part} /> (recursive)           │  │
│  │                                                               │  │
│  │ Show live streaming (text deltas)                            │  │
│  │ Show tool calls (read, grep, edit, etc.)                     │  │
│  │ Progress bar (completed/total tools)                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

### Phase 1: Foundation (2-3 hours)

**Dependencies:** None  
**Goal:** Establish state management and detection

1. **Create Subagent Store** (`src/stores/subagent-store.ts`)
   - Define types (SubagentSession, SubagentState)
   - Implement Zustand store with immer middleware
   - Actions: registerSubagent, addMessage, addPart, toggleExpanded

2. **Add Detection Hooks** (`src/hooks/useSubagentSync.ts`, `useTaskToolDetection.ts`)
   - Detect child sessions via `parentID`
   - Detect task tools with `metadata.sessionId`
   - Map parent part ID → child session ID

### Phase 2: SSE Integration (1-2 hours)

**Dependencies:** Phase 1  
**Goal:** Real-time child session tracking

3. **Subscribe to Child Events** (`useSubagentSync.ts`)
   - `session.created` → register child
   - `message.created` → track child messages
   - `message.part.updated` → update child parts (CRITICAL)
   - `session.status` → track completion

4. **Filter Events** (update `session-messages.tsx`)
   - Track set of child session IDs
   - Filter SSE events by child session ID
   - Prevent parent/child event collision

### Phase 3: UI Components (3-4 hours)

**Dependencies:** Phase 1, 2  
**Goal:** Expandable subagent display

5. **TaskToolPart Component** (`src/components/task-tool-part.tsx`)
   - Replace current inline task renderer
   - Expandable header with chevron
   - Collapsed: show summary (current behavior)
   - Expanded: render `<SubagentView />`

6. **SubagentView Component** (`src/components/subagent-view.tsx`)
   - Render child messages
   - Recursive part rendering (support nested subagents)
   - Running indicator (spinner + "Working...")

7. **PartRenderer Component** (`src/components/subagent-part-renderer.tsx`)
   - Handle text, tool, reasoning parts
   - Reuse existing part renderers where possible

### Phase 4: Polish (1-2 hours)

**Dependencies:** Phase 3  
**Goal:** UX enhancements

8. **Auto-Expand Hook** (`src/hooks/useAutoExpandRunning.ts`)
   - Detect running subagents
   - Auto-expand their parent task tool

9. **Progress Indicators** (update `SubagentView`)
   - Tool progress bar (completed/total)
   - Status badges (running, completed, error)

10. **Streaming Text** (update text part renderer)
    - Accumulate deltas from `message.part.updated`
    - Visual streaming indicator

### Phase 5: Advanced (Optional, 2-3 hours)

**Dependencies:** Phase 4  
**Goal:** Nested subagents, mobile UX

11. **Nested Subagent Support**
    - Recursive depth tracking
    - Max depth limit (e.g., 3 levels)
    - Indentation for visual hierarchy

12. **Mobile-Friendly Sheet** (`src/components/subagent-sheet.tsx`)
    - Bottom sheet for mobile
    - Swipe to dismiss
    - Full-height subagent view

---

## Effort Estimates

| Phase                   | Components            | Hours          | Priority          |
| ----------------------- | --------------------- | -------------- | ----------------- |
| **Phase 1: Foundation** | Store + detection     | 2-3            | P0 (CRITICAL)     |
| **Phase 2: SSE**        | Event subscription    | 1-2            | P0 (CRITICAL)     |
| **Phase 3: UI**         | Expandable components | 3-4            | P0 (CRITICAL)     |
| **Phase 4: Polish**     | Auto-expand, progress | 1-2            | P1 (HIGH)         |
| **Phase 5: Advanced**   | Nested, mobile        | 2-3            | P2 (NICE-TO-HAVE) |
| **TOTAL**               |                       | **9-14 hours** |                   |

**Recommended Sprint:** 2 days for P0+P1 (core functionality + polish)

---

## Missing Components Checklist

```
STATE MANAGEMENT
────────────────
[ ] src/stores/subagent-store.ts (Zustand store)
[ ] src/hooks/useSubagent.ts (selector hook)
[ ] src/hooks/useSubagentSync.ts (SSE subscription)
[ ] src/hooks/useTaskToolDetection.ts (part-to-session mapping)
[ ] src/hooks/useAutoExpandRunning.ts (UX enhancement)

SSE INTEGRATION
───────────────
[ ] Subscribe to session.created (detect children)
[ ] Subscribe to message.created (child messages)
[ ] Subscribe to message.part.updated (child parts)
[ ] Subscribe to session.status (completion)
[ ] Filter by childSessionIds in handlers

UI COMPONENTS
─────────────
[ ] src/components/task-tool-part.tsx (expandable header)
[ ] src/components/subagent-view.tsx (full child renderer)
[ ] src/components/subagent-part-renderer.tsx (recursive parts)
[ ] src/components/subagent-progress.tsx (tool progress bar)
[ ] src/components/subagent-sheet.tsx (mobile view)

UTILITIES
─────────
[ ] src/lib/subagent-utils.ts (detection helpers)
[ ] src/types/subagent.ts (TypeScript types)

STYLES
──────
[ ] src/styles/subagent.css (component styles)
```

---

## Key Insights from SolidJS Reference

The official OpenCode SolidJS app provides critical patterns:

### 1. Child Session Detection

```tsx
// packages/app/src/context/notification.tsx
const isChild = match.found && syncStore.session[match.index].parentID;
```

Pattern: Filter sessions by checking `parentID` field.

### 2. Task Tool Status Tracking

```tsx
// packages/app/src/components/session-turn.tsx:182-216
if (
  part.type === "tool" &&
  part.tool === "task" &&
  part.state.metadata?.sessionId &&
  part.state.status === "running"
) {
  currentTask = part as ToolPart;
  // Lookup child session messages to get current status
  const taskMessages = data.store.message[taskSessionId] ?? [];
  // Find last part to compute status
}
```

Pattern: Use `metadata.sessionId` to look up child session, traverse child messages for current status.

### 3. Part Rendering

```tsx
// packages/ui/src/components/message-part.tsx:564-605
ToolRegistry.register({
  name: "task",
  render(props) {
    const summary = () => props.metadata.summary ?? [];
    // Renders collapsed summary ONLY
  },
});
```

Pattern: Task tool gets `metadata.summary` array. Current implementation stops here. **Guide extends this with expandable view.**

---

## Recommended Next Steps

1. **Read Guide Deeply** - Review `/docs/guides/SUBAGENT_DISPLAY.md` sections 2-4 for TypeScript types and patterns
2. **Start with Phase 1** - Subagent store is the foundation for everything else
3. **Use SolidJS as Reference** - Patterns for child session lookup, status tracking
4. **Incremental Testing** - Test each phase independently before moving to next
5. **Consider Framework Differences** - SolidJS uses reactive signals, React needs explicit state updates

---

## Coverage Summary

| Category                 | Coverage | Status          |
| ------------------------ | -------- | --------------- |
| **Detection & Tracking** | 20%      | 🟡 Partial      |
| **SSE Event Tracking**   | 0%       | 🔴 Missing      |
| **State Management**     | 10%      | 🔴 Missing      |
| **UI Components**        | 20%      | 🟡 Partial      |
| **Advanced Features**    | 0%       | 🔴 Missing      |
| **OVERALL**              | **15%**  | 🔴 CRITICAL GAP |

---

## Risks & Mitigations

### Risk 1: Event Subscription Conflicts

**Issue:** Parent and child sessions both emit `message.part.updated`  
**Mitigation:** Maintain `Set<childSessionId>`, filter events strictly

### Risk 2: State Update Race Conditions

**Issue:** Parts arrive before parent message created  
**Mitigation:** Buffer pending parts (pattern already exists in `session-messages.tsx:70-103`)

### Risk 3: Performance with Nested Subagents

**Issue:** Deep recursion causes render thrashing  
**Mitigation:** Max depth limit (3), virtualize long lists

### Risk 4: Framework Differences (SolidJS → React)

**Issue:** Guide examples use SolidJS primitives (createMemo, createEffect)  
**Mitigation:** Use Zustand for state, React hooks for effects, maintain same patterns

---

## Conclusion

**Current State:** opencode-vibe shows **collapsed summaries only** (15% coverage).  
**Target State:** Full live streaming with expandable subagent views (100% coverage).

**Critical Path:** Phase 1-3 (foundation, SSE, UI) = **6-9 hours** to achieve core functionality.

**Recommendation:** Prioritize Phases 1-3 for MVP subagent display. Defer Phase 5 (nested, mobile) unless high user demand.
