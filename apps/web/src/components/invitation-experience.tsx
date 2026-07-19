import type { ReactNode } from 'react';

export function InvitationExperience({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[linear-gradient(135deg,#eaf3ed,#fbfcfa_50%,#f5ead5)] px-4 py-10">
      <div
        className="absolute -left-24 -top-24 size-80 rounded-full bg-emerald-200/30"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-28 -right-20 size-96 rounded-full bg-amber-200/25"
        aria-hidden="true"
      />
      <section className="relative z-10 w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-[0_28px_80px_rgba(30,55,42,.16)] backdrop-blur">
        <div className="bg-[#173f30] px-6 py-7 text-white sm:px-8">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 place-items-center rounded-2xl bg-white/15 font-black"
              aria-hidden="true"
            >
              P
            </span>
            <div>
              <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-emerald-200">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">{title}</h1>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </section>
    </main>
  );
}
