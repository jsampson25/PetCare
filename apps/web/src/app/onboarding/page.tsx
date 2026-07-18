import { Card } from '@petcare/ui/card';
import { redirect } from 'next/navigation';

import { listBusinessContexts } from '../../lib/auth/tenant-context';
import { CreateBusinessForm } from './create-business-form';

export default async function OnboardingStartPage() {
  const existing = await listBusinessContexts();
  if (existing.length) redirect('/auth/select-business');
  return (
    <Card description="Start with the business and first physical location. Your work is saved as a draft until launch readiness is complete." title="Create your pet care business">
      <CreateBusinessForm />
    </Card>
  );
}
