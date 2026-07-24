import { describe, expect, it } from 'vitest';

import { dollarsToMinor, percentToBasisPoints } from './pricing-values';

describe('pricing value conversion', () => {
  it.each([
    ['0', 0],
    ['25', 2500],
    ['25.5', 2550],
    ['25.50', 2550],
    ['1000.01', 100001],
  ])('converts %s dollars to %i minor units', (value, expected) => {
    expect(dollarsToMinor(value)).toBe(expected);
  });

  it.each([
    [0, 0],
    [6.5, 650],
    [25, 2500],
    [100, 10000],
  ])('converts %s percent to %i basis points', (value, expected) => {
    expect(percentToBasisPoints(value)).toBe(expected);
  });
});
