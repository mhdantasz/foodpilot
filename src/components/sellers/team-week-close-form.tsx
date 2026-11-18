'use client';

import { useState, useTransition, useMemo } from 'react';
import { CalendarClock, LoaderCircle, X, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Seller, SellerActionResult } from '@/lib/sellers/types';
import { closeSellerWeekAction } from '@/app/(app)/equipe/actions';
import { useModalFocus } from '@/components/use-modal-focus';
import {
  getYesterdayISO,
  countInclusiveDays,
  getStartsOnFor7Days,
  getEndsOnFor7Days,
  formatDateISO,
  parseDateUTC,
  addDaysUTC,
} from './date-utils';

export function TeamWeekCloseModal({
  isOpen,
  onClose,
  sellers,
  initialSellerId,
  timezone = 'America/Manaus',
}: {
  isOpen: boolean;
  onClose: () => void;
  sellers: Seller[];
  initialSellerId?: string;
  timezone?: string;
}) {
  const yesterday = useMemo(() => getYesterdayISO(timezone), [timezone]);
  const defaultEndsOn = yesterday;
  const defaultStartsOn = useMemo(() => getStartsOnFor7Days(defaultEndsOn), [defaultEndsOn]);

  const [selectedSellerId, setSelectedSellerId] = useState(initialSellerId || (sellers[0]?.id ?? ''));
  const [endsOn, setEndsOn] = useState(defaultEndsOn);
  const [startsOn, setStartsOn] = useState(defaultStartsOn);
  const [requestId, setRequestId] = useState('');
  const [result, setResult] = useState<SellerActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const modal = useModalFocus(isOpen, onClose, !isPending);

  // Validação estrita: exatamente 7 dias completos, término até ontem
  const validation = useMemo(() => {
    if (!startsOn || !endsOn) {
      return { valid: false, message: 'Selecione as datas de início e término.' };
    }

    if (endsOn > yesterday) {
      return {
        valid: false,
        message: `A data de término não pode ser hoje nem futura. O fechamento exige término até ontem (${yesterday}).`,
      };
    }

    if (startsOn > endsOn) {
      return { valid: false, message: 'A data inicial não pode ser posterior à data final.' };
    }

    const days = countInclusiveDays(startsOn, endsOn);
    if (days !== 7) {
      return {
        valid: false,
        message: `O fechamento exige exatamente 7 dias completos (atualmente selecionados: ${days} ${days === 1 ? 'dia' : 'dias'}).`,
      };
    }

    return { valid: true, days };
  }, [startsOn, endsOn, yesterday]);

  const handleEndsOnChange = (val: string) => {
    setEndsOn(val);
    if (val) {
      // Ajusta automaticamente a data inicial para fechar exatamente 7 dias
      setStartsOn(getStartsOnFor7Days(val));
    }
  };

  const handleStartsOnChange = (val: string) => {
    setStartsOn(val);
    if (val) {
      // Ajusta automaticamente a data final para fechar exatamente 7 dias
      setEndsOn(getEndsOnFor7Days(val));
    }
  };

  const setPresetLast7DaysUntilYesterday = () => {
    const end = yesterday;
    const start = getStartsOnFor7Days(end);
    setEndsOn(end);
    setStartsOn(start);
  };

  const setPresetLastMondayToSunday = () => {
    // Acha o último domingo anterior ou igual a ontem
    const yDate = parseDateUTC(yesterday);
    const dayOfWeek = yDate.getUTCDay(); // 0 = Domingo, 1 = Segunda, etc.
    const diffToSunday = dayOfWeek === 0 ? 0 : dayOfWeek; // dias para voltar ao domingo
    const lastSunday = addDaysUTC(yDate, -diffToSunday);
    const lastMonday = addDaysUTC(lastSunday, -6);

    const endStr = formatDateISO(lastSunday);
    const startStr = formatDateISO(lastMonday);
    setEndsOn(endStr);
    setStartsOn(startStr);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid || isPending) return;

    startTransition(async () => {
      try {
        const stableId = requestId || crypto.randomUUID();
        if (!requestId) setRequestId(stableId);
        const formData = new FormData();
        formData.set('seller_id', selectedSellerId);
        formData.set('starts_on', startsOn);
        formData.set('ends_on', endsOn);
        formData.set('request_id', stableId);

        const res = await closeSellerWeekAction(formData);
        setResult(res);

      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : 'Falha ao fechar semana.',
        });
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="seller-modal-backdrop"
      onClick={() => { if (!isPending) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-week-title"
    >
      <div ref={modal} tabIndex={-1} className="seller-modal-card" onClick={e => e.stopPropagation()}>
        <div className="seller-modal-header">
          <h3 id="close-week-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarClock size={20} color="var(--color-primary)" aria-hidden="true" />
            Fechar Semana de Comissões
          </h3>
          <button type="button" className="icon-button" onClick={onClose} disabled={isPending} aria-label="Fechar janela">
            <X size={20} />
          </button>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          O fechamento consolida as vendas ativas do período semanal de <strong>exatamente 7 dias completos</strong> e preserva os valores de comissão para histórico. O término deve ser <strong>até ontem</strong> (sem datas futuras).
        </p>

        {result && (
          <div
            role={result.ok ? 'status' : 'alert'}
            aria-live="polite"
            className={`form-message ${result.ok ? 'success' : 'error'}`}
          >
            {result.ok && <CheckCircle2 size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />}
            {result.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="commerce-form" aria-label="Fechar semana de comissões">
          <input type="hidden" name="request_id" value={requestId} />

          <fieldset disabled={isPending || result?.ok} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 14 }}>
            <label>
              Vendedor
              <select
                name="seller_id"
                value={selectedSellerId}
                onChange={e => setSelectedSellerId(e.target.value)}
                required
              >
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.location})
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="date-preset-btn"
                onClick={setPresetLast7DaysUntilYesterday}
              >
                7 dias até ontem ({yesterday})
              </button>
              <button
                type="button"
                className="date-preset-btn"
                onClick={setPresetLastMondayToSunday}
              >
                Última Seg a Dom
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label>
                Data inicial (inclusiva)
                <input
                  type="date"
                  name="starts_on"
                  value={startsOn}
                  onChange={e => handleStartsOnChange(e.target.value)}
                  max={yesterday}
                  required
                />
              </label>

              <label>
                Data término (até ontem)
                <input
                  type="date"
                  name="ends_on"
                  value={endsOn}
                  onChange={e => handleEndsOnChange(e.target.value)}
                  max={yesterday}
                  required
                />
              </label>
            </div>

            {/* Alerta de validação */}
            {!validation.valid ? (
              <div className="form-message error" style={{ margin: 0 }}>
                <AlertCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }} />
                {validation.message}
              </div>
            ) : (
              <div className="form-message success" style={{ margin: 0, fontSize: 13 }}>
                ✓ Período válido: <strong>7 dias completos</strong> ({startsOn} a {endsOn}).
              </div>
            )}

            <div className="seller-machine-notice">
              Informação importante: O fechamento semanal cria o registro permanente da comissão devida ao vendedor. O posterior registro de pagamento é apenas um controle interno no sistema e <strong>NÃO realiza transferência bancária nem Pix</strong>.
            </div>

            <div className="commerce-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                className="action-button secondary"
                onClick={onClose}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="action-button"
                disabled={isPending || !validation.valid}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="loading-icon" size={16} />
                    Fechando semana…
                  </>
                ) : (
                  'Confirmar Fechamento'
                )}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
