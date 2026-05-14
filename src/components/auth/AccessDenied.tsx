import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { buttonStyles } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function AccessDenied({
  message = 'You do not have permission to perform this action.',
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-[54vh] items-center justify-center px-4 py-12">
      <Card className="max-w-lg text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#5D6B6B] text-[#D5E5E5]">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <h1 className="mt-5 text-2xl font-black text-[#5D6B6B]">Access denied</h1>
        <p className="mt-2 text-sm leading-6 text-black/58">{message}</p>
        <Link href="/dashboard" className={buttonStyles({ className: 'mt-6' })}>
          Back to Dashboard
        </Link>
      </Card>
    </div>
  );
}
