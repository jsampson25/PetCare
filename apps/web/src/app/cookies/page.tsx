import type { Metadata } from 'next';
import { CookieSettingsButton } from '../../components/cookie-consent';
import { LegalPage } from '../../components/legal-page';

export const metadata: Metadata = { title: 'Cookie Policy' };
export default async function CookiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  return (
    <LegalPage
      description="What cookies and similar technologies Roventra uses, why we use them, and the choices available to you."
      embedded={parameters.embed === '1'}
      title="Cookie Policy"
    >
      <p>
        Cookies are small files stored by a browser. Similar technologies include local storage,
        pixels, and software development kits. Roventra uses these technologies only as described
        here and in our Privacy Policy.
      </p>
      <h2>Necessary technologies</h2>
      <p>
        These support authentication, security, fraud prevention, session continuity, load
        balancing, and saved privacy choices. They are needed for requested services and cannot be
        disabled through our consent controls.
      </p>
      <h2>Analytics technologies</h2>
      <p>
        With permission where required, analytics technologies help us understand which pages and
        features are used, diagnose performance, and improve Roventra. They remain off until the
        visitor opts in when consent is required.
      </p>
      <h2>Marketing technologies</h2>
      <p>
        With permission where required, marketing technologies may measure campaigns or help present
        relevant Roventra advertising. They remain off until the visitor opts in when consent is
        required.
      </p>
      <h2>Current cookie categories</h2>
      <ul>
        <li>
          <strong>Authentication and security:</strong> maintain signed-in sessions and protect
          accounts.
        </li>
        <li>
          <strong>Preference:</strong> remember cookie choices and interface settings.
        </li>
        <li>
          <strong>Analytics:</strong> optional measurement tools added only after consent.
        </li>
        <li>
          <strong>Marketing:</strong> optional campaign tools added only after consent.
        </li>
      </ul>
      <h2>Manage your choices</h2>
      <p>
        You can accept all optional technologies, use necessary technologies only, or select
        categories. You can revisit your decision at any time.
      </p>
      <div className="inline-flex rounded-xl border border-[#b8cce5] bg-white px-4 py-3 text-sm font-bold text-[#1d4ed8]">
        <CookieSettingsButton />
      </div>
      <h2>Contact</h2>
      <p>
        Questions about cookies or privacy may be sent to{' '}
        <a className="font-semibold text-[#1d4ed8]" href="mailto:privacy@getroventra.com">
          privacy@getroventra.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
