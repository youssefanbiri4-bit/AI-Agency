'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MapPinned, RefreshCw } from 'lucide-react';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Label, Select } from '@/components/ui/FormControls';
import { Notice } from '@/components/ui/Notice';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useActionToast } from '@/hooks/useActionToast';
import {
  getPinterestConnectionSettingsAction,
  selectPinterestBoardAction,
  type PinterestConnectionSettingsState,
} from './actions';

const initialState: PinterestConnectionSettingsState = {
  error: null,
  status: 'not_connected',
  connectedAt: null,
  updatedAt: null,
  tokenExpiresAt: null,
  grantedScopes: [],
  missingScopes: [],
  missingEnvironmentVariables: [],
  connectedAccount: null,
  tokenStatus: 'not_connected',
  boards: [],
  selectedBoardId: null,
  selectedBoardName: null,
};

function statusLabel(status: PinterestConnectionSettingsState['status']) {
  return status === 'connected' ? 'Ready' : status === 'not_connected' ? 'Not Connected' : 'Setup Required';
}

function formatList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None';
}

export function PinterestConnectionSettings() {
  const [boardState, boardFormAction, boardPending] = useActionState(
    selectPinterestBoardAction,
    initialState
  );
  const [loadedState, setLoadedState] = useState<PinterestConnectionSettingsState>(initialState);
  const activeState = boardState.message || boardState.error ? boardState : loadedState;

  useEffect(() => {
    let isMounted = true;

    void getPinterestConnectionSettingsAction().then((settings) => {
      if (isMounted) {
        setLoadedState(settings);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useActionToast({
    isPending: boardPending,
    state: boardState,
    loadingMessage: 'Saving Pinterest board...',
    successMessage: (state) => state.message ?? 'Pinterest board selected.',
    errorMessage: (state) => state.error ?? 'Pinterest board is required.',
  });

  return (
    <Card>
      <CardHeader
        title="Pinterest Connection"
        description="Select the organic Pin board used by Content Studio."
        action={<StatusBadge status={statusLabel(activeState.status)} type="system" size="sm" />}
      />

      <div className="space-y-4">
        {activeState.error ? (
          <Notice tone="warning" title="Pinterest setup required">
            {activeState.error}
          </Notice>
        ) : null}

        {activeState.missingEnvironmentVariables.length > 0 ? (
          <Notice tone="warning" title="Pinterest environment setup">
            Missing: {activeState.missingEnvironmentVariables.join(', ')}
          </Notice>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="muted-panel p-4">
            <p className="text-sm font-bold text-black">Connection status</p>
            <p className="mt-2 text-sm leading-6 text-black/58">
              {activeState.status === 'connected'
                ? 'Pinterest OAuth connection is active.'
                : 'Connect Pinterest before publishing Pins.'}
            </p>
            <p className="mt-2 text-xs text-black/44">
              Account: {activeState.connectedAccount ?? 'Not available'}
            </p>
            <p className="mt-1 text-xs text-black/44">
              Token: {activeState.tokenStatus.replace(/_/g, ' ')}
            </p>
          </div>

          <div className="muted-panel p-4">
            <p className="text-sm font-bold text-black">Granted scopes</p>
            <p className="mt-2 break-words text-sm leading-6 text-black/58">
              {formatList(activeState.grantedScopes)}
            </p>
            {activeState.missingScopes.length > 0 ? (
              <p className="mt-2 text-xs font-semibold text-[#F7CBCA]">
                Missing: {activeState.missingScopes.join(', ')}
              </p>
            ) : (
              <p className="mt-2 text-xs font-semibold text-black/48">
                Pin publishing scopes are present.
              </p>
            )}
          </div>
        </div>

        <form action={boardFormAction} className="muted-panel p-4">
          <div className="flex items-start gap-3">
            <MapPinned className="mt-1 h-5 w-5 shrink-0 text-[#F7CBCA]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-black">Pinterest boards found</p>
              <p className="mt-1 text-sm leading-6 text-black/58">
                Selected: {activeState.selectedBoardName ?? 'Missing board'}
              </p>
              <div className="mt-4">
                <Label htmlFor="pinterest_board_id">Default board</Label>
                <Select
                  id="pinterest_board_id"
                  name="pinterest_board_id"
                  defaultValue={activeState.selectedBoardId ?? ''}
                  disabled={activeState.status !== 'connected' || boardPending}
                >
                  <option value="">Choose a board</option>
                  {activeState.boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                type="submit"
                variant="outline"
                className="mt-4"
                disabled={activeState.status !== 'connected' || boardPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                {boardPending ? 'Saving...' : 'Save Pinterest Board'}
              </Button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap gap-3">
          <Link href="/api/ads/pinterest/connect?returnTo=settings" className={buttonStyles({ variant: 'primary' })}>
            <RefreshCw className="h-4 w-4" />
            Reconnect Pinterest
          </Link>
        </div>
      </div>
    </Card>
  );
}
