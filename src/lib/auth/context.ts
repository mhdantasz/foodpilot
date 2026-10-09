import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// cache do React deduplica somente nesta renderização/requisição, nunca entre usuários.
export const getCurrentContext = cache(async () => {
  const client = await createClient();
  if (!client) return null;
  const { data: { user }, error } = await client.auth.getUser();
  if (error && (!error.status || error.status>=500 || error.name==='AuthRetryableFetchError')) throw new Error('Não foi possível conectar à sua conta. Verifique sua conexão e tente novamente.');
  if (error || !user) return null;
  const [profileResult, memberResult] = await Promise.all([
    client.from('profiles').select('*').eq('id', user.id).single(),
    client.from('business_members').select('*').eq('user_id', user.id).order('created_at').order('id').limit(1).maybeSingle(),
  ]);
  if (profileResult.error || memberResult.error) throw new Error('Não foi possível carregar sua conta. Verifique sua conexão e tente novamente.');
  const membership = memberResult.data;
  let business = null;
  if (membership) {
    const result = await client.from('businesses').select('*').eq('id', membership.business_id).single();
    if (result.error) throw new Error('Não foi possível carregar seu negócio. Tente novamente.');
    business = result.data;
  }
  return { user, profile: profileResult.data, membership, business };
});
export async function requireUser() {
  const context = await getCurrentContext();
  if (!context) redirect('/login');
  return context;
}
export async function requireBusiness() {
  const context = await requireUser();
  if (!context.business || !context.membership) redirect('/onboarding');
  return { ...context, business: context.business, membership: context.membership };
}
export async function redirectAuthenticated() {
  const context = await getCurrentContext();
  if (context) redirect(context.business ? '/' : '/onboarding');
}
