import { redirect } from 'next/navigation';
import { startStripeOnboarding } from '../actions';
export async function GET() {
  await startStripeOnboarding();
  redirect('/app/settings/payments?error=Onboarding+link+could+not+be+refreshed.');
}
