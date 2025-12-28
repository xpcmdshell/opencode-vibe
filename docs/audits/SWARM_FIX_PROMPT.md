# OpenCode-Vibe Improvement Swarm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗ ██████╗ ██████╗ ███████╗      │
│  ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗██╔════╝      │
│  ██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║   ██║██║  ██║█████╗        │
│  ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║   ██║██║  ██║██╔══╝        │
│  ╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗╚██████╔╝██████╔╝███████╗      │
│   ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝      │
│                                                                             │
│                    ██╗   ██╗██╗██████╗ ███████╗                             │
│                    ██║   ██║██║██╔══██╗██╔════╝                             │
│                    ██║   ██║██║██████╔╝█████╗                               │
│                    ╚██╗ ╚██╗██║██╔══██╗██╔══╝                               │
│                     ╚████╔╝██║██████╔╝███████╗                              │
│                      ╚═══╝ ╚═╝╚═════╝ ╚══════╝                              │
│                                                                             │
│                 🐝 SWARM FIX PROMPT 🐝                                      │
│                                                                             │
│   Compiled from 5 audit reports                                             │
│   Total: 124KB of findings                                                  │
│   Date: 2025-12-27                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Context

This prompt is designed to be pasted into `/swarm` to fix all identified issues in opencode-vibe.

**Project:** `/Users/joel/Code/joelhooks/opencode-next/`  
**Audit Reports:** `docs/audits/01-05-*.md`  
**Reference Implementation:** `/Users/joel/Code/sst/opencode/packages/app/src/`

---

## Priority Summary

| Priority | Category            | Issues              | Effort |
| -------- | ------------------- | ------------------- | ------ |
| **P0**   | Sync Implementation | 4 critical gaps     | 8.5h   |
| **P0**   | Mobile UX           | 2 critical gaps     | 1.5h   |
| **P1**   | Feature Parity      | 10 missing features | 40h    |
| **P1**   | Subagent Display    | 85% missing         | 9-14h  |
| **P2**   | Polish              | Various             | 10h    |

**Total Estimated Effort:** ~70-80 hours

---

## SWARM TASK

Fix opencode-vibe implementation gaps identified in the audit reports. Focus on P0 issues first, then P1.

### Phase 1: Critical Sync Fixes (P0 - 8.5 hours)

#### 1.1 Restore Store Methods (3h)

**File:** `apps/web/src/react/store.ts`

The store was refactored to `DirectoryState` pattern but convenience methods were removed. Provider calls non-existent methods.

**Add these methods:**

```typescript
type OpencodeActions = {
  // Keep existing
  initDirectory: (directory: string) => void;
  handleEvent: (directory: string, event: any) => void;

  // ADD BACK:
  getSession: (directory: string, id: string) => Session | undefined;
  getSessions: (directory: string) => Session[];
  addSession: (directory: string, session: Session) => void;
  updateSession: (
    directory: string,
    id: string,
    updater: (draft: Session) => void,
  ) => void;
  removeSession: (directory: string, id: string) => void;

  getMessages: (directory: string, sessionID: string) => Message[];
  addMessage: (directory: string, message: Message) => void;
  updateMessage: (
    directory: string,
    sessionID: string,
    messageID: string,
    updater: (draft: Message) => void,
  ) => void;
  removeMessage: (
    directory: string,
    sessionID: string,
    messageID: string,
  ) => void;
};
```

**Implementation pattern:**

```typescript
getSession: (directory, id) => {
  const dir = get().directories[directory]
  if (!dir) return undefined
  const result = Binary.search(dir.sessions, id, (s) => s.id)
  return result.found ? dir.sessions[result.index] : undefined
},
```

#### 1.2 Implement Bootstrap Function (4h)

**File:** `apps/web/src/react/provider.tsx`

Currently `sync()` is a stub with TODO comment. Need full bootstrap.

**Reference:** Official app `packages/app/src/context/global-sync.tsx:131-166`

**Implementation:**

```typescript
const bootstrap = useCallback(async () => {
  try {
    // Load initial sessions
    const response = await fetch(`${url}/session`, {
      headers: { "x-opencode-directory": directory },
    });
    const sessions = await response.json();

    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    const filtered = sessions
      .filter((s) => !s.time.archived)
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((s, i) => i < 20 || s.time.updated > fourHoursAgo);

    store.setSessions(directory, filtered);

    // Load session statuses
    const statusResponse = await fetch(`${url}/session/status`, {
      headers: { "x-opencode-directory": directory },
    });
    const statuses = await statusResponse.json();
    for (const [sessionID, status] of Object.entries(statuses)) {
      store.handleEvent(directory, {
        type: "session.status",
        properties: { sessionID, status },
      });
    }

    store.setSessionReady(directory, true);
    setReady(true);
  } catch (error) {
    console.error("Bootstrap failed:", error);
  }
}, [url, directory, store]);

// Call on mount
useEffect(() => {
  bootstrap();
}, [bootstrap]);
```

#### 1.3 Handle Missing SSE Events (30min)

**File:** `apps/web/src/react/store.ts`

Events are subscribed but silently dropped. Add handlers:

```typescript
case "session.created":
case "session.updated": {
  const session = event.properties.info as Session
  // ... existing logic
}

case "session.deleted": {
  const sessionID = event.properties.sessionID
  const result = Binary.search(dir.sessions, sessionID, (s: Session) => s.id)
  if (result.found) {
    dir.sessions.splice(result.index, 1)
  }
  break
}
```

#### 1.4 Handle global.disposed (1h)

**File:** `apps/web/src/react/provider.tsx`

Server restart = stale state. Need to call bootstrap on this event.

```typescript
subscribe("global.disposed", () => {
  bootstrap();
});
```

---

