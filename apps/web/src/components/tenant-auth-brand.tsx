import type { CSSProperties } from 'react';

import type { PublicTenantBrand } from '../lib/auth/public-tenant-brand';

export function TenantAuthBrand({ brand }: { brand: PublicTenantBrand }) {
  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--tenant-primary)_22%,#dbe7f5)] bg-[color-mix(in_srgb,var(--tenant-primary)_6%,white)] p-3"
      style={
        {
          '--action-primary': brand.primary,
          '--action-primary-hover': `color-mix(in srgb, ${brand.primary} 86%, black)`,
          '--action-primary-active': `color-mix(in srgb, ${brand.primary} 72%, black)`,
          '--action-primary-text': brand.primaryText,
          '--focus-ring': brand.primary,
          '--link-default': brand.primary,
          '--tenant-primary': brand.primary,
        } as CSSProperties
      }
    >
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={brand.logoAlt || `${brand.name} logo`}
          className="size-11 rounded-xl object-contain"
          src={brand.logoUrl}
        />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-xl bg-[var(--tenant-primary)] text-lg font-black"
          style={{ color: brand.primaryText }}
        >
          {brand.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span>
        <span className="block text-xs font-bold uppercase tracking-[.14em] text-[#6b7b91]">
          Customer access
        </span>
        <span className="mt-0.5 block font-bold text-[#0b1f3a]">{brand.name}</span>
      </span>
    </div>
  );
}
