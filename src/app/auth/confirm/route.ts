import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  const code = params.get('code');
  const client = await createClient();
  let destination = '/login?erro=link';
  if (client && tokenHash && (type === 'signup' || type === 'recovery')) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) destination = type === 'recovery' ? '/redefinir-senha' : '/onboarding';
  } else if (client && code) {
    const flowId = params.get('sb_flow_id');
    const { data, error } = await client.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    // O tipo vem do verifier PKCE do SDK, não de um destino fornecido na URL.
    if (!error) destination = 'redirectType' in data && data.redirectType === 'recovery' ? '/redefinir-senha' : '/';
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
