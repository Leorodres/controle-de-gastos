/**
 * Converte um valor digitado em texto com 2 casas ("116.66"), ou null se for inválido.
 * Aceita número (116.66) ou texto com ponto ou vírgula decimal ("116,66"). Não aceita
 * separador de milhar em texto ("1.234,56"): mande 1234,56 ou o número 1234.56.
 */
export function parseAmount(input: unknown): string | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0 || input >= 1e10) return null;
    const cents = Math.round(input * 100);
    if (Math.abs(input * 100 - cents) > 1e-6) return null; // mais de 2 casas decimais
    return (cents / 100).toFixed(2);
  }
  if (typeof input === 'string') {
    const m = /^\s*(\d{1,10})(?:[.,](\d{1,2}))?\s*$/.exec(input);
    if (!m) return null;
    const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
    return cents > 0 ? (cents / 100).toFixed(2) : null;
  }
  return null;
}
