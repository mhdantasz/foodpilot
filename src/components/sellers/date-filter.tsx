'use client';

import { useRouter } from 'next/navigation';
import { Calendar, Filter } from 'lucide-react';
import { addDaysISO, getTodayISO } from './date-utils';

export function DateFilter({
  from,
  to,
  calendarDays,
  timezone = 'America/Manaus',
}: {
  from?: string;
  to?: string;
  calendarDays?: number;
  timezone?: string;
}) {
  const router = useRouter();

  const handlePreset = (daysBack: number) => {
    const toStr = getTodayISO(timezone);
    const fromStr = addDaysISO(toStr, -(daysBack - 1));

    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    params.set('from', fromStr);
    params.set('to', toStr);
    router.push(`?${params.toString()}`);
  };

  const handleMonth = () => {
    const toStr = getTodayISO(timezone);
    const fromStr = `${toStr.slice(0, 7)}-01`;

    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(currentSearch);
    params.set('from', fromStr);
    params.set('to', toStr);
    router.push(`?${params.toString()}`);
  };

  return (
    <section aria-label="Filtro de período" className="date-filter-bar">
      <form method="GET" className="date-filter-inputs">
        <label>
          Data inicial
          <input
            type="date"
            name="from"
            defaultValue={from ?? ''}
            required
            aria-label="Data inicial do período"
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            name="to"
            defaultValue={to ?? ''}
            required
            aria-label="Data final do período"
          />
        </label>
        <button type="submit" className="action-button secondary" aria-label="Aplicar filtro de datas">
          <Filter size={16} aria-hidden="true" />
          Filtrar
        </button>
      </form>

      <div className="date-filter-presets" role="group" aria-label="Períodos rápidos">
        <button
          type="button"
          onClick={() => handlePreset(7)}
          className="date-preset-btn"
        >
          Últimos 7 dias
        </button>
        <button
          type="button"
          onClick={() => handlePreset(30)}
          className="date-preset-btn"
        >
          Últimos 30 dias
        </button>
        <button
          type="button"
          onClick={handleMonth}
          className="date-preset-btn"
        >
          Este mês
        </button>
      </div>

      {calendarDays !== undefined && (
        <span className="date-filter-caption">
          <Calendar size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />
          {calendarDays} {calendarDays === 1 ? 'dia' : 'dias'} de calendário
          {timezone ? ` (${timezone})` : ''}
        </span>
      )}
    </section>
  );
}
