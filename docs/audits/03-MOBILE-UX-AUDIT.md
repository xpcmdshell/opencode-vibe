# Mobile UX Audit - OpenCode Vibe

```
     📱
    ╱  ╲
   ╱ 🔍 ╲  "WHERE'S THE SAFE AREA?"
  ╱______╲
  │ [  ] │  "WHY NO HAPTICS?"
  │ [  ] │  "SERVICE WHAT NOW?"
  │ [  ] │
  │  ⚪  │  < sad iPhone with notch
  └──────┘
```

**Date:** 2025-12-27  
**Cell:** opencode-c802w7-mjp2zp9bqvk  
**Auditor:** WarmWolf  
**Sources:**

- opencode-vibe codebase @ `/Users/joel/Code/joelhooks/opencode-next/`
- `MOBILE_CLIENT_IMPLEMENTATION.md` guide
- Semantic memory (Mobile PWA Feasibility, Mobile MVP)

---

## Executive Summary

**Mobile UX Score: 3.5/10**

opencode-vibe has **excellent foundational work** (PWA manifest, responsive layout, mobile meta tags, fetch-based SSE) but **critical mobile-specific features are missing**. The app is installable but not mobile-optimized. "Couch coding" experience is degraded by:

- ❌ No service worker (offline, background sync, push notifications)
- ❌ No safe-area CSS (content hides under notch/home indicator)
- ❌ No Visibility API (SSE doesn't reconnect when app returns from background)
- ❌ No bottom navigation (thumb-unfriendly top nav only)
- ❌ No touch gestures (swipe, pull-to-refresh, haptics)
- ❌ No offline message queueing
- ✅ PWA manifest (installable, app icons, shortcuts)
- ✅ Fetch-based SSE with exponential backoff
- ✅ Mobile meta tags (viewport-fit, apple-web-app)
- ✅ Responsive layout (`max-w-full`, `overflow-hidden`)

**Key Finding:** The guide (`MOBILE_CLIENT_IMPLEMENTATION.md`) documents mobile patterns extensively (Section 9), but **implementation stopped after basic PWA setup**. The SSE reconnection logic exists but **ignores page visibility**, causing unnecessary reconnects and battery drain.

---

## Research Question Answers

| Question                                    | Answer         | Evidence                                                                                                                                                                |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Visibility API for SSE reconnection?** | ❌ **NO**      | `use-sse.tsx` has reconnection logic but no `document.visibilitychange` listener. Guide Section 9.3 documents the pattern but not implemented.                          |
| **2. Safe-area CSS variables?**             | ❌ **NO**      | `globals.css` has no `env(safe-area-inset-*)` usage. `layout.tsx` sets `viewport-fit: cover` but no padding compensation. Content will hide under notch/home indicator. |
| **3. Bottom navigation?**                   | ❌ **NO**      | `session-layout.tsx` has fixed bottom prompt input but no navigation tabs. Top-only nav requires reaching across screen.                                                |
| **4. Service worker?**                      | ❌ **NO**      | No `sw.js`, `sw.ts`, or service worker registration found. Guide Section 9.2 documents IndexedDB offline patterns but not implemented.                                  |
| **5. Touch gestures?**                      | ❌ **NO**      | No swipe, pull-to-refresh, or gesture handlers. `scroll-area.tsx` has `touch-none` (disables touch).                                                                    |
| **6. Haptic feedback?**                     | ❌ **NO**      | No `navigator.vibrate()` calls. No tactile feedback on actions.                                                                                                         |
| **7. Virtual keyboard handling?**           | ⚠️ **PARTIAL** | `layout.tsx` prevents zoom on input focus, but no `visualViewport` listeners for keyboard resize.                                                                       |
| **8. Offline message queueing?**            | ❌ **NO**      | Guide Section 9.2 documents `pendingMutations` IndexedDB store, but not implemented.                                                                                    |

---

## Missing Features (Priority Order)

### Priority 0 (Critical - Breaks Mobile Experience)

| Feature                         | Impact                                                       | Effort | Why Critical                                                  |
| ------------------------------- | ------------------------------------------------------------ | ------ | ------------------------------------------------------------- |
| **Safe-area insets**            | Content hides under notch/home indicator on iPhone X+        | 1 hour | Users can't see/tap bottom actions. Immediate UX degradation. |
| **Visibility API reconnection** | SSE reconnects even when app is backgrounded, drains battery | 30 min | Battery drain, wasted API calls, poor backgrounding behavior. |

### Priority 1 (High - Degrades Mobile UX)

| Feature                              | Impact                                       | Effort    | Why High Priority                                                    |
| ------------------------------------ | -------------------------------------------- | --------- | -------------------------------------------------------------------- |
| **Service worker + offline caching** | App doesn't work offline, no background sync | 4-6 hours | Core PWA capability. Without this, it's just a website with an icon. |
| **Bottom navigation tabs**           | Thumb-unfriendly top nav requires reaching   | 2 hours   | Mobile ergonomics. Top nav unusable one-handed.                      |
| **Offline message queue**            | Prompts fail silently when offline           | 2 hours   | Data loss. Users expect queued sends like native messaging apps.     |

### Priority 2 (Medium - Nice to Have)

| Feature                     | Impact                               | Effort  | Why Medium Priority                                |
| --------------------------- | ------------------------------------ | ------- | -------------------------------------------------- |
| **Pull-to-refresh**         | No native mobile gesture for refresh | 1 hour  | Expected mobile pattern, but manual refresh works. |
| **Haptic feedback**         | No tactile confirmation on actions   | 1 hour  | Polish, not critical. Visual feedback exists.      |
| **Swipe gestures**          | No swipe to dismiss/navigate         | 2 hours | Nice polish, but buttons work.                     |
| **Virtual keyboard resize** | Layout doesn't adapt to keyboard     | 2 hours | Annoying but input still usable.                   |

### Priority 3 (Low - Future Enhancements)

| Feature                | Impact                                     | Effort    | Why Low Priority                                               |
| ---------------------- | ------------------------------------------ | --------- | -------------------------------------------------------------- |
| **Push notifications** | No agent completion alerts when app closed | 6-8 hours | Requires backend, service worker. High effort, niche use case. |
| **Biometric auth**     | No fingerprint/face unlock                 | 4 hours   | No auth system exists yet.                                     |

---

## Quick Wins (< 2 Hours Each)

### 1. Safe-Area Insets (1 hour)

**Problem:** Content hides under iPhone notch and home indicator.

**Fix:**

```css
/* globals.css */
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

/* session-layout.tsx - fixed bottom prompt */
.prompt-input-fixed {
  bottom: calc(1rem + var(--safe-area-bottom));
}
```

**Validation:** Test on iPhone X+ simulator or physical device with notch.

---

### 2. Visibility API SSE Reconnection (30 min)

**Problem:** SSE reconnects even when app is backgrounded, draining battery.

**Fix:**

```typescript
// use-sse.tsx (add to useSSEDirect)
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      // App returned to foreground - reconnect
      connect();
    } else {
      // App went to background - abort connection
      abortController.current?.abort();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () =>
    document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [connect]);
```

**Validation:** Background app, wait 30s, bring to foreground. SSE should reconnect only on foreground.

---

### 3. Pull-to-Refresh (1 hour)

**Problem:** No native gesture to refresh session/messages.

**Fix:**

```typescript
// session-messages.tsx
import { useEffect, useRef } from "react";

function usePullToRefresh(onRefresh: () => void) {
  const startY = useRef(0);
  const pullDistance = useRef(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0) return;
      pullDistance.current = e.touches[0].clientY - startY.current;

      // Trigger refresh if pulled >80px
      if (pullDistance.current > 80) {
        onRefresh();
        startY.current = 0;
        pullDistance.current = 0;
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [onRefresh]);
}
```

**Validation:** Pull down from top of messages. Should trigger refresh animation.

---

### 4. Haptic Feedback (1 hour)

**Problem:** No tactile confirmation on button presses.

**Fix:**

```typescript
// lib/haptics.ts
export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (!navigator.vibrate) return;

  const patterns = {
    light: [10],
    medium: [20],
    heavy: [30, 10, 30],
  };

  navigator.vibrate(patterns[type]);
}

// Usage in button components
<Button onClick={() => {
  haptic('light');
  handleAction();
}}>
```

**Validation:** Tap buttons on iOS/Android. Should feel subtle vibration.

---

## CSS/Layout Issues

### Issue 1: No Safe-Area Compensation

**File:** `apps/web/src/app/globals.css`  
**Line:** Missing (should be added to `:root`)

**Problem:**

- `layout.tsx` sets `viewport-fit: cover` (allows content under notch)
- But no `padding` or `env(safe-area-inset-*)` compensation
- Bottom prompt input will hide under home indicator
- Top nav will hide under notch

**Visual Description:**

```
┌──────────────────┐
│  [NOTCH AREA]   │ <- Content hidden here
├──────────────────┤
│                  │
│   VISIBLE AREA   │
│                  │
├──────────────────┤
│ [HOME INDICATOR] │ <- Button hidden here
└──────────────────┘
```

**Fix:** Add safe-area CSS variables (see Quick Win #1).

---

### Issue 2: Fixed Bottom Input Without Safe-Area

**File:** `apps/web/src/app/session/[id]/session-layout.tsx`  
**Line:** 103

**Problem:**

```tsx
{
  /* Prompt input - fixed at bottom */
}
<div className="fixed bottom-0">
  {" "}
  // ← No safe-area-bottom offset
  <PromptInput />
</div>;
```

**Fix:**

```tsx
<div className="fixed" style={{ bottom: 'calc(0px + var(--safe-area-bottom))' }}>
```

---

### Issue 3: Table Overflow Strategy

**File:** `apps/web/src/app/globals.css`  
**Line:** 269-275

**Good Pattern:**

```css
@media (max-width: 640px) {
  table {
    display: block;
    overflow-x: auto;
    white-space: nowrap;
  }
}
```

This **correctly** handles wide tables on mobile. No issues here.

---

### Issue 4: Scroll-Area Touch Disable

**File:** `apps/web/src/components/ui/scroll-area.tsx`  
**Line:** 34

**Problem:**

```tsx
className = "flex touch-none select-none transition-colors";
```

`touch-none` **disables touch events** on the scrollbar. This might be intentional (custom scrollbar UI) but could interfere with native scrolling on mobile.

**Recommendation:** Test on mobile. If scrolling feels broken, remove `touch-none`.

---

## PWA Checklist Status

| Requirement            | Status     | Notes                                                                  |
| ---------------------- | ---------- | ---------------------------------------------------------------------- |
| **Web Manifest**       | ✅ PASS    | `/manifest.json` complete (name, icons, start_url, display, shortcuts) |
| **Service Worker**     | ❌ FAIL    | Not implemented. No offline caching, background sync, or push.         |
| **HTTPS**              | ✅ PASS    | Required for PWA, assumed in production.                               |
| **Installable**        | ✅ PASS    | Manifest + meta tags trigger install prompt.                           |
| **App Icons**          | ⚠️ PARTIAL | SVG icon only. Should add PNG fallbacks (192x192, 512x512).            |
| **Offline Support**    | ❌ FAIL    | No service worker = no offline mode.                                   |
| **Background Sync**    | ❌ FAIL    | No service worker = no background sync.                                |
| **Push Notifications** | ❌ FAIL    | No service worker = no push.                                           |
| **Add to Home Screen** | ✅ PASS    | `mobile-web-app-capable` and `apple-mobile-web-app-capable` set.       |
| **Full-Screen Mode**   | ✅ PASS    | `display: standalone` in manifest.                                     |
| **Theme Color**        | ✅ PASS    | `theme-color` set for dark/light modes.                                |
| **Safe-Area Support**  | ❌ FAIL    | No CSS compensation for notch/home indicator.                          |
| **Touch Gestures**     | ❌ FAIL    | No swipe, pull-to-refresh, haptics.                                    |
| **Network Resilience** | ⚠️ PARTIAL | SSE has reconnection but ignores visibility. No offline queue.         |

**Summary:** 6/14 requirements met. **App is installable but not truly "Progressive"**.

---

## Architecture Gaps (vs Guide)

The `MOBILE_CLIENT_IMPLEMENTATION.md` guide is **comprehensive** but **implementation stopped after Section 9.1 (PWA config)**.

### Implemented from Guide:

- ✅ Section 9.1: PWA manifest, meta tags, viewport
- ✅ Partial Section 9.3: SSE reconnection (but no Visibility API)

### NOT Implemented from Guide:

- ❌ Section 9.2: Offline support (IndexedDB, queue mutations, sync)
- ❌ Section 9.3: Visibility API integration
- ❌ Section 9.4: Touch gestures (swipe, haptics)
- ❌ Section 9.5: Virtual keyboard handling
- ❌ Section 9.6: Bottom navigation

**Gap Analysis:**

| Guide Section  | Implementation Gap                      | Impact                                 |
| -------------- | --------------------------------------- | -------------------------------------- |
| 9.2 Offline    | No `lib/offline.ts`, no IndexedDB setup | Can't queue prompts offline, data loss |
| 9.3 SSE        | No visibility listener in `use-sse.tsx` | Battery drain, wasted API calls        |
| 9.4 Gestures   | No touch handlers anywhere              | Feels like desktop site on mobile      |
| 9.5 Keyboard   | No `visualViewport` listeners           | Layout breaks when keyboard opens      |
| 9.6 Navigation | No bottom tabs component                | Thumb-unfriendly ergonomics            |

---

## Recommendations

### Immediate (This Week)

1. **Safe-area insets** - 1 hour fix prevents content hiding under notch
2. **Visibility API** - 30 min fix prevents battery drain
3. **PNG app icons** - 15 min, improves install experience

### Short-term (Next Sprint)

4. **Service worker** - 6 hours, unlocks offline, background sync, push
5. **Bottom navigation** - 2 hours, improves thumb reach
6. **Offline queue** - 2 hours, prevents prompt data loss

### Long-term (Roadmap)

7. **Touch gestures** - 3 hours, feels native
8. **Push notifications** - 8 hours, requires backend integration
9. **Virtual keyboard resize** - 2 hours, polish for input UX

### Don't Bother

- ❌ Biometric auth - No auth system exists yet
- ❌ Native app wrapper - PWA is sufficient for MVP
- ❌ Custom scrollbar UI - Native scrolling is fine

---

## Testing Strategy

### Critical Path Tests

1. **iPhone X+ (Notch Test)**
   - Install PWA
   - Check top nav visibility (should not hide under notch)
   - Check bottom input visibility (should not hide under home indicator)

2. **Background/Foreground (Visibility Test)**
   - Open app, start session
   - Background app (home button)
   - Wait 30 seconds
   - Foreground app
   - Verify SSE reconnects ONLY on foreground (not while backgrounded)

3. **Offline Test**
   - Turn on airplane mode
   - Type prompt, hit send
   - Expected: Message queued (NOT lost)
   - Turn off airplane mode
   - Expected: Queued message sends

### Nice-to-Have Tests

4. **Pull-to-Refresh Test**
   - Pull down from top of messages
   - Expected: Refresh animation, messages reload

5. **Haptic Test**
   - Tap button
   - Expected: Subtle vibration (iOS/Android only)

6. **Keyboard Test**
   - Focus input
   - Expected: Layout shifts to keep input visible

---

## Appendix: Code Locations

### Relevant Files

| File                                               | Purpose                         | Mobile Gaps                        |
| -------------------------------------------------- | ------------------------------- | ---------------------------------- |
| `apps/web/src/app/layout.tsx`                      | Root layout, PWA meta tags      | Missing safe-area CSS              |
| `apps/web/src/app/globals.css`                     | Global styles, theme            | Missing safe-area vars             |
| `apps/web/src/react/use-sse.tsx`                   | SSE connection                  | Missing visibility listener        |
| `apps/web/src/app/session/[id]/session-layout.tsx` | Session layout                  | Fixed bottom input needs safe-area |
| `apps/web/public/manifest.json`                    | PWA manifest                    | Missing PNG icons                  |
| `docs/guides/MOBILE_CLIENT_IMPLEMENTATION.md`      | Mobile patterns (unimplemented) | Sections 9.2-9.6 not coded         |

### Files That Should Exist (But Don't)

- `apps/web/public/sw.js` - Service worker (offline, background sync)
- `apps/web/src/lib/offline.ts` - IndexedDB queue (from guide Section 9.2)
- `apps/web/src/hooks/use-pull-to-refresh.ts` - Pull gesture
- `apps/web/src/lib/haptics.ts` - Vibration helper
- `apps/web/src/components/bottom-nav.tsx` - Thumb-friendly navigation

---

## Conclusion

opencode-vibe has **solid mobile foundations** but **stopped short of true mobile optimization**. The guide exists, the patterns are documented, but **implementation is incomplete**.

**Good News:** All missing features are **implementable in 1-2 sprints**. No architectural changes needed.

**Bad News:** Without safe-area insets and visibility-aware SSE, the app is **actively degraded on mobile** (content hides, battery drains).

**Priority:** Fix safe-area (1 hour) and visibility API (30 min) **immediately**. Then service worker (6 hours) for true PWA experience.

**Score Justification:**

- **3.5/10** = Installable but not optimized
- **Would be 7/10** with safe-area + visibility fixes
- **Would be 9/10** with full Section 9 implementation

---

**Next Steps:**

1. Create cells for Priority 0 fixes (safe-area, visibility)
2. Spike service worker implementation (estimate effort)
3. Design bottom navigation UX (mobile-first)
4. Test on physical iOS/Android devices (not just simulator)

```
     📱
    ╱  ╲
   ╱ ✅ ╲  "NOW WITH SAFE AREAS!"
  ╱______╲
  │ [  ] │  "AND VISIBILITY API!"
  │ [  ] │  "MUCH BETTER!"
  │ ⚡💚 │
  │  ⚪  │  < happy iPhone
  └──────┘
```
