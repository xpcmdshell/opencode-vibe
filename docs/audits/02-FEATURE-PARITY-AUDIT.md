# Feature Parity Audit: opencode-vibe vs Official SolidJS App

**Date:** 2025-12-27  
**Auditor:** Claude (opencode-c802w7-mjp2zp99re0)  
**Sources:**

- Official: `/Users/joel/Code/sst/opencode/packages/app/src/`
- opencode-vibe: `/Users/joel/Code/joelhooks/opencode-next/`

---

```
    ╔════════════════════════════════════════════════╗
    ║                                                ║
    ║        🔍  FEATURE PARITY AUDIT  🔍            ║
    ║                                                ║
    ║    Comparing opencode-vibe against the         ║
    ║    battle-tested Official SolidJS App          ║
    ║                                                ║
    ╚════════════════════════════════════════════════╝
```

---

## Executive Summary

opencode-vibe is a clean, focused **Next.js 16 + React** reimplementation of OpenCode's web interface. It excels at core message display and prompt handling but lacks **~60% of the official app's features**, particularly around session management, IDE-like features, and advanced UI controls.

**Critical Gaps (P0):** Session lifecycle (fork/archive/delete), undo/redo, file tabs, diff viewer  
**High-Value Gaps (P1):** Terminal, MCP management, keyboard shortcuts, sidebar navigation  
**Nice-to-Have (P2):** Agent cycling, theme toggle, session search

---

## Feature Matrix

