-- Checkout pela InfinitePay: o cliente paga numa página segura deles.
ALTER TABLE orders ADD COLUMN payment_url TEXT;
-- Desconto do Pix calculado no pedido; só entra no total se o cliente pagar no Pix.
ALTER TABLE orders ADD COLUMN pix_discount_cents INTEGER NOT NULL DEFAULT 0;
