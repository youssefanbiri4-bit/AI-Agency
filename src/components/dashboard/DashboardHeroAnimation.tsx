import { BarChart3, CheckCircle2, ClipboardList, Megaphone, RadioTower, Sparkles } from 'lucide-react';

const floatingCards = [
  {
    label: 'Tasks',
    value: 'Review queue',
    icon: ClipboardList,
    className: 'dashboard-hero-float dashboard-hero-float-a left-4 top-6',
  },
  {
    label: 'Content',
    value: 'Draft ready',
    icon: Megaphone,
    className: 'dashboard-hero-float dashboard-hero-float-b right-5 top-16',
  },
  {
    label: 'Providers',
    value: 'Live checks',
    icon: RadioTower,
    className: 'dashboard-hero-float dashboard-hero-float-c bottom-6 left-7',
  },
];

export function DashboardHeroAnimation() {
  return (
    <div
      className="dashboard-hero-animation relative min-h-[280px] overflow-hidden rounded-[22px] border border-[#F7CBCA]/12 bg-[#F1F7F7] shadow-[0_22px_58px_rgba(93,107,107,0.10)]"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,227,179,0.92),rgba(255,248,242,0.78)_48%,rgba(255,255,255,0.92))]" />
      <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#F7CBCA]/16 blur-2xl" />
      <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-[#F7CBCA]/14 blur-2xl" />

      <div className="absolute left-1/2 top-1/2 h-40 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-white/70 bg-white/76 p-4 shadow-[0_24px_60px_rgba(93,107,107,0.13)] backdrop-blur-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5D6B6B] text-[#D5E5E5]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-black/42">AI Operator</p>
              <p className="text-sm font-black text-[#5D6B6B]">Agency cockpit</p>
            </div>
          </div>
          <span className="dashboard-hero-pulse h-2.5 w-2.5 rounded-full bg-[#F7CBCA]" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#D5E5E5]">
            <div className="dashboard-hero-progress h-full rounded-full bg-gradient-to-r from-[#F7CBCA] to-[#F7CBCA]" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <MiniPanel label="Plan" active />
            <MiniPanel label="Draft" active />
            <MiniPanel label="Report" />
          </div>
        </div>

        <div className="dashboard-hero-check absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white bg-[#5D6B6B] px-3 py-2 text-xs font-black text-[#D5E5E5] shadow-[0_14px_34px_rgba(93,107,107,0.20)]">
          <CheckCircle2 className="h-4 w-4 text-[#E7F5DC]" />
          Command flow active
        </div>
      </div>

      <div className="dashboard-hero-orbit absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#F7CBCA]/12" />
      <div className="dashboard-hero-orbit dashboard-hero-orbit-delayed absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E7F5DC]/18" />

      {floatingCards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.label}
            className={`absolute z-10 w-36 rounded-2xl border border-white/70 bg-white/82 p-3 shadow-[0_16px_36px_rgba(93,107,107,0.10)] backdrop-blur-[16px] ${card.className}`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D5E5E5] text-[#F7CBCA]">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-black text-black">{card.label}</p>
                <p className="text-[11px] font-semibold leading-4 text-black/50">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}

      <div className="dashboard-hero-scan absolute bottom-10 right-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#F7CBCA]/12 bg-white/78 text-[#F7CBCA] shadow-[0_16px_38px_rgba(202,40,81,0.13)]">
        <BarChart3 className="h-6 w-6" />
      </div>
    </div>
  );
}

function MiniPanel({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className="rounded-lg border border-black/8 bg-[#F1F7F7] px-2 py-2">
      <div className={`mb-1.5 h-1.5 rounded-full ${active ? 'bg-[#F7CBCA]' : 'bg-black/14'}`} />
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-black/46">{label}</p>
    </div>
  );
}
