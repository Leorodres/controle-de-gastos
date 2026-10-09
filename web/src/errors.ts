import { ApiError } from './api'

const FIELD_LABEL: Record<string, string> = {
  occurredOn: 'Data',
  name: 'Nome',
  amount: 'Valor',
  description: 'Descrição',
  kind: 'Tipo',
  installments: 'Parcelas',
  'installments.total': 'Nº de parcelas',
  'installments.current': 'Parcela atual',
}

/** Transforma qualquer erro em uma lista de frases para mostrar ao usuário. */
export function describeError(err: unknown): string[] {
  if (err instanceof ApiError) {
    if (err.issues.length > 0) {
      return err.issues.map((i) => `${FIELD_LABEL[i.path] ?? i.path}: ${i.message}`)
    }
    return [err.message]
  }
  return [err instanceof Error ? err.message : 'Erro inesperado']
}
