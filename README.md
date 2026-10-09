# Controle-de-gastos — controle de gastos doméstico

Etapas feitas: **1** banco de dados + importação da planilha `Gastos.xlsx`; **2** API de cadastro com autopreenchimento, em **NestJS 12**; **3** front-end em React + Vite (formulário rápido e lista, instalável como app).
Próximas: dashboards, acerto entre pessoas, deploy com login, importação da fatura do Nubank.

## Subindo

```bash
cp .env.example .env              # defina POSTGRES_PASSWORD
cp /caminho/Gastos.xlsx data/     # a pasta data/ não é versionada

docker compose up -d db
docker compose run --rm api npm run migrate
docker compose run --rm api npm run import -- /data/Gastos.xlsx
```

O resumo aparece no terminal e o relatório completo em `reports/import-report.md`.
Para refazer a importação (por exemplo, depois de corrigir a planilha), acrescente `--replace`:
isso apaga só o que veio da planilha (`source = 'xlsx'`); o que for cadastrado manualmente no futuro não é tocado.

Opções do import: `--owner Leonardo` (quem é "eu" na coluna Pessoa), `--report <caminho>`.

## Front-end (etapa 3)

```bash
docker compose up -d --build     # db + api + web
```

Abra **http://localhost:8080**. Duas telas:

- **Novo**: formulário de lançamento. Ao digitar o nome aparecem os nomes já usados; um toque preenche tipo, pagamento,
  categoria, pessoa e o último valor. Se o nome já foi lançado em categorias diferentes, a categoria fica em branco e o
  formulário mostra as opções para você escolher. Aceita descrição e compra parcelada.
- **Lançamentos**: lista com busca por nome e filtro "só gastos sem categoria" (bom para arrumar o que faltou). A descrição aparece
  em uma linha, cortada com "…" se for longa. Tocar num item abre a edição, onde também dá para apagar (ou apagar a parcela e as seguintes).

**Para desenvolver o front** (recarrega ao salvar), em vez do container `web`:

```bash
docker compose up -d db api
cd web && npm install && npm run dev      # http://localhost:5173
npm test                                  # testes (Vitest + Testing Library)
```

Se você é novo em React, comece por `web/APRENDER.md`.

**Instalar no celular (PWA).** O app já tem manifesto e service worker, mas o navegador só oferece "instalar" em **HTTPS**
(ou em `localhost`). Por isso isso só vai funcionar de verdade no deploy, com domínio e certificado. Hoje o app só abre
com a API no ar: lançar sem internet não é suportado, e só a "casca" (HTML, JS, CSS) fica em cache, nunca os dados.
Para testar o layout no celular antes do deploy, defina `WEB_BIND=0.0.0.0` no `.env` e abra `http://IP-DO-PC:8080` na mesma rede Wi-Fi
(não faça isso numa rede pública: ainda não há login).

## API (etapa 2)

```bash
docker compose up -d --build     # sobe db + api; a api aplica as migrations pendentes ao iniciar
```

A API responde em `http://localhost:3000` (mude com `API_PORT` no `.env`). **Não tem login:** só escuta em `127.0.0.1`.
A proteção entra junto com o deploy. Exemplos prontos em `api/requests.http`.

| Método e rota | Para quê |
| --- | --- |
| `GET /suggestions?q=ube` | nomes já usados que casam com o que foi digitado (igual, começa com, contém, parecido) e, para cada um, o que preencher |
| `POST /transactions` | cadastra um lançamento; com `installments` cria todas as parcelas |
| `GET /transactions` | lista com filtros: `from`, `to`, `kind`, `categoryId`, `personId`, `q`, `uncategorized=true`, `limit`, `offset` |
| `GET/PATCH /transactions/:id` | lê / corrige |
| `DELETE /transactions/:id` | apaga; `?scope=following` apaga esta parcela e as seguintes |
| `GET/POST /people`, `GET/POST /categories` | cadastros de apoio (categorias vêm das mais usadas para as menos usadas) |
| `GET /health` | saúde (usada pelo healthcheck do compose) |

**Sugestões.** Cada item traz `match` (`exact`, `prefix`, `contains`, `similar`), `uses`, a última data e o último valor,
`fill` (tipo, forma de pagamento, fixo, categoria e pessoa mais frequentes; empate vai para o mais recente),
`categories` (todas as categorias já usadas com esse nome, com contagem) e `confidence` (fatia da categoria mais usada).
Acento e maiúscula não importam, e "Colchão 4/12" busca por "colchao". É uma **sugestão**: o formulário deve
pré-preencher e deixar trocar, principalmente quando `confidence` é baixa.

