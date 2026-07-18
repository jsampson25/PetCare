import { createSupabaseServerClient } from '../supabase/server';

export type PortalDashboard = {
  business: { id: string; name: string };
  household: { id: string; display_name: string };
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string;
    phone: string;
  };
  pets: Array<{
    id: string;
    name: string;
    breed: string;
    birth_date: string | null;
    sex: string;
    vaccinations: Array<{ id: string; type: string; expires_on: string; review_status: string }>;
  }>;
  bookings: Array<{
    id: string;
    booking_number: string;
    status: string;
    created_at: string;
    location_name: string;
    items: Array<{
      id: string;
      pet_id: string;
      pet_name: string;
      service_name: string;
      starts_at: string;
      ends_at: string;
      status: string;
    }>;
  }>;
  invoices: Array<{
    id: string;
    invoice_number: string;
    status: string;
    currency_code: string;
    issued_at: string | null;
    due_at: string | null;
    total_minor: number;
    balance_due_minor: number;
  }>;
  report_cards: Array<{
    id: string;
    pet_id: string;
    pet_name: string;
    service_category: string;
    published_at: string;
    narrative: string;
    highlights: Record<string, unknown>;
  }>;
  messages: Array<{
    id: string;
    message_type: string;
    channel: string;
    status: string;
    created_at: string;
    sent_at: string | null;
  }>;
};

export async function resolvePortalDashboard(): Promise<PortalDashboard | null> {
  const supabase = await createSupabaseServerClient();
  const { data: access } = await supabase
    .from('customer_portal_access')
    .select('business_id')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (!access) return null;
  const { data, error } = await supabase.rpc('get_customer_portal_dashboard', {
    target_business_id: access.business_id,
  });
  return error || !data ? null : (data as PortalDashboard);
}
