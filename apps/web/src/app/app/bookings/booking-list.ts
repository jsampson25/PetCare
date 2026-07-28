export type BookingListItem = {
  ends_at: string;
  pets: { name: string } | null;
  service_versions: { customer_name: string } | null;
  starts_at: string;
};

export type BookingListSummary = {
  additionalItemCount: number;
  endsAt: string;
  petName: string;
  serviceName: string;
  startsAt: string;
};

export function summarizeBookingItems(items: BookingListItem[]): BookingListSummary | null {
  const orderedItems = [...items].sort(
    (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
  );
  const primaryItem = orderedItems[0];
  if (!primaryItem) return null;

  return {
    additionalItemCount: Math.max(0, orderedItems.length - 1),
    endsAt: primaryItem.ends_at,
    petName: primaryItem.pets?.name ?? 'Pet not assigned',
    serviceName: primaryItem.service_versions?.customer_name ?? 'Service not assigned',
    startsAt: primaryItem.starts_at,
  };
}