**Descrição.** Campo opcional e curto (até 200 caracteres) para a ação ou quem pagou, por exemplo nome `Spotify` e
descrição `pagamento da Leh`. Vem em todas as respostas; o formulário deve mostrá-la cortada com "..." quando for longa.
Texto vazio vira `null`. Na planilha, a importação lê uma coluna opcional chamada `Descrição`.

**Valores.** `amount` aceita número (`24.10`) ou texto com vírgula (`"24,10"`), maior que zero e com no máximo 2 casas.
Datas em `AAAA-MM-DD`. Campos desconhecidos são recusados (evita gravar `valor` quando o campo é `amount`).

**Parcelas.** `"installments": { "total": 12, "current": 4 }` cria as parcelas 4 a 12, uma por mês a partir de `occurredOn`
(dia 31 vira o último dia de meses mais curtos), todas ligadas por um grupo. Sem `installments`, um nome terminando em
`3/12` vira só aquela parcela, como na planilha.

Exemplo no PowerShell (o `GetBytes` evita problema de acento no PowerShell 5):

```powershell
$body = @{ occurredOn="2026-10-08"; name="Uber"; amount=24.10; kind="expense"; paymentMethod="credit"; categoryId=1; personId=1 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:3000/transactions -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
Invoke-RestMethod "http://localhost:3000/suggestions?q=ube"
```

### Sem Docker para os scripts

```bash
cd api && npm ci                  # precisa de Node 22.12 ou mais novo (exigência do Nest 12)
export PGHOST=localhost PGUSER=gastos PGPASSWORD=... PGDATABASE=gastos
npm run migrate
npm run import -- ../data/Gastos.xlsx --report ../reports/import-report.md
npm run start:dev               # API com recarga automática, em http://localhost:3000
npm test                        # testes unitários (Vitest; não precisam de banco)
npm run test:e2e                # testes da API; criam um banco temporário gastos_test_* e o removem no fim
npm run typecheck
```

O Postgres do compose escuta só em `127.0.0.1:5432` (dá para abrir no DBeaver); nada é exposto na rede.

## Como a planilha foi mapeada

| Planilha (`Entrada ou Saída`) | Tipo no banco | Observação |
| --- | --- | --- |
| Saída | `expense` | `person_id` = de quem é o gasto (gastos de outras pessoas no seu cartão ficam aqui) |
| Entrada sem "Pago com" | `income` | salário, férias; é o que a aba Dash soma em "Entradas" |
| Entrada paga no Crédito | `reimbursement` | alguém te repassou dinheiro; **não é renda** |
| Pagamento de Crédito | `card_payment` | movimento de caixa da fatura; **não é gasto** (já contado no `expense`) |

Outras decisões da importação:

- Parcela no fim do nome ("Colchao 3/12") vira `installment_no` / `installment_total`, e o nome fica "Colchao".
  Só vale se N ≤ M e M ≥ 2, então "Dany vai pagar 15/09" não é tratado como parcela.
- `name_normalized` (minúsculo, sem acento) é a chave que a etapa 2 vai usar no autopreenchimento.
- Valores com fração de centavo (ex.: 573,345) são arredondados para centavos; o relatório informa a diferença.
- Cada linha guarda `source_ref` (ex.: `Base!R42`), a linha original da planilha, para rastrear qualquer lançamento.

## Conferência

Depois de importar, o script compara os totais que a **própria planilha** calculou (aba Dash: entradas e saídas
do ano e de cada mês; aba Dash Mês: pagamentos e gastos no crédito por pessoa) com o que ficou no banco.
Qualquer diferença aparece no relatório.

## Estrutura

```
docker-compose.yml        db (Postgres 17) + api (NestJS) + web (nginx servindo o React)
api/migrations/           SQL versionado (aplicado ao subir a api ou por npm run migrate)
api/src/<módulo>/         um módulo Nest por assunto (transactions, suggestions, people, categories, health, database),
                          cada um com controller, service e module; schemas Zod validados pelo próprio Nest
api/src/common/           validação global (Standard Schema) e filtro de erros
api/src/lib/              regras puras e testáveis: nomes, parcelas, valores, sugestões
api/test/                 testes e2e (Nest + supertest) com banco temporário
web/src/                  front React: components/, hooks/, api.ts (único contato com o back-end), formState.ts
web/nginx.conf            serve o build e encaminha /api para o Nest
api/src/import/           leitura da planilha, mapeamento e relatório
```
