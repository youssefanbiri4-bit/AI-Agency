import { redirect } from 'next/navigation';

export default function BillingSettingsRedirectPage() {
  redirect('/dashboard/settings');
}
