'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { deleteCreativeAssetAction } from './actions';

interface CreativeAssetDeleteButtonProps {
  assetId: string;
  redirectAfterDelete?: boolean;
}

export function CreativeAssetDeleteButton({
  assetId,
  redirectAfterDelete = false,
}: CreativeAssetDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm(
      'Delete this creative asset? This will remove it from the asset library and unlink it from any content drafts.'
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCreativeAssetAction(assetId);

      if (result.error) {
        toast.error('Could not delete creative asset.');
        return;
      }

      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Creative asset deleted.');
      }

      if (redirectAfterDelete) {
        router.push('/dashboard/creative-assets');
      } else {
        router.refresh();
      }
    });
  };

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 className="h-4 w-4" />
      {isPending ? 'Deleting...' : 'Delete Asset'}
    </Button>
  );
}
