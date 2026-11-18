import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { confirmationReturnTo } from '@/lib/auth/return-to';
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const code = params.get('code');
  const pendingInvitation = request.cookies.get('pending_seller_invitation')?.value;
  const client = await createClient();
  let destination = '/login?erro=link';
  if (client && tokenHash && (type === 'signup' || type === 'recovery')) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) destination = confirmationReturnTo(type === 'recovery', pendingInvitation, '/onboarding');
  } else if (client && code) {
    const flowId = params.get('sb_flow_id');
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    // O tipo vem do verifier PKCE do SDK, não de um destino fornecido na URL.
    if (!error) destination = confirmationReturnTo('redirectType' in data && data.redirectType === 'recovery', pendingInvitation, '/');
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  if (destination !== '/login?erro=link') response.cookies.delete('pending_seller_invitation');
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
