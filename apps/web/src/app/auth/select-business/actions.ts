'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { businessContextCookie, listBusinessContexts } from '../../../lib/auth/tenant-context';

export async function selectBusiness(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get('businessId'));
  if (!parsed.success) redirect('/auth/select-business?error=Choose+a+valid+business.');

  const available = await listBusinessContexts();
  if (!available.some((context) => context.businessId === parsed.data)) {
    redirect('/denied');
  }

  const cookieStore = await cookies();
  cookieStore.set(businessContextCookie, parsed.data, {
    httpOnly: true,
    maxAge: 60 * 60 * 12,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  redirect('/app');
}
