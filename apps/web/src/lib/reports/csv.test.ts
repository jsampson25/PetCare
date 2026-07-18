import { describe, expect, it } from 'vitest';

import { createCsv, csvCell } from './csv';

describe('CSV reporting', () => {
  it('escapes punctuation, quotes, and line breaks as data', () => {
    expect(csvCell('Pat, Owner')).toBe('"Pat, Owner"');
    expect(csvCell('She said "hello"')).toBe('"She said ""hello"""');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
    expect(csvCell('=2+2')).toBe("'=2+2");
  });

  it('creates stable header and row order', () => {
    expect(createCsv(['number', 'status'], [{ number: 'B-1', status: 'confirmed' }])).toBe(
      'number,status\r\nB-1,confirmed',
    );
  });
});
