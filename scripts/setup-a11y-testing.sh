#!/bin/bash
# Accessibility Testing Setup & Automation
# WCAG 2.1 AA Compliance Testing
# Updated: Wave 8

echo "================================================"
echo "  A11Y Testing Setup"
echo "================================================"

## 1️⃣ INSTALLED TOOLS (devDependencies)
echo ""
echo "Already installed:"
echo "  axe-core v4.12.1       — core rule engine"
echo "  @axe-core/react         — browser React integration"
echo ""
echo "Not installed (requires Chrome/Chromium):"
echo "  pa11y / pa11y-ci        — full-page automated audits"
echo ""

## 2️⃣ CHECK CHROME AVAILABILITY
CHROME=$(command -v google-chrome || command -v chromium || command -v chromium-browser || echo "")
if [ -n "$CHROME" ]; then
  echo "✅ Chrome found: $CHROME"
  echo "   pa11y-ci can run: npx pa11y-ci"
else
  echo "⚠️  Chrome/Chromium not found."
  echo "   Install one of:"
  echo "     Ubuntu/Debian: sudo apt install chromium-browser"
  echo "     macOS: brew install --cask google-chrome"
  echo "     Then set: export CHROME_PATH=/path/to/chrome"
  echo ""
  echo "   Without Chrome, use the axe-core script:"
  echo "     npm run a11y:rules    # list available rules"
  echo "     npm run a11y:audit    # see all available commands"
fi

## 3️⃣ RUNNABLE SCRIPTS
echo ""
echo "Available npm scripts:"
echo "  npm run a11y:rules       — List all axe-core rules (no browser needed)"
echo "  npm run a11y:audit       — Show help for the audit script"
echo "  npm run a11y:audit:url <url>  — Audit URL (needs Chrome)"
echo "  npm run a11y:setup       — This setup checker"
echo ""
echo "Dev component (temporary, local use only):"
echo "  Import <AxeDevTools /> from '@/lib/a11y-dev' in your layout"
echo "  during development to get axe overlays in browser console."
echo "  REMOVE BEFORE COMMITTING."
echo ""

## 4️⃣ MANUAL TESTING RESOURCES
echo "Manual testing tools:"
echo "  axe DevTools (Chrome Extension)"
echo "  WAVE (Chrome Extension)"
echo "  Lighthouse (Chrome DevTools)"
echo "  Screen readers: NVDA (Win), VoiceOver (Mac), Orca (Linux)"
echo ""
echo "See A11Y_QUICK_START.md for detailed manual testing guide."
echo "See A11Y_TESTING_CHECKLIST.md for the full test checklist."
echo "See ACCESSIBILITY.md for implementation patterns."
echo ""
echo "================================================"
