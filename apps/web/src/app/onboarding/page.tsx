import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { listBusinessContexts } from '../../lib/auth/tenant-context';
import { CreateBusinessForm } from './create-business-form';

export default async function OnboardingStartPage() {
  const existing = await listBusinessContexts();
  if (existing.length) redirect('/auth/select-business');
  return (
    <div className="grid overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_32px_90px_rgba(30,64,175,.14)] lg:grid-cols-[0.86fr_1.14fr]">
      <aside className="relative overflow-hidden bg-[#0b1f3a] p-8 text-white lg:p-10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#2563eb]/30 blur-2xl" />
        <p className="relative text-xs font-black uppercase tracking-[0.18em] text-[#7dd3fc]">
          Business onboarding
        </p>
        <h1 className="relative mt-4 text-4xl font-semibold leading-tight tracking-[-.045em]">
          Let&apos;s build your connected business.
        </h1>
        <p className="relative mt-5 leading-7 text-white/70">
          Start with your business and first location. Your setup remains private until you are
          ready to launch.
        </p>
        <div className="relative mt-7 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[.15em] text-[#7dd3fc]">Free trial</p>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Explore website design, booking, and daily operations before selecting a paid plan.
          </p>
        </div>
        <ol className="relative mt-8 space-y-4">
          {[
            'Create the business',
            'Complete location details',
            'Add services and pricing',
            'Publish when ready',
          ].map((step, index) => (
            <li className="flex items-center gap-3 text-sm font-bold" key={step}>
              <span className="grid size-8 place-items-center rounded-full border border-[#60a5fa]/40 bg-[#2563eb]/25 text-[#bae6fd]">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </aside>
      <Card
        className="rounded-none border-0 !p-8 shadow-none lg:!p-10"
        title="Create your pet care business"
        description="Begin with the information customers will recognize."
      >
        <CreateBusinessForm />
      </Card>
    </div>
  );
}
