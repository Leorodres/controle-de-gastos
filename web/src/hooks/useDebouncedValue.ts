import { useEffect, useState } from 'react'

/**
 * Devolve `value` só depois que ele ficar parado por `delayMs`.
 * Serve para não chamar a API a cada tecla digitada.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    // Função de limpeza: o React a executa antes de rodar o efeito de novo (ou ao desmontar).
    // Se `value` mudar antes do tempo, o timer antigo é cancelado.
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