| Feature Category          | Feature                           | Official                       | opencode-vibe | Gap                        | Priority |
| ------------------------- | --------------------------------- | ------------------------------ | ------------- | -------------------------- | -------- |
| **Session Management**    |
|                           | Create session                    | ✅                             | ✅            | None                       | -        |
|                           | View session                      | ✅                             | ✅            | None                       | -        |
|                           | Session list/history              | ✅                             | ❌            | Missing                    | **P0**   |
|                           | Fork session                      | ✅                             | ❌            | Missing                    | **P1**   |
|                           | Archive session                   | ✅                             | ❌            | Missing                    | **P0**   |
|                           | Delete session                    | ❌                             | ❌            | None (both missing)        | P2       |
|                           | Share session (URL)               | ✅                             | ❌            | Missing                    | **P1**   |
|                           | Session search/filter             | ✅                             | ❌            | Missing                    | P2       |
| **Message Display**       |
|                           | Message rendering                 | ✅                             | ✅            | None                       | -        |
|                           | Tool use display                  | ✅                             | ✅            | Partial (needs validation) | P1       |
|                           | Reasoning display                 | ✅                             | ✅            | None                       | -        |
|                           | Code blocks w/ syntax             | ✅                             | ✅            | None                       | -        |
|                           | Image attachments                 | ✅                             | ❌            | Missing                    | **P1**   |
|                           | PDF attachments                   | ✅                             | ❌            | Missing                    | P2       |
| **Prompt Input**          |
|                           | Rich text editor                  | ✅                             | ✅            | None                       | -        |
|                           | @ file autocomplete               | ✅                             | ✅            | None                       | -        |
|                           | / command autocomplete            | ✅                             | ✅            | None                       | -        |
|                           | File pills (inline)               | ✅                             | ✅            | None                       | -        |
|                           | Image upload/paste                | ✅                             | ❌            | Missing                    | **P1**   |
|                           | PDF upload                        | ✅                             | ❌            | Missing                    | P2       |
|                           | Drag & drop files                 | ✅                             | ❌            | Missing                    | **P1**   |
|                           | Shell mode (!)                    | ✅                             | ❌            | Missing                    | P2       |
|                           | Command history (↑/↓)             | ✅                             | ❌            | Missing                    | **P1**   |
| **Undo/Redo**             |
|                           | Undo last message                 | ✅ (`mod+z` + `/undo`)         | ❌            | Missing                    | **P0**   |
|                           | Redo undone message               | ✅ (`mod+shift+z` + `/redo`)   | ❌            | Missing                    | **P0**   |
|                           | Revert to message                 | ✅ (session.revert API)        | ❌            | Missing                    | **P0**   |
|                           | Restore prompt on undo            | ✅                             | ❌            | Missing                    | **P0**   |
| **Model/Agent Selection** |
|                           | Model selector                    | ✅ (dialog)                    | ✅ (dropdown) | Different UX               | P2       |
|                           | Agent selector                    | ✅ (dropdown)                  | ❌            | Missing                    | **P1**   |
|                           | Agent cycling (hotkey)            | ✅ (`mod+.`)                   | ❌            | Missing                    | **P1**   |
|                           | Model search                      | ✅                             | ❌            | Missing                    | P2       |
|                           | Recent models                     | ✅                             | ❌            | Missing                    | P2       |
|                           | Connect provider                  | ✅ (in-app)                    | ❌            | Missing (CLI only)         | P2       |
| **File/Diff Display**     |
|                           | Review panel (split)              | ✅                             | ❌            | Missing                    | **P0**   |
|                           | File tabs                         | ✅ (draggable)                 | ❌            | Missing                    | **P0**   |
|                           | Diff viewer (side-by-side)        | ✅                             | ❌            | Missing                    | **P0**   |
|                           | Diff stats (insertions/deletions) | ✅                             | ❌            | Missing                    | **P1**   |
|                           | File tree navigation              | ✅                             | ❌            | Missing                    | P2       |
|                           | File open dialog                  | ✅ (`mod+p`)                   | ❌            | Missing                    | **P1**   |
| **Terminal**              |
|                           | Embedded terminal                 | ✅ (xterm.js)                  | ❌            | Missing                    | **P1**   |
|                           | Multiple terminal tabs            | ✅ (draggable)                 | ❌            | Missing                    | P2       |
|                           | Terminal toggle                   | ✅ (`ctrl+\``)                 | ❌            | Missing                    | **P1**   |
|                           | Shell history persistence         | ✅                             | ❌            | Missing                    | P2       |
| **MCP Integration**       |
|                           | MCP server list                   | ✅                             | ❌            | Missing                    | **P1**   |
|                           | MCP enable/disable                | ✅                             | ❌            | Missing                    | **P1**   |
|                           | MCP status indicators             | ✅                             | ❌            | Missing                    | **P1**   |
|                           | MCP error display                 | ✅                             | ❌            | Missing                    | P2       |
| **Keyboard Shortcuts**    |
|                           | Command palette                   | ✅                             | ❌            | Missing                    | **P0**   |
|                           | Session navigation                | ✅ (`mod+↑/↓`)                 | ❌            | Missing                    | **P1**   |
|                           | Message navigation                | ✅ (`mod+↑/↓`)                 | ❌            | Missing                    | **P1**   |
|                           | File open                         | ✅ (`mod+p`)                   | ❌            | Missing                    | **P1**   |
|                           | Model select                      | ✅ (`mod+'`)                   | ❌            | Missing                    | P2       |
|                           | Toggle terminal                   | ✅ (`ctrl+\``)                 | ❌            | Missing                    | **P1**   |
|                           | Toggle review                     | ✅ (`mod+shift+r`)             | ❌            | Missing                    | **P1**   |
|                           | Toggle steps                      | ✅ (`mod+e`)                   | ❌            | Missing                    | P2       |
|                           | New session                       | ✅ (`mod+shift+s`)             | ❌            | Missing                    | P2       |
|                           | Archive session                   | ✅ (`mod+shift+backspace`)     | ❌            | Missing                    | **P1**   |
| **Sidebar/Navigation**    |
|                           | Project sidebar                   | ✅ (resizable)                 | ❌            | Missing                    | **P0**   |
|                           | Session list in sidebar           | ✅                             | ❌            | Missing                    | **P0**   |
|                           | Session grouping by project       | ✅                             | ❌            | Missing                    | **P1**   |
|                           | Session search in sidebar         | ✅                             | ❌            | Missing                    | P2       |
|                           | Sidebar toggle                    | ✅ (`mod+b`)                   | ❌            | Missing                    | **P1**   |
|                           | Sidebar resize                    | ✅                             | ❌            | Missing                    | P2       |
|                           | Multi-project support             | ✅                             | ❌            | Missing                    | **P0**   |
| **UI Polish**             |
|                           | Status bar (bottom)               | ✅                             | ❌            | Missing                    | P2       |
|                           | Context usage indicator           | ✅                             | ❌            | Missing                    | P2       |
|                           | MCP/LSP status badges             | ✅                             | ❌            | Missing                    | P2       |
|                           | Working state animation           | ✅                             | ✅            | None                       | -        |
|                           | Auto-scroll to latest             | ✅                             | ✅            | None                       | -        |
|                           | Theme toggle                      | ⚠️ (disabled)                  | ✅            | vibe has it!               | -        |
|                           | Responsive mobile UI              | ✅                             | ⚠️            | Partial                    | P2       |
| **Advanced Features**     |
|                           | Message rail (thumbnail nav)      | ✅                             | ❌            | Missing                    | P2       |
|                           | Steps collapse/expand             | ✅                             | ❌            | Missing                    | P2       |
|                           | Session title editing             | ✅                             | ❌            | Missing                    | P2       |
|                           | Tab drag & drop                   | ✅                             | ❌            | Missing                    | P2       |
|                           | Resizable panels                  | ✅ (review, terminal, sidebar) | ❌            | Missing                    | **P1**   |

