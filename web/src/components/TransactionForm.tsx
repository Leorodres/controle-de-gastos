import { useState, type FormEvent } from 'react'
import { createTransaction, deleteTransaction, updateTransaction } from '../api'
import { describeError } from '../errors'
import { KIND_LABEL, PAYMENT_LABEL, formatMoney, toInputAmount } from '../format'
import { afterSave, emptyForm, formFromTransaction, MAX_DESCRIPTION, toInput, toInstallments, validate } from '../formState'
import type { FormState } from '../formState'
import { useSuggestions } from '../hooks/useSuggestions'
import type { Category, PaymentMethod, Person, Suggestion, Transaction, TxKind } from '../types'
import { NameField } from './NameField'

/** Abaixo disso o nome já foi lançado em categorias demais: não pré-seleciona, deixa você escolher. */
export const CONFIDENCE_THRESHOLD = 0.7

interface Props {
  people: Person[]
  categories: Category[]
  /** Se vier, o formulário edita este lançamento; se não, cria um novo. */
  editing?: Transaction
  onSaved: (message: string) => void
  onDeleted?: () => void
  onCancel?: () => void
}

export function TransactionForm({ people, categories, editing, onSaved, onDeleted, onCancel }: Props) {
  // useState(() => ...) com função: o valor inicial é calculado só na primeira renderização.
  const [form, setForm] = useState<FormState>(() =>
    editing ? formFromTransaction(editing) : emptyForm(people.find((p) => p.isOwner)),
  )
  const [picked, setPicked] = useState<Suggestion | null>(null) // sugestão escolhida (guarda as categorias alternativas)
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // Busca sugestões enquanto digita, mas não na edição nem depois de escolher uma.
  const suggestions = useSuggestions(form.name, !editing && picked === null)

  // Atualiza um campo mantendo os outros. A forma funcional (f => ...) evita ler estado velho.
  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function changeName(value: string) {
    update('name', value)
    setPicked(null) // mexeu no nome: volta a sugerir
  }

  function applySuggestion(s: Suggestion) {
    const uncertain = s.confidence !== null && s.confidence < CONFIDENCE_THRESHOLD
    setPicked(s)
    setForm((f) => ({
      ...f,
      name: s.name,
      kind: s.fill.kind,
      paymentMethod: s.fill.paymentMethod ?? '',
      isFixed: s.fill.isFixed,
      personId: s.fill.personId === null ? '' : String(s.fill.personId),
      // categoria duvidosa fica em branco para você escolher entre as alternativas
      categoryId: !uncertain && s.fill.categoryId !== null ? String(s.fill.categoryId) : '',
      // só sugere o último valor se você ainda não digitou um
      amount: f.amount === '' ? toInputAmount(s.lastAmount) : f.amount,
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault() // sem isso o navegador recarregaria a página
    const problems = validate(form)
    if (problems.length > 0) {
      setErrors(problems)
      return
    }
    setErrors([])
    setSaving(true)
    try {
      const input = toInput(form)
      if (editing) {
        await updateTransaction(editing.id, input)
        onSaved(`Salvo: ${input.name}`)
      } else {
        const created = await createTransaction(input, toInstallments(form))
        onSaved(
          created.length > 1
            ? `Lançadas ${created.length} parcelas de ${input.name}`
            : `Lançado: ${input.name} ${formatMoney(created[0]?.amount ?? input.amount)}`,
        )
        setForm(afterSave(form))
        setPicked(null)
      }
    } catch (err) {
      setErrors(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(scope: 'this' | 'following') {
    if (!editing) return
    const question = scope === 'following' ? 'Apagar esta parcela e todas as seguintes?' : 'Apagar este lançamento?'
    if (!window.confirm(question)) return
    try {
      await deleteTransaction(editing.id, scope)
      onDeleted?.()
    } catch (err) {
      setErrors(describeError(err))
    }
  }

  const installmentsAllowed = !editing && form.kind === 'expense'
  const showAlternatives = picked !== null && picked.categories.length > 1
  const uncertain = picked !== null && picked.confidence !== null && picked.confidence < CONFIDENCE_THRESHOLD

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>{editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>

      <NameField value={form.name} onChange={changeName} suggestions={suggestions} onPick={applySuggestion} />

      <div className="row">
        <label className="field">
          Valor
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </label>
        <label className="field">
          Data
          <input type="date" value={form.occurredOn} onChange={(e) => update('occurredOn', e.target.value)} />
        </label>
      </div>

      <div className="row">
        <label className="field">
          Tipo
          <select value={form.kind} onChange={(e) => update('kind', e.target.value as TxKind)}>
            {(Object.keys(KIND_LABEL) as TxKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Pagamento
          <select value={form.paymentMethod} onChange={(e) => update('paymentMethod', e.target.value as PaymentMethod | '')}>
            <option value="">—</option>
            {(Object.keys(PAYMENT_LABEL) as PaymentMethod[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        Categoria
        <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {showAlternatives && (
        <div className={uncertain ? 'hint hint-warn' : 'hint'}>
          <p>
            {uncertain
              ? 'Esse nome já foi lançado em categorias diferentes. Escolha uma:'
              : 'Já lançado com esse nome em:'}
          </p>
          <div className="chips">
            {picked.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={String(c.id) === form.categoryId ? 'chip chip-on' : 'chip'}
                onClick={() => update('categoryId', String(c.id))}
              >
                {c.name} · {c.uses}×
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <label className="field">
          Pessoa
          <select value={form.personId} onChange={(e) => update('personId', e.target.value)}>
            <option value="">Sem pessoa</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.isFixed} onChange={(e) => update('isFixed', e.target.checked)} />
          Gasto fixo
        </label>
      </div>

      <label className="field">
        Descrição (opcional)
        <input
          type="text"
          maxLength={MAX_DESCRIPTION}
          placeholder="Ex.: pagamento da Leh"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
        <span className="counter">
          {form.description.length}/{MAX_DESCRIPTION}
        </span>
      </label>

      {installmentsAllowed && (
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={form.installmentsOn}
              onChange={(e) => update('installmentsOn', e.target.checked)}
            />
            Compra parcelada
          </label>
          {form.installmentsOn && (
            <>
              <div className="row">
                <label className="field">
                  Nº de parcelas
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.installmentsTotal}
                    onChange={(e) => update('installmentsTotal', e.target.value)}
                  />
                </label>
                <label className="field">
                  Parcela atual
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.installmentsCurrent}
                    onChange={(e) => update('installmentsCurrent', e.target.value)}
                  />
                </label>
              </div>
              <p className="muted small">
                O valor acima é o de <em>cada parcela</em>. Serão criadas as parcelas da atual até a última, uma por mês.
              </p>
            </>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <ul className="error-box" role="alert">
          {errors.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Salvando…' : editing ? 'Salvar' : 'Lançar'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>

      {editing && (
        <div className="actions danger-zone">
          <button type="button" className="btn btn-danger" onClick={() => handleDelete('this')}>
            Apagar
          </button>
          {editing.installment?.groupId && (
            <button type="button" className="btn btn-danger" onClick={() => handleDelete('following')}>
              Apagar esta e as seguintes
            </button>
          )}
        </div>
      )}
    </form>
  )
}
