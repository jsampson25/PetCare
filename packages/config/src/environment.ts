import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
});

const serverEnvironmentSchema = publicEnvironmentSchema.extend({
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parsePublicEnvironment(environment: Record<string, string | undefined>) {
  return publicEnvironmentSchema.parse(environment);
}

export function parseServerEnvironment(environment: Record<string, string | undefined>) {
  return serverEnvironmentSchema.parse(environment);
}
