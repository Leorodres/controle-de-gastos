-- Esquema inicial: lançamentos, pessoas e categorias.

-- Tipos de lançamento (derivados dos tipos usados na planilha):
--   income        entrada de dinheiro do dono (salário, férias). Soma em "Entradas".
--   expense       gasto, pela data da compra. person_id = de quem é o gasto.
--                 Gastos de outras pessoas no seu cartão ficam aqui, com person_id delas.
--   reimbursement alguém repassou dinheiro por gastos feitos no seu cartão.
--                 NÃO é renda; abate o que a pessoa te deve.
--   card_payment  pagamento de fatura do cartão (movimento de caixa). NÃO é gasto:
--                 o gasto já foi contado no expense. Evita contar duas vezes.
CREATE TYPE tx_kind AS ENUM ('income', 'expense', 'reimbursement', 'card_payment');
CREATE TYPE payment_method AS ENUM ('credit', 'debit');

CREATE TABLE people (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text        NOT NULL UNIQUE,
  is_owner   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- no máximo uma pessoa pode ser "o dono" (quem usa o sistema)
CREATE UNIQUE INDEX people_single_owner ON people (is_owner) WHERE is_owner;

CREATE TABLE categories (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_on       date           NOT NULL,
  name              text           NOT NULL,  -- como foi digitado, sem o sufixo de parcela
  name_normalized   text           NOT NULL,  -- minúsculo e sem acento: chave do autopreenchimento
  raw_name          text,                     -- texto original da planilha (rastreabilidade)
  amount            numeric(12, 2) NOT NULL CHECK (amount > 0),
  kind              tx_kind        NOT NULL,
  payment_method    payment_method,
  is_fixed          boolean        NOT NULL DEFAULT false,
  category_id       bigint REFERENCES categories (id),
  person_id         bigint REFERENCES people (id),
  installment_no    smallint,
  installment_total smallint,
  source            text           NOT NULL DEFAULT 'manual',  -- manual | xlsx | ...
  source_ref        text,                                       -- ex.: Base!R42 (linha na planilha)
  created_at        timestamptz    NOT NULL DEFAULT now(),
  updated_at        timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT installment_pair CHECK ((installment_no IS NULL) = (installment_total IS NULL)),
  CONSTRAINT installment_range CHECK (
    installment_no IS NULL OR (installment_total >= 2 AND installment_no BETWEEN 1 AND installment_total)
  ),
  CONSTRAINT source_ref_unique UNIQUE (source, source_ref)
);

CREATE INDEX transactions_occurred_on_idx ON transactions (occurred_on);
CREATE INDEX transactions_kind_date_idx   ON transactions (kind, occurred_on);
CREATE INDEX transactions_name_norm_idx   ON transactions (name_normalized);
CREATE INDEX transactions_category_idx    ON transactions (category_id);
CREATE INDEX transactions_person_idx      ON transactions (person_id);
