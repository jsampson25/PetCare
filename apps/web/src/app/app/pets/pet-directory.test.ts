import { describe, expect, it } from 'vitest';

import { filterPetDirectory, hasCurrentVaccination } from './pet-directory';

const pets = [
  { breed: 'Golden Retriever', id: 'pet-1', name: 'Milo', preferred_name: null },
  { breed: 'French Bulldog', id: 'pet-2', name: 'Bella', preferred_name: 'Bee' },
];

describe('pet directory', () => {
  it('matches pet identity, breed, and owner name', () => {
    const owners = new Map([
      ['pet-1', 'Pat Morgan'],
      ['pet-2', 'Nina Chen'],
    ]);

    expect(filterPetDirectory(pets, 'golden', owners)).toEqual([pets[0]]);
    expect(filterPetDirectory(pets, 'bee', owners)).toEqual([pets[1]]);
    expect(filterPetDirectory(pets, 'NINA', owners)).toEqual([pets[1]]);
  });

  it('requires an approved, unexpired vaccination record', () => {
    expect(
      hasCurrentVaccination(
        [{ expires_on: '2027-01-01', review_status: 'approved' }],
        '2026-07-27',
      ),
    ).toBe(true);
    expect(
      hasCurrentVaccination(
        [
          { expires_on: '2026-07-26', review_status: 'approved' },
          { expires_on: '2027-01-01', review_status: 'pending' },
        ],
        '2026-07-27',
      ),
    ).toBe(false);
  });
});
