/* eslint-disable react/no-unescaped-entities */
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
        This policy applies to Roventra's websites, business management platform, customer portals,
        hosted business websites, mobile experiences, and related services. It does not replace the
        privacy notice a pet-care business must provide for its own practices.
      </p>

      <h2>1. Roventra's privacy role</h2>
      <p>
        Roventra acts as a business or controller for information used to operate our accounts,
        subscriptions, websites, security, support, and product development. For customer, pet,
        reservation, care, staff, and business records processed on a pet-care business's
        instructions, Roventra generally acts as that business's service provider or processor. The
        business remains responsible for its customer relationships, notices, legal bases, and
        privacy-request decisions.
      </p>

      <h2>2. Information you provide</h2>
      <ul>
        <li>
          Account details such as name, email address, phone number, credentials, and preferences.
        </li>
        <li>
          Business, location, staff, subscription, billing, website, service, and pricing details.
        </li>
        <li>
          Customer, household, emergency-contact, authorized-pickup, and communication information.
        </li>
        <li>
          Pet identity, image, behavior, feeding, medication, vaccination, veterinarian, care, and
          incident information.
        </li>
        <li>
          Reservations, invoices, payment references, memberships, waivers, forms, files, messages,
          and support requests.
        </li>
      </ul>

      <h2>3. Information collected automatically</h2>
      <p>
        We may collect IP address, device and browser type, operating system, language, referring
        page, pages and features used, dates and times, approximate location derived from IP,
        identifiers, logs, security events, crashes, and performance information. Optional analytics
        and advertising technologies are governed by your choices and our{' '}
        <Link className="font-semibold text-[#1d4ed8]" href="/cookies">
          Cookie Policy
        </Link>
        .
      </p>

      <h2>4. Information from other sources</h2>
      <p>
        We may receive information from a Business, its authorized users, invited household members,
        payment and identity providers, communication providers, integrations selected by a
        Business, support partners, and public business sources. We combine information only as
        needed for the purposes described in this policy.
      </p>

      <h2>5. How we use information</h2>
      <ul>
        <li>
          Provide websites, accounts, reservations, care workflows, communications, billing, and
          support.
        </li>
        <li>
          Authenticate users, enforce permissions, prevent fraud, investigate misuse, and maintain
          audit records.
        </li>
        <li>Process subscriptions and facilitate payments through payment providers.</li>
        <li>Operate integrations and complete actions requested by a Business or Customer.</li>
        <li>Measure reliability, diagnose errors, improve usability, and develop features.</li>
        <li>Send transactional notices and permitted product or marketing communications.</li>
        <li>
          Comply with law, enforce agreements, and protect people, animals, rights, and systems.
        </li>
      </ul>

      <h2>6. Sensitive and pet-care information</h2>
      <p>
        The service can contain medication, vaccination, veterinarian, accessibility, and free-form
        care notes. Some information may be considered sensitive under applicable law even when it
        concerns a pet or reveals information about a person. Businesses should collect only what
        they need, restrict staff access, and avoid entering unnecessary human medical information.
        Roventra does not use sensitive information for targeted advertising.
      </p>

      <h2>7. How information is disclosed</h2>
      <ul>
        <li>With the Business and authorized users responsible for the Customer or pet.</li>
        <li>
          With service providers supporting cloud hosting, authentication, storage, payments, email,
          messaging, analytics, support, and security.
        </li>
        <li>With integrations and third parties a Business or User directs us to connect.</li>
        <li>
          With advisers, auditors, insurers, financing sources, or transaction parties subject to
          appropriate duties.
        </li>
        <li>
          With authorities or other parties when required by law or reasonably necessary to prevent
          harm, fraud, abuse, or security threats.
        </li>
      </ul>
      <p>
        We do not sell personal information for money. If future advertising practices constitute a
        "sale," "sharing," or targeted advertising under an applicable privacy law, we will provide
        the required notice and opt-out before using those practices.
      </p>

      <h2>8. Payments</h2>
      <p>
        Payment providers process card and bank information under their own privacy notices and
        security obligations. Roventra generally receives tokens, transaction identifiers, status,
        limited card details such as brand and last four digits, and fraud or dispute information,
        rather than complete card numbers.
      </p>

      <h2>9. Data retention</h2>
      <p>
        Retention depends on the type of information, account status, Business instructions,
        security needs, backup cycles, disputes, and legal or financial recordkeeping duties. We
        retain information only as long as reasonably needed for those purposes, then delete,
        de-identify, or isolate it from ordinary use. Businesses may configure or request deletion
        subject to applicable obligations.
      </p>

      <h2>10. Security</h2>
      <p>
        We use administrative, technical, and physical safeguards designed for the nature of the
        information, including tenant isolation, access controls, authentication, encryption in
        transit, logging, backups, and security monitoring where applicable. No system can guarantee
        absolute security. Users must protect credentials and promptly report suspected incidents.
      </p>

      <h2>11. International processing</h2>
      <p>
        Roventra and its providers may process information in the United States and other countries
        where protections differ. When required, we will use recognized safeguards for international
        transfers. The initial commercial service is intended for United States businesses unless
        Roventra expressly approves another market.
      </p>

      <h2>12. Your choices and privacy rights</h2>
      <p>
        Depending on where you live, you may request access, correction, deletion, portability, or
        restriction; object to certain processing; withdraw consent; or appeal a decision. You may
        also opt out of marketing and change cookie choices. We will not unlawfully discriminate
        against you for exercising a privacy right. We may verify your identity and authority before
        acting.
      </p>
      <p>
        Requests about records controlled by a pet-care Business should normally be sent to that
        Business first. Requests concerning Roventra's own practices may be sent to the address
        below. An authorized agent may submit a request where law permits, subject to verification.
      </p>

      <h2>13. State-specific disclosures</h2>
      <p>
        Residents of states with comprehensive privacy laws may have additional rights when the law
        applies to Roventra or a Business. Before commercial launch, Roventra will publish any
        required category tables, request metrics, appeal process, sensitive-data disclosures, and
        "Do Not Sell or Share" mechanism based on actual processing and applicable thresholds.
      </p>

      <h2>14. Children</h2>
      <p>
        Roventra is designed for pet-care businesses and adults. It is not directed to children
        under 13, and we do not knowingly collect personal information directly from children under
        13. Contact us if you believe a child submitted information directly to Roventra without
        appropriate authorization.
      </p>

      <h2>15. Changes and contact</h2>
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
