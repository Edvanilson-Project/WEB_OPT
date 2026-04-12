BEGIN;

INSERT INTO companies (
  id,
  name,
  cnpj,
  trade_name,
  status,
  city,
  state,
  phone,
  fleet_size,
  daily_trips
)
VALUES (
  1,
  'OTIMIZ Transportes Ltda',
  '00.000.000/0001-00',
  'OTIMIZ',
  'active',
  'Salvador',
  'BA',
  '(71) 9999-0000',
  32,
  180
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    cnpj = EXCLUDED.cnpj,
    trade_name = EXCLUDED.trade_name,
    status = EXCLUDED.status,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    phone = EXCLUDED.phone,
    fleet_size = EXCLUDED.fleet_size,
    daily_trips = EXCLUDED.daily_trips;

INSERT INTO users (
  id,
  name,
  email,
  password_hash,
  role,
  status,
  company_id
)
VALUES (
  1,
  'Administrador',
  'admin@otimiz.com',
  '$2b$10$0OCrkIak3mMjsjhku8.aoOQK7sMvATLbk8zhfVg4WEfSY.6RLcHga',
  'super_admin',
  'active',
  1
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    company_id = EXCLUDED.company_id;

INSERT INTO terminals (
  id,
  company_id,
  name,
  short_name,
  address,
  latitude,
  longitude,
  is_garage,
  is_active
)
VALUES
  (
    12,
    1,
    'Alto de Coutos',
    'AC',
    'R. 2 de Julho - Coutos, Salvador - BA, 40750-380',
    -12.85530312,
    -38.46413151,
    false,
    true
  ),
  (
    13,
    1,
    'Estacao Hiper (Sent. Pituba)',
    'EH',
    'Brotas, Salvador - BA, 40280-901',
    -12.98512735,
    -38.46695110,
    false,
    true
  ),
  (
    14,
    1,
    'Garagem Praia Grande',
    'G1',
    'Av. Afranio Peixoto - Praia Grande, Salvador - BA, 40720-690',
    -12.87783920,
    -38.47766007,
    true,
    true
  )
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    is_garage = EXCLUDED.is_garage,
    is_active = EXCLUDED.is_active;

INSERT INTO vehicle_types (
  id,
  company_id,
  name,
  code,
  passenger_capacity,
  cost_per_km,
  cost_per_hour,
  fixed_cost,
  is_active
)
VALUES (
  6,
  1,
  'Ônibus Padrão',
  'BUS-STD',
  150,
  2.50,
  45.00,
  800.00,
  true
)
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    passenger_capacity = EXCLUDED.passenger_capacity,
    cost_per_km = EXCLUDED.cost_per_km,
    cost_per_hour = EXCLUDED.cost_per_hour,
    fixed_cost = EXCLUDED.fixed_cost,
    is_active = EXCLUDED.is_active;

INSERT INTO lines (
  id,
  company_id,
  code,
  name,
  origin_terminal_id,
  destination_terminal_id,
  distance_km,
  avg_trip_duration_minutes,
  status,
  color_hex,
  pullout_terminal_id,
  pullout_duration_minutes,
  pullback_duration_minutes,
  return_distance_km,
  return_trip_duration_minutes,
  idle_terminal_id,
  idle_distance_km,
  idle_return_distance_km,
  garage_terminal_id,
  garage_distance_km,
  operation_mode,
  vehicle_type_id
)
VALUES (
  16,
  1,
  '1672',
  'ALTO DE COUTOS X EST. BRT HIPER',
  12,
  13,
  7.00,
  69,
  'active',
  '#0F766E',
  14,
  10,
  10,
  7.00,
  82,
  12,
  0.50,
  0.50,
  14,
  1.20,
  'roundtrip',
  6
)
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    origin_terminal_id = EXCLUDED.origin_terminal_id,
    destination_terminal_id = EXCLUDED.destination_terminal_id,
    distance_km = EXCLUDED.distance_km,
    avg_trip_duration_minutes = EXCLUDED.avg_trip_duration_minutes,
    status = EXCLUDED.status,
    color_hex = EXCLUDED.color_hex,
    pullout_terminal_id = EXCLUDED.pullout_terminal_id,
    pullout_duration_minutes = EXCLUDED.pullout_duration_minutes,
    pullback_duration_minutes = EXCLUDED.pullback_duration_minutes,
    return_distance_km = EXCLUDED.return_distance_km,
    return_trip_duration_minutes = EXCLUDED.return_trip_duration_minutes,
    idle_terminal_id = EXCLUDED.idle_terminal_id,
    idle_distance_km = EXCLUDED.idle_distance_km,
    idle_return_distance_km = EXCLUDED.idle_return_distance_km,
    garage_terminal_id = EXCLUDED.garage_terminal_id,
    garage_distance_km = EXCLUDED.garage_distance_km,
    operation_mode = EXCLUDED.operation_mode,
    vehicle_type_id = EXCLUDED.vehicle_type_id;

INSERT INTO optimization_settings (
  id,
  company_id,
  name,
  is_active,
  algorithm_type,
  time_budget_seconds,
  cct_max_shift_minutes,
  cct_max_work_minutes,
  cct_max_driving_minutes,
  cct_min_break_minutes,
  cct_min_layover_minutes,
  apply_cct,
  pullout_minutes,
  pullback_minutes,
  max_vehicle_shift_minutes,
  fixed_vehicle_activation_cost,
  deadhead_cost_per_minute,
  idle_cost_per_minute,
  allow_vehicle_split_shifts,
  allow_multi_line_block,
  allow_relief_points,
  preserve_preferred_pairs,
  enforce_trip_groups_hard,
  operator_change_terminals_only,
  operator_single_vehicle_only,
  operation_mode,
  connection_tolerance_minutes,
  fairness_weight,
  sunday_off_weight,
  holiday_extra_pct,
  same_depot_required
)
VALUES (
  1,
  1,
  'CI Battery Fixture',
  true,
  'hybrid_pipeline',
  60,
  480,
  440,
  270,
  15,
  8,
  true,
  10,
  10,
  960,
  800.00,
  0.85,
  0.50,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  'urban',
  2,
  0.60,
  0.00,
  1.00,
  false
)
ON CONFLICT (id) DO UPDATE
SET company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    algorithm_type = EXCLUDED.algorithm_type,
    time_budget_seconds = EXCLUDED.time_budget_seconds,
    cct_max_shift_minutes = EXCLUDED.cct_max_shift_minutes,
    cct_max_work_minutes = EXCLUDED.cct_max_work_minutes,
    cct_max_driving_minutes = EXCLUDED.cct_max_driving_minutes,
    cct_min_break_minutes = EXCLUDED.cct_min_break_minutes,
    cct_min_layover_minutes = EXCLUDED.cct_min_layover_minutes,
    apply_cct = EXCLUDED.apply_cct,
    pullout_minutes = EXCLUDED.pullout_minutes,
    pullback_minutes = EXCLUDED.pullback_minutes,
    max_vehicle_shift_minutes = EXCLUDED.max_vehicle_shift_minutes,
    fixed_vehicle_activation_cost = EXCLUDED.fixed_vehicle_activation_cost,
    deadhead_cost_per_minute = EXCLUDED.deadhead_cost_per_minute,
    idle_cost_per_minute = EXCLUDED.idle_cost_per_minute,
    allow_vehicle_split_shifts = EXCLUDED.allow_vehicle_split_shifts,
    allow_multi_line_block = EXCLUDED.allow_multi_line_block,
    allow_relief_points = EXCLUDED.allow_relief_points,
    preserve_preferred_pairs = EXCLUDED.preserve_preferred_pairs,
    enforce_trip_groups_hard = EXCLUDED.enforce_trip_groups_hard,
    operator_change_terminals_only = EXCLUDED.operator_change_terminals_only,
    operator_single_vehicle_only = EXCLUDED.operator_single_vehicle_only,
    operation_mode = EXCLUDED.operation_mode,
    connection_tolerance_minutes = EXCLUDED.connection_tolerance_minutes,
    fairness_weight = EXCLUDED.fairness_weight,
    sunday_off_weight = EXCLUDED.sunday_off_weight,
    holiday_extra_pct = EXCLUDED.holiday_extra_pct,
    same_depot_required = EXCLUDED.same_depot_required;

UPDATE optimization_settings
SET is_active = CASE WHEN id = 1 THEN true ELSE false END
WHERE company_id = 1;

DELETE FROM trips WHERE line_id = 16;

DO $$
DECLARE
  trip_index integer := 0;
  base_group integer := 120000;
  start_min integer;
  duration_out integer;
  duration_back integer;
  layover integer;
  passenger_out integer;
  passenger_back integer;
  current_group integer;
  final_return_id integer;
BEGIN
  INSERT INTO trips (
    company_id,
    trip_code,
    line_id,
    schedule_id,
    direction,
    start_time_minutes,
    end_time_minutes,
    duration_minutes,
    origin_terminal_id,
    destination_terminal_id,
    passenger_count,
    vehicle_type_id,
    trip_group_id,
    is_active,
    idle_before_minutes,
    idle_after_minutes,
    is_pull_out,
    is_pull_back,
    timetable_rule_id,
    schedule_group_id,
    timetable_id
  )
  VALUES (
    1,
    'CI-1672-PULLOUT',
    16,
    NULL,
    'outbound',
    255,
    300,
    45,
    14,
    12,
    0,
    6,
    NULL,
    true,
    0,
    10,
    true,
    false,
    NULL,
    NULL,
    16
  );

  FOR start_min IN SELECT generate_series(300, 580, 20)
  LOOP
    trip_index := trip_index + 1;
    current_group := base_group + trip_index;
    duration_out := 62 + ((trip_index - 1) % 4) * 7;
    duration_back := duration_out + CASE WHEN trip_index % 3 = 0 THEN 12 ELSE 6 END;
    layover := 8 + (trip_index % 3) * 2;
    passenger_out := 70 + ((trip_index * 11) % 55);
    passenger_back := 58 + ((trip_index * 13) % 60);

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-OUT', current_group),
      16,
      NULL,
      'outbound',
      start_min,
      start_min + duration_out,
      duration_out,
      12,
      13,
      passenger_out,
      NULL,
      current_group,
      true,
      0,
      layover,
      false,
      false,
      NULL,
      NULL,
      16
    );

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-RET', current_group),
      16,
      NULL,
      'return',
      start_min + duration_out + layover,
      start_min + duration_out + layover + duration_back,
      duration_back,
      13,
      12,
      passenger_back,
      NULL,
      current_group,
      true,
      layover,
      10 + (trip_index % 4),
      false,
      false,
      NULL,
      NULL,
      16
    );
  END LOOP;

  FOR start_min IN SELECT generate_series(610, 850, 30)
  LOOP
    trip_index := trip_index + 1;
    current_group := base_group + trip_index;
    duration_out := 45 + ((trip_index - 1) % 3) * 6;
    duration_back := duration_out + 8 + (trip_index % 2) * 4;
    layover := 7 + (trip_index % 2) * 3;
    passenger_out := 8 + ((trip_index * 7) % 40);
    passenger_back := 12 + ((trip_index * 5) % 45);

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-OUT', current_group),
      16,
      NULL,
      'outbound',
      start_min,
      start_min + duration_out,
      duration_out,
      12,
      13,
      passenger_out,
      NULL,
      current_group,
      true,
      0,
      layover,
      false,
      false,
      NULL,
      NULL,
      16
    );

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-RET', current_group),
      16,
      NULL,
      'return',
      start_min + duration_out + layover,
      start_min + duration_out + layover + duration_back,
      duration_back,
      13,
      12,
      passenger_back,
      NULL,
      current_group,
      true,
      layover,
      12 + (trip_index % 3),
      false,
      false,
      NULL,
      NULL,
      16
    );
  END LOOP;

  FOR start_min IN SELECT generate_series(960, 1340, 20)
  LOOP
    trip_index := trip_index + 1;
    current_group := base_group + trip_index;
    duration_out := 58 + ((trip_index - 1) % 5) * 6;
    duration_back := duration_out + CASE WHEN trip_index % 4 = 0 THEN 14 ELSE 8 END;
    layover := 8 + (trip_index % 3) * 2;
    passenger_out := 50 + ((trip_index * 9) % 80);
    passenger_back := 60 + ((trip_index * 10) % 90);

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-OUT', current_group),
      16,
      NULL,
      'outbound',
      start_min,
      start_min + duration_out,
      duration_out,
      12,
      13,
      passenger_out,
      NULL,
      current_group,
      true,
      0,
      layover,
      false,
      false,
      NULL,
      NULL,
      16
    );

    INSERT INTO trips (
      company_id,
      trip_code,
      line_id,
      schedule_id,
      direction,
      start_time_minutes,
      end_time_minutes,
      duration_minutes,
      origin_terminal_id,
      destination_terminal_id,
      passenger_count,
      vehicle_type_id,
      trip_group_id,
      is_active,
      idle_before_minutes,
      idle_after_minutes,
      is_pull_out,
      is_pull_back,
      timetable_rule_id,
      schedule_group_id,
      timetable_id
    )
    VALUES (
      1,
      format('CI-1672-%s-RET', current_group),
      16,
      NULL,
      'return',
      start_min + duration_out + layover,
      start_min + duration_out + layover + duration_back,
      duration_back,
      13,
      12,
      passenger_back,
      NULL,
      current_group,
      true,
      layover,
      12 + (trip_index % 4),
      false,
      false,
      NULL,
      NULL,
      16
    );
  END LOOP;

  SELECT id
  INTO final_return_id
  FROM trips
  WHERE line_id = 16
    AND direction = 'return'
  ORDER BY end_time_minutes DESC, id DESC
  LIMIT 1;

  UPDATE trips
  SET is_pull_back = true,
      idle_after_minutes = GREATEST(idle_after_minutes, 14)
  WHERE id = final_return_id;
END $$;

SELECT setval(pg_get_serial_sequence('companies', 'id'), GREATEST((SELECT max(id) FROM companies), 1), true);
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT max(id) FROM users), 1), true);
SELECT setval(pg_get_serial_sequence('terminals', 'id'), GREATEST((SELECT max(id) FROM terminals), 1), true);
SELECT setval(pg_get_serial_sequence('vehicle_types', 'id'), GREATEST((SELECT max(id) FROM vehicle_types), 1), true);
SELECT setval(pg_get_serial_sequence('lines', 'id'), GREATEST((SELECT max(id) FROM lines), 1), true);
SELECT setval(pg_get_serial_sequence('optimization_settings', 'id'), GREATEST((SELECT max(id) FROM optimization_settings), 1), true);
SELECT setval(pg_get_serial_sequence('trips', 'id'), GREATEST((SELECT max(id) FROM trips), 1), true);

COMMIT;