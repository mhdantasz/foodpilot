'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, LoaderCircle, CheckCircle2 } from 'lucide-react';
import { acceptSellerInviteAction } from '@/app/vendedor/actions';
import type { SellerActionResult } from '@/lib/sellers/types';

const initialState: SellerActionResult = { ok: false, message: '' };

export function InviteAcceptCard() {
  const [code, setCode] = useState('');
  const router = useRouter();
  const [state, action, pending] = useActionState(async (_previous: SellerActionResult, form: FormData) => {
    try {
      const result = await acceptSellerInviteAction(form);
      if (result.ok) router.refresh();
      return result;
    } catch { return { ok: false, message: 'Não foi possível vincular agora. Confira a conexão e tente novamente.' }; }
  }, initialState);

  return (
    <section className="section-card" aria-labelledby="invite-title" style={{ maxWidth: 540, margin: '40px auto' }}>
      <div className="section-heading" style={{ marginBottom: 16 }}>
        <h2 id="invite-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <KeyRound size={22} color="var(--color-primary)" aria-hidden="true" />
          Vincular conta de vendedor
        </h2>
      </div>

      <p className="muted" style={{ marginBottom: 20 }}>
        Você precisa de um código de convite emitido pelo gerente do negócio para ativar seu painel de vendas.
      </p>

      {state.message && (
        <div
          role={state.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={`form-message ${state.ok ? 'success' : 'error'}`}
          style={{ marginBottom: 16 }}
        >
          {state.ok && <CheckCircle2 size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -3 }} />}
          {state.message}
        </div>
      )}

      {!state.ok && (
        <form action={action} className="commerce-form" aria-label="Aceitar convite de vendedor">
          <label>
            Código do convite
            <input
              type="text"
              name="code"
              value={code}
              onChange={e => setCode(e.target.value.trim())}
              placeholder="Cole o código de 64 caracteres"
              required
              minLength={64}
              maxLength={64}
              pattern="[a-f0-9]{64}"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
              autoFocus
              style={{ fontSize: 16 }}
            />
          </label>

          <button
            type="submit"
            className="action-button"
            disabled={pending || !code.trim()}
            aria-busy={pending}
            style={{ width: '100%', minHeight: 48, fontSize: 16 }}
          >
            {pending ? (
              <>
                <LoaderCircle className="loading-icon" size={18} />
                Vinculando conta…
              </>
            ) : (
              'Ativar acesso de vendedor'
            )}
          </button>
        </form>
      )}

      <p className="muted" style={{ fontSize: 14, marginTop: 20 }}>Se recebeu um link, abra o link completo enviado pelo gerente. Não compartilhe seu convite com outras pessoas.</p>
    </section>
  );
}
