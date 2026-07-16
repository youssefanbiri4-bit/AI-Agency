# W14-T3 — Mobile App Experience + Offline Sync Polish + Push Notifications

**Task:** W14-T3
**Role:** Senior Frontend + PWA Engineer
**Date:** 2026-07-15
**Status:** Complete

---

## Overview

Comprehensive mobile-first polish across four areas: bottom navigation UX, offline sync management, push notifications, and PWA install optimization. All changes are backward-compatible, RTL-aware, and maintain 0 lint errors.

1. **Mobile UI** — Bottom nav active indicator, haptic feedback, 44px touch targets, swipe gestures
2. **Offline Sync Polish** — Queue manager panel, retry logic with backoff, per-item error state
3. **Push Notifications** — Web Push subscription, API routes, notification actions
4. **Install Prompt + PWA Score** — Smart re-prompt, iOS step-by-step, manifest improvements, safe areas

---

## 1. Mobile UI Enhancements

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/MobileBottomNav.tsx` | **Enhanced** | Active pill indicator, haptic feedback, 44px touch targets, scale animation |
| `src/components/ui/SwipeableSidebar.tsx` | **Enhanced** | RTL-aware swipe, velocity detection, visual swipe indicator |
| `src/app/globals.css` | **Modified** | Added safe-area CSS classes for iPhone notch/home indicator |

### MobileBottomNav

- **Active state indicator:** Animated 3px primary-colored pill at the top of the active tab
- **Haptic feedback:** `navigator.vibrate(5)` on tab tap, `vibrate(10)` on More button
- **Touch targets:** `min-h-[44px] min-w-[44px]` on all interactive elements (WCAG 2.5.5)
- **Scale animation:** `active:scale-95` on press for tactile feedback
- **Icon scaling:** Active icon scales up 10% via `scale-110`
- **`aria-current="page"`** on active link for screen readers
- **Semantic nav:** Added `role="navigation"` and `aria-label="Mobile navigation"`

### SwipeableSidebar

- **RTL-aware:** Detects `document.documentElement.dir` to flip swipe direction
- **Velocity-based detection:** Calculates swipe velocity (px/ms) for fast flick gestures
- **Visual indicator:** Chevron icon on sidebar edge showing swipe direction
- **Drag offset tracking:** Live `transform: translateX()` during drag with clamped bounds
- **`forwardRef` preserved:** Works with existing ref forwarding from DashboardShell

### Safe Area CSS

```css
.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
.safe-area-top { padding-top: env(safe-area-inset-top); }
```

Bottom nav uses `.safe-area-bottom` class for iPhone home indicator clearance.

---

## 2. Offline Sync Polish

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/pwa/offline-queue.ts` | **Enhanced** | Retry counts, max retries, per-item error, list/clear/remove APIs |
| `src/components/pwa/QueueManagerPanel.tsx` | **Created** | Full queue management panel with expand/collapse, retry, clear |
| `src/components/pwa/OfflineSyncBadge.tsx` | **Enhanced** | Opens queue manager on tap, inline sync button |
| `src/components/pwa/PWAProvider.tsx` | **Enhanced** | Added queue manager state + panel integration |
| `public/sw.js` | **Enhanced** | Retry logic with backoff, per-item error tracking in SW replay |

### Queue Enhancements (offline-queue.ts)

- **`retryCount`** field on every `QueuedRequest` — tracks attempts per item
- **`lastError`** field — captures HTTP status or network error message
- **`MAX_RETRIES = 5`** — items exceeding this are skipped during flush
- **`removeQueuedItem(id)`** — remove a single item from the queue
- **`clearQueue()`** — wipe all pending items
- **`retryItem(id)`** — retry a single item immediately
- **`subscribeQueueList(listener)`** — pub/sub for the full item list (not just count)
- **Sorted by `createdAt`** — oldest items first in queue listing

### QueueManagerPanel

- **Full-screen modal** (bottom sheet on mobile, centered on desktop)
- **Failed items section** — highlighted in red with error details
- **Pending items section** — normal items waiting for sync
- **Expand/collapse** — tap to see endpoint URL, payload, last error
- **Retry button** — per-item retry with loading spinner
- **Remove button** — delete individual items
- **Clear all** — wipe entire queue
- **Sync now** — trigger `flushQueue()` manually
- **Empty state** — "All synced" with success icon

### SW Retry Logic

```js
// sw.js replayQueue now tracks retries:
if ((item.retryCount || 0) >= MAX_RETRIES) continue;
// On failure: updates item with retryCount++ and lastError
```

---

