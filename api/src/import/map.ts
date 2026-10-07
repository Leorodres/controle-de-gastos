import { normalizeName, parseInstallment } from '../lib/normalize.js';
import type { RawRow } from './parse.js';

export type TxKind = 'income' | 'expense' | 'reimbursement' | 'card_payment';
export type PaymentMethod = 'credit' | 'debit';

/** Lançamento pronto para inserir no banco. */
export interface TxInput {
  occurredOn: string;
  name: string;
  nameNormalized: string;
  rawName: string | null;
  amount: string; // "573.35"
  kind: TxKind;
  paymentMethod: PaymentMethod | null;
  isFixed: boolean;
  category: string | null;
  person: string | null;
  installmentNo: number | null;
  installmentTotal: number | null;
  sourceRef: string;
}

/** Observações sobre a linha que só interessam ao relatório (não vão para o banco). */
export interface RowFlags {
  nameIssue: RawRow['nameIssue'];
  fixedMissing: boolean;
  /** valor original menos valor gravado (frações de centavo arredondadas) */
  roundingDelta: number;
}

export interface MappedRow {
  sheetRow: number;
  tx: TxInput;
  flags: RowFlags;
}

export type MapResult = { ok: true; row: MappedRow } | { ok: false; sheetRow: number; reason: string };

/**
 * Regras da planilha para o modelo:
 *  - Saída                          -> expense
 *  - Entrada paga no Crédito        -> reimbursement (alguém te pagou gastos do cartão)
 *  - Entrada sem "Pago com"         -> income (salário, férias)
 *  - Pagamento de Crédito           -> card_payment
 */
export function mapRow(raw: RawRow): MapResult {
  const fail = (reason: string): MapResult => ({ ok: false, sheetRow: raw.sheetRow, reason });

  const tipo = normalizeName(raw.tipo);
  const pago = raw.pago ? normalizeName(raw.pago) : null;

  let paymentMethod: PaymentMethod | null = null;
  if (pago === 'credito') paymentMethod = 'credit';
  else if (pago === 'debito') paymentMethod = 'debit';
  else if (pago !== null) return fail(`"Pago com" desconhecido: ${raw.pago}`);

  let kind: TxKind;
  if (tipo === 'saida') kind = 'expense';
  else if (tipo === 'pagamento de credito') kind = 'card_payment';
  else if (tipo === 'entrada') kind = paymentMethod === 'credit' ? 'reimbursement' : 'income';
  else return fail(`tipo desconhecido: ${raw.tipo}`);

  const cents = Math.round(raw.valor * 100 + 1e-7); // arredonda meio centavo para cima
  if (cents <= 0) return fail(`valor não positivo: ${raw.valor}`);

  let fixedMissing = false;
  let isFixed = false;
  const fixo = raw.fixo ? normalizeName(raw.fixo) : null;
  if (fixo === 'sim') isFixed = true;
  else if (fixo === 'nao') isFixed = false;
  else fixedMissing = true;

  const rawName = raw.name;
  const parsed = parseInstallment(rawName ?? '(sem nome)');

  return {
    ok: true,
    row: {
      sheetRow: raw.sheetRow,
      tx: {
        occurredOn: raw.date,
        name: parsed.name,
        nameNormalized: normalizeName(parsed.name),
        rawName,
        amount: (cents / 100).toFixed(2),
        kind,
        paymentMethod,
        isFixed,
        category: raw.categoria,
        person: raw.pessoa,
        installmentNo: parsed.installmentNo,
        installmentTotal: parsed.installmentTotal,
        sourceRef: `Base!R${raw.sheetRow}`,
      },
      flags: { nameIssue: raw.nameIssue, fixedMissing, roundingDelta: raw.valor - cents / 100 },
    },
  };
}
