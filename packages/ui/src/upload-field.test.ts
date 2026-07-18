import { describe, expect, it } from 'vitest';

import { validateSelectedFile } from './upload-field';

describe('validateSelectedFile', () => {
  it('accepts an allowed file within the size limit', () => {
    expect(
      validateSelectedFile({ size: 1024, type: 'application/pdf' }, ['application/pdf']),
    ).toBeNull();
  });

  it('rejects oversized and unsupported files', () => {
    expect(
      validateSelectedFile({ size: 11 * 1024 * 1024, type: 'application/pdf' }, [
        'application/pdf',
      ]),
    ).toContain('larger');
    expect(validateSelectedFile({ size: 1024, type: 'text/html' }, ['application/pdf'])).toContain(
      'not supported',
    );
  });
});
