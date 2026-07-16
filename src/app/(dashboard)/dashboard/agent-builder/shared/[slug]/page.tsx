import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getAgentBuilderAgentBySlug } from '@/lib/data/agent-builder';
import { SharedTemplateView } from './SharedTemplateView';

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const result = await getAgentBuilderAgentBySlug(slug, supabase);

  return <SharedTemplateView agent={result.data} />;
}
