import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="group card-lift flex h-full flex-col rounded-lg border border-black/8 bg-white p-6 shadow-[0_18px_48px_rgba(0,0,0,0.06)] hover:border-[#8B3CDE]/24 hover:shadow-[0_24px_64px_rgba(139,60,222,0.12)]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-[#8B3CDE]/14 bg-[#F0DBEF]/62 text-[#8B3CDE] group-hover:bg-[#8B3CDE] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold text-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-black/62">{description}</p>
    </article>
  );
}
