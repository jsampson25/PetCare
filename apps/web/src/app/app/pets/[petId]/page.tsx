import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { ButtonLink } from '@petcare/ui/button-link';
import { Card } from '@petcare/ui/card';
import { Field } from '@petcare/ui/field';
import { notFound, redirect } from 'next/navigation';

import { resolveBusinessContext } from '../../../../lib/auth/tenant-context';
import { createSupabaseServerClient } from '../../../../lib/supabase/server';
import {
  addPetAllergy,
  resolvePetAllergy,
  reviewPetVaccination,
  submitPetVaccination,
} from './actions';

type PageParameters = Promise<{ petId: string }>;
type SearchParameters = Promise<Record<string, string | string[] | undefined>>;

export default async function PetVaccinationsPage({
  params,
  searchParams,
}: {
  params: PageParameters;
  searchParams: SearchParameters;
}) {
  const context = await resolveBusinessContext();
  if (!context || !context.permissions.has('pets.view')) redirect('/denied');
  const { petId } = await params;
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: pet } = await supabase
    .from('pets')
    .select('id,name,breed,household_id,status')
    .eq('business_id', context.businessId)
    .eq('id', petId)
    .maybeSingle();
  if (!pet) notFound();
  const { data: vaccinations } = await supabase
    .from('pet_vaccinations')
    .select(
      'id,vaccine_type,administered_on,expires_on,provider_name,evidence_object_path,evidence_file_name,scan_status,review_status,review_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const { data: allergies } = await supabase
    .from('pet_allergies')
    .select(
      'id,allergen,category,severity,reaction,care_instructions,information_source,status,resolved_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const evidenceLinks = new Map<string, string>();
  await Promise.all(
    (vaccinations ?? []).map(async (record) => {
      if (record.scan_status !== 'clean') return;
      const { data } = await supabase.storage
        .from('pet-vaccine-evidence')
        .createSignedUrl(record.evidence_object_path, 300);
      if (data?.signedUrl) evidenceLinks.set(record.id, data.signedUrl);
    }),
  );
  const error = typeof query.error === 'string' ? query.error : undefined;
  const notice = typeof query.notice === 'string' ? query.notice : undefined;
  const canManage = context.permissions.has('pets.manage_care');

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <ButtonLink href="/app/customers" variant="secondary">
          Back to customers
        </ButtonLink>
        <div>
          <p className="text-sm font-bold text-[var(--action-primary)]">Pet health record</p>
          <h1 className="text-3xl font-black tracking-tight">{pet.name} care profile</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            {pet.breed} · {pet.status}
          </p>
        </div>
      </header>
      {error ? (
        <Alert title="Vaccination not updated" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Vaccination updated" tone="success">
          {notice}
        </Alert>
      ) : null}
      <Card
        title={`Allergy safety records (${allergies?.filter((allergy) => allergy.status === 'active').length ?? 0} active)`}
        description="Structured allergy details remain visible and auditable until resolved with a reason."
      >
        {allergies?.length ? (
          <ul className="space-y-4">
            {allergies.map((allergy) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={allergy.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{allergy.allergen}</p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {allergy.category} · {allergy.information_source.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={allergyTone(allergy.severity)}>
                      {allergy.severity.replaceAll('_', ' ')}
                    </Badge>
                    <Badge tone={allergy.status === 'active' ? 'warning' : 'neutral'}>
                      {allergy.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Reaction:</strong> {allergy.reaction}
                </p>
                <p className="mt-2 text-sm">
                  <strong>Care instructions:</strong> {allergy.care_instructions}
                </p>
                {allergy.resolved_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Resolution:</strong> {allergy.resolved_reason}
                  </p>
                ) : null}
                {canManage && allergy.status === 'active' ? (
                  <form
                    action={resolvePetAllergy}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="allergyId" type="hidden" value={allergy.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Resolution reason" name="resolutionReason" required />
                    <Button type="submit" variant="secondary">
                      Resolve record
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No allergy records have been added.
          </p>
        )}
      </Card>
      {canManage ? (
        <Card
          title="Add allergy safety record"
          description="Record the observed reaction and exact handling instructions, not only the allergen name."
        >
          <form action={addPetAllergy} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <Field label="Allergen" name="allergen" required />
            <AllergySelect
              label="Category"
              name="category"
              options={['food', 'medication', 'environmental', 'contact', 'other']}
            />
            <AllergySelect
              label="Severity"
              name="severity"
              options={['mild', 'moderate', 'severe', 'life_threatening']}
            />
            <AllergySelect
              label="Information source"
              name="source"
              options={['customer_reported', 'staff_observed', 'veterinary_documented']}
            />
            <TextArea label="Observed or expected reaction" name="reaction" required />
            <TextArea label="Care and exposure instructions" name="careInstructions" required />
            <div className="sm:col-span-2">
              <Button type="submit">Add allergy record</Button>
            </div>
          </form>
        </Card>
      ) : null}
      {canManage ? (
        <Card
          title="Submit vaccination evidence"
          description="PDF, JPG, or PNG up to 10 MB. New evidence remains pending until reviewed and scanned."
        >
          <form action={submitPetVaccination} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <SelectField name="vaccineType" />
            <Field label="Veterinarian or provider (optional)" name="providerName" />
            <Field label="Administered date (optional)" name="administeredOn" type="date" />
            <Field label="Expiration date" name="expiresOn" required type="date" />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold" htmlFor="evidence">
                Evidence file
              </label>
              <input
                accept="application/pdf,image/jpeg,image/png"
                className="mt-2 block min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] p-3 text-sm"
                id="evidence"
                name="evidence"
                required
                type="file"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Submit evidence</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card title={`Vaccination records (${vaccinations?.length ?? 0})`}>
        {vaccinations?.length ? (
          <ul className="space-y-4">
            {vaccinations.map((record) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={record.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{vaccineLabel(record.vaccine_type)}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Expires {formatDate(record.expires_on)}
                      {record.provider_name ? ` · ${record.provider_name}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={statusTone(record.review_status)}>{record.review_status}</Badge>
                    <Badge tone={record.scan_status === 'clean' ? 'success' : 'warning'}>
                      scan {record.scan_status}
                    </Badge>
                  </div>
                </div>
                {evidenceLinks.get(record.id) ? (
                  <a
                    className="mt-3 inline-block font-bold text-[var(--action-primary)] underline"
                    href={evidenceLinks.get(record.id)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View {record.evidence_file_name}
                  </a>
                ) : null}
                {record.review_reason ? (
                  <p className="mt-3 text-sm">Review note: {record.review_reason}</p>
                ) : null}
                {canManage && record.review_status === 'pending' ? (
                  <ReviewForm
                    canAccept={record.scan_status === 'clean'}
                    petId={pet.id}
                    vaccinationId={record.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No vaccination evidence has been submitted.
          </p>
        )}
      </Card>
    </div>
  );
}

function ReviewForm({
  canAccept,
  petId,
  vaccinationId,
}: {
  canAccept: boolean;
  petId: string;
  vaccinationId: string;
}) {
  return (
    <form action={reviewPetVaccination} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <input name="petId" type="hidden" value={petId} />
      <input name="vaccinationId" type="hidden" value={vaccinationId} />
      <Field label="Rejection reason (required only when rejecting)" name="reason" />
      <Button disabled={!canAccept} name="decision" type="submit" value="accepted">
        Accept
      </Button>
      {!canAccept ? (
        <p className="text-sm text-[var(--text-secondary)] sm:col-span-3">
          Acceptance becomes available after the evidence scan is clean.
        </p>
      ) : null}
      <Button name="decision" type="submit" value="rejected" variant="secondary">
        Reject
      </Button>
    </form>
  );
}

function SelectField({ name }: { name: string }) {
  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={name}>
        Vaccine
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
        id={name}
        name={name}
      >
        <option value="rabies">Rabies</option>
        <option value="dhpp">DHPP</option>
        <option value="bordetella">Bordetella</option>
        <option value="canine_influenza">Canine influenza</option>
        <option value="leptospirosis">Leptospirosis</option>
        <option value="other">Other</option>
      </select>
    </div>
  );
}

function vaccineLabel(value: string) {
  return value === 'dhpp'
    ? 'DHPP'
    : value
        .split('_')
        .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
        .join(' ');
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}
function statusTone(status: string): 'danger' | 'neutral' | 'success' | 'warning' {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

function allergyTone(severity: string): 'danger' | 'neutral' | 'warning' {
  if (severity === 'life_threatening' || severity === 'severe') return 'danger';
  if (severity === 'moderate') return 'warning';
  return 'neutral';
}

function AllergySelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={name}>
        {label}
      </label>
      <select
        className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3 capitalize"
        id={name}
        name={name}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ label, name, required }: { label: string; name: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-bold" htmlFor={name}>
        {label}
      </label>
      <textarea
        className="mt-2 min-h-28 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] p-3"
        id={name}
        name={name}
        required={required}
      />
    </div>
  );
}
