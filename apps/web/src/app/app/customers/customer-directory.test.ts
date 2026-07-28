import { describe, expect, it } from 'vitest';

import { filterCustomerDirectory, summarizeCustomerHousehold } from './customer-directory';

const customers = [
  {
    email: 'pat.morgan@example.test',
    first_name: 'Patricia',
    id: 'customer-1',
    last_name: 'Morgan',
    phone: '615-555-0101',
    preferred_name: 'Pat',
  },
  {
    email: 'nina.chen@example.test',
    first_name: 'Nina',
    id: 'customer-2',
    last_name: 'Chen',
    phone: '615-555-0102',
    preferred_name: null,
  },
];

describe('customer directory', () => {
  it('matches customer names, preferred names, email, and phone', () => {
    expect(filterCustomerDirectory(customers, 'pat')).toEqual([customers[0]]);
    expect(filterCustomerDirectory(customers, 'CHEN')).toEqual([customers[1]]);
    expect(filterCustomerDirectory(customers, '0102')).toEqual([customers[1]]);
    expect(filterCustomerDirectory(customers, 'example.test')).toEqual(customers);
  });

  it('summarizes only active household pets', () => {
    expect(
      summarizeCustomerHousehold({
        display_name: 'Morgan household',
        pets: [
          { name: 'Milo', status: 'active' },
          { name: 'Scout', status: 'inactive' },
        ],
      }),
    ).toEqual({
      activePetCount: 1,
      displayName: 'Morgan household',
      petNames: ['Milo'],
    });
  });
});
