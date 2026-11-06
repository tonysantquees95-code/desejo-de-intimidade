-- Banco da loja no D1 (SQLite), igual ao do Floot (Postgres).
-- Datas ficam em texto ISO (2026-11-06T19:20:00.000Z), sim/não em 0/1 e JSON em texto.

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_users_email ON users (email);

CREATE TABLE user_passwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_accessed TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  attempted_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  success INTEGER DEFAULT 0
);
CREATE INDEX login_attempts_cleanup_idx ON login_attempts (attempted_at);
CREATE INDEX login_attempts_email_fail_idx ON login_attempts (lower(email), attempted_at DESC) WHERE success = 0;

CREATE TABLE password_reset_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX password_reset_codes_user_idx ON password_reset_codes (user_id, created_at DESC);

CREATE TABLE customer_profiles (
  user_id INTEGER PRIMARY KEY,
  cpf TEXT, phone TEXT, cep TEXT, street TEXT, street_number TEXT, complement TEXT,
  neighborhood TEXT, city TEXT, state TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_text TEXT,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  price_cents INTEGER, weight_grams INTEGER, width_cm INTEGER, height_cm INTEGER, length_cm INTEGER,
  compare_at_cents INTEGER, specifications TEXT, stock_quantity INTEGER, cost_cents INTEGER
);
CREATE INDEX products_category_idx ON products (category, sort_order, id);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  payment_method TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT,
  payment_provider_id TEXT,
  pix_qr_text TEXT,
  pix_qr_image_url TEXT,
  pix_expires_at TEXT,
  tracking_code TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  shipping_service TEXT,
  shipping_days INTEGER,
  melhor_envio_id TEXT,
  shipment_error TEXT,
  customer_notified_status TEXT,
  discount_cents INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX orders_payment_provider_id_idx ON orders (payment_provider_id);
CREATE INDEX orders_user_id_idx ON orders (user_id);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT NOT NULL,
  image_url TEXT,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  stock_reserved INTEGER NOT NULL DEFAULT 0,
  unit_cost_cents INTEGER
);
CREATE INDEX order_items_order_id_idx ON order_items (order_id);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'product',
  product_id INTEGER,
  product_name TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  display_name TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX reviews_order_id_idx ON reviews (order_id);
CREATE INDEX reviews_visible_idx ON reviews (visible, created_at DESC);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE ajustes_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quando TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  area TEXT NOT NULL,
  texto TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'painel',
  ok INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ajustes_log_quando ON ajustes_log (quando DESC);

CREATE TABLE app_dispositivos (
  token TEXT PRIMARY KEY,
  usuario_id INTEGER,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX app_dispositivos_usuario_idx ON app_dispositivos (usuario_id);

CREATE TABLE cobranca_avisos (
  order_nsu TEXT PRIMARY KEY,
  slug TEXT,
  transaction_nsu TEXT,
  corpo TEXT NOT NULL DEFAULT '{}',
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE publicacao_ideias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  data TEXT,
  formato TEXT NOT NULL DEFAULT 'feed',
  legenda TEXT NOT NULL DEFAULT '',
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE publicacao_pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  turno TEXT,
  ideia_ref TEXT,
  ideia_titulo TEXT,
  quando TEXT,
  legenda TEXT,
  estado TEXT NOT NULL DEFAULT 'pendente',
  resultado TEXT,
  imagem_url TEXT,
  pedido_por TEXT,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX publicacao_pedidos_estado ON publicacao_pedidos (estado, criado);

CREATE TABLE push_inscricoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identidade TEXT NOT NULL UNIQUE,
  usuario_id INTEGER,
  nome TEXT,
  assinatura TEXT NOT NULL,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE solicitacoes_troca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  preferencia TEXT NOT NULL,
  itens TEXT NOT NULL,
  descricao TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'nova',
  resposta TEXT,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX solicitacoes_troca_order_idx ON solicitacoes_troca (order_id);

CREATE TABLE stories_dia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  turno TEXT NOT NULL,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL DEFAULT '',
  pergunta TEXT,
  imagem_url TEXT NOT NULL,
  enquete INTEGER NOT NULL DEFAULT 0,
  instagram_por TEXT,
  instagram_em TEXT,
  whatsapp_por TEXT,
  whatsapp_em TEXT,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX stories_dia_criado ON stories_dia (criado DESC);

CREATE TABLE venus_robo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canal TEXT NOT NULL,
  remetente TEXT NOT NULL,
  mensagens TEXT NOT NULL DEFAULT '[]',
  pausado_ate TEXT,
  menu TEXT,
  atendimentos INTEGER NOT NULL DEFAULT 0,
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (canal, remetente)
);

CREATE TABLE venus_vetores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL,
  ref TEXT NOT NULL,
  texto TEXT NOT NULL,
  resposta TEXT,
  hash TEXT NOT NULL,
  modelo TEXT NOT NULL,
  vetor TEXT NOT NULL,
  usos INTEGER NOT NULL DEFAULT 0,
  atualizado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tipo, ref)
);

-- Arquivos enviados pelo painel (fotos de produtos, stories), em pedaços de até 1,5 MB.
CREATE TABLE arquivos (
  caminho TEXT NOT NULL,
  parte INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  dados BLOB NOT NULL,
  criado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (caminho, parte)
);
