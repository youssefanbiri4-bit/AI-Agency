# W8-T8 A11Y Tooling

**Status:** Complete  
**Date:** 2026-07-13  
**Branch:** `chore/w8-a11y-tooling`

---

## Summary

Installed practical accessibility testing tooling for local/CI use without breaking the app or affecting production bundles.

---

## Installed devDependencies

| Package | Version | Purpose | Production Impact |
|---|---|---|---|
| `axe-core` | ^4.12.1 | Core axe rule engine. Used by `scripts/a11y-audit.mjs` to list rules and provide the `axe.source` script for in-browser injection. | None (dev only) |
| `@axe-core/react` | latest | React integration that runs axe in the browser during development. Imported via dynamic `import()` — never loaded in production. | None (dynamic import, production guard) |

### Not installed

| Tool | Reason |
|---|---|
| `pa11y` / `pa11y-ci` | Requires Chrome/Chromium + Puppeteer (which downloads ~300MB Chromium). No Chrome available in this environment. Documented below. |

---

## New Files

| File | Purpose |
|---|---|
| `scripts/a11y-audit.mjs` | CLI script: lists axe rules (`npm run a11y:rules`) or audits a URL (`npm run a11y:audit:url <url>`) |
| `src/lib/a11y-dev.tsx` | Dev-only `<AxeDevTools />` component — drop into any layout during dev to get axe overlays in the browser console |
| `scripts/setup-a11y-testing.sh` | Updated to reflect current tooling state and Chrome requirements |

## Modified Files

| File | Change |
|---|---|
| `package.json` | Added `a11y:rules`, `a11y:audit:url` scripts; updated `a11y:audit` |
| `.pa11yci.json` | Added `_note` documenting pa11y-ci status |

---

## How to Run A11y Checks

### 1. List all available axe-core rules (no browser needed)
```bash
npm run a11y:rules
```
Outputs 105 WCAG rules organized by impact level (critical, serious, moderate, minor).

### 2. Full-page automated audit (requires Chrome)

First, ensure Chrome/Chromium is installed:
```bash
# Ubuntu/Debian:
sudo apt install chromium-browser

# macOS:
brew install --cask google-chrome
```

Then install pa11y:
```bash
npm install --save-dev pa11y pa11y-ci
```

Run the audit:
```bash
# Start dev server (in another terminal):
npm run dev

# Option A — use the new helper script:
CHROME_PATH=/usr/bin/chromium npm run a11y:audit:url http://localhost:3000/dashboard

# Option B — use pa11y-ci directly:
npx pa11y-ci --config .pa11yci.json
```

### 3. Dev-only browser overlay (temporary local use)

1. Add to any client component or layout:
   ```tsx
   import { AxeDevTools } from '@/lib/a11y-dev';
   // ...
   return (
     <>
       <AxeDevTools />
       <YourExistingContent />
     </>
   );
   ```
2. Run `npm run dev` and open browser console — axe violations appear as overlay
3. **Remove before committing** — the component uses `process.env.NODE_ENV` guard but the import itself is local-only

### 4. Browser extensions (manual testing)

- **axe DevTools** — Chrome extension, scans single pages
- **WAVE** — Chrome extension, visualizes accessibility issues
- **Lighthouse** — built into Chrome DevTools

### 5. Screen reader testing

- **Windows:** [NVDA](https://www.nvaccess.org/) (free)
- **macOS:** VoiceOver (built-in, Cmd+F5)
- **Linux:** [Orca](https://help.gnome.org/users/orca/stable/)

---

## Gate Status

| Gate | Status | Notes |
|---|---|---|
| `tsc --noEmit` | ✅ Pass (1 pre-existing error in `signup/page.tsx:3`) | Pre-existing `type React` import issue, unrelated |
| `eslint .` | ✅ Pass (no new warnings) | Script and component both lint clean |
| `vitest run` | ✅ Pass | All existing tests green |

No new test was added — vitest uses `node` environment without jsdom, making axe-core tests require a DOM. The owner should add a jsdom-based vitest config for component a11y tests if needed.

---

## Files Changed
```
 M .pa11yci.json
 M package.json
 M scripts/setup-a11y-testing.sh
 A scripts/a11y-audit.mjs
 A src/lib/a11y-dev.tsx
 A docs/orchestrator/reports/W8-T8-A11Y-TOOLING.md
```

---

## Success Criteria

- [x] Tools installed (`axe-core`, `@axe-core/react`) or documented why not (`pa11y` — needs Chrome)
- [x] Owner can run documented a11y checks (rules list, URL audit with Chrome, dev overlay, browser extensions)
- [x] Main typecheck/lint/tests still green
- [x] Report written
