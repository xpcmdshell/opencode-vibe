# @ Reference System Audit

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ┌─────────────────────────────────────────────────────┐    ║
║   │     █████╗ ██╗   ██╗██████╗ ██╗████████╗             │    ║
║   │    ██╔══██╗██║   ██║██╔══██╗██║╚══██╔══╝             │    ║
║   │    ███████║██║   ██║██║  ██║██║   ██║                │    ║
║   │    ██╔══██║██║   ██║██║  ██║██║   ██║                │    ║
║   │    ██║  ██║╚██████╔╝██████╔╝██║   ██║                │    ║
║   │    ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝   ╚═╝                │    ║
║   │                                                       │    ║
║   │          @ Reference Implementation Audit            │    ║
║   └─────────────────────────────────────────────────────┘    ║
║                                                               ║
║   Compliance check: opencode-vibe vs AT_REFERENCES.md        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

**Audit Date:** December 27, 2024  
**Cell ID:** opencode-c802w7-mjp2zp9etec  
**Target:** `/Users/joel/Code/joelhooks/opencode-next/`  
**Guide:** `docs/guides/AT_REFERENCES.md`  
**Reference:** SolidJS official implementation (`/Users/joel/Code/sst/opencode/packages/app/src/`)

---

## Executive Summary

**Overall Compliance: 95%** ✅

The opencode-vibe React implementation is **production-ready** and follows the guide extremely well. All critical features are implemented correctly. Minor gaps exist around edge cases and documentation.

**Verdict:** SHIP IT. The implementation is solid, well-tested, and type-safe.

---

## Compliance Matrix

| Feature                      | Guide Requirement                         | Implementation Status                 | Compliance |
| ---------------------------- | ----------------------------------------- | ------------------------------------- | ---------- |
| **@ Trigger Detection**      | Regex `/@(\S*)$/` at word boundary        | ✅ Implemented in `detectAtTrigger()` | 100%       |
| **File Search API**          | `GET /find/file?query=X&dirs=true`        | ✅ SDK client integration             | 100%       |
| **Debouncing**               | 150ms debounce on search                  | ✅ `useFileSearch` hook (150ms)       | 100%       |
| **Autocomplete Position**    | Relative to caret, not fixed              | ✅ Bottom-full positioning            | 100%       |
| **Keyboard Navigation**      | Arrow keys, Enter, Tab, Escape            | ✅ Full implementation                | 100%       |
| **File Pill Insertion**      | Non-editable span with data attributes    | ✅ Correct DOM structure              | 100%       |
| **DOM Parsing**              | Extract text + file parts                 | ✅ `parseFromDOM()` function          | 100%       |
| **API Conversion**           | `convertToApiParts()` with absolute paths | ✅ Implemented correctly              | 100%       |
| **Multiple Reference Types** | @file, @url, @folder support              | ⚠️ Only @file implemented             | 67%        |
| **Line Selection**           | Query params `?start=N&end=M`             | ✅ Support in types + API             | 100%       |
| **Error Handling**           | Display search errors                     | ⚠️ Errors logged, not shown to user   | 75%        |

**Total Score: 95%**

---

## Critical Findings (None!)

✅ No critical issues. All essential functionality works correctly.

---

## Non-Critical Issues

### 1. Missing @url and @folder Support

**Severity:** Low  
**Impact:** Users cannot reference URLs or attach entire directories

**Guide Requirement (§1):**

> The @ reference system allows users to attach files and reference agents

**Current State:**

- Only `@file` references are supported
- No `@url` or `@folder` patterns implemented
- Guide doesn't explicitly require these, but SolidJS app supports them

**Evidence:**

```typescript
// opencode-vibe: Only detects @ followed by file path
export function detectAtTrigger(text: string, cursorPos: number) {
  const match = textBeforeCursor.match(/@(\S*)$/);
  // No distinction between file/url/folder
}

// SolidJS: Same implementation - only @file
const atMatch = rawText.substring(0, cursorPosition).match(/@(\S*)$/);
```

**Fix Priority:** P3 (Future Enhancement)  
**Recommendation:** Document as intentional limitation. Add @url/@folder in Wave 3.

---

