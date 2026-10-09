# React para quem vem do back-end

Este guia liga cada conceito ao arquivo onde ele aparece neste projeto. Leia o conceito, abra o arquivo, mude algo e veja a tela (ou os testes) reagirem.

## Rodando

```bash
docker compose up -d db api      # banco + API (na raiz do repositório)
cd web
npm install
npm run dev                      # http://localhost:5173 (recarrega ao salvar)
npm test                         # testes; npm run test:watch fica rodando enquanto você edita
npx oxlint                       # avisos de boas práticas de React
```

O Vite encaminha `/api/...` para a API em `localhost:3000` (ver `vite.config.ts`).

## A ideia central

**A tela é uma função do estado.** Você não manda "mude este elemento"; você muda um dado, e o React redesenha o que for preciso. Em vez de `document.getElementById(...).innerText = x`, você escreve `setX(x)`.

| Conceito | O que é, em termos de back-end | Onde ver |
| --- | --- | --- |
| **Componente** | uma função que devolve a "view" (JSX, um HTML dentro do TypeScript) | `components/TransactionItem.tsx` é o mais simples |
| **Props** | os parâmetros da função; só leitura; vão do pai para o filho | `TransactionItem` recebe `tx` e `onEdit` |
| **Callback via props** | o filho "avisa" o pai chamando uma função que o pai passou | `onSaved`, `onEdit`, `onCancel` |
| **State** (`useState`) | a memória do componente; mudou, o React redesenha | `TransactionForm.tsx` (`form`, `errors`, `saving`) |
| **Render puro** | mesma entrada, mesma saída; nada de chamar API durante o desenho | todos os componentes |
| **Effect** (`useEffect`) | código que sincroniza com o mundo de fora (API, timers) | `App.tsx` (carregar dados, sumir o aviso) |
| **Cleanup** do effect | desfazer o que o effect fez antes de rodar de novo | `hooks/useDebouncedValue.ts`, `hooks/useSuggestions.ts` |
| **Custom hook** | uma função `useAlgo` que empacota estado + effects para reaproveitar (parecido com um service) | `hooks/` |
| **`key`** | a identidade de um item; mudou a key, o React cria o componente do zero | `App.tsx` (`key={editing.id}`) |
| **Formulário controlado** | o `<input>` mostra o state (`value`) e atualiza o state (`onChange`) | `TransactionForm.tsx` |
| **Valor derivado** | o que dá para calcular a partir do state não precisa de outro state | `loading` em `hooks/useTransactions.ts`, `uncertain` em `TransactionForm.tsx` |

## Regras que evitam a maioria dos bugs

1. **Nunca altere o state diretamente.** `setForm({ ...form, name })` cria um objeto novo; `form.name = x` não faz o React notar nada. Com arrays, use `[...items, novo]` e `.filter`/`.map`, não `push`.
2. **Use a forma funcional quando o novo valor depende do antigo:** `setForm(f => ({ ...f, [key]: value }))` (ver `update` em `TransactionForm.tsx`).
3. **Todo valor de fora usado dentro de um effect vai no array de dependências.** O lint (`oxlint`) avisa quando falta.
4. **Respostas de rede podem chegar fora de ordem.** Por isso `useSuggestions` cancela a requisição velha (`AbortController`) e `useTransactions` ignora respostas de pedidos antigos (`cancelled`). É o equivalente a descartar uma resposta obsoleta no servidor.
5. **Não guarde em state o que dá para calcular.** Dois states que precisam andar juntos viram bug.

## Fluxo de dados deste app

```
App.tsx   (guarda: pessoas, categorias, aba, lançamento em edição, aviso)
 ├─ TransactionForm   (guarda: o formulário)  ── usa useSuggestions ──> api.suggest
 │    └─ NameField    (só mostra: recebe valor e sugestões por props)
 └─ TransactionList   (guarda: filtros)       ── usa useTransactions ─> api.listTransactions
      └─ TransactionItem
```

`api.ts` é o único arquivo que conhece URLs e JSON. `formState.ts` tem a lógica do formulário sem React (por isso é fácil de testar).

## Como os testes funcionam

Os testes (`*.spec.ts(x)`) usam o Testing Library: eles procuram elementos como o usuário os veria (por rótulo, texto, papel) e clicam e digitam de verdade, com a API simulada (`vi.mock`). Se você quebrar um comportamento, o teste que descreve esse comportamento falha com uma mensagem legível.

## Exercícios (do mais fácil ao mais difícil)

1. **Sinta o teste te proteger.** Em `TransactionForm.tsx`, mude `CONFIDENCE_THRESHOLD` de `0.7` para `0.95` e rode `npm test`. Qual teste falha e por quê? Desfaça.
2. **Mostre o total.** Na aba "Lançamentos", escreva "N lançamentos" no título usando o `total` que `useTransactions` já devolve.
3. **Nova categoria.** Adicione um botão "+ nova categoria" ao lado do seletor. O back-end já tem `POST /categories` (veja `api/requests.http`); crie `createCategory` em `api.ts` e chame `reload` no `App` depois.
4. **Filtro por tipo.** A API aceita `kind` em `GET /transactions`. Acrescente um `<select>` na lista, passe o valor por `listTransactions` e escreva um teste.
5. **Filtro por mês.** A API aceita `from` e `to`. Um `<input type="month">` e uma pequena função que converte "2026-10" em `from=2026-10-01` e `to=2026-10-31`.

Dica para qualquer exercício: escreva (ou ajuste) o teste primeiro, veja falhar, depois faça passar.
