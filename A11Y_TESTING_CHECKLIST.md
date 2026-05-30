# Accessibility Testing Checklist
# WCAG 2.1 AA Compliance Verification

## 📋 Pre-Testing Setup

- [ ] Start development server: `npm run dev`
- [ ] Install axe DevTools Chrome Extension
- [ ] Install WAVE Extension
- [ ] Enable VoiceOver (Mac) or install NVDA (Windows)
- [ ] Use Lighthouse (Chrome DevTools)

---

## 🔍 Testing Pages

### Page 1: Login (`/auth/login`)

#### Keyboard Navigation:
- [ ] Tab focuses email input
- [ ] Tab focuses password input
- [ ] Tab focuses "Sign In" button
- [ ] Tab focuses "Sign Up" link
- [ ] Enter submits form
- [ ] Focus indicator visible on all interactive elements
- [ ] No keyboard traps
- [ ] Escape closes any modals (if present)

#### Form Fields:
- [ ] Email label associated with input
- [ ] Password label associated with input
- [ ] Error messages linked to fields (aria-describedby)
- [ ] Required fields marked
- [ ] Placeholder text not used as label
- [ ] Help text properly announced

#### Color & Contrast:
- [ ] Text has 4.5:1 contrast ratio
- [ ] Buttons have 3:1 contrast ratio
- [ ] Focus indicator has sufficient contrast
- [ ] Color not sole indicator of status

#### Screen Reader:
- [ ] Title announced correctly
- [ ] Form fields labeled
- [ ] Error messages announced
- [ ] Links have descriptive text (not "click here")
- [ ] Button purposes clear

**Issues Found:** ___________________________
**Action Items:** ___________________________

---

### Page 2: Dashboard (`/dashboard`)

#### Navigation:
- [ ] Skip to main content link (hidden but available)
- [ ] Navigation menu keyboard accessible
- [ ] Current page link has aria-current="page"
- [ ] Menu expandable with keyboard
- [ ] Sidebar toggle accessible

#### Main Content:
- [ ] Heading hierarchy correct (h1 → h2 → h3)
- [ ] No skipped heading levels
- [ ] Headings used for structure, not styling
- [ ] Page title at top
- [ ] Focus moved to main content on page load

#### Tables (if present):
- [ ] Table has caption or aria-label
- [ ] Headers marked with `<th>`
- [ ] Rows have proper headers associated
- [ ] Summary text for complex tables
- [ ] Sortable columns announce sort order

#### Buttons & Controls:
- [ ] Icon-only buttons have aria-labels
- [ ] Button states announced (disabled, pressed)
- [ ] Tooltips available via aria-label
- [ ] Hover effects not sole indicator of interaction

#### Color & Contrast:
- [ ] All text has sufficient contrast
- [ ] Icons have sufficient contrast
- [ ] Status indicators not color-only
- [ ] Links distinguishable from text (not color alone)

#### Lists:
- [ ] Lists use proper semantic markup (`<ul>`, `<li>`)
- [ ] List items identifiable as group
- [ ] Nested lists properly structured

**Issues Found:** ___________________________
**Action Items:** ___________________________

---

### Page 3: Content Studio (`/dashboard/content-studio`)

#### Complex Interactions:
- [ ] Tabs keyboard accessible (Arrow keys navigate)
- [ ] Tab panels associated with tabs (aria-controls)
- [ ] Modals have proper focus management
- [ ] Focus returns to trigger on modal close
- [ ] Collapsible sections use aria-expanded

#### Forms:
- [ ] All inputs have associated labels
- [ ] Error messages appear and are announced
- [ ] Success messages use aria-live="polite"
- [ ] Progress indicator announced
- [ ] Multi-step form navigation clear

#### Dynamic Content:
- [ ] Live regions use proper aria-live roles
- [ ] Updates announced without page refresh
- [ ] Loading states announced
- [ ] Results count announced

#### Rich Content:
- [ ] WYSIWYG editor accessible
- [ ] Text formatting controls keyboard accessible
- [ ] Media controls have labels
- [ ] Captions available (if video)

#### Large Component:
- [ ] Component not overwhelming for screen readers
- [ ] Can navigate to specific sections
- [ ] Sections have clear landmarks

**Issues Found:** ___________________________
**Action Items:** ___________________________

---

## 🧪 Automated Testing Results

