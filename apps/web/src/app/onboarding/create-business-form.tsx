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
      {state.error ? (
        <Alert title="Business not created" tone="danger">
          {state.error}
        </Alert>
      ) : null}
      <Field
        autoComplete="organization"
        label="Business display name"
        name="businessName"
        required
      />
      <div>
        <label className="block text-sm font-bold" htmlFor="businessSlug">
          Website URL name
        </label>
        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
          Choose the short name used for your PetCare website. Do not enter .com here.
        </p>
        <div className="mt-2 flex min-h-12 items-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white focus-within:border-[var(--focus-ring)] focus-within:ring-3 focus-within:ring-[color-mix(in_srgb,var(--focus-ring)_25%,transparent)]">
          <span className="hidden border-r bg-slate-50 px-3 py-3 text-sm text-slate-500 sm:block">
            localhost:3000/site/
          </span>
          <input
            className="min-w-0 flex-1 px-3 py-3 text-base outline-none"
            id="businessSlug"
            name="businessSlug"
            placeholder="preppy-pet"
            required
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          You can connect preppypet.com or another custom domain after setup.
        </p>
      </div>
      <Field label="First location name" name="locationName" placeholder="Main Facility" required />
      <Field
        hint="A short internal name for this location—not a domain name."
        label="Location URL name"
        name="locationSlug"
        placeholder="main-location"
        required
      />
      <div>
        <label className="block text-sm font-bold" htmlFor="timeZone">
          Location time zone
        </label>
        <select
          className="mt-2 min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-default)] px-3"
          defaultValue="America/Chicago"
          id="timeZone"
          name="timeZone"
          required
        >
          <option value="America/New_York">Eastern</option>
          <option value="America/Chicago">Central</option>
          <option value="America/Denver">Mountain</option>
          <option value="America/Phoenix">Arizona</option>
          <option value="America/Los_Angeles">Pacific</option>
          <option value="America/Anchorage">Alaska</option>
          <option value="Pacific/Honolulu">Hawaii</option>
        </select>
      </div>
      <Button loading={pending} type="submit">
        Create business
      </Button>
    </form>
  );
}