### Phase 2: Critical Mobile Fixes (P0 - 1.5 hours)

#### 2.1 Safe-Area CSS (1h)

**File:** `apps/web/src/app/globals.css`

Content hides under iPhone notch/home indicator.

**Add:**

```css
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
  --safe-area-right: env(safe-area-inset-right);
}

body {
  padding-top: var(--safe-area-top);
  padding-bottom: var(--safe-area-bottom);
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
}
```

**Update fixed bottom input:**

```tsx
// session-layout.tsx
<div className="fixed" style={{ bottom: 'calc(0px + var(--safe-area-bottom))' }}>
```

#### 2.2 Visibility API for SSE (30min)

**File:** `apps/web/src/react/use-sse.tsx`

SSE reconnects even when app is backgrounded, draining battery.

**Add:**

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      connect();
    } else {
      abortController.current?.abort();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [connect]);
```

---

### Phase 3: Subagent Display (P1 - 9-14 hours)

#### 3.1 Create Subagent Store (2-3h)

**File:** `apps/web/src/stores/subagent-store.ts` (NEW)

```typescript
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface SubagentSession {
  id: string;
  parentSessionId: string;
  parentPartId: string;
  agentName: string;
  status: "running" | "completed" | "error";
  messages: Message[];
  parts: Record<string, Part[]>;
}

interface SubagentState {
  sessions: Record<string, SubagentSession>;
  partToSession: Record<string, string>;
  expanded: Set<string>;

  registerSubagent: (
    childSessionId: string,
    parentSessionId: string,
    parentPartId: string,
    agentName: string,
  ) => void;
  addMessage: (sessionId: string, message: Message) => void;
  addPart: (sessionId: string, messageId: string, part: Part) => void;
  toggleExpanded: (partId: string) => void;
}
```

#### 3.2 SSE Child Session Subscription (1-2h)

**File:** `apps/web/src/hooks/useSubagentSync.ts` (NEW)

Subscribe to child session events:

- `session.created` → detect children via `parentID`
- `message.created` → track child messages
- `message.part.updated` → update child parts (CRITICAL for real-time)
- `session.status` → track completion

#### 3.3 Expandable TaskToolPart Component (2-3h)

**File:** `apps/web/src/components/task-tool-part.tsx` (NEW)

Replace current inline task renderer with expandable version:

- Header with chevron + agent name + status
- Collapsed: show summary (current behavior)
- Expanded: render `<SubagentView />`

#### 3.4 SubagentView Component (2h)

**File:** `apps/web/src/components/subagent-view.tsx` (NEW)

Render child session content:

- Child messages
- Recursive part rendering
- Running indicator
- Progress bar (completed/total tools)

---

### Phase 4: Feature Parity (P1 - 40 hours)

These are larger features that require more planning. Create separate cells for each:

1. **Session List + Sidebar** (15h) - Multi-project navigation
2. **Undo/Redo** (8h) - `session.revert/unrevert` API integration
3. **Review Panel + Diff Viewer** (12h) - Show what changed
4. **Command Palette** (8h) - Keyboard shortcuts infrastructure
5. **Terminal Integration** (10h) - xterm.js + LocalPTY

---

### Phase 5: Polish (P2 - 10 hours)

1. **Error Toast for Search Failures** (1h) - Show "Search failed" instead of "No files found"
2. **DOM Normalization Check** (1h) - Prevent ContentEditable chaos
3. **Pull-to-Refresh** (1h) - Native mobile gesture
4. **Haptic Feedback** (1h) - Vibration on actions
5. **Service Worker** (6h) - Offline caching, background sync

---

## File Reference

| Concern        | File                                               |
| -------------- | -------------------------------------------------- |
| SSE Connection | `apps/web/src/react/use-sse.tsx`                   |
| State Store    | `apps/web/src/react/store.ts`                      |
| Provider       | `apps/web/src/react/provider.tsx`                  |
| Session Layout | `apps/web/src/app/session/[id]/session-layout.tsx` |
| Global CSS     | `apps/web/src/app/globals.css`                     |
| Message Parts  | `apps/web/src/components/message-part.tsx`         |
| Prompt Input   | `apps/web/src/components/prompt/PromptInput.tsx`   |
| Autocomplete   | `apps/web/src/components/prompt/Autocomplete.tsx`  |

---

## Audit Reports

Full details in:

- `docs/audits/01-SYNC-AUDIT.md` (837 lines)
- `docs/audits/02-FEATURE-PARITY-AUDIT.md` (513 lines)
- `docs/audits/03-MOBILE-UX-AUDIT.md` (512 lines)
- `docs/audits/04-SUBAGENT-DISPLAY-AUDIT.md` (772 lines)
- `docs/audits/05-AT-REFERENCES-AUDIT.md` (545 lines) - ✅ APPROVED, no fixes needed

---

## Success Criteria

- [ ] All P0 sync issues fixed (store methods, bootstrap, event handlers)
- [ ] Safe-area CSS prevents content hiding under notch
- [ ] SSE only reconnects when app is in foreground
- [ ] Subagent display shows expandable child sessions
- [ ] Tests pass for all changes
- [ ] No TypeScript errors

---

## Notes for Swarm Workers

1. **Read the audit reports** - They contain code snippets and exact file:line references
2. **Reference the SolidJS app** - It's the source of truth at `/Users/joel/Code/sst/opencode/packages/app/src/`
3. **Check semantic-memory** - 20+ memories stored from audits with specific patterns
4. **Write tests** - Each fix should have corresponding tests
5. **Store learnings** - Use `semantic-memory_store` for non-obvious patterns discovered

```
     🐝
    /   \
   / FIX \
  /  ALL  \
 / THE    \
/  THINGS  \
‾‾‾‾‾‾‾‾‾‾‾
```
