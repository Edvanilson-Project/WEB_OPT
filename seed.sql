-- ═══════════════════════════════════════════
-- OTIMIZ — Seed inicial do banco de dados
-- ═══════════════════════════════════════════

-- Empresa principal
INSERT INTO companies (name, cnpj, trade_name, status, city, state, phone, fleet_size, daily_trips)
VALUES ('OTIMIZ Transportes Ltda', '00.000.000/0001-00', 'OTIMIZ', 'active', 'São Paulo', 'SP', '(11) 9999-0000', 50, 300)
ON CONFLICT DO NOTHING;

-- Usuário admin (senha: 123456)
INSERT INTO users (name, email, password_hash, role, status, company_id)
VALUES (
  'Administrador',
  'admin@otimiz.com',
  '$2b$10$0OCrkIak3mMjsjhku8.aoOQK7sMvATLbk8zhfVg4WEfSY.6RLcHga',
  'super_admin',
  'active',
  (SELECT id FROM companies WHERE cnpj = '00.000.000/0001-00' LIMIT 1)
)
ON CONFLICT (email) DO NOTHING;

-- Terminais
INSERT INTO terminals (company_id, name, short_name, address, is_garage, is_active)
VALUES
  ((SELECT id FROM companies LIMIT 1), 'Terminal Central', 'CENT', 'Av. Paulista, 1000 - São Paulo/SP', false, true),
  ((SELECT id FROM companies LIMIT 1), 'Terminal Norte', 'NORT', 'Av. Zaki Narchi, 500 - São Paulo/SP', false, true),
  ((SELECT id FROM companies LIMIT 1), 'Terminal Sul', 'SUL', 'Av. Cupecê, 2000 - São Paulo/SP', false, true),
  ((SELECT id FROM companies LIMIT 1), 'Garagem Principal', 'GAR1', 'Rua da Garagem, 100 - São Paulo/SP', true, true),
  ((SELECT id FROM companies LIMIT 1), 'Terminal Leste', 'LEST', 'Av. Aricanduva, 3000 - São Paulo/SP', false, true)
ON CONFLICT DO NOTHING;

-- Tipos de veículo
INSERT INTO vehicle_types (company_id, name, code, passenger_capacity, cost_per_km, cost_per_hour, fixed_cost, is_active)
VALUES
  ((SELECT id FROM companies LIMIT 1), 'Ônibus Padrão',   'BUS-STD', 44, 2.50, 45.00, 800.00, true),
  ((SELECT id FROM companies LIMIT 1), 'Ônibus Articulado','BUS-ART', 120, 3.80, 65.00, 1200.00, true),
  ((SELECT id FROM companies LIMIT 1), 'Micro-ônibus',    'MICRO',   26, 1.80, 35.00, 500.00, true),
  ((SELECT id FROM companies LIMIT 1), 'Van Executiva',   'VAN-EXE', 15, 1.50, 30.00, 400.00, true)
ON CONFLICT DO NOTHING;

-- Linhas
INSERT INTO lines (company_id, code, name, origin_terminal_id, destination_terminal_id, distance_km, avg_trip_duration_minutes, status, color_hex)
VALUES
  (
    (SELECT id FROM companies LIMIT 1),
    '001',
    'Central → Norte',
    (SELECT id FROM terminals WHERE short_name = 'CENT' LIMIT 1),
    (SELECT id FROM terminals WHERE short_name = 'NORT' LIMIT 1),
    18.5, 45, 'active', '#1976D2'
  ),
  (
    (SELECT id FROM companies LIMIT 1),
    '002',
    'Central → Sul',
    (SELECT id FROM terminals WHERE short_name = 'CENT' LIMIT 1),
    (SELECT id FROM terminals WHERE short_name = 'SUL' LIMIT 1),
    22.0, 55, 'active', '#388E3C'
  ),
  (
    (SELECT id FROM companies LIMIT 1),
    '003',
    'Norte → Leste',
    (SELECT id FROM terminals WHERE short_name = 'NORT' LIMIT 1),
    (SELECT id FROM terminals WHERE short_name = 'LEST' LIMIT 1),
    14.0, 35, 'active', '#F57C00'
  ),
  (
    (SELECT id FROM companies LIMIT 1),
    '004',
    'Sul → Leste',
    (SELECT id FROM terminals WHERE short_name = 'SUL' LIMIT 1),
    (SELECT id FROM terminals WHERE short_name = 'LEST' LIMIT 1),
    25.5, 60, 'active', '#7B1FA2'
  )
ON CONFLICT DO NOTHING;
