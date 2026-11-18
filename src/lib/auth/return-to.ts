// Only the seller invitation route may be carried through login/email confirmation.
// Never redirect to a client-supplied origin or an arbitrary application endpoint.
export function invitationReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 256) return null;
  try {
    const url = new URL(value, 'https://local.invalid');
    if (url.origin !== 'https://local.invalid' || url.pathname !== '/convite' || url.hash) return null;
    const code = url.searchParams.get('code');
    if (!code || !/^[a-zA-Z0-9_-]{20,128}$/.test(code)) return null;
    return `/convite?code=${encodeURIComponent(code)}`;
  } catch { return null; }
}

export function invitationPath(code: unknown): string | null {
  return typeof code === 'string' ? invitationReturnTo(`/convite?code=${encodeURIComponent(code)}`) : null;
}

export function confirmationReturnTo(recovery: boolean, pendingInvitation: unknown, fallback: '/' | '/onboarding'): string {
  return recovery ? '/redefinir-senha' : invitationReturnTo(pendingInvitation) || fallback;
}

export function authConfirmationUrl(appUrl: string): string {
  const url = new URL(appUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('APP_URL inválida');
  return `${url.origin}/auth/confirm`;
}