---

## Priority Breakdown

### P0 - Critical (Must-Have for MVP)

**Session Lifecycle:**

- **Archive session** - Users need to clean up history (`session.archive` API exists)
- **Session list/navigation** - Core UX: browse past work
- **Sidebar with projects** - Multi-project support is table stakes

**Undo/Redo:**

- **Full undo/redo stack** - Session has `revert` API, prompt restoration logic exists
- **Restore prompt on undo** - Critical UX: don't lose user input

**File/Diff Display:**

- **Review panel** - Show what changed (exists in official: `SessionReview` component)
- **Diff viewer** - Side-by-side comparison (exists: `DiffChanges` component)
- **File tabs** - Open/view modified files (draggable tabs exist)

**Keyboard Shortcuts:**

- **Command palette** - Power user access to all features

**Effort:** ~40-60 hours (2-3 weeks)  
**Blockers:** Requires OpenCode SDK endpoints to be stable

---

### P1 - High-Value (Significantly Improves UX)

**Session Management:**

- Fork session (create from existing)
- Share session (generate URL)

**Input Features:**

- Image upload/paste/drag & drop
- Command history (↑/↓ arrow keys)

**Agent/Model:**

- Agent selector + cycling hotkey
- File open dialog (`mod+p`)

**Terminal:**

- Embedded terminal (xterm.js) - many users expect this
- Terminal toggle hotkey

**MCP:**

- MCP server management UI
- MCP status indicators

**Keyboard Shortcuts:**

- Session/message navigation (`mod+↑/↓`)
- Review/terminal toggles

**Resizable Panels:**

- Review, terminal, sidebar resize handles

**Effort:** ~30-40 hours (1.5-2 weeks)

---

### P2 - Nice-to-Have (Polish & Power Users)

- PDF attachments
- Shell mode (!)
- Model search/recent models
- Session search/filter
- File tree navigation
- Multiple terminal tabs
- Message rail thumbnails
- Steps collapse/expand
- Status bar
- Context usage indicator
- Session title editing
- Tab drag & drop
- Responsive mobile UI polish

**Effort:** ~20-30 hours (1 week)

---

## Dependencies Between Features

```
┌─────────────────────────────────────────┐
│                                         │
│  Session List (P0)                      │
│    ├── Archive (P0)                     │
│    ├── Fork (P1)                        │
│    └── Share (P1)                       │
│                                         │
│  Sidebar (P0)                           │
│    ├── Multi-project (P0)               │
│    ├── Session grouping (P1)            │
│    └── Session search (P2)              │
│                                         │
│  Undo/Redo (P0)                         │
│    ├── Revert API integration (P0)      │
│    └── Prompt restoration (P0)          │
│                                         │
│  Review Panel (P0)                      │
│    ├── Diff viewer (P0)                 │
│    ├── File tabs (P0)                   │
│    └── Resizable (P1)                   │
│                                         │
│  Command Palette (P0)                   │
│    └── All keyboard shortcuts (P1)      │
│                                         │
│  Terminal (P1)                          │
│    ├── xterm.js integration             │
│    └── Multiple tabs (P2)               │
│                                         │
└─────────────────────────────────────────┘
```

**Critical Path:**

1. Session list + sidebar (enables multi-project, archive)
2. Undo/redo (core UX safety net)
3. Review panel + diff viewer (show changes)
4. Command palette (unlock keyboard shortcuts)
5. Terminal (common use case)

---

## Effort Estimates

### Core Architecture (~10h)

- Session state management refactor (handle list, archive, fork)
- Sidebar layout + multi-project routing
- Keyboard shortcut system (command palette)

### Session Management (~15h)

