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
  addPetBehaviorRecord,
  addPetFeedingPlan,
  addPetHealthCondition,
  addPetIdentifier,
  addPetMedicationPlan,
  discontinuePetFeedingPlan,
  discontinuePetMedicationPlan,
  resolvePetBehaviorRecord,
  resolvePetHealthCondition,
  resolvePetAllergy,
  replacePetProfilePhoto,
  retirePetIdentifier,
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
    .select('id,name,breed,household_id,status,photo_object_path,photo_file_name')
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
  const { data: medications } = await supabase
    .from('pet_medication_plans')
    .select(
      'id,medication_name,dose,route,schedule_description,administration_instructions,as_needed,as_needed_reason,starts_on,ends_on,information_source,status,discontinued_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const { data: feedingPlans } = await supabase
    .from('pet_feeding_plans')
    .select(
      'id,food_name,food_source,amount_per_meal,meals_per_day,schedule_description,preparation_instructions,supplement_instructions,feed_separately,separate_feeding_reason,information_source,status,discontinued_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const { data: behaviorRecords } = await supabase
    .from('pet_behavior_records')
    .select(
      'id,behavior_type,severity,context_description,observed_on,triggers,preferred_handling,prohibited_approaches,calming_strategies,group_play_guidance,information_source,status,resolved_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const { data: healthConditions } = await supabase
    .from('pet_health_conditions')
    .select(
      'id,condition_name,category,severity,diagnosed_on,care_impact,emergency_instructions,information_source,status,resolved_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  const { data: identifiers } = await supabase
    .from('pet_identifiers')
    .select(
      'id,identifier_type,identifier_value,issuer,issued_on,expires_on,status,retired_reason,created_at',
    )
    .eq('business_id', context.businessId)
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  let petPhotoUrl: string | undefined;
  if (pet.photo_object_path) {
    const { data } = await supabase.storage
      .from('pet-profile-photos')
      .createSignedUrl(pet.photo_object_path, 300);
    petPhotoUrl = data?.signedUrl;
  }
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
        <div className="flex flex-wrap items-center gap-5">
          {petPhotoUrl ? (
            <div
              aria-label={`${pet.name} profile photo`}
              className="h-28 w-28 shrink-0 rounded-full border border-[var(--border-default)] bg-cover bg-center shadow-sm"
              role="img"
              style={{ backgroundImage: `url(${JSON.stringify(petPhotoUrl)})` }}
            />
          ) : (
            <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full bg-[var(--surface-subtle)] text-4xl font-black text-[var(--text-secondary)]">
              {pet.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-[var(--action-primary)]">Pet health record</p>
            <h1 className="text-3xl font-black tracking-tight">{pet.name} care profile</h1>
            <p className="mt-2 text-[var(--text-secondary)]">
              {pet.breed} · {pet.status}
            </p>
          </div>
        </div>
      </header>
      {error ? (
        <Alert title="Pet profile not updated" tone="danger">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert title="Pet profile updated" tone="success">
          {notice}
        </Alert>
      ) : null}
      {canManage ? (
        <Card
          title={pet.photo_object_path ? 'Replace profile photo' : 'Add profile photo'}
          description="A photo helps staff recognize the pet but never replaces structured identity. JPG, PNG, or WebP up to 5 MB."
        >
          <form
            action={replacePetProfilePhoto}
            className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <input name="petId" type="hidden" value={pet.id} />
            <div>
              <label className="block text-sm font-bold" htmlFor="photo">
                Pet photo
              </label>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="mt-2 block w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] p-3 text-sm file:mr-4 file:min-h-10 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--surface-subtle)] file:px-4 file:font-bold"
                id="photo"
                name="photo"
                required
                type="file"
              />
              {pet.photo_file_name ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Current file: {pet.photo_file_name}
                </p>
              ) : null}
            </div>
            <Button type="submit">{pet.photo_object_path ? 'Replace photo' : 'Add photo'}</Button>
          </form>
        </Card>
      ) : null}
      <Card
        title={`Identifiers (${identifiers?.filter((identifier) => identifier.status === 'active').length ?? 0} active)`}
        description="Microchips, licenses, and registrations provide durable identity beyond name or photo. Formatting is normalized to prevent duplicate assignments."
      >
        {identifiers?.length ? (
          <ul className="space-y-4">
            {identifiers.map((identifier) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={identifier.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{identifier.identifier_value}</p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {identifier.identifier_type.replaceAll('_', ' ')}
                      {identifier.issuer ? ` · ${identifier.issuer}` : ''}
                    </p>
                  </div>
                  <Badge tone={identifier.status === 'active' ? 'info' : 'neutral'}>
                    {identifier.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[var(--text-secondary)]">
                  {identifier.issued_on
                    ? `Issued ${formatDate(identifier.issued_on)}`
                    : 'Issue date not provided'}
                  {' · '}
                  {identifier.expires_on
                    ? `Expires ${formatDate(identifier.expires_on)}`
                    : 'No expiration recorded'}
                </p>
                {identifier.retired_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Retirement reason:</strong> {identifier.retired_reason}
                  </p>
                ) : null}
                {canManage && identifier.status === 'active' ? (
                  <form
                    action={retirePetIdentifier}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="petIdentifierId" type="hidden" value={identifier.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Retirement reason" name="reason" required />
                    <Button type="submit" variant="secondary">
                      Retire identifier
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No identifiers have been added.</p>
        )}
      </Card>
      {canManage ? (
        <Card
          title="Add pet identifier"
          description="Use the exact number shown by the registry or issuing authority. Dashes and spaces are retained for display but ignored during duplicate checks."
        >
          <form action={addPetIdentifier} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <HealthSelect
              label="Identifier type"
              name="identifierType"
              options={['microchip', 'license', 'registration', 'other']}
            />
            <Field label="Identifier value" name="identifierValue" required />
            <Field label="Issuer or registry (optional)" name="issuer" />
            <div />
            <Field
              label="Issue date (optional)"
              max={new Date().toISOString().slice(0, 10)}
              name="issuedOn"
              type="date"
            />
            <Field label="Expiration date (optional)" name="expiresOn" type="date" />
            <div className="sm:col-span-2">
              <Button type="submit">Add identifier</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card
        title={`Health conditions (${healthConditions?.filter((condition) => condition.status === 'active').length ?? 0} active)`}
        description="Severe and critical medical conditions require emergency instructions and remain prominent for care staff."
      >
        {healthConditions?.length ? (
          <ul className="space-y-4">
            {healthConditions.map((condition) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={condition.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{condition.condition_name}</p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {condition.category.replaceAll('_', ' ')} ·{' '}
                      {condition.information_source.replaceAll('_', ' ')}
                      {condition.diagnosed_on ? ` · ${formatDate(condition.diagnosed_on)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={healthTone(condition.severity)}>{condition.severity}</Badge>
                    <Badge tone={condition.status === 'active' ? 'warning' : 'neutral'}>
                      {condition.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Care impact:</strong> {condition.care_impact}
                </p>
                {condition.emergency_instructions ? (
                  <div className="mt-3">
                    <Alert title="Emergency instructions" tone="danger">
                      {condition.emergency_instructions}
                    </Alert>
                  </div>
                ) : null}
                {condition.resolved_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Resolution:</strong> {condition.resolved_reason}
                  </p>
                ) : null}
                {canManage && condition.status === 'active' ? (
                  <form
                    action={resolvePetHealthCondition}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="healthConditionId" type="hidden" value={condition.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Resolution reason" name="reason" required />
                    <Button type="submit" variant="secondary">
                      Resolve condition
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No health conditions have been added.
          </p>
        )}
      </Card>
      {canManage ? (
        <Card
          title="Add health condition"
          description="Describe how the condition changes daily care. Severe or critical conditions require emergency instructions."
        >
          <form action={addPetHealthCondition} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <Field label="Condition or diagnosis" name="conditionName" required />
            <HealthSelect
              label="Category"
              name="category"
              options={[
                'cardiac',
                'respiratory',
                'neurological',
                'seizure',
                'mobility',
                'sensory',
                'digestive',
                'endocrine',
                'skin_coat',
                'immune',
                'post_surgical',
                'other',
              ]}
            />
            <HealthSelect
              label="Severity"
              name="severity"
              options={['mild', 'moderate', 'severe', 'critical']}
            />
            <Field
              label="Diagnosis date (optional)"
              max={new Date().toISOString().slice(0, 10)}
              name="diagnosedOn"
              type="date"
            />
            <HealthSelect
              label="Information source"
              name="informationSource"
              options={['customer_reported', 'staff_observed', 'veterinary_documented']}
            />
            <div />
            <TextArea label="Daily care impact" name="careImpact" required />
            <TextArea label="Emergency instructions" name="emergencyInstructions" />
            <div className="sm:col-span-2">
              <Button type="submit">Add health condition</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card
        title={`Behavior and handling (${behaviorRecords?.filter((record) => record.status === 'active').length ?? 0} active)`}
        description="Critical behavior risks remain structured and prominent instead of being buried in general notes."
      >
        {behaviorRecords?.length ? (
          <ul className="space-y-4">
            {behaviorRecords.map((record) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={record.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold capitalize">
                      {record.behavior_type.replaceAll('_', ' ')}
                    </p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {record.information_source.replaceAll('_', ' ')}
                      {record.observed_on ? ` · ${formatDate(record.observed_on)}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={behaviorTone(record.severity)}>{record.severity}</Badge>
                    <Badge tone={record.status === 'active' ? 'warning' : 'neutral'}>
                      {record.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Context:</strong> {record.context_description}
                </p>
                {record.triggers ? (
                  <p className="mt-2 text-sm">
                    <strong>Triggers:</strong> {record.triggers}
                  </p>
                ) : null}
                <p className="mt-2 text-sm">
                  <strong>Preferred handling:</strong> {record.preferred_handling}
                </p>
                {record.prohibited_approaches ? (
                  <p className="mt-2 text-sm">
                    <strong>Do not:</strong> {record.prohibited_approaches}
                  </p>
                ) : null}
                {record.calming_strategies ? (
                  <p className="mt-2 text-sm">
                    <strong>Calming strategies:</strong> {record.calming_strategies}
                  </p>
                ) : null}
                <p className="mt-2 text-sm capitalize">
                  <strong>Group play:</strong> {record.group_play_guidance.replaceAll('_', ' ')}
                </p>
                {record.resolved_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Resolution:</strong> {record.resolved_reason}
                  </p>
                ) : null}
                {canManage && record.status === 'active' ? (
                  <form
                    action={resolvePetBehaviorRecord}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="behaviorRecordId" type="hidden" value={record.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Resolution reason" name="reason" required />
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
            No behavior or handling records have been added.
          </p>
        )}
      </Card>
      {canManage ? (
        <Card
          title="Add behavior and handling record"
          description="Describe the context and safe handling response. Customer statements and staff observations remain distinguishable."
        >
          <form action={addPetBehaviorRecord} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <BehaviorSelect
              label="Behavior or risk type"
              name="behaviorType"
              options={[
                'aggression',
                'bite_history',
                'escape_risk',
                'severe_anxiety',
                'resource_guarding',
                'dog_interaction',
                'human_interaction',
                'handling_sensitivity',
                'barrier_reactivity',
                'other',
              ]}
            />
            <BehaviorSelect
              label="Severity"
              name="severity"
              options={['information', 'caution', 'high', 'critical']}
            />
            <Field
              label="Observation date (optional)"
              max={new Date().toISOString().slice(0, 10)}
              name="observedOn"
              type="date"
            />
            <BehaviorSelect
              label="Information source"
              name="informationSource"
              options={['customer_reported', 'staff_observed', 'veterinary_documented']}
            />
            <TextArea label="Context and what occurred" name="contextDescription" required />
            <TextArea label="Known triggers (optional)" name="triggers" />
            <TextArea label="Preferred safe handling" name="preferredHandling" required />
            <TextArea label="Prohibited approaches (optional)" name="prohibitedApproaches" />
            <TextArea label="Calming strategies (optional)" name="calmingStrategies" />
            <BehaviorSelect
              label="Group-play guidance"
              name="groupPlayGuidance"
              options={['not_evaluated', 'approved', 'conditional', 'not_approved']}
            />
            <div className="sm:col-span-2">
              <Button type="submit">Add behavior record</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card
        title="Feeding plan"
        description="Only one plan is active at a time so staff have one authoritative source for meal-task generation."
      >
        {feedingPlans?.length ? (
          <ul className="space-y-4">
            {feedingPlans.map((plan) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={plan.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{plan.food_name}</p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {plan.food_source.replaceAll('_', ' ')} ·{' '}
                      {plan.information_source.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Badge tone={plan.status === 'active' ? 'success' : 'neutral'}>
                    {plan.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Amount:</strong> {plan.amount_per_meal}, {plan.meals_per_day} meal
                  {plan.meals_per_day === 1 ? '' : 's'} daily
                </p>
                <p className="mt-2 text-sm">
                  <strong>Schedule:</strong> {plan.schedule_description}
                </p>
                <p className="mt-2 text-sm">
                  <strong>Preparation:</strong> {plan.preparation_instructions}
                </p>
                {plan.supplement_instructions ? (
                  <p className="mt-2 text-sm">
                    <strong>Supplements:</strong> {plan.supplement_instructions}
                  </p>
                ) : null}
                {plan.feed_separately ? (
                  <Alert title="Feed separately" tone="warning">
                    {plan.separate_feeding_reason}
                  </Alert>
                ) : null}
                {plan.discontinued_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Discontinued:</strong> {plan.discontinued_reason}
                  </p>
                ) : null}
                {canManage && plan.status === 'active' ? (
                  <form
                    action={discontinuePetFeedingPlan}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="feedingPlanId" type="hidden" value={plan.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Discontinuation reason" name="reason" required />
                    <Button type="submit" variant="secondary">
                      Discontinue plan
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No feeding plan has been added.</p>
        )}
      </Card>
      {canManage && !feedingPlans?.some((plan) => plan.status === 'active') ? (
        <Card
          title="Add feeding plan"
          description="Use explicit amounts and timing. Avoid vague instructions such as feed normally."
        >
          <form action={addPetFeedingPlan} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <Field label="Food brand and product" name="foodName" required />
            <FeedingSelect
              label="Food source"
              name="foodSource"
              options={['customer_provided', 'business_provided']}
            />
            <Field label="Amount per meal (include unit)" name="amountPerMeal" required />
            <Field
              label="Meals per day"
              max={8}
              min={1}
              name="mealsPerDay"
              required
              type="number"
            />
            <TextArea label="Meal schedule or timing" name="scheduleDescription" required />
            <TextArea label="Preparation instructions" name="preparationInstructions" required />
            <TextArea label="Supplement instructions (optional)" name="supplementInstructions" />
            <FeedingSelect
              label="Information source"
              name="informationSource"
              options={['customer_reported', 'staff_confirmed', 'veterinary_documented']}
            />
            <label className="flex min-h-12 items-center gap-3 text-sm font-bold sm:col-span-2">
              <input className="size-5" name="feedSeparately" type="checkbox" />
              Feed separately from other pets
            </label>
            <div className="sm:col-span-2">
              <Field
                hint="Required when separate feeding is selected."
                label="Separate-feeding reason"
                name="separateFeedingReason"
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Add feeding plan</Button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card
        title={`Medication plans (${medications?.filter((plan) => plan.status === 'active').length ?? 0} active)`}
        description="The profile stores medication instructions; operational administration tasks and actual-dose history come later."
      >
        {medications?.length ? (
          <ul className="space-y-4">
            {medications.map((plan) => (
              <li
                className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-4"
                key={plan.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">
                      {plan.medication_name} · {plan.dose}
                    </p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">
                      {plan.route} · {plan.information_source.replaceAll('_', ' ')}
                    </p>
                  </div>
                  <Badge tone={plan.status === 'active' ? 'success' : 'neutral'}>
                    {plan.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm">
                  <strong>Schedule:</strong> {plan.schedule_description}
                </p>
                <p className="mt-2 text-sm">
                  <strong>Instructions:</strong> {plan.administration_instructions}
                </p>
                {plan.as_needed ? (
                  <p className="mt-2 text-sm">
                    <strong>As needed for:</strong> {plan.as_needed_reason}
                  </p>
                ) : null}
                {plan.starts_on || plan.ends_on ? (
                  <p className="mt-2 text-sm">
                    <strong>Effective:</strong>{' '}
                    {plan.starts_on ? formatDate(plan.starts_on) : 'Immediately'} through{' '}
                    {plan.ends_on ? formatDate(plan.ends_on) : 'No scheduled end'}
                  </p>
                ) : null}
                {plan.discontinued_reason ? (
                  <p className="mt-2 text-sm">
                    <strong>Discontinued:</strong> {plan.discontinued_reason}
                  </p>
                ) : null}
                {canManage && plan.status === 'active' ? (
                  <form
                    action={discontinuePetMedicationPlan}
                    className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                  >
                    <input name="medicationPlanId" type="hidden" value={plan.id} />
                    <input name="petId" type="hidden" value={pet.id} />
                    <Field label="Discontinuation reason" name="reason" required />
                    <Button type="submit" variant="secondary">
                      Discontinue plan
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">
            No medication plans have been added.
          </p>
        )}
      </Card>
      {canManage ? (
        <Card
          title="Add medication plan"
          description="Enter the label instructions exactly. Staff will confirm current medication again at check-in."
        >
          <form action={addPetMedicationPlan} className="grid gap-5 sm:grid-cols-2">
            <input name="petId" type="hidden" value={pet.id} />
            <Field label="Medication name" name="medicationName" required />
            <Field label="Dose (include unit)" name="dose" required />
            <MedicationSelect
              label="Route"
              name="route"
              options={['oral', 'topical', 'otic', 'ophthalmic', 'inhaled', 'injection', 'other']}
            />
            <MedicationSelect
              label="Information source"
              name="source"
              options={['customer_reported', 'staff_confirmed', 'veterinary_documented']}
            />
            <TextArea label="Schedule or timing" name="scheduleDescription" required />
            <TextArea
              label="Administration instructions"
              name="administrationInstructions"
              required
            />
            <Field label="Effective start (optional)" name="startsOn" type="date" />
            <Field label="Effective end (optional)" name="endsOn" type="date" />
            <label className="flex min-h-12 items-center gap-3 text-sm font-bold sm:col-span-2">
              <input className="size-5" name="asNeeded" type="checkbox" />
              Administer only as needed
            </label>
            <Field
              className="sm:col-span-2"
              hint="Required when the medication is as-needed."
              label="As-needed indication"
              name="asNeededReason"
            />
            <div className="sm:col-span-2">
              <Button type="submit">Add medication plan</Button>
            </div>
          </form>
        </Card>
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

function MedicationSelect({
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

function FeedingSelect({
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

function BehaviorSelect({
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

function behaviorTone(severity: string): 'danger' | 'info' | 'neutral' | 'warning' {
  if (severity === 'critical' || severity === 'high') return 'danger';
  if (severity === 'caution') return 'warning';
  return 'info';
}

function HealthSelect({
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

function healthTone(severity: string): 'danger' | 'neutral' | 'warning' {
  if (severity === 'critical' || severity === 'severe') return 'danger';
  if (severity === 'moderate') return 'warning';
  return 'neutral';
}
