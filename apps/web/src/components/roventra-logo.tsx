import Image from 'next/image';

const logoSources = {
  brand: '/brand/roventra-logo-kit/roventra-brand.svg',
  navy: '/brand/roventra-logo-kit/roventra-navy.svg',
  white: '/brand/roventra-logo-kit/roventra-white.svg',
} as const;

export function RoventraLogo({
  className = 'h-9 w-auto',
  priority = false,
  variant = 'brand',
}: {
  className?: string;
  priority?: boolean;
  variant?: keyof typeof logoSources;
}) {
  return (
    <Image
      alt="Roventra"
      className={className}
      height={453}
      priority={priority}
      src={logoSources[variant]}
      width={1643}
    />
  );
}
