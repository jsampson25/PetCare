export function dollarsToMinor(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function percentToBasisPoints(value: number) {
  return Math.round(value * 100);
}
