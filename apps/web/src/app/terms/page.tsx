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
        service, you agree to these Terms.
      </p>
      <h2>Eligibility and accounts</h2>
      <p>
        You must be legally able to enter this agreement and provide accurate account information.
        You are responsible for authorized users, account security, and activity under your account.
        Notify us promptly of suspected unauthorized access.
      </p>
      <h2>The service</h2>
      <p>
        Roventra provides website, booking, customer, pet-care operations, communication,
        payment-support, and reporting tools. Features may change as the platform develops. You are
        responsible for configuring the service for your business and independently meeting
        animal-care, employment, tax, payment, accessibility, privacy, and other legal obligations.
      </p>
      <h2>Trials, subscriptions, and payment</h2>
      <p>
        Trial access ends at the stated time unless converted to a paid subscription. Paid
        subscriptions renew for the selected billing period until canceled. Fees, taxes, usage
        charges, renewal terms, and cancellation options will be shown at purchase. Except where
        required by law or expressly stated, fees already paid are nonrefundable.
      </p>
      <h2>Your data and responsibilities</h2>
      <p>
        You retain rights in information and content you submit. You grant Roventra the limited
        rights needed to host, process, transmit, back up, and display that content to provide and
        secure the service. You must have the necessary permissions and lawful basis to submit
        customer, staff, pet, medical, vaccination, image, payment, and communication information.
      </p>
      <h2>Acceptable use</h2>
      <p>
        You may not misuse the service, violate law or third-party rights, interfere with security
        or availability, probe for vulnerabilities without authorization, distribute malware, send
        unlawful messages, access another tenant’s data, or use the service to harm people or
        animals.
      </p>
      <h2>Third-party services</h2>
      <p>
        Integrations and third-party services are governed by their own terms and privacy practices.
        Roventra is not responsible for third-party services, but we will use reasonable care in
        selecting and operating integrations we provide.
      </p>
      <h2>Suspension and termination</h2>
      <p>
        You may stop using the service and cancel according to your subscription terms. We may limit
        or suspend access to protect the service, address nonpayment, comply with law, or respond to
        a material breach. Where practical, we will provide notice and an opportunity to resolve the
        issue.
      </p>
      <h2>Disclaimers and liability</h2>
      <p>
        The service is provided on an “as available” basis to the extent permitted by law. Roventra
        is business software and does not replace professional veterinary, legal, accounting, or
        animal-care judgment. Final warranty exclusions, liability limits, indemnification
        provisions, governing law, and dispute terms will be included before commercial launch and
        reviewed by qualified counsel.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these Terms and will provide notice when a material change requires it.
        Continued use after an effective update constitutes acceptance where permitted by law.
        Questions may be sent to{' '}
        <a className="font-semibold text-[#1d4ed8]" href="mailto:legal@getroventra.com">
          legal@getroventra.com
        </a>
        .
      </p>
    </LegalPage>
  );
}
