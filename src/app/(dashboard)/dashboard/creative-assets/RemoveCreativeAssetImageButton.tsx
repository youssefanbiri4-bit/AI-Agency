'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/toast';
import { removeCreativeAssetImageAction } from './actions';

interface RemoveCreativeAssetImageButtonProps {
  assetId: string;
}

export function RemoveCreativeAssetImageButton({ assetId }: RemoveCreativeAssetImageButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRemoveImage = () => {
    startTransition(async () => {
      const result = await removeCreativeAssetImageAction(assetId);

      if (result.error) {
        toast.error('Could not remove image from asset.');
        return;
      }

      if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success('Image removed from asset.');
      }

      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRemoveImage}
      disabled={isPending}
    >
      <ImageOff className="h-4 w-4" />
      {isPending ? 'Removing...' : 'Remove Image'}
    </Button>
  );
}
