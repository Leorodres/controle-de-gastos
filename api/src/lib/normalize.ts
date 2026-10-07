/** Minúsculo, sem acento, espaços colapsados. É a chave usada para casar nomes de gastos. */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedName {
  /** Nome sem o sufixo de parcela, só com espaços ajustados (mantém maiúsculas como digitado). */
  name: string;
  installmentNo: number | null;
  installmentTotal: number | null;
}

// Sufixo "N/M" no fim do nome: "Colchao 3/12", "Placa de video 1/10".
const INSTALLMENT_SUFFIX = /^(.*\S)\s+(\d{1,2})\s*\/\s*(\d{1,2})$/;

/**
 * Reconhece parcela no fim do nome. Só vale se 1 <= N <= M e M >= 2, o que descarta
 * datas como "Dany vai pagar 15/09" (15 > 9).
 */
export function parseInstallment(raw: string): ParsedName {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const m = INSTALLMENT_SUFFIX.exec(cleaned);
  if (m) {
    const base = m[1] as string;
    const no = Number(m[2]);
    const total = Number(m[3]);
    if (total >= 2 && no >= 1 && no <= total) {
      return { name: base, installmentNo: no, installmentTotal: total };
    }
  }
  return { name: cleaned, installmentNo: null, installmentTotal: null };
}
