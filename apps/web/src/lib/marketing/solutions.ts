export type Solution = {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  outcomes: string[];
  capabilities: { title: string; description: string }[];
};

export const solutions: Solution[] = [
  {
    slug: 'boarding',
    eyebrow: 'Boarding operations',
    title: 'Run every stay with calm, visible care.',
    summary:
      'Connect requests, capacity, check-in, room assignments, daily care, customer updates, and checkout in one live operating flow.',
    outcomes: ['Protect capacity', 'Reduce missed care', 'Create confident handovers'],
    capabilities: [
      {
        title: 'Availability and occupancy',
        description:
          'Manage room types, compatible assignments, blackouts, turnover, waitlists, and peak demand.',
      },
      {
        title: 'Universal check-in',
        description:
          'Verify vaccines, agreements, balances, medications, belongings, and intake condition before care begins.',
      },
      {
        title: 'Daily care command center',
        description:
          'Coordinate feeding, medication, enrichment, wellness observations, tasks, incidents, and shift handovers.',
      },
      {
        title: 'Branded stay updates',
        description:
          'Share photos, timelines, notes, and report cards through the same customer experience as the business website.',
      },
    ],
  },
  {
    slug: 'daycare',
    eyebrow: 'Daycare operations',
    title: 'Turn busy daycare days into a controlled rhythm.',
    summary:
      'Manage enrollment, attendance, playgroups, staffing, recurring plans, care observations, and pickup from one connected day board.',
    outcomes: ['Control daily capacity', 'Build safer groups', 'Grow recurring revenue'],
    capabilities: [
      {
        title: 'Admissions and eligibility',
        description:
          'Track evaluations, trial days, vaccine requirements, approvals, restrictions, and first-day readiness.',
      },
      {
        title: 'Memberships and passes',
        description:
          'Support recurring attendance, packages, credits, freezes, expirations, family sharing, and priority rules.',
      },
      {
        title: 'Playgroup intelligence',
        description:
          'Plan groups around compatibility, size, temperament, ratios, yards, weather, rotations, and rest periods.',
      },
      {
        title: 'Live attendance',
        description:
          'See expected, checked-in, active, resting, pickup-ready, late, and completed visits without side spreadsheets.',
      },
    ],
  },
  {
    slug: 'grooming',
    eyebrow: 'Grooming operations',
    title: 'Schedule the work the coat actually requires.',
    summary:
      'Bring intake assessments, service estimates, groomer availability, production stages, add-ons, quality checks, and rebooking together.',
    outcomes: ['Quote more accurately', 'Keep the day moving', 'Increase rebooking'],
    capabilities: [
      {
        title: 'Pet-aware service setup',
        description:
          'Configure pricing and duration around size, breed, coat, condition, add-ons, staff, and location.',
      },
      {
        title: 'Grooming production board',
        description:
          'Move appointments through arrival, prep, bath, dry, groom, quality review, and pickup-ready states.',
      },
      {
        title: 'Intake and consent',
        description:
          'Capture coat condition, requested style, health concerns, photo references, approvals, and change authorization.',
      },
      {
        title: 'Retention workflows',
        description:
          'Remember preferences, recommend cadence, create recurring appointments, and send branded reminders.',
      },
    ],
  },
  {
    slug: 'training',
    eyebrow: 'Training programs',
    title: 'Sell progress, not disconnected appointments.',
    summary:
      'Organize evaluations, programs, private sessions, classes, credits, goals, homework, attendance, and progress around one pet record.',
    outcomes: ['Package programs', 'Show progress', 'Keep families engaged'],
    capabilities: [
      {
        title: 'Programs and enrollment',
        description:
          'Offer evaluations, private lessons, cohorts, multi-session programs, prerequisites, and capacity limits.',
      },
      {
        title: 'Goals and session notes',
        description:
          'Track behaviors, objectives, exercises, outcomes, homework, media, and next-session recommendations.',
      },
      {
        title: 'Credits and packages',
        description:
          'Sell prepaid programs, enforce expiry and eligibility, and maintain a clear redemption ledger.',
      },
      {
        title: 'Family communication',
        description:
          'Deliver progress summaries and at-home guidance through the branded customer portal.',
      },
    ],
  },
  {
    slug: 'multi-location',
    eyebrow: 'Multi-location management',
    title: 'Give every location flexibility without losing control.',
    summary:
      'Standardize the definitions that matter while allowing local services, pricing, hours, capacity, staffing, and operating policies.',
    outcomes: ['Compare locations', 'Protect standards', 'Expand faster'],
    capabilities: [
      {
        title: 'Shared operating model',
        description:
          'Govern services, roles, care standards, reporting definitions, and brand controls across the organization.',
      },
      {
        title: 'Local configuration',
        description:
          'Let locations manage their own hours, resources, prices, taxes, capacity, team access, and closures.',
      },
      {
        title: 'Portfolio visibility',
        description:
          'Compare occupancy, revenue, utilization, incidents, compliance, retention, and operational health.',
      },
      {
        title: 'Controlled access',
        description:
          'Scope staff and manager permissions by role, location, responsibility, and sensitive action.',
      },
    ],
  },
  {
    slug: 'website-builder',
    eyebrow: 'Website and commerce',
    title: 'Give every business a website that belongs to them.',
    summary:
      'Create a polished public site, booking journey, account experience, and customer portal from one shared brand system—without handing customers off to a mismatched widget.',
    outcomes: ['Own the first impression', 'Keep booking on-brand', 'Publish without developers'],
    capabilities: [
      {
        title: 'Flexible themes and layouts',
        description:
          'Choose header, navigation, hero, service, gallery, testimonial, FAQ, and footer arrangements for each brand.',
      },
      {
        title: 'Visual page building',
        description:
          'Arrange reusable sections, change colors and typography, upload media, and create custom policy or information pages.',
      },
      {
        title: 'Connected conversion',
        description:
          'Move customers from services to availability, booking, payment, registration, and the portal without leaving the brand.',
      },
      {
        title: 'Domains and publishing',
        description:
          'Preview safely, publish changes, connect a custom domain, manage search metadata, and preserve responsive accessibility.',
      },
    ],
  },
];

export function findSolution(slug: string) {
  return solutions.find((solution) => solution.slug === slug);
}
