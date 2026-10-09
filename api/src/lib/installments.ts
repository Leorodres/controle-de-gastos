export function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Soma meses a uma data AAAA-MM-DD; se o dia não existir no mês de destino, usa o último dia. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return `${pad(year, 4)}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}

/**
 * Parcelas de `current` até `total`, uma por mês, a partir de `occurredOn` (que é a data da parcela `current`).
 * Cada data é calculada a partir da original, então 31/jan vira 28/fev e volta a 31/mar.
 */
export function expandInstallments(occurredOn: string, total: number, current = 1): { no: number; occurredOn: string }[] {
  const out: { no: number; occurredOn: string }[] = [];
  for (let no = current; no <= total; no++) out.push({ no, occurredOn: addMonths(occurredOn, no - current) });
  return out;
}
