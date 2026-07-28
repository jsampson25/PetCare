export type PetDirectoryRecord = {
  breed: string;
  id: string;
  name: string;
  preferred_name: string | null;
};

export type VaccinationRecord = {
  expires_on: string;
  review_status: string;
};

export function filterPetDirectory<Pet extends PetDirectoryRecord>(
  pets: Pet[],
  query: string,
  ownerNames: Map<string, string>,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return pets;

  return pets.filter((pet) =>
    [pet.name, pet.preferred_name ?? '', pet.breed, ownerNames.get(pet.id) ?? '']
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}

export function hasCurrentVaccination(records: VaccinationRecord[], today: string) {
  return records.some(
    (record) => record.review_status === 'approved' && record.expires_on >= today,
  );
}
