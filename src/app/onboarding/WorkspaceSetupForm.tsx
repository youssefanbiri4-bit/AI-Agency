'use client';

import { useActionState } from 'react';
import { ArrowRight, Building2 } from 'lucide-react';
import { createWorkspaceAction, type WorkspaceSetupState } from './actions';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';

const defaultWorkspaceSetupState: WorkspaceSetupState = {
  error: null,
  fields: {
    name: '',
    slug: '',
  },
};

export function WorkspaceSetupForm() {
  const [state, formAction, isPending] = useActionState(
    createWorkspaceAction,
    defaultWorkspaceSetupState
  );
  const formState = state ?? defaultWorkspaceSetupState;
  const fields = formState.fields ?? defaultWorkspaceSetupState.fields;

  return (
    <Card>
      <CardHeader
        title="Create your workspace"
        description="This workspace will hold your real tasks, reports, reviews, and integration settings."
      />

      {formState.error && (
        <Notice tone="danger" title="Workspace setup needs attention">
          {formState.error}
        </Notice>
      )}

      <form action={formAction} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="name">Workspace Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Acme Growth Team"
            defaultValue={fields.name}
            required
            disabled={isPending}
            autoComplete="organization"
          />
        </div>

        <div>
          <Label htmlFor="slug">Workspace Slug</Label>
          <Input
            id="slug"
            name="slug"
            type="text"
            placeholder="acme-growth-team"
            defaultValue={fields.slug}
            disabled={isPending}
            pattern="[a-zA-Z0-9 -]+"
          />
          <p className="mt-2 text-xs leading-5 text-black/54">
            Leave blank to generate one from the workspace name.
          </p>
        </div>

        <Button type="submit" size="lg" disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Building2 className="h-5 w-5 animate-pulse" />
              Creating workspace...
            </>
          ) : (
            <>
              Create Workspace
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
