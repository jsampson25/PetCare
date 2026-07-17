export type TestBusiness = {
  id: string;
  name: string;
  slug: string;
};

export function createTestBusiness(overrides: Partial<TestBusiness> = {}): TestBusiness {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Happy Paws Test Resort',
    slug: 'happy-paws-test',
    ...overrides,
  };
}
