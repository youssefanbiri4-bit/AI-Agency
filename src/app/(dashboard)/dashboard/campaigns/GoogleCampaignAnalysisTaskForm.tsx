'use client';

import { useActionState } from 'react';
import { BarChart3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import {
  createGoogleAdsCampaignAnalysisTask,
  type CampaignTaskState,
} from './actions';

interface GoogleCampaignAnalysisTaskFormProps {
  customerId: string;
  campaignId: string;
}

const initialState: CampaignTaskState = {
  error: null,
};

export function GoogleCampaignAnalysisTaskForm({
  customerId,
  campaignId,
}: GoogleCampaignAnalysisTaskFormProps) {
  const [state, action, isPending] = useActionState(
    createGoogleAdsCampaignAnalysisTask,
    initialState
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="campaignId" value={campaignId} />

      {state?.error && (
        <Notice tone="danger" title="Analysis task was not created" className="shadow-none">
          {state.error}
        </Notice>
      )}

      <Button type="submit" variant="soft" size="sm" disabled={isPending}>
        {isPending ? (
          <>
            <Clock className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4" />
            Create AI Analysis Task
          </>
        )}
      </Button>
    </form>
  );
}
