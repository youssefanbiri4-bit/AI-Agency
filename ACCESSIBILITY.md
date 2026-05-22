# Accessibility (A11y) Implementation Guide

## WCAG 2.1 AA Compliance

This document outlines accessibility standards and implementation in the AI Agency dashboard.

## Quick Reference

### ARIA Labels Module
```typescript
import { ariaLabels, createButtonA11y, createInputA11y } from '@/lib/accessibility';

// Use predefined labels
<button {...createButtonA11y('Delete', ariaLabels.btnDelete)}>
  Delete
</button>

// Create custom labels
<input {...createInputA11y('email', 'Enter your email address', true)} />
```

## Core Requirements

### 1. Keyboard Navigation
- ✅ All interactive elements must be keyboard accessible
- ✅ Tab order must be logical
- ✅ Focus must be visible (focus:ring-* in Tailwind)
- ✅ No keyboard traps

**Implementation:**
```tsx
<button
  className="focus:outline-none focus:ring-4 focus:ring-[#F7CBCA]/18"
  aria-label="Close dialog"
>
  ✕
</button>
```

### 2. Screen Reader Support
- ✅ All images need alt text
- ✅ Buttons need aria-labels
- ✅ Form fields need associated labels
- ✅ Use semantic HTML (button, form, nav, main)

**Implementation:**
```tsx
<form role="search" aria-label="Site search">
  <label htmlFor="search">Search:</label>
  <input id="search" type="search" />
  <button type="submit" aria-label="Submit search">
    Search
  </button>
</form>
```

### 3. Color Contrast
- ✅ Text: 4.5:1 contrast ratio
- ✅ UI Components: 3:1 contrast ratio
- ✅ Don't rely on color alone

**Tool:** WebAIM Contrast Checker

### 4. Text Alternatives
- ✅ Images: `<img alt="description" />`
- ✅ Icons: `aria-label="description"`
- ✅ Decorative elements: `aria-hidden="true"`

**Implementation:**
```tsx
// Meaningful icon
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

// Decorative icon
<span aria-hidden="true">→</span> Next Page
```

### 5. Form Accessibility
- ✅ Labels must be associated with inputs
- ✅ Error messages must be announced
- ✅ Required fields must be marked

**Implementation:**
```tsx
function AccessibleInput() {
  const [error, setError] = useState<string>();

  return (
    <div>
      <label htmlFor="email">
        Email <span aria-label="required">*</span>
      </label>
      <input
        id="email"
        type="email"
        aria-required="true"
        aria-describedby={error ? 'email-error' : undefined}
        aria-invalid={!!error}
      />
      {error && (
        <div id="email-error" role="alert" className="text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}
```

### 6. Focus Management
- ✅ Modal opens: move focus to dialog
- ✅ Modal closes: return focus to trigger
- ✅ Route changes: move focus to page title

**Implementation:**
```tsx
function Modal({ isOpen, onClose }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isOpen && titleRef.current) {
      titleRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div role="dialog" aria-modal="true">
      <h2 ref={titleRef} tabIndex={-1}>
        Dialog Title
      </h2>
    </div>
  );
}
```

## Component Checklist

### Buttons
- [ ] Has text or aria-label
- [ ] Focus visible
- [ ] Keyboard accessible
- [ ] Properly disabled state

### Forms
- [ ] Labels associated with inputs
- [ ] Error messages linked via aria-describedby
- [ ] Required fields marked
- [ ] Validation messages announced

### Navigation
- [ ] Current page marked with aria-current="page"
- [ ] Navigation has role="navigation"
- [ ] Links have descriptive text

### Tables
- [ ] Headers marked with `<th>`
- [ ] aria-label on table
- [ ] aria-describedby for complex tables

### Images
- [ ] Meaningful alt text (not "image of...")
- [ ] Decorative images have empty alt=""
- [ ] Icon-only buttons have aria-label

### Headings
- [ ] Proper hierarchy (h1 → h2 → h3)
- [ ] Don't skip levels
- [ ] Use for structure, not styling

### Lists
- [ ] Use `<ul>`, `<ol>`, `<li>`
- [ ] Add aria-label if needed
- [ ] Don't use for styling

## Testing Tools

### Automated Testing
- **axe DevTools**: Browser extension for accessibility audit
- **Lighthouse**: Chrome DevTools audit
- **WAVE**: WebAIM accessibility checker

### Manual Testing
- **Keyboard Navigation**: Tab through entire page
- **Screen Reader**: NVDA (Windows), JAWS (Windows), VoiceOver (Mac)
- **Color Contrast**: Use WebAIM Contrast Checker

### Test Checklist
```bash
# Keyboard navigation
[ ] Tab through entire page
[ ] Focus order is logical
[ ] No keyboard traps
[ ] Focus indicator visible

# Screen Reader (NVDA/VoiceOver)
[ ] Page structure makes sense
[ ] Form labels announced
[ ] Buttons have labels
[ ] Error messages announced
[ ] Live regions work

# Visual
[ ] Colors have sufficient contrast
[ ] Text is readable
[ ] Resizable up to 200%
[ ] No reliance on color alone
```

## ARIA Patterns

### Alert/Status Messages
```tsx
<div role="alert" aria-live="polite" aria-atomic="true">
  Your changes have been saved
</div>
```

### Tabs
```tsx
<div role="tablist">
  <button
    role="tab"
    aria-selected={active === 'tab1'}
    aria-controls="tab1-panel"
  >
    Tab 1
  </button>
  <div
    id="tab1-panel"
    role="tabpanel"
    aria-labelledby="tab1"
  >
    Content
  </div>
</div>
```

### Expandable Content
```tsx
<button
  aria-expanded={isOpen}
  aria-controls="details"
>
  More Details
</button>
<div id="details">
  Hidden content
</div>
```

### Tooltips
```tsx
<button
  aria-describedby="tooltip-1"
  onMouseEnter={() => setShowTooltip(true)}
>
  Help
</button>
<div id="tooltip-1" role="tooltip" hidden={!showTooltip}>
  Additional information
</div>
```

## Common Mistakes to Avoid

❌ **Bad:**
```tsx
// No label for icon button
<button>🗑️</button>

// Color-only status indication
<span style={{ color: 'red' }}>Error</span>

// Alt text that just says "image"
<img alt="image" src="..." />
```

✅ **Good:**
```tsx
// Icon button with aria-label
<button aria-label="Delete item">🗑️</button>

// Status with text + color
<span className="text-red-600" role="alert">Error occurred</span>

// Descriptive alt text
<img alt="Dashboard showing campaign performance" src="..." />
```

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast](https://webaim.org/resources/contrastchecker/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility](https://reactjs.org/docs/dom-elements.html#accessibility)

## Implementation Status

| Feature | Status | Priority |
|---------|--------|----------|
| ARIA Labels | ✅ Implemented | High |
| Keyboard Navigation | 🔄 In Progress | High |
| Screen Reader Testing | ⏳ Planned | High |
| Color Contrast Audit | ⏳ Planned | Medium |
| Focus Management | ⏳ Planned | Medium |
| Form Accessibility | 🔄 In Progress | High |
| Image Alt Text | ⏳ Planned | Medium |

## Next Steps

1. Add ARIA labels to all interactive components
2. Audit keyboard navigation
3. Test with screen readers (NVDA, VoiceOver)
4. Fix color contrast issues
5. Document accessibility patterns
6. Add accessibility tests
