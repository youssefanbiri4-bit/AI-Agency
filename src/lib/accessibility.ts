/**
 * ARIA Labels and Accessibility Helpers
 *
 * Ensures WCAG 2.1 AA compliance for UI components
 * See: https://www.w3.org/WAI/WCAG21/quickref/
 */

export const ariaLabels = {
  // Navigation & Structure
  navMain: 'Main navigation',
  navSidebar: 'Sidebar navigation',
  navBreadcrumb: 'Breadcrumb navigation',

  // Forms & Input
  formSearch: 'Search form',
  formFilter: 'Filter options',
  inputSearch: 'Search field',
  inputEmail: 'Email address',
  inputPassword: 'Password',

  // Buttons & Actions
  btnClose: 'Close dialog',
  btnSubmit: 'Submit form',
  btnCancel: 'Cancel operation',
  btnDelete: 'Delete item',
  btnEdit: 'Edit item',
  btnMore: 'More options',
  btnMenu: 'Open menu',

  // Content Studio
  contentStudioCreate: 'Create new content',
  contentStudioEdit: 'Edit content',
  contentStudioPublish: 'Publish content',
  contentStudioSchedule: 'Schedule content publication',
  contentStudioPreview: 'Preview content',

  // Modals & Dialogs
  dialogConfirm: 'Confirmation dialog',
  dialogAlert: 'Alert message',
  dialogError: 'Error dialog',

  // Status & Feedback
  statusLoading: 'Loading content',
  statusSuccess: 'Operation successful',
  statusError: 'Operation failed',
  statusWarning: 'Warning message',

  // Lists & Tables
  tableContent: 'Content items table',
  tableCampaigns: 'Campaigns table',
  listTasks: 'Task list',

  // Regions
  regionMain: 'Main content',
  regionSidebar: 'Sidebar',
  regionHeader: 'Site header',
  regionFooter: 'Site footer',
  regionStatus: 'Status messages',
};

/**
 * Helper function to create accessible button attributes
 */
export function createButtonA11y(label: string, ariaLabel?: string) {
  return {
    'aria-label': ariaLabel || label,
    title: label,
  };
}

/**
 * Helper function to create accessible form input attributes
 */
export function createInputA11y(id: string, label: string, required = false) {
  return {
    id,
    'aria-label': label,
    'aria-required': required,
    'aria-describedby': `${id}-error`,
  };
}

/**
 * Helper function to create accessible error message attributes
 */
export function createErrorA11y(fieldId: string, error?: string) {
  return {
    id: `${fieldId}-error`,
    role: 'alert',
    'aria-live': 'polite',
    'aria-atomic': true,
  };
}

/**
 * Helper function to create accessible table attributes
 */
export function createTableA11y(caption: string) {
  return {
    role: 'table',
    'aria-label': caption,
  };
}

/**
 * Helper function to create accessible list attributes
 */
export function createListA11y(label: string) {
  return {
    role: 'list',
    'aria-label': label,
  };
}

/**
 * Helper function to create accessible dialog attributes
 */
export function createDialogA11y(title: string, titleId: string) {
  return {
    role: 'dialog',
    'aria-modal': true,
    'aria-labelledby': titleId,
  };
}

/**
 * Helper function for loading states
 */
export function createLoadingA11y(isLoading: boolean) {
  return {
    'aria-busy': isLoading,
    'aria-live': 'polite',
  };
}

/**
 * Helper function for status badges
 */
export function createStatusBadgeA11y(status: string) {
  const statusMap: Record<string, string> = {
    'draft': 'Draft - Not published',
    'scheduled': 'Scheduled for publication',
    'published': 'Published and live',
    'failed': 'Publication failed',
    'pending': 'Pending review',
  };

  return {
    'aria-label': statusMap[status] || status,
    role: 'status',
    'aria-live': 'polite',
  };
}

/**
 * Helper function for tabs
 */
export function createTabsA11y(activeTab: string, tabId: string) {
  return {
    'aria-selected': activeTab === tabId,
    'aria-controls': `${tabId}-panel`,
    role: 'tab',
  };
}

/**
 * Helper function for tab panels
 */
export function createTabPanelA11y(tabId: string) {
  return {
    id: `${tabId}-panel`,
    role: 'tabpanel',
    'aria-labelledby': tabId,
  };
}

/**
 * Helper function for pagination
 */
export function createPaginationA11y(currentPage: number, totalPages: number) {
  return {
    'aria-label': `Page ${currentPage} of ${totalPages}`,
    'aria-current': 'page',
  };
}

/**
 * Helper function for skip links
 */
export function createSkipLinkA11y(href: string) {
  return {
    href,
    className: 'sr-only focus:not-sr-only',
    'aria-label': 'Skip to main content',
  };
}

/**
 * Screen reader only class (use with Tailwind)
 * .sr-only {
 *   position: absolute;
 *   width: 1px;
 *   height: 1px;
 *   padding: 0;
 *   margin: -1px;
 *   overflow: hidden;
 *   clip: rect(0, 0, 0, 0);
 *   white-space: nowrap;
 *   border-width: 0;
 * }
 *
 * .focus\:not-sr-only:focus {
 *   position: static;
 *   width: auto;
 *   height: auto;
 *   padding: inherit;
 *   margin: inherit;
 *   overflow: visible;
 *   clip: auto;
 *   white-space: normal;
 * }
 */

export default ariaLabels;