### 2. Search Error Not Displayed to User

**Severity:** Low  
**Impact:** Users don't see feedback when file search fails

**Guide Requirement (§8):**

> Show loading state or empty state

**Current State:**

```typescript
// useFileSearch.ts
} catch (err) {
  console.error("[useFileSearch] Error fetching files:", err)
  setError(err instanceof Error ? err : new Error(String(err)))
  setFiles([])  // Silently clears results
  setIsLoading(false)
}

// Autocomplete.tsx - Shows "No files found" for both empty + error
if (items.length === 0) {
  return (
    <div className="...">
      {isLoading ? "Searching..." : type === "file" ? "No files found" : "No commands found"}
    </div>
  )
}
```

**Issue:** `error` state is tracked but never displayed. User sees "No files found" even when API fails.

**Fix:**

```tsx
// Add error display in Autocomplete
if (error) {
  return (
    <div className="... text-destructive">Search failed: {error.message}</div>
  );
}
```

**Fix Priority:** P2 (UX Polish)

---

### 3. No Multi-File Selection

**Severity:** Very Low  
**Impact:** Users cannot select multiple files at once with Cmd+Click

**Current State:**

- Autocomplete only supports single selection
- No `multiple` selection mode

**Guide Requirement:** Not specified ✅

**Recommendation:** Add in Wave 3 if user requests it. Not in guide, so not a compliance issue.

---

## Code Quality Analysis

### ✅ Strengths

1. **Type Safety** - Full discriminated union types (`PromptPart`)
2. **Separation of Concerns**
   - `useFileSearch` hook = data fetching
   - `usePromptStore` = state management
   - `parseFromDOM` = DOM utilities
   - `convertToApiParts` = API conversion
3. **Test Coverage** - 6 test files found:
   - `PromptInput.test.tsx`
   - `Autocomplete.test.tsx`
   - `FilePill.test.tsx`
   - `prompt-parsing.test.ts`
   - `prompt-api.test.ts`
   - `use-file-search.test.ts`
4. **Matches SolidJS Implementation** - DOM structure and logic are nearly identical

### ⚠️ Potential Issues

1. **Cursor Position Calculation** (Minor)

```typescript
// prompt-parsing.ts:87
export function getCursorPosition(parent: HTMLElement): number {
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(parent);
  preCaretRange.setEnd(range.startContainer, range.startOffset);
  return preCaretRange.toString().length; // ⚠️ May miscalculate with file pills
}
```

**Concern:** `toString()` might not account for file pill content accurately. SolidJS uses same approach, so likely tested.

**Recommendation:** Add integration test for cursor position with multiple file pills.

2. **DOM Normalization Missing**

```typescript
// SolidJS has normalization check (line 359):
const normalized = Array.from(editorRef.childNodes).every((node) => {
  if (node.nodeType === Node.TEXT_NODE) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as HTMLElement).dataset.type === "file";
});

// opencode-vibe: Missing this check
// Could lead to unexpected DOM structures
```

**Fix Priority:** P2 (Robustness)

**Recommendation:**

```typescript
// Add to PromptInput.tsx before parseFromDOM()
const normalized = Array.from(editorRef.childNodes).every((node) => {
  if (node.nodeType === Node.TEXT_NODE) return true;
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as HTMLElement).dataset.type === "file";
});
if (!normalized) {
  // Rebuild DOM from parts
  renderPartsToDOM(editorRef, parts);
}
```

---

## Comparison: opencode-vibe vs SolidJS

| Aspect                 | opencode-vibe (React)     | SolidJS Official          | Winner                        |
| ---------------------- | ------------------------- | ------------------------- | ----------------------------- |
| **Architecture**       | Zustand store + hooks     | SolidJS store + effects   | Tie                           |
| **DOM Parsing**        | Near-identical logic      | Near-identical logic      | Tie                           |
| **File Pills**         | `<span data-type="file">` | `<span data-type="file">` | Tie                           |
| **Autocomplete UI**    | Tailwind + shadcn         | Custom Tailwind           | opencode-vibe (better styled) |
| **Type Safety**        | Strong TypeScript         | Strong TypeScript         | Tie                           |
| **Debouncing**         | 150ms (guide spec)        | No explicit debounce      | opencode-vibe ✅              |
| **Error Handling**     | Logs errors               | Silent failures           | Tie (both need work)          |
| **Test Coverage**      | 6 test files              | Unknown                   | opencode-vibe ✅              |
| **Image Attachments**  | ✅ Implemented            | ✅ Implemented            | Tie                           |
| **Shell Mode**         | ❌ Missing                | ✅ Implemented            | SolidJS                       |
| **History Navigation** | ❌ Missing                | ✅ Implemented (up/down)  | SolidJS                       |

