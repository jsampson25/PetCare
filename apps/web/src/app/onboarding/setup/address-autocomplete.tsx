'use client';

import { useEffect, useRef, useState } from 'react';

type AddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type SelectedPlace = {
  addressComponents?: AddressComponent[];
  fetchFields(options: { fields: string[] }): Promise<void>;
};

type PlacePrediction = {
  toPlace(): SelectedPlace;
};

type PlaceSelectEvent = Event & {
  placePrediction?: PlacePrediction;
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new (options?: { includedRegionCodes?: string[] }) => HTMLElement;
};

declare global {
  interface Window {
    google?: {
      maps: {
        importLibrary(name: 'places'): Promise<PlacesLibrary>;
      };
    };
  }
}

let mapsScriptPromise: Promise<void> | undefined;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps could not be loaded.'));
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

function valueFor(components: AddressComponent[], type: string, short = false) {
  const component = components.find((item) => item.types.includes(type));
  return component ? (short ? component.shortText : component.longText) : '';
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  if (!value) return;
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement)) return;
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

export function AddressAutocomplete({ apiKey }: { apiKey?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>(
    apiKey ? 'loading' : 'unavailable',
  );

  useEffect(() => {
    if (!apiKey || !hostRef.current) return;
    const host = hostRef.current;
    let active = true;

    void loadGoogleMaps(apiKey)
      .then(async () => {
        const places = await window.google?.maps.importLibrary('places');
        if (!active || !places) return;

        const autocomplete = new places.PlaceAutocompleteElement({
          includedRegionCodes: ['us', 'ca'],
        });
        autocomplete.setAttribute('aria-label', 'Search for the business address');
        autocomplete.addEventListener('gmp-select', async (event) => {
          const prediction = (event as PlaceSelectEvent).placePrediction;
          if (!prediction) return;

          const place = prediction.toPlace();
          await place.fetchFields({ fields: ['addressComponents'] });
          const components = place.addressComponents ?? [];
          const form = host.closest('form');
          if (!(form instanceof HTMLFormElement)) return;

          const streetNumber = valueFor(components, 'street_number');
          const route = valueFor(components, 'route');
          const city =
            valueFor(components, 'locality') ||
            valueFor(components, 'postal_town') ||
            valueFor(components, 'sublocality');

          setFormValue(form, 'addressLine1', [streetNumber, route].filter(Boolean).join(' '));
          setFormValue(form, 'city', city);
          setFormValue(form, 'region', valueFor(components, 'administrative_area_level_1', true));
          setFormValue(form, 'postalCode', valueFor(components, 'postal_code'));
          setFormValue(form, 'countryCode', valueFor(components, 'country', true).toUpperCase());
        });

        host.replaceChildren(autocomplete);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('unavailable');
      });

    return () => {
      active = false;
      host.replaceChildren();
    };
  }, [apiKey]);

  return (
    <div className="col-span-full rounded-2xl border border-[#c9dcf7] bg-[#f5f9ff] p-4">
      <label className="block text-sm font-bold">Find the business address</label>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Start typing and select the correct address. We will fill in the address fields below.
      </p>
      <div className="mt-3 min-h-12" ref={hostRef} />
      {status === 'loading' ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">Loading address search...</p>
      ) : null}
      {status === 'unavailable' ? (
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Address search is not configured yet. You can still enter the address manually.
        </p>
      ) : null}
    </div>
  );
}
