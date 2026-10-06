/** Integers only. Decimal input is parsed as text, never multiplied as a float. */
export const MAX_MONEY_CENTS = 1_000_000_000_000;
export function safeCents(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error('Valor monetário fora do limite permitido.');
  return value;
}
export function brlToCents(input: string): number {
  const text = input.trim().replace(/^R\$\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text)) throw new Error('Informe o valor em reais, por exemplo 12,50.');
  const [whole, fraction = ''] = text.replaceAll('.', '').split(',');
  const cents = safeCents(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
  if (cents > MAX_MONEY_CENTS) throw new Error('Valor monetário fora do limite permitido.');
  return cents;
}
export function centsToBRL(value: number): string {
  safeCents(value);
  const absolute = Math.abs(value);
  return `${value < 0 ? '-' : ''}${Math.trunc(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}
export function formatMoney(value: number): string {
  const text = centsToBRL(value);
  const [whole, fraction] = text.split(',');
  return `R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction}`;
}
export function sumCents(values: number[]): number { return values.reduce((sum, value) => safeCents(sum + safeCents(value)), 0); }
export function profitCents(revenue: number, cost: number): number { return safeCents(safeCents(revenue) - safeCents(cost)); }
