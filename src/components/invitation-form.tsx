'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { acceptSellerInviteAction } from '@/app/vendedor/actions';
import type { SellerActionResult } from '@/lib/sellers/types';

export function InvitationForm({ code }: { code: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (_previous: SellerActionResult, data: FormData) => {
    try {
      const result = await acceptSellerInviteAction(data);
      if (result.ok) { router.replace('/vendedor'); router.refresh(); }
      return result;
    } catch { return { ok: false, message: 'Não foi possível aceitar agora. Confira a conexão e tente novamente.' }; }
  }, { ok: false, message: '' });
  return <form action={action} className="auth-form">
    <input type="hidden" name="code" value={code} />
    <p>Ao aceitar, esta conta será vinculada como vendedor à equipe que emitiu o convite. Confira com seu gerente se você recebeu o link correto.</p>
    <button className="action-button" type="submit" disabled={pending || state.ok} aria-busy={pending}>{pending ? 'Aceitando convite…' : 'Aceitar convite e começar'}</button>
    {state.message && <p className={`form-message ${state.ok ? 'success' : 'error'}`} role={state.ok ? 'status' : 'alert'}>{state.message}</p>}
  </form>;
}
