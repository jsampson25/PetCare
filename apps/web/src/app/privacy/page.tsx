import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '../../components/legal-page';

export const metadata: Metadata = { title: 'Privacy Policy' };
export default function PrivacyPage() {
  return (
    <LegalPage
      description="How Roventra collects, uses, shares, and protects personal information across our websites and services."
      title="Privacy Policy"
    >
      <p>
        This policy applies to Roventra’s websites, business management platform, customer portals,
        and related services. A pet-care business using Roventra is responsible for its own
        customer-facing privacy notices and data practices.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>
          Account and contact details, including name, email address, telephone number, and login
          credentials.
        </li>
        <li>
          Business details, subscription information, support communications, and configuration
          choices.
        </li>
        <li>
          Customer, household, pet, reservation, care, vaccination, document, payment, and
          communication data submitted through the service.
        </li>
        <li>Device, browser, IP address, security, usage, and diagnostic information.</li>
        <li>
          Cookie and consent preferences described in our{' '}
          <Link className="font-semibold text-[#1d4ed8]" href="/cookies">
            Cookie Policy
          </Link>
          .
        </li>
      </ul>
      <h2>How we use information</h2>
      <ul>
        <li>Provide, secure, support, and improve the service.</li>
        <li>Process registrations, reservations, subscriptions, and payments.</li>
        <li>Authenticate users, prevent fraud, troubleshoot errors, and maintain audit records.</li>
        <li>Send service communications and, where permitted, product or marketing messages.</li>
        <li>Meet legal obligations and enforce our agreements.</li>
      </ul>
      <h2>How information is shared</h2>
      <p>
        We may share information with service providers that support hosting, authentication,
        payments, email, messaging, analytics, customer support, and security. We may also disclose
        information when required by law, to protect rights and safety, during a business
        transaction, or when directed by the business that controls the information. We do not sell
        personal information for money.
      </p>
      <h2>Businesses and their customers</h2>
      <p>
        For information a pet-care business enters or collects through Roventra, that business
        generally determines why and how the information is used. Roventra processes that
        information to provide the service. Privacy requests about a pet-care business’s records
        should normally be directed to that business first.
      </p>
      <h2>Retention and security</h2>
      <p>
        We retain information for as long as needed to provide the service, meet contractual and
        legal duties, resolve disputes, and maintain security. We use administrative, technical, and
        physical safeguards, but no system can guarantee absolute security.
      </p>
      <h2>Your choices and rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, restrict, or
        receive a copy of personal information, or to object to certain uses. You may also change
        cookie choices through Cookie settings in the footer. We may need to verify your identity
        before completing a request.
      </p>
      <h2>Children</h2>
      <p>
        Roventra is designed for pet-care businesses and adults. It is not directed to children
        under 13, and we do not knowingly collect personal information directly from children under
        13.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update this policy as the service or law changes. We will post the revised date and
        provide additional notice when appropriate. Questions and privacy requests may be sent to{' '}
        <a className="font-semibold text-[#1d4ed8]" href="mailto:privacy@getroventra.com">
          privacy@getroventra.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
