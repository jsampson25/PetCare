import { Alert } from '@petcare/ui/alert';
import { Badge } from '@petcare/ui/badge';
import { Button } from '@petcare/ui/button';
import { Card } from '@petcare/ui/card';
import { DataTable, type DataColumn } from '@petcare/ui/data-table';
import { Field } from '@petcare/ui/field';
import { FormErrorSummary } from '@petcare/ui/form-error-summary';
import { StatePanel } from '@petcare/ui/state-panel';

import { ComponentInteractions } from '../../../components/component-interactions';

type ExampleReservation = {
  date: string;
  pet: string;
  service: string;
  status: string;
};

const reservationColumns: DataColumn<ExampleReservation>[] = [
  { key: 'pet', header: 'Pet', render: (row) => <strong>{row.pet}</strong> },
  { key: 'service', header: 'Service', render: (row) => row.service },
  { key: 'date', header: 'Arrival', render: (row) => row.date },
  { key: 'status', header: 'Status', render: (row) => <Badge tone="success">{row.status}</Badge> },
];

const reservations: ExampleReservation[] = [
  { date: 'Aug 14, 8:00 AM', pet: 'Bella', service: 'Boarding', status: 'Confirmed' },
  { date: 'Aug 15, 7:30 AM', pet: 'Max', service: 'Daycare', status: 'Confirmed' },
];

export default function DesignSystemPage() {
  return (
    <div>
      <p className="text-sm font-bold text-[var(--action-primary)]">E01 foundation</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Design system</h1>
      <p className="mt-2 max-w-3xl leading-7 text-[var(--text-secondary)]">
        A review surface for shared components, semantics, interaction states, and accessible
        tenant-safe styling. Examples use visible labels and do not rely on color alone.
      </p>

      <div className="mt-8 grid gap-6">
        <Card
          title="Actions"
          description="Minimum 44px targets with visible keyboard focus and explicit states."
        >
          <div className="flex flex-wrap gap-3">
            <Button>Save changes</Button>
            <Button variant="secondary">Review details</Button>
            <Button variant="quiet">Cancel</Button>
            <Button variant="danger">Archive record</Button>
            <Button disabled>Unavailable</Button>
            <Button loading>Submitting</Button>
          </div>
        </Card>

        <Card
          title="Form fields"
          description="Labels remain visible; guidance and errors are programmatically associated."
        >
          <div className="grid gap-5">
            <FormErrorSummary
              errors={[{ fieldId: 'example-phone', message: 'Enter a valid phone number.' }]}
            />
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                hint="Used for reservation confirmations."
                id="example-email"
                label="Email address"
                type="email"
              />
              <Field
                error="Enter a valid phone number."
                id="example-phone"
                label="Mobile phone"
                value="555"
                readOnly
              />
            </div>
          </div>
        </Card>

        <Card
          title="Statuses"
          description="Every status has a textual label in addition to its color treatment."
        >
          <div className="flex flex-wrap gap-3">
            <Badge>Draft</Badge>
            <Badge tone="info">Pending review</Badge>
            <Badge tone="success">Verified</Badge>
            <Badge tone="warning">Expires soon</Badge>
            <Badge tone="danger">Action required</Badge>
          </div>
        </Card>

        <Card title="Messages and exceptions">
          <div className="grid gap-3">
            <Alert title="Helpful information">This record can be completed later.</Alert>
            <Alert title="Ready" tone="success">
              All required information is present.
            </Alert>
            <Alert title="Review required" tone="warning">
              One vaccination expires before the stay.
            </Alert>
            <Alert title="Unable to continue" tone="danger">
              Correct the highlighted information and try again.
            </Alert>
          </div>
        </Card>

        <Card title="Empty state">
          <StatePanel
            action={<Button>Add first pet</Button>}
            description="Pet profiles keep vaccinations, feeding, medication, behavior, and care instructions together."
            title="No pets yet"
          />
        </Card>

        <Card
          title="Data table"
          description="Headers, caption, status text, and a contained horizontal overflow fallback."
        >
          <DataTable
            caption="Example upcoming reservations"
            columns={reservationColumns}
            getRowKey={(row) => `${row.pet}-${row.date}`}
            rows={reservations}
          />
        </Card>

        <Card
          title="Interactive patterns"
          description="Review with mouse, keyboard, touch, zoom, and assistive technology."
        >
          <ComponentInteractions />
        </Card>
      </div>
    </div>
  );
}
