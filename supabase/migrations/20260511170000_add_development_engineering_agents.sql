-- Phase 17: Development & Engineering department and developer agents.
-- Safe catalog-only seed. Does not create tasks, execute n8n workflows, modify callbacks,
-- change provider publishing, or touch secrets.

insert into public.departments (id, name, description, color, sort_order)
values
  (
    'development_engineering',
    'Development & Engineering',
    'Helps the manager plan, review, debug, document, test, and deploy software projects inside AgentFlow AI.',
    '#CA2851',
    4
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.agents (
  id,
  department_id,
  name,
  role,
  description,
  capabilities,
  example_tasks,
  icon,
  color,
  sort_order,
  is_active
)
values
  (
    'code-review-agent',
    'development_engineering',
    'Code Review Agent',
    'Development & Engineering',
    'Reviews code quality, structure, readability, maintainability, and potential bugs.',
    array['Code quality review', 'Changed-file review', 'Pull request summary review', 'Risk detection', 'Testing checklist'],
    array['Review recent project changes', 'Review a pull request summary', 'Inspect component structure and risky code'],
    'Code',
    '#CA2851',
    19,
    true
  ),
  (
    'bug-fix-agent',
    'development_engineering',
    'Bug Fix Agent',
    'Development & Engineering',
    'Analyzes errors, logs, screenshots, and failing behavior to propose a safe fix plan.',
    array['Root-cause analysis', 'Build error triage', 'Runtime crash planning', 'TypeScript error review', 'Safe fix plan'],
    array['Analyze this build error', 'Create a safe fix plan for a broken UI behavior', 'Investigate a failed API call'],
    'Bug',
    '#CA2851',
    20,
    true
  ),
  (
    'architecture-agent',
    'development_engineering',
    'Architecture Agent',
    'Development & Engineering',
    'Plans system architecture, project structure, data flow, and feature implementation phases.',
    array['Architecture planning', 'Folder structure design', 'Data flow mapping', 'Database design', 'API/server actions plan'],
    array['Plan a new SaaS project architecture', 'Design a provider integration', 'Split this feature into implementation phases'],
    'Workflow',
    '#CA2851',
    21,
    true
  ),
  (
    'testing-agent',
    'development_engineering',
    'Testing Agent',
    'Development & Engineering',
    'Creates testing checklists, QA plans, edge cases, and acceptance criteria.',
    array['Manual QA planning', 'Route smoke testing', 'Form validation testing', 'Provider readiness testing', 'Acceptance criteria'],
    array['Create final stabilization checklist', 'Write route smoke test plan', 'Create provider readiness test checklist'],
    'TestTube',
    '#CA2851',
    22,
    true
  ),
  (
    'documentation-agent',
    'development_engineering',
    'Documentation Agent',
    'Development & Engineering',
    'Creates internal guides, user docs, technical reports, release notes, FAQs, and checklists.',
    array['Internal documentation', 'Technical reports', 'Release notes', 'Setup guides', 'FAQ writing'],
    array['Write a feature guide', 'Create release summary', 'Document this setup workflow'],
    'BookOpen',
    '#CA2851',
    23,
    true
  ),
  (
    'deployment-agent',
    'development_engineering',
    'Deployment Agent',
    'Development & Engineering',
    'Prepares deployment plans, Vercel checks, environment checklists, smoke tests, and rollback notes.',
    array['Vercel deployment planning', 'Environment checklist', 'Migration checklist', 'Smoke test report', 'Rollback plan'],
    array['Prepare production deployment checklist', 'Review Vercel build error', 'Create rollback notes for this release'],
    'Rocket',
    '#CA2851',
    24,
    true
  ),
  (
    'security-review-agent',
    'development_engineering',
    'Security Review Agent',
    'Development & Engineering',
    'Reviews security risks, secret exposure, RLS, file upload safety, OAuth, and token storage.',
    array['Secret exposure review', 'RLS review', 'OAuth/token storage review', 'Upload safety review', 'No-secrets checklist'],
    array['Review env var safety', 'Audit Supabase RLS notes', 'Check file upload safety'],
    'ShieldCheck',
    '#CA2851',
    25,
    true
  ),
  (
    'database-agent',
    'development_engineering',
    'Database Agent',
    'Development & Engineering',
    'Plans and reviews database schema, Supabase migrations, RLS, indexes, relationships, and storage policies.',
    array['Migration planning', 'SQL review', 'RLS checklist', 'Relationship design', 'Storage policy review'],
    array['Design a workspace-scoped table', 'Review Supabase migration', 'Create RLS testing checklist'],
    'Database',
    '#CA2851',
    26,
    true
  ),
  (
    'ui-ux-review-agent',
    'development_engineering',
    'UI/UX Review Agent',
    'Development & Engineering',
    'Reviews interface layout, readability, flows, accessibility, and responsive behavior.',
    array['UI audit', 'Responsive review', 'Accessibility notes', 'Flow review', 'Layout improvement plan'],
    array['Review dashboard layout', 'Audit mobile responsiveness', 'Suggest UI fixes for a crowded form'],
    'PanelsTopLeft',
    '#CA2851',
    27,
    true
  )
on conflict (id) do update
set
  department_id = excluded.department_id,
  name = excluded.name,
  role = excluded.role,
  description = excluded.description,
  capabilities = excluded.capabilities,
  example_tasks = excluded.example_tasks,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
