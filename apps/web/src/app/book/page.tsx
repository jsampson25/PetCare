import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import type { CSSProperties } from 'react';

import { createSupabaseServerClient } from '../../lib/supabase/server';
type SP = Promise<Record<string, string | string[] | undefined>>;
export const metadata = { robots: { index: false, follow: false } };
export default async function BookPage({ searchParams }: { searchParams: SP }) {
  const q = await searchParams;
  const tenant = typeof q.tenant === 'string' ? q.tenant : '';
  const supabase = await createSupabaseServerClient();
  const { data: site } = tenant
    ? await supabase.rpc('get_public_tenant_website', { public_slug_value: tenant })
    : { data: null };
  if (!site)
    return (
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Card title="Choose your pet-care business">
          <p>
            Open booking from a business’s published website so services, branding, and tenant
            context remain connected.
          </p>
        </Card>
      </main>
    );
  return (
    <main
      className="min-h-screen bg-white px-6 py-16 text-slate-950"
      style={{ '--action-primary': site.brand_tokens.primary } as CSSProperties}
    >
      <div className="mx-auto max-w-4xl">
        <p className="font-black" style={{ color: 'var(--action-primary)' }}>
          {site.business.name}
        </p>
        <h1 className="mt-3 text-4xl font-black">Book pet care</h1>
        <p className="mt-3 text-slate-600">
          Choose a published service. Availability, eligibility, and final pricing are revalidated
          before confirmation.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {site.services.map((service: { name: string; description: string; category: string }) => (
            <Card key={service.name} title={service.name} description={service.category}>
              <p>{service.description}</p>
              <div className="mt-4">
                <ButtonLink href="/auth/sign-in?next=/portal/reservations">
                  Continue in customer portal
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
