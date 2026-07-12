'use client';

import { useActionState, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionToast } from '@/components/ui/useActionToast';
import { toast } from '@/components/ui/toast';
import type { ContentStudioActionState } from '@/app/(dashboard)/dashboard/content-studio/actions';
import {
  createContentStudioItemAction,
  createContentStudioTaskAction,
  executeContentStudioProviderActionAction,
  updateContentStudioItemAction,
} from '@/app/(dashboard)/dashboard/content-studio/actions';
import { trackTemplateUsageAction } from '@/app/(dashboard)/dashboard/agent-library/usage-actions';
import type { AgentTemplate } from '@/lib/agent-library/templates';
import type { ContentStudioItemView } from '@/app/(dashboard)/dashboard/content-studio/shared';
import {
  buildTemplatePrefill,
  buildQueryHref,
  providerActionProgressLabel,
  isScheduleMessage,
} from './shared';
import type { TemplatePrefillType } from './shared';

const initialActionState: ContentStudioActionState = {
  error: null,
  message: null,
  itemId: null,
  taskId: null,
  outcome: null,
};

interface UseContentStudioFormActionsOptions {
  selectedItem: ContentStudioItemView | null;
  agentTemplate?: AgentTemplate | null;
  schedulerReady: boolean;
  schedulerMessage: string;
}

interface UseContentStudioFormActionsReturn {
  formRef: React.RefObject<HTMLFormElement | null>;
  saveState: ContentStudioActionState;
  saveFormAction: (payload: FormData) => void;
  savePending: boolean;
  taskState: ContentStudioActionState;
  taskFormAction: (payload: FormData) => void;
  taskPending: boolean;
  providerState: ContentStudioActionState;
  providerFormAction: (payload: FormData) => void;
  providerPending: boolean;
  templatePrefill: TemplatePrefillType;
  scheduleToastMethod: typeof toast.info | typeof toast.warning;
}

export function useContentStudioFormActions({
  selectedItem,
  agentTemplate,
  schedulerReady,
  schedulerMessage,
}: UseContentStudioFormActionsOptions): UseContentStudioFormActionsReturn {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement | null>(null);

  const saveAction = useMemo(
    () =>
      selectedItem
        ? updateContentStudioItemAction.bind(null, selectedItem.id)
        : createContentStudioItemAction,
    [selectedItem]
  );

  const taskAction = useMemo(
    () =>
      selectedItem
        ? createContentStudioTaskAction.bind(null, selectedItem.id)
        : createContentStudioTaskAction.bind(null, ''),
    [selectedItem]
  );

  const providerAction = useMemo(
    () =>
      selectedItem
        ? executeContentStudioProviderActionAction.bind(null, selectedItem.id)
        : executeContentStudioProviderActionAction.bind(null, ''),
    [selectedItem]
  );

  const [saveState, saveFormAction, savePending] = useActionState(saveAction, initialActionState);
  const [taskState, taskFormAction, taskPending] = useActionState(taskAction, initialActionState);
  const [providerState, providerFormAction, providerPending] = useActionState(
    providerAction,
    initialActionState
  );

  const templatePrefill = useMemo(() => buildTemplatePrefill(agentTemplate), [agentTemplate]);

  useEffect(() => {
    if (!agentTemplate) return;

    void trackTemplateUsageAction({
      templateId: agentTemplate.id,
      actionType: 'view_template',
      sourcePage: 'content_studio',
      metadata: { surface: 'template_prefill' },
    });
  }, [agentTemplate]);

  const scheduleToastMethod =
    selectedItem?.content_type === 'linkedin_post_planner'
      ? toast.warning
      : schedulerReady
        ? toast.info
        : toast.warning;

  useActionToast({
    isPending: savePending,
    state: saveState,
    loadingMessage: selectedItem ? 'Updating campaign...' : 'Creating campaign...',
    successMessage: (currentState) =>
      currentState.message ?? (selectedItem ? 'Campaign draft saved.' : 'Campaign draft saved.'),
    successDescription: (currentState) =>
      isScheduleMessage(currentState.message)
        ? schedulerReady
          ? 'The secure scheduler will pick this item up at or after the planned time when provider readiness allows it.'
          : schedulerMessage
        : selectedItem
          ? 'Draft saved and creative assets synced.'
          : 'You can keep editing it from Content Library.',
    errorMessage: (currentState) => currentState.error ?? (selectedItem ? 'Could not update content item.' : 'Could not create content item.'),
  });

  useActionToast({
    isPending: taskPending,
    state: taskState,
    loadingMessage: 'Creating AI task...',
    successMessage: () => 'AI task created.',
    successDescription: 'You can view it in Tasks.',
    successAction: (currentState) =>
      currentState.taskId
        ? {
            label: 'Open Tasks',
            href: `/dashboard/tasks/${currentState.taskId}`,
          }
        : {
            label: 'Open Tasks',
            href: '/dashboard/tasks',
          },
    errorMessage: (currentState) => currentState.error ?? 'Could not create AI task.',
  });

  useActionToast({
    isPending: providerPending,
    state: providerState,
    loadingMessage:
      selectedItem
        ? providerActionProgressLabel(selectedItem)
        : 'Processing provider action...',
    successMessage: (currentState) =>
      selectedItem?.content_type === 'pinterest_pin' && currentState.outcome === 'success'
        ? 'Published to Pinterest successfully.'
        : selectedItem?.content_type === 'google_ads_campaign_draft' && currentState.outcome === 'success'
          ? 'Paused Google Ads draft created.'
          : selectedItem && selectedItem.content_type.includes('ad') && currentState.outcome === 'success'
            ? 'Paused Meta ad draft created.'
            : currentState.message ?? 'Provider action completed.',
    successDescription: (currentState) =>
      currentState.outcome === 'success'
        ? 'The provider confirmed the action and the item was updated.'
        : undefined,
    errorMessage: (currentState) =>
      selectedItem?.content_type === 'pinterest_pin'
        ? currentState.error ?? 'Could not publish to Pinterest.'
        : currentState.error ?? 'Could not publish.',
  });

  useEffect(() => {
    if (!saveState.itemId || saveState.error) {
      return;
    }

    router.replace(
      buildQueryHref({
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
        itemId: saveState.itemId,
      })
    );
    router.refresh();
  }, [pathname, router, saveState.error, saveState.itemId, searchParams]);

  useEffect(() => {
    if (!providerState.itemId) {
      return;
    }

    router.replace(
      buildQueryHref({
        pathname,
        searchParams: new URLSearchParams(searchParams.toString()),
        itemId: providerState.itemId,
      })
    );
    router.refresh();
  }, [pathname, providerState.itemId, router, searchParams]);

  return {
    formRef,
    saveState,
    saveFormAction,
    savePending,
    taskState,
    taskFormAction,
    taskPending,
    providerState,
    providerFormAction,
    providerPending,
    templatePrefill,
    scheduleToastMethod,
  };
}
