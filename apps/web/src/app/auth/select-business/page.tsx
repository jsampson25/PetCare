import { Button } from '@petcare/ui/button';
import { redirect } from 'next/navigation';

import { AuthCard } from '../../../components/auth-card';
import { listBusinessContexts } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { selectBusiness } from './actions';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function SelectBusinessPage({ searchParams }: { searchParams: SearchParameters }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/auth/sign-in?next=/auth/select-business');

  const businesses = await listBusinessContexts();
  if (businesses.length === 0) redirect('/onboarding');
  const parameters = await searchParams;
  const error = typeof parameters.error === 'string' ? parameters.error : undefined;

  return (
    <AuthCard error={error} title="Choose a business">
      <div className="space-y-3">
        {businesses.map((business) => (
          <form action={selectBusiness} key={business.businessId}>
            <input name="businessId" type="hidden" value={business.businessId} />
            <Button className="w-full justify-between" type="submit" variant="secondary">
              {business.businessName}<span aria-hidden="true">→</span>
            </Button>
          </form>
        ))}
      </div>
    </AuthCard>
  );
}
