'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, GitBranch, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import {
  formatProjectStatus,
  formatProjectType,
  normalizeProjectMetadata,
  projectPriorities,
  projectStatuses,
  projectTypes,
} from '@/lib/data/projects';
import { parseGitHubRepoUrl } from '@/lib/github-url';
import type { ProjectRecord } from '@/types/database';
import {
  createProjectAction,
  updateProjectAction,
  type ProjectFormState,
} from './actions';

interface ProjectFormProps {
  mode: 'create' | 'edit';
  project?: ProjectRecord;
}

const initialState: ProjectFormState = {
  error: null,
  message: null,
  projectId: null,
};

type TextMetadataKey =
  | 'release_notes'
  | 'last_deploy_notes'
  | 'known_issues'
  | 'rollback_notes'
  | 'testing_checklist';

function metadataText(project: ProjectRecord | undefined, key: TextMetadataKey) {
  if (!project) return '';

  const metadata = normalizeProjectMetadata(project.metadata);
  return metadata[key] ?? '';
}

function nextActionsText(project: ProjectRecord | undefined) {
  if (!project) return '';

  return normalizeProjectMetadata(project.metadata).next_actions.join('\n');
}

export function ProjectForm({ mode, project }: ProjectFormProps) {
  const router = useRouter();
  const action = mode === 'create' ? createProjectAction : updateProjectAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useActionToast({
    isPending,
    state,
    loadingMessage: mode === 'create' ? 'Creating project...' : 'Updating project...',
    successMessage: (currentState) =>
      currentState.message ?? (mode === 'create' ? 'Project created.' : 'Project updated.'),
    errorMessage: (currentState) =>
      currentState.error ?? (mode === 'create' ? 'Could not create project.' : 'Could not update project.'),
  });

  useEffect(() => {
    if (mode === 'create' && state.projectId && !state.error) {
      router.push(`/dashboard/projects/${state.projectId}`);
    }

    if (mode === 'edit' && state.projectId && !state.error) {
      router.refresh();
    }
  }, [mode, router, state.error, state.projectId]);

  return (
    <form action={formAction} className="space-y-6">
      {project ? <input type="hidden" name="projectId" value={project.id} /> : null}

      {state.error && (
        <Notice tone="danger" title={mode === 'create' ? 'Could not create project' : 'Could not update project'}>
          {state.error}
        </Notice>
      )}

      <Card>
        <CardHeader
          title={mode === 'create' ? 'New Project' : 'Edit Project'}
          description="Keep internal project context, delivery links, notes, and deployment readiness in one place."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label htmlFor="name">
              Project name <span className="text-[#F7CBCA]">*</span>
            </Label>
            <Input id="name" name="name" defaultValue={project?.name ?? ''} required disabled={isPending} />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={project?.description ?? ''}
              rows={4}
              disabled={isPending}
              placeholder="What is this project, product, campaign, or system for?"
            />
          </div>

          <div>
            <Label htmlFor="projectType">Project type</Label>
            <Select id="projectType" name="projectType" defaultValue={project?.project_type ?? 'software'} disabled={isPending}>
              {projectTypes.map((type) => (
                <option key={type} value={type}>
                  {formatProjectType(type)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={project?.status ?? 'planning'} disabled={isPending}>
              {projectStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatProjectStatus(status)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" name="priority" defaultValue={project?.priority ?? 'medium'} disabled={isPending}>
              {projectPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="techStack">Tech stack</Label>
            <Input id="techStack" name="techStack" defaultValue={project?.tech_stack ?? ''} disabled={isPending} placeholder="Next.js, Supabase, Vercel" />
          </div>

          <GitHubProjectFields project={project} disabled={isPending} />

          <div>
            <Label htmlFor="productionUrl">Production URL</Label>
            <Input id="productionUrl" name="productionUrl" type="url" defaultValue={project?.production_url ?? ''} disabled={isPending} placeholder="https://..." />
          </div>

          <div>
            <Label htmlFor="stagingUrl">Staging URL</Label>
            <Input id="stagingUrl" name="stagingUrl" type="url" defaultValue={project?.staging_url ?? ''} disabled={isPending} placeholder="https://..." />
          </div>

          <div>
            <Label htmlFor="documentationUrl">Documentation URL</Label>
            <Input id="documentationUrl" name="documentationUrl" type="url" defaultValue={project?.documentation_url ?? ''} disabled={isPending} placeholder="https://..." />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="localPathNote">Local path note</Label>
            <Input id="localPathNote" name="localPathNote" defaultValue={project?.local_path_note ?? ''} disabled={isPending} placeholder="/home/youssef/AI-Agency or local setup notes" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Notes & Release Details"
          description="Manual notes only. Do not store API keys, tokens, or private credentials here."
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Label htmlFor="nextActions">Next actions</Label>
            <Textarea id="nextActions" name="nextActions" defaultValue={nextActionsText(project)} rows={4} disabled={isPending} placeholder="One action per line" />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="notes">Project notes</Label>
            <Textarea id="notes" name="notes" defaultValue={project?.notes ?? ''} rows={5} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="releaseNotes">Release / deployment notes</Label>
            <Textarea id="releaseNotes" name="releaseNotes" defaultValue={metadataText(project, 'release_notes')} rows={4} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="lastDeployNotes">Last deploy notes</Label>
            <Textarea id="lastDeployNotes" name="lastDeployNotes" defaultValue={metadataText(project, 'last_deploy_notes')} rows={4} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="knownIssues">Known issues</Label>
            <Textarea id="knownIssues" name="knownIssues" defaultValue={metadataText(project, 'known_issues')} rows={4} disabled={isPending} />
          </div>

          <div>
            <Label htmlFor="rollbackNotes">Rollback notes</Label>
            <Textarea id="rollbackNotes" name="rollbackNotes" defaultValue={metadataText(project, 'rollback_notes')} rows={4} disabled={isPending} />
          </div>

          <div className="lg:col-span-2">
            <Label htmlFor="testingChecklist">Testing checklist</Label>
            <Textarea id="testingChecklist" name="testingChecklist" defaultValue={metadataText(project, 'testing_checklist')} rows={4} disabled={isPending} />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? <Clock className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isPending
            ? mode === 'create'
              ? 'Creating...'
              : 'Updating...'
            : mode === 'create'
              ? 'Create Project'
              : 'Update Project'}
        </Button>
      </div>
    </form>
  );
}

function GitHubProjectFields({
  project,
  disabled,
}: {
  project?: ProjectRecord;
  disabled: boolean;
}) {
  const metadata = normalizeProjectMetadata(project?.metadata);
  const [repoUrl, setRepoUrl] = useState(project?.github_url ?? metadata.github.repo_url ?? '');
  const [owner, setOwner] = useState(metadata.github.owner ?? parseGitHubRepoUrl(project?.github_url)?.owner ?? '');
  const [repo, setRepo] = useState(metadata.github.repo ?? parseGitHubRepoUrl(project?.github_url)?.repo ?? '');
  const [defaultBranch, setDefaultBranch] = useState(metadata.github.default_branch ?? '');

  function parseUrl(value: string) {
    const parsed = parseGitHubRepoUrl(value);

    if (!parsed) return;

    setOwner((current) => current || parsed.owner);
    setRepo((current) => current || parsed.repo);
    setRepoUrl(parsed.url);
  }

  return (
    <div className="lg:col-span-2 rounded-2xl border border-[#F7CBCA]/12 bg-[#F1F7F7]/65 p-4">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#F7CBCA] shadow-sm">
          <GitBranch className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-black text-[#5D6B6B]">GitHub Repository</h3>
          <p className="mt-1 text-sm leading-6 text-black/56">
            Store repository metadata for read-only project tracking. Token setup is not required just to save the URL.
          </p>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Label htmlFor="githubUrl">GitHub repo URL</Label>
          <Input
            id="githubUrl"
            name="githubUrl"
            type="url"
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            onBlur={(event) => parseUrl(event.target.value)}
            disabled={disabled}
            placeholder="https://github.com/owner/repo"
          />
        </div>
        <div>
          <Label htmlFor="githubOwner">Repository owner</Label>
          <Input
            id="githubOwner"
            name="githubOwner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            disabled={disabled}
            placeholder="owner"
          />
        </div>
        <div>
          <Label htmlFor="githubRepo">Repository name</Label>
          <Input
            id="githubRepo"
            name="githubRepo"
            value={repo}
            onChange={(event) => setRepo(event.target.value)}
            disabled={disabled}
            placeholder="repo"
          />
        </div>
        <div>
          <Label htmlFor="githubDefaultBranch">Default branch</Label>
          <Input
            id="githubDefaultBranch"
            name="githubDefaultBranch"
            value={defaultBranch}
            onChange={(event) => setDefaultBranch(event.target.value)}
            disabled={disabled}
            placeholder="main"
          />
        </div>
        <div className="rounded-lg border border-black/7 bg-white/75 p-3 text-sm leading-6 text-black/58">
          Use a fine-grained read-only GitHub token for live commits, issues, branches, and pull requests.
        </div>
      </div>
    </div>
  );
}
