#!/bin/bash
# Accessibility Testing Setup & Automation
# WCAG 2.1 AA Compliance Testing

## 1️⃣ INSTALL ACCESSIBILITY TESTING TOOLS

# Install axe DevTools Chrome Extension
# https://chrome.google.com/webstore/detail/axe-devtools-web-accessib/lhdoppojpmngadmnkpklempisson

# Install WAVE Extension
# https://wave.webaim.org/extension/

# Install Lighthouse (included in Chrome DevTools)

# For automated testing:
npm install --save-dev @axe-core/react pa11y pa11y-ci

## 2️⃣ KEYBOARD NAVIGATION TESTING

# Test Checklist:
# [ ] Tab through entire application
# [ ] Shift+Tab to go backwards
# [ ] Enter to activate buttons
# [ ] Space for checkboxes/radio buttons
# [ ] Arrow keys in lists/menus
# [ ] Escape to close modals
# [ ] Focus indicator always visible

## 3️⃣ SCREEN READER TESTING

### Windows:
# Install NVDA (free)
# https://www.nvaccess.org/

# Keyboard shortcuts:
# Ctrl+Alt+N       - Start NVDA
# Insert+H         - Help mode
# Insert+Down      - Read current item
# Insert+Up Arrow  - Read title
# Tab              - Navigate form controls

### macOS:
# Use built-in VoiceOver
# Cmd+F5 to enable
# VoiceOver Key: Control+Option
# Control+Option+U - Open rotor
# Control+Option+Right Arrow - Navigate

### Linux:
# Install Orca
# https://help.gnome.org/users/orca/stable/

## 4️⃣ COLOR CONTRAST TESTING

# WebAIM Contrast Checker
# https://webaim.org/resources/contrastchecker/

# Minimum ratios:
# Large text (18pt+): 3:1
# Normal text: 4.5:1
# UI components: 3:1

## 5️⃣ AUTOMATED TESTING COMMANDS

echo "Running Accessibility Audits..."

# Lighthouse audit (built into Chrome)
# 1. Open DevTools (F12)
# 2. Click Lighthouse tab
# 3. Select "Accessibility"
# 4. Run audit

# axe DevTools (Chrome Extension)
# 1. Open page
# 2. Click axe Extension
# 3. Click "Scan this page"
# 4. Review results

# WAVE (Chrome Extension)
# 1. Open page
# 2. Click WAVE Extension
# 3. View accessibility summary

## 6️⃣ CREATE TEST AUTOMATION

# Create pa11y configuration
cat > .pa11yci.json << 'EOF'
{
  "runners": ["axe", "pa11y"],
  "timeout": 20000,
  "standard": "WCAG2AA",
  "chromeLaunchConfig": {
    "args": ["--no-sandbox"]
  },
  "urls": [
    "http://localhost:3000/dashboard",
    "http://localhost:3000/dashboard/content-studio",
    "http://localhost:3000/auth/login"
  ]
}
EOF

echo "✅ Accessibility testing tools configured!"
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Install axe DevTools Chrome Extension"
echo "3. Manual test keyboard navigation (Tab through page)"
echo "4. Test with screen reader (VoiceOver/NVDA)"
echo "5. Run automated audit: npx pa11y-ci"
