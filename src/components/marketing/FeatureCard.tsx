import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="group card-lift flex h-full flex-col rounded-lg border border-[#F7CBCA]/10 bg-white/70 p-6 shadow-[0_18px_42px_rgba(93,107,107,0.06)] backdrop-blur-[14px] [-webkit-backdrop-filter:blur(14px)] hover:border-[#F7CBCA]/24 hover:shadow-[0_24px_64px_rgba(202,40,81,0.12)]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-[#F7CBCA]/14 bg-[#D5E5E5]/62 text-[#F7CBCA] group-hover:bg-[#F7CBCA] group-hover:text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-bold text-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-black/62">{description}</p>
    </article>
  );
}
