import { formatMoney } from '../format'
import type { Suggestion } from '../types'

interface Props {
  value: string
  onChange: (value: string) => void
  suggestions: Suggestion[]
  onPick: (suggestion: Suggestion) => void
}

/** Campo de nome com a lista de nomes já usados logo abaixo. Um toque numa sugestão preenche o formulário. */
export function NameField({ value, onChange, suggestions, onPick }: Props) {
  return (
    <div className="field">
      <label>
        Nome
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          placeholder="Ex.: Uber, Pix Dany, Mercado"
        />
      </label>

      {suggestions.length > 0 && (
        <ul className="suggestions" aria-label="Nomes já usados">
          {suggestions.map((s) => (
            <li key={s.nameNormalized}>
              <button type="button" onClick={() => onPick(s)}>
                <strong>{s.name}</strong>
                <span className="muted">
                  {s.uses}× · {s.categories[0]?.name ?? 'sem categoria'} · {formatMoney(s.lastAmount)}
                  {s.match === 'similar' ? ' · parecido' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
