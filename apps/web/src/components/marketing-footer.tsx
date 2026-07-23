import Link from 'next/link';
import { CookieSettingsButton } from './cookie-consent';
import { RoventraLogo } from './roventra-logo';

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#dbe7f5] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.2fr_repeat(3,.7fr)] lg:px-8">
        <div>
          <Link className="inline-flex" href="/" aria-label="Roventra home">
            <RoventraLogo className="h-9 w-auto" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#52627a]">
            The connected website and operating platform for modern pet-care businesses.
          </p>
        </div>
        <div className="grid content-start gap-3 text-sm text-[#40516a]">
          <strong className="text-[#0b1f3a]">Platform</strong>
          <Link href="/features">Features</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/security">Security</Link>
          <Link href="/pricing">Pricing</Link>
        </div>
        <div className="grid content-start gap-3 text-sm text-[#40516a]">
          <strong className="text-[#0b1f3a]">Solutions</strong>
          <Link href="/solutions/boarding">Boarding</Link>
          <Link href="/solutions/daycare">Daycare</Link>
          <Link href="/solutions/grooming">Grooming</Link>
          <Link href="/solutions/website-builder">Website builder</Link>
        </div>
        <div className="grid content-start gap-3 text-sm text-[#40516a]">
          <strong className="text-[#0b1f3a]">Get started</strong>
          <Link href="/demo">See Roventra</Link>
          <Link href="/switch-to-roventra">Switch to Roventra</Link>
          <Link href="/auth/register?plan=growth&trial=14">Free trial</Link>
          <Link href="/auth/sign-in">Sign in</Link>
        </div>
      </div>
      <div className="border-t border-[#e7eef8] px-6 py-5 text-xs text-[#52627a]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <span>© 2026 Roventra. Built for exceptional pet care.</span>
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/privacy" rel="noreferrer" target="_blank">
              Privacy
            </Link>
            <Link href="/terms" rel="noreferrer" target="_blank">
              Terms
            </Link>
            <Link href="/cookies" rel="noreferrer" target="_blank">
              Cookies
            </Link>
            <CookieSettingsButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}
