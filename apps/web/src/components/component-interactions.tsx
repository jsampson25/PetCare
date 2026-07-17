'use client';

import { Button } from '@petcare/ui/button';
import { Dialog } from '@petcare/ui/dialog';
import { Tabs } from '@petcare/ui/tabs';
import { UploadField, validateSelectedFile } from '@petcare/ui/upload-field';
import { useState } from 'react';

export function ComponentInteractions() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string>();

  return (
    <div className="grid gap-8">
      <div>
        <h3 className="font-bold">Managed dialog</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
          Escape and the close action return control without navigating away.
        </p>
        <div className="mt-4">
          <Button onClick={() => setDialogOpen(true)} variant="secondary">Open example dialog</Button>
        </div>
        <Dialog
          description="This example uses the browser’s modal dialog behavior for focus containment and Escape handling."
          onClose={() => setDialogOpen(false)}
          open={dialogOpen}
          title="Review reservation change"
        >
          <p className="leading-7 text-[var(--text-secondary)]">
            Feature dialogs will place the safest default action first and clearly label destructive consequences.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <Button onClick={() => setDialogOpen(false)} variant="secondary">Cancel</Button>
            <Button onClick={() => setDialogOpen(false)}>Confirm change</Button>
          </div>
        </Dialog>
      </div>

      <div>
        <h3 className="font-bold">Keyboard tabs</h3>
        <div className="mt-3">
          <Tabs
            label="Pet profile sections"
            items={[
              { id: 'overview', label: 'Overview', content: <p className="leading-7 text-[var(--text-secondary)]">Identity, care alerts, and the next reservation.</p> },
              { id: 'vaccines', label: 'Vaccinations', content: <p className="leading-7 text-[var(--text-secondary)]">Required records, verification status, and expiration dates.</p> },
              { id: 'care', label: 'Care instructions', content: <p className="leading-7 text-[var(--text-secondary)]">Feeding, medication, behavior, and handling needs.</p> },
            ]}
          />
        </div>
      </div>

      <UploadField
        accept={['application/pdf', 'image/jpeg', 'image/png']}
        error={uploadError}
        hint="PDF, JPG, or PNG. Maximum 10 MB. Files are not uploaded in this demonstration."
        id="vaccine-record"
        label="Vaccination record"
        onSelect={(file) => {
          setUploadError(
            file
              ? validateSelectedFile(file, ['application/pdf', 'image/jpeg', 'image/png']) ?? undefined
              : undefined,
          );
        }}
      />
    </div>
  );
}
