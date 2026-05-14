'use client';

import { useActionState, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, FilePlus, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { useActionToast } from '@/components/ui/useActionToast';
import { formatReleaseStatus, formatReleaseType, releaseStatuses, releaseTypes } from '@/lib/data/releases';
import type { ProjectRecord, ReleaseRecord } from '@/types/database';
import { createReleaseAction, updateReleaseAction, type ReleaseFormState } from './actions';

interface ReleaseFormProps {
  mode: 'create' | 'edit';
  release?: ReleaseRecord;
  projects: ProjectRecord[];
  onCancel?: () => void;
}

const initialState: ReleaseFormState = { error: null, message: null, releaseId: null };

const template = {
  summary: 'Summary:\n\nFiles Changed:\n\nVerification:\n- npm run lint:\n- npx tsc --noEmit:\n- npm run build:\n\nDeployment:\n\nKnown Issues:\n\nSafety Confirmations:\n- Task execution logic was not changed.\n- Provider publishing logic was not changed.\n- Real Scheduling Execution core logic was not changed.\n- n8n/callbacks/webhooks were not changed.\n- Environment variables/secrets were not touched.\n- ads_management was not added.\n\nNext Steps:',
  testingChecklist: '- Open affected dashboard routes\n- Create/edit primary record\n- Verify responsive layout\n- Confirm no runtime errors\n- Confirm no secrets exposed',
};

export function ReleaseForm({ mode, release, projects, onCancel }: ReleaseFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(mode === 'create' ? createReleaseAction : updateReleaseAction, initialState);
  const [summary, setSummary] = useState(release?.summary ?? '');
  const [testingChecklist, setTestingChecklist] = useState(release?.testing_checklist ?? '');

  useActionToast({
    isPending,
    state,
    loadingMessage: mode === 'create' ? 'Creating release...' : 'Updating release...',
    successMessage: (current) => current.message ?? (mode === 'create' ? 'Release created.' : 'Release updated.'),
    errorMessage: (current) => current.error ?? (mode === 'create' ? 'Could not create release.' : 'Could not update release.'),
  });

  useEffect(() => {
    if (mode === 'create' && state.releaseId && !state.error) {
      router.push(`/dashboard/releases/${state.releaseId}`);
    }
    if (mode === 'edit' && state.releaseId && !state.error) router.refresh();
  }, [mode, router, state.error, state.releaseId]);

  return (
    <form action={formAction} className="space-y-6">
      {release ? <input type="hidden" name="releaseId" value={release.id} /> : null}
      {state.error && <Notice tone="danger" title="Release was not saved">{state.error}</Notice>}
      <Card>
        <CardHeader
          title={mode === 'create' ? 'New Release' : 'Edit Release'}
          description="Do not paste API keys, tokens, or private credentials into release notes."
          action={mode === 'create' ? (
            <Button type="button" variant="outline" onClick={() => { setSummary(template.summary); setTestingChecklist(template.testingChecklist); }}>
              <FilePlus className="h-4 w-4" />
              Create Release from Latest Phase
            </Button>
          ) : null}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <Field name="title" label="Title" defaultValue={release?.title} required disabled={isPending} />
          <Field name="version" label="Version" defaultValue={release?.version} disabled={isPending} />
          <Field name="phaseName" label="Phase name" defaultValue={release?.phase_name} disabled={isPending} />
          <div>
            <Label htmlFor="projectId">Related project</Label>
            <Select id="projectId" name="projectId" defaultValue={release?.project_id ?? ''} disabled={isPending}>
              <option value="">No project</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="releaseType">Release type</Label>
            <Select id="releaseType" name="releaseType" defaultValue={release?.release_type ?? 'feature'} disabled={isPending}>
              {releaseTypes.map((type) => <option key={type} value={type}>{formatReleaseType(type)}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={release?.status ?? 'draft'} disabled={isPending}>
              {releaseStatuses.map((status) => <option key={status} value={status}>{formatReleaseStatus(status)}</option>)}
            </Select>
          </div>
          <Text name="summary" label="Summary" value={summary} onChange={setSummary} disabled={isPending} />
          <Text name="filesChanged" label="Files changed" defaultValue={release?.files_changed} disabled={isPending} />
          <Text name="featuresAdded" label="Features added" defaultValue={release?.features_added} disabled={isPending} />
          <Text name="fixes" label="Fixes" defaultValue={release?.fixes} disabled={isPending} />
          <Text name="knownIssues" label="Known issues" defaultValue={release?.known_issues} disabled={isPending} />
          <Text name="testingChecklist" label="Testing checklist" value={testingChecklist} onChange={setTestingChecklist} disabled={isPending} />
          <Text name="rollbackNotes" label="Rollback notes" defaultValue={release?.rollback_notes} disabled={isPending} />
          <Text name="testedRoutes" label="Tested routes" defaultValue={String(release?.metadata?.tested_routes ?? '')} disabled={isPending} />
          <Text name="warnings" label="Warnings" defaultValue={String(release?.metadata?.warnings ?? '')} disabled={isPending} />
          <Text name="blockers" label="Blockers" defaultValue={String(release?.metadata?.blockers ?? '')} disabled={isPending} />
          <Field name="deployUrl" label="Deploy URL" type="url" defaultValue={release?.deploy_url} disabled={isPending} />
          <Field name="mainProductionUrl" label="Main production URL" type="url" defaultValue={release?.main_production_url} disabled={isPending} />
          <Field name="previousDeployUrl" label="Previous deploy URL" type="url" defaultValue={String(release?.metadata?.previous_deploy_url ?? '')} disabled={isPending} />
          <Field name="buildStatus" label="Build status" defaultValue={release?.build_status} disabled={isPending} />
          <Field name="lintStatus" label="Lint status" defaultValue={release?.lint_status} disabled={isPending} />
          <Field name="typecheckStatus" label="Typecheck status" defaultValue={release?.typecheck_status} disabled={isPending} />
          <Field name="deployStatus" label="Deploy status" defaultValue={release?.deploy_status} disabled={isPending} />
          <Field name="deployedAt" label="Deployed at" type="datetime-local" defaultValue={release?.deployed_at?.slice(0, 16)} disabled={isPending} />
          <Text name="safeRecoverySteps" label="Safe recovery steps" defaultValue={String(release?.metadata?.safe_recovery_steps ?? '')} disabled={isPending} />
        </div>
      </Card>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>}
        <Button type="submit" size="lg" disabled={isPending}>{isPending ? <Clock className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}{mode === 'create' ? 'Create Release' : 'Update Release'}</Button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'defaultValue' | 'id' | 'name'>;

function Field({ label, name, defaultValue, ...props }: FieldProps) {
  return <div><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={defaultValue ?? ''} {...props} /></div>;
}

function Text({ label, name, value, onChange, defaultValue, disabled }: { label: string; name: string; value?: string; onChange?: (value: string) => void; defaultValue?: string | null; disabled?: boolean }) {
  return <div className="lg:col-span-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} defaultValue={value === undefined ? defaultValue ?? '' : undefined} rows={4} disabled={disabled} /></div>;
}
