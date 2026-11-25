-- O preço de venda dos cadastros anteriores sempre foi preco_brl.
ALTER TABLE produtos
  ADD COLUMN moeda ENUM('BRL', 'USD') NOT NULL DEFAULT 'BRL',
  MODIFY preco_brl DECIMAL(10,2) NULL,
  ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE;