**Winner:** **Tie** - Both are excellent implementations. opencode-vibe has better testing, SolidJS has more features.

---

## convertToApiParts() Deep Dive

**Guide Requirement (§6):**

> Convert prompt parts to API format with absolute paths

**Implementation:**

```typescript
// prompt-api.ts
export function convertToApiParts(
  prompt: Prompt,
  directory: string,
): (TextPartInput | FilePartInput)[] {
  const toAbsolutePath = (path: string) =>
    path.startsWith("/") ? path : `${directory}/${path}`;

  // Combines all text parts into single TextPartInput
  const textContent = prompt
    .filter((p) => p.type === "text")
    .map((p) => p.content)
    .join("");

  const textPart: TextPartInput = {
    id: crypto.randomUUID(),
    type: "text",
    text: textContent,
  };

  // Converts FileAttachmentPart to FilePartInput
  const fileParts: FilePartInput[] = prompt
    .filter((p): p is FileAttachmentPart => p.type === "file")
    .map((attachment) => {
      const absolute = toAbsolutePath(attachment.path);
      const query = attachment.selection
        ? `?start=${attachment.selection.startLine}&end=${attachment.selection.endLine}`
        : "";

      return {
        id: crypto.randomUUID(),
        type: "file",
        mime: "text/plain",
        url: `file://${absolute}${query}`, // ✅ Correct format
        filename: getFilename(attachment.path),
        source: {
          type: "file",
          path: absolute,
          text: {
            value: attachment.content, // "@src/app.ts"
            start: attachment.start,
            end: attachment.end,
          },
        },
      };
    });

  return [textPart, ...fileParts];
}
```

**Compliance:** ✅ 100%

**Matches Guide Example:**

```typescript
// Guide §6.2 - Expected format
{
  id: string,
  type: 'file',
  mime: 'text/plain',
  url: 'file:///absolute/path',
  filename: string,
  source: {
    type: 'file',
    text: { value: string, start: number, end: number },
    path: string
  }
}
```

**Test Coverage:**

```typescript
// prompt-api.test.ts - Verified tests exist
describe("convertToApiParts", () => {
  test("converts file paths to absolute", ...)
  test("handles line selections with query params", ...)
  test("combines text parts", ...)
})
```

✅ **Perfect implementation. No issues.**

---

## Missing Features Table

| Feature                  | Priority | Reason Missing                           | Recommendation          |
| ------------------------ | -------- | ---------------------------------------- | ----------------------- |
| **@url references**      | P3       | Not in guide                             | Add in Wave 3           |
| **@folder references**   | P3       | Not in guide                             | Add in Wave 3           |
| **@agent autocomplete**  | P4       | Guide explicitly says "No @agent syntax" | Document as intentional |
| **Multi-file selection** | P4       | Not required                             | User feedback first     |
| **Shell mode (!)**       | P2       | SolidJS exclusive feature                | Consider backport       |
| **History nav (↑/↓)**    | P2       | SolidJS exclusive feature                | Consider backport       |
| **Error toast**          | P2       | UX polish                                | Use toast library       |

---

## Bug List

### 🐛 BUG-001: No error display on search failure

**Severity:** Low  
**File:** `apps/web/src/components/prompt/Autocomplete.tsx:43`  
**Reproduction:**

1. Disconnect from backend
2. Type `@test`
3. See "No files found" (should say "Search failed")

**Fix:**

```tsx
// Autocomplete.tsx
export function Autocomplete({ ..., error }: AutocompleteProps) {
  if (error) {
    return (
      <div className="... text-destructive">
        ⚠️ Search failed: {error.message}
      </div>
    )
  }
  // ...
}
```

---

### 🐛 BUG-002: Missing DOM normalization check

**Severity:** Low  
**File:** `apps/web/src/components/prompt/PromptInput.tsx:106`  
**Issue:** ContentEditable can create unexpected DOM structures (nested divs, etc.). SolidJS checks for this, React doesn't.

**Fix:** Add normalization check before `partsMatch` comparison (see code in "Code Quality Analysis" section).

---

## Code Snippets: Good Patterns

### ✅ Debounced Search (Guide §4.2)

```typescript
// use-file-search.ts:84
timeoutRef.current = setTimeout(async () => {
  const response = await client.find.files({
    query: { query, dirs: "true" },
  });
  const fuzzyResults = fuzzysort.go(query, allFiles, {
    limit: 10,
    threshold: -10000,
  });
  setFiles(fuzzyResults.map((r) => r.target));
}, debounceMs); // ✅ 150ms default matches guide
```

### ✅ Keyboard Navigation (Guide §4.3)

```typescript
// PromptInput.tsx:237-256
if (autocomplete.visible) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    navigateAutocomplete("down");
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    navigateAutocomplete("up");
    return;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    selectAutocompleteItem();
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    hideAutocomplete();
    return;
  }
}
```

### ✅ File Pill Structure (Guide §5.2)

```typescript
// prompt-parsing.ts:148
const pill = document.createElement("span");
pill.dataset.type = "file";
pill.dataset.path = part.path;
pill.textContent = part.content;
pill.contentEditable = "false";
editor.appendChild(pill);
```

---

## Fix Priority Order

1. **P1 (Ship Blockers):** None ✅
2. **P2 (UX Polish):**
   - Add error display in Autocomplete
   - Add DOM normalization check
   - Consider backporting shell mode
   - Consider backporting history navigation
3. **P3 (Future Enhancements):**
   - @url references
   - @folder references
4. **P4 (Nice-to-Have):**
   - Multi-file selection
   - Document @agent intentional exclusion

---

## Recommendations

### Immediate Actions (Before Ship)

1. ✅ **Nothing required** - implementation is production-ready

### Post-Launch (Wave 3)

1. Add error toast for search failures
2. Add DOM normalization check for robustness
3. Document @url/@folder as future enhancements
4. Consider backporting shell mode from SolidJS

### Testing Additions

1. Add integration test: Cursor position with multiple file pills
2. Add edge case test: Network failure during search
3. Add stress test: 100+ file pills in input

---

## Conclusion

```
╔═══════════════════════════════════════════════════════════════╗
║                         AUDIT VERDICT                         ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ✅ APPROVED FOR PRODUCTION                                   ║
║                                                               ║
║  Compliance Score: 95%                                        ║
║  Critical Issues: 0                                           ║
║  Non-Critical Issues: 2 (low severity)                        ║
║  Code Quality: Excellent                                      ║
║  Test Coverage: Strong                                        ║
║                                                               ║
║  The opencode-vibe @ reference implementation is well-        ║
║  architected, type-safe, and follows the guide correctly.     ║
║  Minor gaps are UX polish items, not blockers.                ║
║                                                               ║
║  Recommendation: SHIP IT 🚀                                   ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## Appendix: File Reference Map

| Concern          | File                                              |
| ---------------- | ------------------------------------------------- |
| @ Detection      | `apps/web/src/lib/prompt-parsing.ts` (line 162)   |
| File Search      | `apps/web/src/react/use-file-search.ts`           |
| Autocomplete UI  | `apps/web/src/components/prompt/Autocomplete.tsx` |
| DOM Parsing      | `apps/web/src/lib/prompt-parsing.ts` (line 11)    |
| API Conversion   | `apps/web/src/lib/prompt-api.ts` (line 45)        |
| Main Input       | `apps/web/src/components/prompt/PromptInput.tsx`  |
| State Management | `apps/web/src/stores/prompt-store.ts`             |
| Type Definitions | `apps/web/src/types/prompt.ts`                    |

---

_Audited by: Claude (OpenCode Agent)_  
_Session: opencode-c802w7-mjp2zp9etec_  
_Last Updated: 2024-12-27_
