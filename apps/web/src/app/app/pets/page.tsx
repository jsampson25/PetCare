import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { CommandBar } from '@petcare/ui/command-bar';
import { Field } from '@petcare/ui/field';
import { Icon } from '@petcare/ui/icon';
import { PageHeader } from '@petcare/ui/page-header';
import { RecordList, RecordListItem } from '@petcare/ui/record-list';
import { SelectField } from '@petcare/ui/select-field';
import { StatePanel } from '@petcare/ui/state-panel';
import { redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../lib/supabase/server';
import { filterPetDirectory, hasCurrentVaccination } from './pet-directory';

type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function PetsPage({ searchParams }: { searchParams: SearchParameters }) {
  const context = await resolveBusinessContext();
  if (!context?.permissions.has('pets.view')) redirect('/denied');
  const parameters = await searchParams;
  const query = typeof parameters.q === 'string' ? parameters.q.trim() : '';
  const status = typeof parameters.status === 'string' ? parameters.status : 'active';
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseServerClient();
  let petQuery = supabase
    .from('pets')
    .select('id,household_id,name,preferred_name,breed,birth_date,sex,status')
    .eq('business_id', context.businessId)
    .order('name')
    .limit(100);
  if (status !== 'all') petQuery = petQuery.eq('status', status);
  const { data: petRecords } = await petQuery;
  const householdIds = [...new Set((petRecords ?? []).map((pet) => pet.household_id))];
  const petIds = (petRecords ?? []).map((pet) => pet.id);
  const [
    { data: householdMembers },
    { data: vaccinations },
    { data: allergies },
    { data: medications },
  ] = await Promise.all([
    householdIds.length
      ? supabase
          .from('household_members')
          .select('household_id,households(display_name),customers(first_name,last_name)')
          .eq('business_id', context.businessId)
          .in('household_id', householdIds)
          .order('created_at')
      : Promise.resolve({ data: [] }),
    petIds.length
      ? supabase
          .from('pet_vaccinations')
          .select('pet_id,expires_on,review_status')
          .eq('business_id', context.businessId)
          .in('pet_id', petIds)
      : Promise.resolve({ data: [] }),
    petIds.length
      ? supabase
          .from('pet_allergies')
          .select('pet_id')
          .eq('business_id', context.businessId)
          .eq('status', 'active')
          .in('pet_id', petIds)
      : Promise.resolve({ data: [] }),
    petIds.length
      ? supabase
          .from('pet_medication_plans')
          .select('pet_id')
          .eq('business_id', context.businessId)
          .eq('status', 'active')
          .in('pet_id', petIds)
      : Promise.resolve({ data: [] }),
  ]);

  const householdById = new Map<string, { displayName: string; ownerName: string }>();
  for (const membership of householdMembers ?? []) {
    if (householdById.has(membership.household_id)) continue;
    const household = membership.households as unknown as { display_name: string } | null;
    const customer = membership.customers as unknown as {
      first_name: string;
      last_name: string;
    } | null;
    householdById.set(membership.household_id, {
      displayName: household?.display_name ?? 'Household unavailable',
      ownerName: customer ? `${customer.first_name} ${customer.last_name}` : 'Owner unavailable',
    });
  }
  const ownerNames = new Map(
    (petRecords ?? []).map((pet) => [pet.id, householdById.get(pet.household_id)?.ownerName ?? '']),
  );
  const pets = filterPetDirectory(petRecords ?? [], query, ownerNames);
  const vaccinationsByPet = new Map<string, { expires_on: string; review_status: string }[]>();
  for (const vaccination of vaccinations ?? []) {
    vaccinationsByPet.set(vaccination.pet_id, [
      ...(vaccinationsByPet.get(vaccination.pet_id) ?? []),
      vaccination,
    ]);
  }
  const allergyCountByPet = countByPet(allergies ?? []);
  const medicationCountByPet = countByPet(medications ?? []);
  const vaccinationReadyCount = pets.filter((pet) =>
    hasCurrentVaccination(vaccinationsByPet.get(pet.id) ?? [], today),
  ).length;
  const activeCarePlanCount = pets.reduce(
    (total, pet) =>
      total + (allergyCountByPet.get(pet.id) ?? 0) + (medicationCountByPet.get(pet.id) ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          context.permissions.has('customers.view') ? (
            <ButtonLink href="/app/customers" leadingIcon={<Icon name="users" />}>
              Add through household
            </ButtonLink>
          ) : null
        }
        description="Find pet identity, ownership, vaccination records, and active care needs."
        eyebrow="Pet records"
        title="Pets"
      />
      <CommandBar
        description="Search pet or owner identity, then narrow by pet lifecycle status."
        title="Find pets"
      >
        <form className="flex flex-wrap items-end gap-3" method="get">
          <Field
            defaultValue={query}
            density="compact"
            label="Pet, breed, or owner"
            name="q"
            placeholder="Milo, Golden Retriever, or Pat Morgan"
          />
          <SelectField defaultValue={status} density="compact" label="Status" name="status">
            <option value="active">Active</option>
            <option value="all">All</option>
            <option value="inactive">Inactive</option>
            <option value="restricted">Restricted</option>
            <option value="deceased">Deceased</option>
            <option value="archived">Archived</option>
          </SelectField>
          <Button leadingIcon={<Icon name="filter" />} type="submit" variant="secondary">
            Apply filters
          </Button>
        </form>
      </CommandBar>
      <Card eyebrow="Pet summary" title="Current view" tone="subtle">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">Pets</dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{pets.length}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">
              Current vaccine on file
            </dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{vaccinationReadyCount}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-[var(--text-secondary)]">
              Allergy + medication records
            </dt>
            <dd className="mt-1 text-3xl font-black tracking-tight">{activeCarePlanCount}</dd>
          </div>
        </dl>
      </Card>
      <Card
        actions={<Badge tone="info">{pets.length} records</Badge>}
        description="Operational pet identity with direct access to care and eligibility history."
        eyebrow="Pet directory"
        title="Pet records"
      >
        {pets.length ? (
          <RecordList>
            {pets.map((pet) => {
              const household = householdById.get(pet.household_id);
              const vaccinationReady = hasCurrentVaccination(
                vaccinationsByPet.get(pet.id) ?? [],
                today,
              );
              const careRecordCount =
                (allergyCountByPet.get(pet.id) ?? 0) + (medicationCountByPet.get(pet.id) ?? 0);
              return (
                <RecordListItem
                  action={
                    <ButtonLink
                      href={`/app/pets/${pet.id}`}
                      leadingIcon={<Icon name="arrow-right" />}
                      variant="secondary"
                    >
                      View care profile
                    </ButtonLink>
                  }
                  description={
                    <div className="space-y-1">
                      <p>
                        {pet.breed} · {pet.sex} · {household?.ownerName ?? 'Owner unavailable'}
                      </p>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {household?.displayName ?? 'Household unavailable'} · {careRecordCount}{' '}
                        active allergy or medication record{careRecordCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  }
                  key={pet.id}
                  leading={
                    <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-subtle)] text-[var(--action-primary)]">
                      <Icon name="pets" />
                    </span>
                  }
                  status={
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={vaccinationReady ? 'success' : 'warning'}>
                        {vaccinationReady ? 'current vaccine on file' : 'vaccine review needed'}
                      </Badge>
                      <Badge tone={pet.status === 'active' ? 'info' : 'neutral'}>
                        {pet.status}
                      </Badge>
                    </div>
                  }
                  title={pet.preferred_name || pet.name}
                />
              );
            })}
          </RecordList>
        ) : (
          <StatePanel
            action={
              context.permissions.has('customers.view') ? (
                <ButtonLink href="/app/customers" leadingIcon={<Icon name="users" />}>
                  Open customers
                </ButtonLink>
              ) : null
            }
            description="Adjust the filters or add a pet through a customer household."
            size="compact"
            title="No pets in this view"
          />
        )}
      </Card>
    </div>
  );
}

function countByPet(records: { pet_id: string }[]) {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.pet_id, (counts.get(record.pet_id) ?? 0) + 1);
  return counts;
}