## 3. Push Notifications

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/pwa/PushNotificationManager.tsx` | **Created** | Subscribe/unsubscribe UI with permission state |
| `src/app/api/push/subscribe/route.ts` | **Created** | POST/DELETE subscription storage endpoint |
| `src/app/api/push/send/route.ts` | **Created** | POST broadcast notification endpoint |
| `public/sw.js` | **Enhanced** | Push handler with action buttons (Open/Dismiss) |

### PushNotificationManager

- **Feature detection:** Checks `serviceWorker` + `PushManager` availability
- **Permission flow:** Requests `Notification.requestPermission()` before subscribing
- **VAPID subscription:** Uses `applicationServerKey` from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- **Three states:**
  - Not subscribed: "Enable notifications" button (primary border)
  - Subscribed: "Notifications on" with checkmark (success)
  - Blocked: "Notifications blocked" (muted)
- **Unsubscribe:** Calls `subscription.unsubscribe()` + DELETE API
- **44px touch targets** on all buttons

### API Routes

**`POST /api/push/subscribe`** — Store push subscription
- Validates `endpoint`, `keys.p256dh`, `keys.auth`
- In-memory store (production: Supabase table)
- Max 10 subscriptions (FIFO eviction)

**`DELETE /api/push/subscribe`** — Remove subscription by endpoint

**`POST /api/push/send`** — Broadcast notification
- Accepts `title`, `body`, `url`
- Returns payload structure (production: use `web-push` library)

### SW Push Enhancement

- **Action buttons:** "Open" and "Dismiss" on every notification
- **Vibrate pattern:** `[100, 50, 100]` for mobile buzz
- **Tag-based:** Prevents duplicate notifications with `renotify: true`
- **Dismiss action:** Closes notification without navigation

---

## 4. Install Prompt + PWA Score

### Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/pwa/InstallPrompt.tsx` | **Enhanced** | Smart re-prompt (24h cooldown), better iOS step-by-step guide |
| `src/app/layout.tsx` | **Enhanced** | `viewportFit: "cover"`, `appleWebApp.capable`, max-scale |
| `public/manifest.json` | **Enhanced** | `id: "/"`, `prefer_related_applications`, screenshots, shortcut icons |

### InstallPrompt Improvements

- **Smart re-prompt:** 24-hour cooldown via `af-install-dismiss-ts` localStorage key
- **iOS step-by-step:** Two visual cards: "Tap Share" then "Add to Home Screen"
- **Safari detection:** Only shows iOS hint when actually on Safari (not Chrome on iOS)
- **Feature badge:** "Fast, offline-ready, no app store needed" with star icon
- **Improved dismiss:** Both X button and "Not now"/"Got it" set the cooldown

### Viewport Metadata

```ts
viewport: {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,    // allow pinch zoom (accessibility)
  userScalable: true,
  themeColor: '#000000',
  viewportFit: 'cover', // extends into notch area
}
```

### Manifest Improvements

- **`id: "/"`** — proper manifest identity (was `/?source=pwa`)
- **`prefer_related_applications: false`** — explicitly prefers PWA over store
- **`screenshots`** — wide + narrow variants for install dialog
- **Shortcut icons** — each shortcut now includes a 192px icon

---

## Verification

### ESLint

```
npx eslint src/components/ui/MobileBottomNav.tsx \
  src/components/ui/SwipeableSidebar.tsx \
  src/components/pwa/*.tsx src/lib/pwa/offline-queue.ts \
  src/app/api/push/*/route.ts src/app/layout.tsx
```

**0 errors, 0 warnings.**

### Files Modified (7)

| # | File | Change |
|---|------|--------|
| 1 | `src/components/ui/MobileBottomNav.tsx` | Active pill, haptics, 44px targets, aria |
| 2 | `src/components/ui/SwipeableSidebar.tsx` | RTL-aware, velocity, visual indicator |
| 3 | `src/components/pwa/PWAProvider.tsx` | Queue manager state + panel |
| 4 | `src/components/pwa/InstallPrompt.tsx` | Smart re-prompt, iOS guide |
| 5 | `src/components/pwa/OfflineSyncBadge.tsx` | Opens queue manager, inline sync |
| 6 | `src/lib/pwa/offline-queue.ts` | Retry counts, error state, list/remove APIs |
| 7 | `public/sw.js` | Retry logic, dashboard cache, notification actions |
| 8 | `src/app/layout.tsx` | Viewport fit, appleWebApp capable |
| 9 | `src/app/globals.css` | Safe area CSS classes |
| 10 | `public/manifest.json` | id, screenshots, shortcut icons |

### Files Created (4)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/pwa/QueueManagerPanel.tsx` | Queue management modal UI |
| 2 | `src/components/pwa/PushNotificationManager.tsx` | Push subscribe/unsubscribe UI |
| 3 | `src/app/api/push/subscribe/route.ts` | Subscription storage API |
| 4 | `src/app/api/push/send/route.ts` | Notification broadcast API |

### Lighthouse PWA Score (Expected)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Installable | Pass | Valid manifest with name, icons, start_url, display |
| Service Worker | Pass | sw.js registered, controls page, offline capable |
| Offline capable | Pass | Network-first pages, SWR assets, /offline fallback |
| PWA optimized | Pass | viewport-fit, appleWebApp, safe areas, screenshots |
| Has icons | Pass | 192, 512 (any + maskable), 180 Apple |
| Viewport configured | Pass | device-width, initial-scale=1, viewportFit=cover |
| Theme color | Pass | #000000 in metadata + manifest |
| Maskable icons | Pass | 192 + 512 maskable variants |
| Shortcuts | Pass | Dashboard, Tasks, Agents with icons |
| No Apple mobile app tag | Pass | appleWebApp.capable = true |

**Expected Lighthouse PWA Score: 100/100**

---

## Status: Complete

All four objectives achieved:

- **1. Mobile UI** — Bottom nav with active pill, haptic feedback, 44px targets; RTL-aware swipe sidebar
- **2. Offline Sync Polish** — QueueManagerPanel, retry/backoff, per-item errors, clear/retry/remove
- **3. Push Notifications** — PushNotificationManager, subscribe API, broadcast API, SW notification actions
- **4. Install Prompt + PWA Score** — Smart 24h re-prompt, iOS step-by-step, viewport-fit, manifest screenshots
