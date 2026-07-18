import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { redirect } from 'next/navigation';
import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { reviewWebsiteInquiry } from './actions';
type SP = Promise<Record<string, string | string[] | undefined>>;
export default async function WebsiteInquiriesPage({ searchParams }: { searchParams: SP }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('website.edit')) redirect('/denied');
  const q = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from('website_inquiries')
    .select('id,name,email,phone,message,status,submitted_at,source_path')
    .eq('business_id', context.businessId)
    .in('status', ['new', 'in_review', 'responded'])
    .order('submitted_at');
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-bold text-[var(--action-primary)]">Website leads</p>
        <h1 className="mt-2 text-3xl font-black">Inquiries</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Review consented website inquiries without turning them into customers automatically.
        </p>
      </header>
      {typeof q.notice === 'string' ? (
        <Alert title="Inquiry updated" tone="success">
          {q.notice}
        </Alert>
      ) : null}
      {typeof q.error === 'string' ? (
        <Alert title="Update unavailable" tone="danger">
          {q.error}
        </Alert>
      ) : null}
      <div className="grid gap-5">
        {items?.map((item) => {
          const options =
            item.status === 'new'
              ? ['in_review', 'spam']
              : item.status === 'in_review'
                ? ['responded', 'spam']
                : ['closed'];
          return (
            <Card
              key={item.id}
              title={item.name}
              description={`${item.email} · ${item.phone ?? 'No phone'}`}
            >
              <Badge tone="warning">{item.status.replaceAll('_', ' ')}</Badge>
              <p className="my-4 leading-7">{item.message}</p>
              <form
                action={reviewWebsiteInquiry}
                className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
              >
                <input name="inquiryId" type="hidden" value={item.id} />
                <label className="text-sm font-bold">
                  Next status
                  <select className="mt-2 min-h-12 w-full rounded-lg border px-3" name="status">
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <Field label="Review notes" name="notes" required />
                <Button type="submit">Update</Button>
              </form>
            </Card>
          );
        })}
      </div>
      {!items?.length ? (
        <Card>
          <p>No inquiries need review.</p>
        </Card>
      ) : null}
    </div>
  );
}
