export const workspaceRoles = ['owner', 'admin', 'operator', 'editor', 'viewer'] as const;
export type StrictWorkspaceRole = (typeof workspaceRoles)[number];

export interface WorkspacePermission {
  area: string;
  owner: string[];
  admin: string[];
  operator: string[];
  editor: string[];
  viewer: string[];
}

export const actionLabels = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  publish: 'Publish',
  run: 'Run',
  export: 'Export',
  manage_settings: 'Manage Settings',
} as const;

const allActions = Object.keys(actionLabels);
const contentOperatorActions = ['view', 'create', 'edit', 'publish', 'run', 'export'];
const contentEditorActions = ['view', 'create', 'edit'];

export const permissionsMatrix: WorkspacePermission[] = [
  { area: 'Dashboard', owner: allActions, admin: ['view', 'export'], operator: ['view'], editor: ['view'], viewer: ['view'] },
  { area: 'Content Studio', owner: allActions, admin: allActions, operator: contentOperatorActions, editor: contentEditorActions, viewer: ['view'] },
  { area: 'Content Library', owner: allActions, admin: allActions, operator: contentOperatorActions, editor: contentEditorActions, viewer: ['view'] },
  { area: 'Creative Assets', owner: allActions, admin: allActions, operator: contentOperatorActions, editor: contentEditorActions, viewer: ['view'] },
  { area: 'Projects', owner: allActions, admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'], operator: ['view', 'create', 'edit'], editor: ['view', 'create', 'edit'], viewer: ['view'] },
  { area: 'Prompt Library', owner: allActions, admin: ['view', 'create', 'edit', 'delete', 'export'], operator: ['view', 'create', 'edit'], editor: ['view', 'create', 'edit'], viewer: ['view'] },
  { area: 'Releases', owner: allActions, admin: ['view', 'create', 'edit', 'delete', 'export'], operator: ['view'], editor: ['view'], viewer: ['view'] },
  { area: 'Reports / Analytics', owner: allActions, admin: ['view', 'export'], operator: ['view', 'export'], editor: ['view'], viewer: ['view'] },
  { area: 'System Health', owner: allActions, admin: ['view', 'export'], operator: ['view'], editor: [], viewer: [] },
  { area: 'Security Center', owner: allActions, admin: ['view', 'export'], operator: [], editor: [], viewer: [] },
  { area: 'Backup Center', owner: allActions, admin: ['view', 'export'], operator: ['view'], editor: [], viewer: [] },
  { area: 'Provider Settings', owner: allActions, admin: ['view'], operator: [], editor: [], viewer: [] },
  { area: 'Brand Kit / Theme', owner: allActions, admin: ['view', 'edit', 'manage_settings'], operator: ['view'], editor: ['view'], viewer: ['view'] },
  { area: 'Tasks', owner: allActions, admin: allActions, operator: ['view', 'create', 'edit', 'run'], editor: ['view', 'create'], viewer: ['view'] },
  { area: 'Reviews', owner: allActions, admin: allActions, operator: ['view', 'create', 'edit'], editor: ['view', 'create'], viewer: ['view'] },
  { area: 'Scheduler', owner: allActions, admin: ['view', 'run'], operator: ['view'], editor: [], viewer: [] },
  { area: 'GitHub Integration', owner: allActions, admin: ['view', 'create', 'edit'], operator: ['view'], editor: ['view'], viewer: ['view'] },
  { area: 'Codebase Analyzer', owner: allActions, admin: ['view', 'create', 'edit', 'export'], operator: ['view'], editor: ['view'], viewer: ['view'] },
  { area: 'AI Assistant', owner: allActions, admin: ['view', 'create', 'run'], operator: ['view', 'create'], editor: ['view', 'create'], viewer: ['view'] },
  { area: 'Roles & Permissions', owner: allActions, admin: ['view'], operator: [], editor: [], viewer: [] },
];

export function getPermissionLevelSummary(role: StrictWorkspaceRole) {
  switch (role) {
    case 'owner':
      return 'Full workspace control, including roles, providers, security, backups, scheduler, and publishing.';
    case 'admin':
      return 'Can manage core workspace content and operations, with sensitive ownership and secret controls restricted.';
    case 'operator':
      return 'Can manage content operations and scheduling workflows, without provider, backup, security, or role control.';
    case 'editor':
      return 'Can draft and edit content, assets, prompts, and tasks, without publishing or settings access.';
    case 'viewer':
      return 'Read-only access to dashboard, projects, reports, and documentation.';
  }
}
