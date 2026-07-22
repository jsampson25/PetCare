import Link from 'next/link';

type TrialBannerProps = {
  planName: string;
  remainingDays: number;
  trialEndsAt: string;
};

export function TrialBanner({ planName, remainingDays, trialEndsAt }: TrialBannerProps) {
  const end = new Date(trialEndsAt);
  const endingLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#bfdbfe] bg-[linear-gradient(110deg,#eff6ff,#e0f2fe)] px-5 py-4 text-[#0b1f3a] shadow-[0_10px_30px_rgba(37,99,235,.08)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#2563eb] text-xs font-black text-white">
          {remainingDays}
        </span>
        <div>
          <p className="text-sm font-bold">
            {planName} trial: {remainingDays} {remainingDays === 1 ? 'day' : 'days'} remaining
          </p>
          <p className="mt-1 text-xs leading-5 text-[#52627a]">
            Your trial ends {endingLabel}. Your work stays saved while you review the plans.
          </p>
        </div>
      </div>
      <Link
        className="shrink-0 rounded-xl bg-[#2563eb] px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-[#1d4ed8]"
        href="/pricing"
      >
        Review plans
      </Link>
    </div>
  );
}
