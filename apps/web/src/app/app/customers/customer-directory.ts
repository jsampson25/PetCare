export type CustomerDirectoryRecord = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  preferred_name: string | null;
};

export type CustomerHousehold = {
  display_name: string;
  pets: { name: string; status: string }[];
};

export function filterCustomerDirectory<Customer extends CustomerDirectoryRecord>(
  customers: Customer[],
  query: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return customers;

  return customers.filter((customer) =>
    [
      customer.first_name,
      customer.last_name,
      customer.preferred_name ?? '',
      customer.email,
      customer.phone,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function summarizeCustomerHousehold(household: CustomerHousehold | null) {
  const activePets = household?.pets.filter((pet) => pet.status === 'active') ?? [];
  return {
    activePetCount: activePets.length,
    displayName: household?.display_name ?? 'Household unavailable',
    petNames: activePets.map((pet) => pet.name),
  };
}
