'use client';

import { useActionState, useState } from 'react';
import { UserPlus, LoaderCircle, X, CheckCircle2 } from 'lucide-react';
import { createSellerAction } from '@/app/(app)/equipe/actions';
import type { SellerActionResult } from '@/lib/sellers/types';
import { useModalFocus } from '@/components/use-modal-focus';

const initialState: SellerActionResult = { ok: false, message: '' };

export function TeamSellerCreateModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [state, action, pending] = useActionState(async (_prev: SellerActionResult, data: FormData) => {
    try {
    const res = await createSellerAction(data);
    if (res.ok) {
      setName('');
      setLocation('');
    }
    return res;
    } catch { return { ok: false, message: 'Não foi possível confirmar o cadastro. Confira a lista antes de tentar novamente.' }; }
  }, initialState);
  const modal = useModalFocus(isOpen, onClose, !pending);

  if (!isOpen) return null;

  return (
    <div
      className="seller-modal-backdrop"
      onClick={() => { if (!pending) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-seller-title"
    >
      <div ref={modal} tabIndex={-1} className="seller-modal-card" onClick={e => e.stopPropagation()}>
        <div className="seller-modal-header">
          <h3 id="new-seller-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={20} color="var(--color-primary)" aria-hidden="true" />
            Cadastrar Novo Vendedor
          </h3>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fechar janela"
          >
            <X size={20} />
          </button>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          Cadastre o nome e o ponto/local de atuação do vendedor. Após cadastrar, você poderá gerar um convite para vincular a conta dele.
        </p>

        {state.message && (
          <div
            role={state.ok ? 'status' : 'alert'}
            aria-live="polite"
            className={`form-message ${state.ok ? 'success' : 'error'}`}
          >
            {state.ok && <CheckCircle2 size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />}
            {state.message}
          </div>
        )}

        <form action={action} className="commerce-form" aria-label="Cadastrar vendedor">
          <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
            <label>
              Nome do vendedor
              <input
                type="text"
                name="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Tyrone Silva"
                required
                minLength={2}
                maxLength={100}
                autoFocus
              />
            </label>

            <label>
              Local de atuação / Ponto de venda
              <input
                type="text"
                name="location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Ex: Praça Central / Quiosque 2"
                required
                minLength={2}
                maxLength={100}
              />
            </label>

            <div className="commerce-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="action-button secondary"
                onClick={onClose}
                disabled={pending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="action-button"
                disabled={pending || !name.trim() || !location.trim()}
                aria-busy={pending}
              >
                {pending ? (
                  <>
                    <LoaderCircle className="loading-icon" size={16} />
                    Cadastrando…
                  </>
                ) : (
                  'Salvar Vendedor'
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
