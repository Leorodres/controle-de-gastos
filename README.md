# Controle-de-gastos — controle de gastos doméstico

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

### Sem Docker para os scripts

```bash
cd api && npm ci
export PGHOST=localhost PGUSER=gastos PGPASSWORD=... PGDATABASE=gastos
npm run migrate
npm run import -- ../data/Gastos.xlsx --report ../reports/import-report.md
npm test            # testes de normalização de nomes e mapeamento
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
docker-compose.yml        db (Postgres 17) + api (perfil "tools": só scripts nesta etapa)
api/migrations/           SQL versionado (aplicado por npm run migrate)
api/src/import/           leitura da planilha, mapeamento e relatório
api/src/lib/normalize.ts  normalização de nomes e parcelas (será reaproveitada pela API)
```
