/**
 * A11y Component Examples
 *
 * Shows best practices for adding accessibility features to components
 * WCAG 2.1 AA compliance examples
 */

import {
  ariaLabels,
  createButtonA11y,
  createInputA11y,
  createErrorA11y,
  createStatusBadgeA11y,
  createSkipLinkA11y,
} from '@/lib/accessibility';

/**
 * Example: Accessible Search Form
 */
export function AccessibleSearchExample() {
  return (
    <form {...createFormA11y('Global search')}>
      <label htmlFor="global-search">
        <span className="sr-only">Search content</span>
        <input
          {...createInputA11y('global-search', 'Search all content')}
          type="search"
          placeholder="Search..."
        />
      </label>
      <button
        {...createButtonA11y('Search', 'Search for content')}
        type="submit"
      >
        Search
      </button>
    </form>
  );
}

/**
 * Example: Accessible Form with Error Handling
 */
export function AccessibleFormExample() {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Validate and set errors
      }}
    >
      <div>
        <label htmlFor="email">Email Address</label>
        <input
          {...createInputA11y('email', 'Email address', true)}
          type="email"
          required
        />
        {errors.email && (
          <div {...createErrorA11y('email', errors.email)}>
            {errors.email}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="name">Full Name</label>
        <input
          {...createInputA11y('name', 'Your full name', true)}
          type="text"
          required
        />
        {errors.name && (
          <div {...createErrorA11y('name', errors.name)}>
            {errors.name}
          </div>
        )}
      </div>

      <button type="submit" {...createButtonA11y('Submit form')}>
        Submit
      </button>
    </form>
  );
}

/**
 * Example: Accessible Status Badge
 */
export function AccessibleStatusBadgeExample({
  status,
}: {
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}) {
  const statusColors: Record<typeof status, string> = {
    draft: 'bg-gray-100',
    scheduled: 'bg-blue-100',
    published: 'bg-green-100',
    failed: 'bg-red-100',
  };

  return (
    <span {...createStatusBadgeA11y(status)} className={statusColors[status]}>
      {status}
    </span>
  );
}

/**
 * Example: Skip to Main Content Link
 */
export function SkipToMainContent() {
  return (
    <a {...createSkipLinkA11y('#main-content')}>
      Skip to main content
    </a>
  );
}

/**
 * Example: Accessible Modal/Dialog
 */
export function AccessibleModalExample({
  isOpen,
  onClose,
  title,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  if (!isOpen) return null;

  return (
    <div {...createDialogA11y(title, 'modal-title')}>
      <h2 id="modal-title">{title}</h2>
      <button
        {...createButtonA11y('Close')}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

/**
 * Helpers for common ARIA patterns
 */

function createFormA11y(label: string) {
  return {
    role: 'form',
    'aria-label': label,
  };
}

function createDialogA11y(title: string, titleId: string) {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
  };
}

/**
 * Best Practices Summary:
 *
 * 1. Always provide aria-label for icon-only buttons
 * 2. Use aria-required="true" for mandatory form fields
 * 3. Link error messages with aria-describedby
 * 4. Use aria-live regions for dynamic content updates
 * 5. Add aria-label to navigation landmarks
 * 6. Use role="alert" for error messages
 * 7. Include aria-current="page" on current page link in nav
 * 8. Use aria-expanded for collapsible sections
 * 9. Ensure keyboard navigation works (tab order, focus visible)
 * 10. Test with screen readers (NVDA, JAWS, VoiceOver)
 */

export default {
  AccessibleSearchExample,
  AccessibleFormExample,
  AccessibleStatusBadgeExample,
  SkipToMainContent,
  AccessibleModalExample,
};
