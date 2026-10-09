import ExcelJS from 'exceljs';
import { normalizeName } from '../lib/normalize.js';

/** Linha da aba Base, já lida da planilha mas ainda sem interpretação. */
export interface RawRow {
  sheetRow: number;
  date: string; // YYYY-MM-DD
  tipo: string;
  name: string | null;
  nameIssue: 'missing' | 'error' | 'numeric' | null;
  pago: string | null;
  fixo: string | null;
  categoria: string | null;
  pessoa: string | null;
  descricao: string | null;
  valor: number;
}

export interface SkippedRow {
  sheetRow: number;
  reason: string;
}

/** Totais que a própria planilha calculou (valores em cache), usados para conferir a importação. */
export interface DashReference {
  year: number;
  yearTotals: { entradas: number; saidas: number } | null;
  months: { month: number; entradas: number; saidas: number }[];
  credit: {
    year: number;
    month: number;
    rows: { label: string; pagamentos: number; gastos: number }[];
  } | null;
}

export interface WorkbookData {
  rows: RawRow[];
  skipped: SkippedRow[];
  blankRows: number;
  dash: DashReference | null;
}

type ErrorValue = { error: string };

function isError(v: unknown): v is ErrorValue {
  return typeof v === 'object' && v !== null && 'error' in v;
}

/** Valor "puro" da célula: resultado em cache se for fórmula, texto se for rich text. */
function unwrap(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return (v as { result?: unknown }).result ?? null;
    if ('error' in v) return v;
    if ('richText' in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join('');
    if ('text' in v) return (v as { text: string }).text;
  }
  return v;
}

function asText(v: unknown): string | null {
  if (v === null || v === undefined || v instanceof Date || isError(v)) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim())) return Number(v.trim().replace(',', '.'));
  return null;
}

function asDate(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // número serial do Excel (base 1899-12-30)
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
    if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  }
  return null;
}

const HEADERS = {
  date: 'data',
  tipo: 'entrada ou saida',
  name: 'nome evento',
  pago: 'pago com',
  fixo: 'fixo?',
  categoria: 'categoria gasto',
  pessoa: 'pessoa',
  valor: 'valor',
} as const;

function readBase(ws: ExcelJS.Worksheet): Pick<WorkbookData, 'rows' | 'skipped' | 'blankRows'> {
  const cols = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const t = asText(unwrap(cell.value));
    if (t) cols.set(normalizeName(t), col);
  });
  const col = (key: keyof typeof HEADERS): number => {
    const c = cols.get(HEADERS[key]);
    if (!c) throw new Error(`Aba Base: coluna "${HEADERS[key]}" não encontrada na linha 1`);
    return c;
  };
  // coluna opcional: planilhas antigas não têm "Descrição"
  const descricaoCol = cols.get('descricao') ?? null;
  const c = Object.fromEntries((Object.keys(HEADERS) as (keyof typeof HEADERS)[]).map((k) => [k, col(k)])) as Record<
    keyof typeof HEADERS,
    number
  >;

  const rows: RawRow[] = [];
  const skipped: SkippedRow[] = [];
  let blankRows = 0;

  for (let n = 2; n <= ws.rowCount; n++) {
    const row = ws.getRow(n);
    const dateV = unwrap(row.getCell(c.date).value);
    const tipo = asText(unwrap(row.getCell(c.tipo).value));
    const valorV = unwrap(row.getCell(c.valor).value);

    if (asText(dateV) === null && !(dateV instanceof Date) && tipo === null && asText(valorV) === null) {
      blankRows++; // linhas só com fórmulas (Mês/Ano) e sem dados
      continue;
    }

    const date = asDate(dateV);
    const valor = asNumber(valorV);
    if (!date) {
      skipped.push({ sheetRow: n, reason: 'data ausente ou inválida' });
      continue;
    }
    if (!tipo) {
      skipped.push({ sheetRow: n, reason: 'tipo (Entrada ou Saída) ausente' });
      continue;
    }
    if (valor === null) {
      skipped.push({ sheetRow: n, reason: 'valor ausente ou inválido' });
      continue;
    }

    const nameV = unwrap(row.getCell(c.name).value);
    let name = asText(nameV);
    let nameIssue: RawRow['nameIssue'] = null;
    if (isError(nameV)) nameIssue = 'error';
    else if (name === null) nameIssue = 'missing';
    else if (/^-?\d+([.,]\d+)?$/.test(name)) nameIssue = 'numeric';
    if (isError(nameV)) name = null;

    rows.push({
      sheetRow: n,
      date,
      tipo,
      name,
      nameIssue,
      pago: asText(unwrap(row.getCell(c.pago).value)),
      fixo: asText(unwrap(row.getCell(c.fixo).value)),
      categoria: asText(unwrap(row.getCell(c.categoria).value)),
      pessoa: asText(unwrap(row.getCell(c.pessoa).value)),
      descricao: descricaoCol ? asText(unwrap(row.getCell(descricaoCol).value)) : null,
      valor,
    });
  }
  return { rows, skipped, blankRows };
}

/**
 * Número de uma célula do Dash. O exceljs omite o resultado em cache quando ele é 0
 * (a fórmula chega sem `result`), então fórmula sem resultado é lida como 0. Se a planilha
 * nunca tivesse sido calculada isso apareceria como divergência na conferência, não passaria batido.
 */
function num(ws: ExcelJS.Worksheet, addr: string): number | null {
  const v = ws.getCell(addr).value;
  if (typeof v === 'object' && v !== null && !(v instanceof Date) && ('formula' in v || 'sharedFormula' in v) && !('result' in v)) {
    return 0;
  }
  return asNumber(unwrap(v));
}

/** Lê os totais em cache das abas Dash e Dash Mês. Melhor esforço: se o layout mudou, devolve null. */
function readDash(wb: ExcelJS.Workbook): DashReference | null {
  const ws = wb.getWorksheet('Dash');
  if (!ws) return null;
  const year = num(ws, 'B5');
  if (year === null) return null;

  const e = num(ws, 'F5');
  const s = num(ws, 'J5');
  const months: DashReference['months'] = [];
  for (let r = 10; r <= 21; r++) {
    const month = num(ws, `B${r}`);
    const entradas = num(ws, `C${r}`);
    const saidas = num(ws, `D${r}`);
    if (month !== null && entradas !== null && saidas !== null) months.push({ month, entradas, saidas });
  }

  let credit: DashReference['credit'] = null;
  const wm = wb.getWorksheet('Dash Mês');
  if (wm) {
    const cy = num(wm, 'B5');
    const cm = num(wm, 'F5');
    if (cy !== null && cm !== null) {
      const rows: { label: string; pagamentos: number; gastos: number }[] = [];
      for (let r = 10; r <= 20; r++) {
        const label = asText(unwrap(wm.getCell(`B${r}`).value));
        const pagamentos = num(wm, `C${r}`);
        const gastos = num(wm, `D${r}`);
        if (!label || normalizeName(label) === 'total') break;
        if (pagamentos !== null && gastos !== null) rows.push({ label, pagamentos, gastos });
      }
      credit = { year: cy, month: cm, rows };
    }
  }

  return { year, yearTotals: e !== null && s !== null ? { entradas: e, saidas: s } : null, months, credit };
}

export async function readWorkbook(file: string): Promise<WorkbookData> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const base = wb.getWorksheet('Base');
  if (!base) throw new Error('Aba "Base" não encontrada na planilha');
  return { ...readBase(base), dash: readDash(wb) };
}