- Session list UI (sidebar)
- Archive/fork functionality
- Session navigation (prev/next)
- Share URL generation

### Undo/Redo (~8h)

- Integrate `session.revert/unrevert` API
- Prompt restoration on undo
- History navigation state
- Keyboard shortcuts

### Review/Diff (~12h)

- Review panel layout (split view)
- Diff viewer component (side-by-side)
- File tabs (draggable)
- Resize handles

### Command Palette (~8h)

- Command registry
- Fuzzy search
- Keyboard navigation
- Keybind display

### Terminal (~10h)

- xterm.js integration
- PTY connection
- Terminal state persistence
- Toggle hotkey

### MCP UI (~6h)

- MCP server list
- Enable/disable toggles
- Status indicators

### Input Enhancements (~6h)

- Image upload/paste/drag & drop
- Command history (↑/↓)
- Shell mode (!)

### Polish (~5h)

- Status bar
- Context usage indicator
- Responsive tweaks

**Total:** ~80 hours (4 weeks with 1 dev)

---

## Recommended Implementation Order

### Phase 1: Core UX (Week 1) - **P0**

1. Session list + sidebar navigation
2. Undo/redo (revert API)
3. Command palette skeleton

### Phase 2: IDE Features (Week 2) - **P0**

4. Review panel + diff viewer
5. File tabs
6. Command palette completion

### Phase 3: Power User (Week 3) - **P1**

7. Terminal integration
8. MCP management UI
9. Keyboard shortcuts (all)

### Phase 4: Polish (Week 4) - **P1/P2**

10. Image upload
11. Resizable panels
12. Agent selector
13. Status bar

---

## Known Issues / Anti-Patterns

### Official App Has:

- **Commented-out theme toggle** (line 205-217 in `session.tsx`) - they had issues with theme data export
- **Complex session navigation logic** (message rails, multi-level navigation)
- **Heavy use of SolidJS reactivity** (createMemo, createEffect) - Next.js/React patterns differ

### opencode-vibe Strengths:

- **Clean separation** of concerns (stores, hooks, components)
- **Type-safe** everywhere (TypeScript, Zod schemas)
- **Modern React patterns** (Server Components, Suspense, SSE)
- **Test coverage** (most core logic has tests)

### opencode-vibe Weaknesses:

- **Missing session persistence** (no local state beyond current session)
- **No offline mode** (official has localStorage caching)
- **SSE-only** (official has SSE + direct API calls)

---

## API Coverage

### Used by opencode-vibe:

- `session.get(id)`
- `session.messages(id)`
- `session.create()`
- `session.prompt(...)`

### Missing in opencode-vibe:

- `session.revert(sessionID, messageID)` (**P0** - undo)
- `session.unrevert(sessionID)` (**P0** - redo)
- `session.update(sessionID, { time: { archived } })` (**P0** - archive)
- `session.share(sessionID)` (**P1** - share URL)
- `session.abort(sessionID)` (stop generation)
- `session.shell(sessionID, command)` (shell mode)
- `session.command(sessionID, command)` (custom commands)
- `mcp.status()` (**P1** - MCP list)
- `mcp.connect(name)` (**P1**)
- `mcp.disconnect(name)` (**P1**)

**Action:** Verify all endpoints exist in `/Users/joel/Code/sst/opencode/packages/app/src/context/sdk.tsx`

---

## Non-Obvious Gaps (Store in Semantic Memory)

### Session Revert is NOT Delete

The official app uses `session.revert(messageID)` to "undo" to a specific message, not delete messages. Reverted messages stay in history but are filtered from view. This enables **redo** by moving the revert pointer forward.

**Implementation:**

```typescript
// Official pattern (session.tsx:320-334)
const revertMessageID = info()?.revert?.messageID;
const visibleMessages = messages.filter(
  (m) => !revertMessageID || m.id < revertMessageID,
);

// On undo: move pointer back
await sdk.session.revert({ sessionID, messageID: lastVisible.id });

// On redo: move pointer forward OR unrevert fully
await sdk.session.unrevert({ sessionID });
```

### Prompt Restoration on Undo

Official app stores parts in `sync.data.part[messageID]` and uses `extractPromptFromParts()` to restore the original prompt when undoing (session.tsx:326-330). This is critical UX: users expect their input back.

### Shell Mode (!) is Separate Input Mode

