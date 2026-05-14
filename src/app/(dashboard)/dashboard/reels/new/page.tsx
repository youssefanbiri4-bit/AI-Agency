import { redirect } from 'next/navigation';

export default function NewReelPage() {
  redirect('/dashboard/content-studio?tab=reels&type=instagram_reel');
}