### axe DevTools Scan:
```
Date: ________________
Issues Found: _________
Critical: ___  Serious: ___  Moderate: ___  Minor: ___
```

### Lighthouse Accessibility Audit:
```
Date: ________________
Score: ___/100
Issues: _______________
```

### WAVE Extension:
```
Date: ________________
Errors: ___  Warnings: ___  Contrast: ___
```

---

## ♿ Screen Reader Testing (NVDA/VoiceOver)

### Tested with: ☐ NVDA  ☐ VoiceOver  ☐ JAWS  ☐ Orca

#### Page Structure:
- [ ] Page title announced on page load
- [ ] Landmarks identified (nav, main, complementary)
- [ ] Heading structure makes sense when skipping
- [ ] Can navigate by heading, link, button
- [ ] Region labels descriptive

#### Forms:
- [ ] Field labels announced before input
- [ ] Required status announced
- [ ] Error messages associated with field
- [ ] Placeholder text not announced as label
- [ ] Form instructions announced

#### Dynamic Content:
- [ ] Status messages announced without request
- [ ] Loading states communicated
- [ ] Auto-complete suggestions announced
- [ ] Table updates announced

#### Navigation:
- [ ] Can navigate forward and backward
- [ ] Links have descriptive text
- [ ] Button purposes clear
- [ ] Skip links work correctly
- [ ] Focus order logical

#### Issues Encountered:
1. ________________________
2. ________________________
3. ________________________

---

## 🎨 Visual & Color Testing

### Color Contrast Audit (WebAIM Checker):

#### Text Colors:
```
Component         | Foreground  | Background  | Ratio  | Pass?
------------------|-------------|-------------|--------|-------
Primary Button    | #FFFFFF     | #F7CBCA     | 4.5:1  | ☐ Yes
Secondary Text    | #5D6B6B     | #FFFFFF     | 5.2:1  | ☐ Yes
```

### Focus Indicators:
- [ ] Focus outline visible on all elements
- [ ] Focus indicator color has 3:1 contrast
- [ ] Focus indicator not removed without replacement
- [ ] Focus outline minimum 2px
- [ ] Focus visible on hover + focus

### Dark Mode (if applicable):
- [ ] Colors tested in dark mode
- [ ] Contrast maintained in dark mode
- [ ] No hardcoded colors

---

## 📱 Responsive & Zoom Testing

### Mobile (Touch):
- [ ] Touch targets at least 44x44px
- [ ] Space between touch targets
- [ ] No floating elements over content
- [ ] Gestures have keyboard alternatives

### Zoom (200%):
- [ ] Page readable at 200% zoom
- [ ] No horizontal scrolling at 200%
- [ ] Content not cut off
- [ ] Touch targets remain accessible

### Screen Reader with Mobile:
- [ ] VoiceOver (iOS) - if applicable
- [ ] TalkBack (Android) - if applicable

---

## ✅ Compliance Summary

### WCAG 2.1 Level AA:

| Category | Status | Issues | Notes |
|----------|--------|--------|-------|
| Perceivable | ☐ Pass | ____ | |
| Operable | ☐ Pass | ____ | |
| Understandable | ☐ Pass | ____ | |
| Robust | ☐ Pass | ____ | |

### Overall Status:
- **WCAG 2.1 AA Compliant:** ☐ Yes  ☐ No  ☐ Partial

### Issues Summary:
1. **Critical (Must Fix):**
   - ________________________
   
2. **Serious (Should Fix):**
   - ________________________
   
3. **Moderate (Nice to Fix):**
   - ________________________

---

## 🔧 Fixes to Apply

### High Priority (Week 1):
- [ ] Issue: _____________________
  - Fix: _____________________
  - File: _____________________
  
- [ ] Issue: _____________________
  - Fix: _____________________
  - File: _____________________

### Medium Priority (Week 2):
- [ ] Issue: _____________________
  - Fix: _____________________
  - File: _____________________

### Low Priority (Week 3):
- [ ] Issue: _____________________
  - Fix: _____________________
  - File: _____________________

---

## 📝 Test Sign-Off

**Tester Name:** ___________________  
**Date:** ___________________  
**Status:** ☐ Pass  ☐ Fail  ☐ Needs Review  

**Notes:**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

**Approved by:** ___________________

---

## 📚 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Checker](https://wave.webaim.org/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

**Template Version:** 1.0  
**Last Updated:** 2026-05-22
