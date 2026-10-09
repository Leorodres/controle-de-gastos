import { useEffect, useState } from 'react'
import { suggest } from '../api'
import type { Suggestion } from '../types'
import { useDebouncedValue } from './useDebouncedValue'

const MIN_CHARS = 2

/**
 * Sugestões de nomes já usados para o que está sendo digitado.
 * `enabled = false` desliga a busca (ex.: depois que o usuário escolheu uma sugestão).
 */
export function useSuggestions(text: string, enabled: boolean): Suggestion[] {
  const query = useDebouncedValue(text.trim(), 250)
  const [result, setResult] = useState<{ query: string; items: Suggestion[] }>({ query: '', items: [] })

  useEffect(() => {
    if (!enabled || query.length < MIN_CHARS) return

    // AbortController cancela a requisição anterior se o usuário continuar digitando,
    // evitando que uma resposta lenta e antiga sobrescreva a resposta mais nova.
    const controller = new AbortController()
    suggest(query, controller.signal)
      .then((items) => setResult({ query, items }))
      .catch(() => {
        /* cancelada ou sem rede: sem sugestões, o formulário continua funcionando */
      })
    return () => controller.abort()
  }, [query, enabled])

  // Só mostra o resultado se ele for da busca atual (evita piscar sugestões velhas).
  return enabled && query.length >= MIN_CHARS && result.query === query ? result.items : []
}
