import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { listBusinessContexts } from '../../lib/auth/tenant-context';
import { CreateBusinessForm } from './create-business-form';

export default async function OnboardingStartPage() {
  const existing = await listBusinessContexts();
  if (existing.length) redirect('/auth/select-business');
  return (
    <div className="grid overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_28px_80px_rgba(30,55,42,.14)] lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="bg-[#173f30] p-8 text-white lg:p-10">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">
          Business onboarding
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          Let&apos;s build your pet care workspace.
        </h1>
        <p className="mt-5 leading-7 text-emerald-50/75">
          Start with your business and first location. Your setup remains private until you are
          ready to launch.
        </p>
        <ol className="mt-8 space-y-4">
          {[
            'Create the business',
            'Complete location details',
            'Add services and pricing',
            'Publish when ready',
          ].map((step, index) => (
            <li className="flex items-center gap-3 text-sm font-bold" key={step}>
              <span className="grid size-8 place-items-center rounded-full border border-white/20 bg-white/10">
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