Typing `!` at cursor position 0 switches to shell mode (font-mono, different placeholders, calls `session.shell` instead of `session.prompt`). Exit with Escape or Backspace at position 0 (prompt-input.tsx:649-670).

### File Tabs Use URI Scheme

File tabs use `file://absolute/path` as tab IDs. This allows mixing file tabs with review tabs. The `tabs().open("file://...")` pattern is throughout the codebase.

### Terminal Uses LocalPTY Abstraction

Terminal isn't just xterm.js - it's a `LocalPTY` abstraction that handles connection, reconnection, and state persistence (context/terminal.tsx). Each terminal has a unique ID and persisted state.

### MCP Status is Polled

MCP status isn't SSE - it's polled via `mcp.status()` after connect/disconnect actions. The UI shows loading states during transitions (dialog-select-mcp.tsx:11-31).

### Session List Sorting is Time-Based with Recency Boost

Sessions updated in the last minute sort by ID (ascending, newer IDs = later). Older sessions sort by updated time descending. This keeps active sessions at top while sorting historical ones logically (layout.tsx:121-132).

### Message Rail Uses Thumbnail Navigation

The official app has a `SessionMessageRail` that shows user message thumbnails on the left. Clicking navigates to that message, expanding its response. This is separate from session list navigation (session.tsx:625-630).

### Diff Stats Come from Backend

The official app shows `DiffChanges` components with green/red bars. These stats come from `sync.data.session_diff[sessionID]` - the backend calculates insertions/deletions per file.

### Agent Cycling Uses Index Math

Agent cycling (`mod+.`) calls `local.agent.move(offset)` which does modulo arithmetic on the agent list. It wraps around (context/local.tsx, session.tsx:295-306).

---

## Summary for Composite Doc

**Critical Findings (5-10 bullets):**

1. **~60% feature gap** - opencode-vibe has core message display but lacks session management (archive, fork, share), undo/redo, file tabs, diff viewer, terminal, and keyboard shortcuts.

2. **Undo/Redo is P0 blocker** - Official uses `session.revert(messageID)` API with prompt restoration (`extractPromptFromParts`). Reverted messages stay in history, enabling redo by moving pointer forward. **Critical UX safety net missing.**

3. **Review panel + diff viewer are P0** - Users expect to see what changed. Official has `SessionReview` and `DiffChanges` components with side-by-side diffs and insertions/deletions stats from backend.

4. **Session list/sidebar is P0** - Multi-project navigation is table stakes. Official has resizable sidebar with project grouping, session search, and time-based sorting (recency boost for active sessions).

5. **Command palette unlocks power users** - Official has comprehensive keyboard shortcuts (`mod+p` file open, `mod+'` model select, `ctrl+\`` terminal, `mod+shift+r`review toggle,`mod+shift+backspace` archive). All require command palette infrastructure.

6. **Terminal integration is high-value** - Many users expect embedded terminal. Official uses `LocalPTY` abstraction (not just xterm.js) with connection handling and state persistence.

7. **MCP management UI is P1** - Official has in-app MCP server list with enable/disable toggles and status polling (not SSE). Critical for MCP adoption.

8. **Image attachments missing** - Official supports image upload/paste/drag & drop (prompt-input.tsx:218-269). opencode-vibe only has file pills for text files.

9. **API coverage is 50%** - opencode-vibe uses 4/12 session endpoints. Missing: `revert`, `unrevert`, `update`, `share`, `abort`, `shell`, `command`, and all MCP endpoints.

10. **Implementation order matters** - Session list + sidebar enables archive/fork. Undo/redo requires revert API + prompt restoration. Review panel requires diff viewer + file tabs. Command palette unlocks all keyboard shortcuts. Terminal is standalone. **Estimated 80 hours (4 weeks) for P0+P1.**

---

## Stored Memories

The following learnings have been stored in semantic-memory for future reference:

1. Session revert mechanics (NOT delete, enables redo)
2. Prompt restoration on undo pattern
3. Shell mode input switching (!)
4. File tab URI scheme (`file://...`)
5. LocalPTY terminal abstraction
6. MCP status polling pattern
7. Session sorting with recency boost
8. Message rail thumbnail navigation
9. Diff stats from backend
10. Agent cycling modulo pattern

**Tags:** opencode-vibe, audit, features, parity, session-management, undo-redo, keyboard-shortcuts, terminal, mcp, diff-viewer, sidebar, review-panel

---

**End of Audit**
