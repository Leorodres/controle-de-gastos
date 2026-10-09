-- Busca aproximada de nomes (digitou "ubber", acha "uber") e agrupamento de parcelas.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX transactions_name_trgm_idx ON transactions USING gin (name_normalized gin_trgm_ops);

-- Parcelas criadas de uma vez (compra em 12x) compartilham o mesmo grupo,
-- para poder apagar "esta e as seguintes" se a compra for cancelada.
-- As parcelas importadas da planilha ficam sem grupo (NULL).
ALTER TABLE transactions ADD COLUMN installment_group_id uuid;
ALTER TABLE transactions ADD CONSTRAINT installment_group_needs_no
  CHECK (installment_group_id IS NULL OR installment_no IS NOT NULL);
CREATE INDEX transactions_installment_group_idx ON transactions (installment_group_id)
  WHERE installment_group_id IS NOT NULL;
