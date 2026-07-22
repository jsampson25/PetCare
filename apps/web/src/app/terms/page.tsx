/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next';

import { LegalPage } from '../../components/legal-page';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage
      description="The terms that govern access to and use of the Roventra platform and related services."
      title="Terms of Service"
    >
      <p>
        These Terms form an agreement between Roventra and the person or organization using the
        service. By creating an account, starting a trial, purchasing a subscription, or using the
        service, you agree to these Terms. If you act for a business, you represent that you have
        authority to bind that business.
      </p>

      <h2>1. Definitions and roles</h2>
      <p>
        "Business" means a pet-care provider that subscribes to Roventra. "Customer" means a pet
        owner or other person who interacts with a Business through Roventra. "User" means anyone
        authorized to access the service. "Business Data" means information, records, content, and
        files submitted to the service by or for a Business.
      </p>
      <p>
        Roventra provides software that connects Businesses and Customers. Unless expressly stated,
        Roventra is not the pet-care provider, merchant of record for pet-care services, veterinary
        provider, employer, or agent of either party. A Business and its Customer contract directly
        for pet-care services.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <p>
        You must be at least 18 years old, legally able to enter this agreement, and provide
        accurate account information. You are responsible for authorized users, role assignments,
        account security, and activity under your account. Credentials may not be shared outside the
        authorized user. Notify us promptly of suspected unauthorized access.
      </p>

      <h2>3. The service</h2>
      <p>
        Roventra provides website, booking, customer, pet-care operations, communication,
        payment-support, and reporting tools. We may improve, add, modify, or discontinue features.
        We will use reasonable efforts to give notice when a material change significantly reduces
        paid functionality.
      </p>

      <h2>4. Business and customer responsibilities</h2>
      <p>
        Each Business controls its services, prices, capacity, availability, policies, staff,
        animal-care decisions, and customer relationships. Roventra does not verify a Business,
        Customer, pet record, vaccination record, availability entry, or care instruction. Users
        must independently confirm information needed for safe care and legal compliance.
      </p>
      <p>
        Businesses are responsible for applicable animal-care, veterinary, employment, tax, payment,
        accessibility, consumer-protection, marketing, recordkeeping, and privacy duties. Roventra
        does not provide veterinary, legal, tax, accounting, or medical advice.
      </p>

      <h2>5. Reservations, cancellations, and pet-care services</h2>
      <p>
        Reservation availability and service descriptions come from the Business. The Business is
        responsible for honoring reservations and disclosing deposits, cancellation charges, no-show
        charges, late-pickup charges, refund terms, vaccination requirements, and other policies
        before booking. Roventra is not responsible for the quality, safety, legality, or completion
        of pet-care services.
      </p>

      <h2>6. Trials, subscriptions, and payment</h2>
      <p>
        Trial access ends at the stated time unless converted to a paid subscription. Paid
        subscriptions renew for the selected billing period until canceled. Fees, taxes, usage
        charges, renewal terms, and cancellation options will be shown at purchase. Except where
        required by law or expressly stated, fees already paid are nonrefundable.
      </p>
      <p>
        Payment processing may be provided by an independent payment processor. You authorize that
        processor and Roventra to complete charges you approve, including subscription charges and
        customer transactions configured by a Business. Card details may be stored by the payment
        processor rather than Roventra.
      </p>

      <h2>7. Communications</h2>
      <p>
        Roventra and Businesses may send account notices, reservation confirmations, care updates,
        receipts, security notices, and other transactional communications by email, text, push
        notification, or in-product message. Marketing communications require the permissions
        required by law and must provide an applicable opt-out. Message and data rates may apply.
        Businesses are responsible for obtaining and honoring consent for messages they initiate.
      </p>

      <h2>8. Business Data and privacy</h2>
      <p>
        A Business retains its rights in Business Data. The Business grants Roventra the limited,
        nonexclusive rights needed to host, process, transmit, back up, display, and protect that
        data while providing the service. The Business must have all necessary rights, notices,
        permissions, and lawful bases for customer, staff, pet, vaccination, care, image, document,
        payment, and communication information it submits.
      </p>

      <h2>9. Content and intellectual property</h2>
      <p>
        Roventra and its licensors own the service, software, designs, documentation, trademarks,
        and related materials. Subject to these Terms and payment of applicable fees, Roventra gives
        the Business a limited, nonexclusive, nontransferable right to use the service during its
        subscription. Feedback may be used to improve Roventra without restriction or payment.
      </p>
      <p>
        Users must own or have permission to publish logos, photographs, copy, reviews, messages,
        documents, and other content they upload. Public website content may be displayed as
        directed by the Business.
      </p>

      <h2>10. Acceptable use</h2>
      <p>
        You may not violate law or third-party rights; access another tenant's data; bypass access
        controls; distribute malware; interfere with availability; scrape or probe the service
        without authorization; reverse engineer the service except where law expressly permits; send
        unlawful or deceptive communications; impersonate another person; upload harmful or
        infringing content; or use the service to harm people or animals.
      </p>

      <h2>11. Third-party services</h2>
      <p>
        Integrations and third-party services are governed by their own terms and privacy practices.
        Their availability, security, and performance are outside Roventra's control. Roventra may
        suspend an integration that creates a security, legal, or operational risk.
      </p>

      <h2>12. Suspension, termination, and data export</h2>
      <p>
        You may stop using the service and cancel according to your subscription terms. We may limit
        or suspend access to protect the service, address nonpayment, comply with law, prevent harm,
        or respond to a material breach. Where practical, we will provide notice and an opportunity
        to resolve the issue. Data export and deletion after termination are subject to the plan,
        documented retention periods, legal obligations, and backup cycles in effect at that time.
      </p>

      <h2>13. Availability and beta features</h2>
      <p>
        Maintenance, third-party failures, internet outages, emergencies, and other events may
        interrupt access. Preview, beta, and trial features may be incomplete, changed, or removed
        and should not be relied on for critical animal-care or safety decisions without an
        independent process.
      </p>

      <h2>14. Disclaimers and liability</h2>
      <p>
        The service is provided on an "as available" basis to the extent permitted by law. Final
        warranty exclusions, liability limits, indemnification provisions, governing law, dispute
        procedures, and any arbitration provisions will be included before commercial launch and
        reviewed by qualified counsel. Nothing in these Terms excludes rights or liability that
        applicable law does not allow the parties to exclude.
      </p>

      <h2>15. Changes and contact</h2>
      <p>
        We may update these Terms as the service or law changes. We will provide additional notice
        and request renewed acceptance when legally required or when a material change warrants it.
        Questions may be sent to{' '}
        <a className="font-semibold text-[#1d4ed8]" href="mailto:legal@getroventra.com">
          legal@getroventra.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
