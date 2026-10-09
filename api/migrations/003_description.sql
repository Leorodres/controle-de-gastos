-- Descrição curta e opcional do lançamento (ex.: "pagamento da Leh" num lançamento "Spotify").
ALTER TABLE transactions ADD COLUMN description text;
ALTER TABLE transactions ADD CONSTRAINT description_length
  CHECK (description IS NULL OR char_length(description) BETWEEN 1 AND 200);
