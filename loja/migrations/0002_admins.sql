-- Toni e Natália viram administradores sozinhos ao criar a conta na loja nova.
CREATE TRIGGER admins_da_loja AFTER INSERT ON users
WHEN lower(NEW.email) IN ('tonysantquees95@gmail.com', 'nataliadarosacarvalho@gmail.com')
BEGIN
  UPDATE users SET role = 'admin' WHERE id = NEW.id;
END;
