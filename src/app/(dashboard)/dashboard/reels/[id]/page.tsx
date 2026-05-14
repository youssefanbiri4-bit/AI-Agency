import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ReelDetailRedirectPage({ params }: Props) {
  const { id } = await params;

  redirect(`/dashboard/content-studio?tab=reels&item=${id}`);
}
