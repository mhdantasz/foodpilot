/** Calendar-only arithmetic always uses UTC; business day selection uses an explicit timezone. */
export function formatDateISO(date: Date): string { return date.toISOString().slice(0, 10); }
export function parseDateUTC(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
export function addDaysUTC(date: Date, days: number): Date { const next = new Date(date); next.setUTCDate(next.getUTCDate() + days); return next; }
export function addDaysISO(value: string, days: number): string { return formatDateISO(addDaysUTC(parseDateUTC(value), days)); }
export function getTodayISO(timezone = 'America/Manaus', now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function getYesterdayISO(timezone = 'America/Manaus'): string { return addDaysISO(getTodayISO(timezone), -1); }
export function countInclusiveDays(startsOn: string, endsOn: string): number {
  if (!startsOn || !endsOn) return 0;
  const start = parseDateUTC(startsOn).getTime(), end = parseDateUTC(endsOn).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 86400000) + 1 : 0;
}
export function getStartsOnFor7Days(endsOn: string): string { return addDaysISO(endsOn, -6); }
export function getEndsOnFor7Days(startsOn: string): string { return addDaysISO(startsOn, 6); }
