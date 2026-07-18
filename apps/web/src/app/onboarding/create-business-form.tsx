'use client';

import { Alert } from '@petcare/ui/alert';
import { Button } from '@petcare/ui/button';
import { Field } from '@petcare/ui/field';
import { useActionState } from 'react';

import { createFirstBusiness, type CreateBusinessState } from './actions';

const initialState: CreateBusinessState = {};

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState(createFirstBusiness, initialState);
  return (
    <form action={action} className="space-y-5">
      {state.error ? <Alert title="Business not created" tone="danger">{state.error}</Alert> : null}
      <Field autoComplete="organization" label="Business display name" name="businessName" required />
      <Field hint="Lowercase letters, numbers, and hyphens. You can connect a custom domain later." label="PetCare web address" name="businessSlug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="happy-paws" required />
      <Field label="First location name" name="locationName" placeholder="Main Facility" required />
      <Field label="Location web address" name="locationSlug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="main" required />
      <div>
        <label className="block text-sm font-bold" htmlFor="timeZone">Location time zone</label>
        <select className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3" defaultValue="America/Chicago" id="timeZone" name="timeZone" required>
          <option value="America/New_York">Eastern</option><option value="America/Chicago">Central</option><option value="America/Denver">Mountain</option><option value="America/Phoenix">Arizona</option><option value="America/Los_Angeles">Pacific</option><option value="America/Anchorage">Alaska</option><option value="Pacific/Honolulu">Hawaii</option>
        </select>
      </div>
      <Button loading={pending} type="submit">Create business</Button>
    </form>
  );
}
