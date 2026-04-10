BEGIN;

DO $$
DECLARE
  source_line lines%ROWTYPE;
  target_line_id integer;
  target_code text;
  target_name text;
  target_color text;
  time_shift integer;
  group_shift integer;
BEGIN
  SELECT *
  INTO source_line
  FROM lines
  WHERE id = 16;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linha base 16 nao encontrada em lines';
  END IF;

  FOR target_code, target_name, target_color, time_shift, group_shift IN
    SELECT *
    FROM (
      VALUES
        ('1672_ML_A', source_line.name || ' MULTI A', '#0B8A5B', 6, 1000000),
        ('1672_ML_B', source_line.name || ' MULTI B', '#C84C09', 12, 2000000)
    ) AS targets(code, name, color_hex, shift_minutes, trip_group_offset)
  LOOP
    INSERT INTO lines (
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
      source_line.company_id,
      target_code,
      target_name,
      source_line.origin_terminal_id,
      source_line.destination_terminal_id,
      source_line.distance_km,
      source_line.avg_trip_duration_minutes,
      source_line.status,
      target_color,
      source_line.pullout_terminal_id,
      source_line.pullout_duration_minutes,
      source_line.pullback_duration_minutes,
      source_line.return_distance_km,
      source_line.return_trip_duration_minutes,
      source_line.idle_terminal_id,
      source_line.idle_distance_km,
      source_line.idle_return_distance_km,
      source_line.garage_terminal_id,
      source_line.garage_distance_km,
      source_line.operation_mode,
      source_line.vehicle_type_id
    )
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
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
        vehicle_type_id = EXCLUDED.vehicle_type_id,
        updated_at = now()
    RETURNING id INTO target_line_id;

    DELETE FROM trips WHERE line_id = target_line_id;

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
    SELECT
      t.company_id,
      target_code || '-' || COALESCE(t.trip_code, t.id::text),
      target_line_id,
      NULL,
      t.direction,
      t.start_time_minutes + time_shift,
      t.end_time_minutes + time_shift,
      t.duration_minutes,
      t.origin_terminal_id,
      t.destination_terminal_id,
      t.passenger_count,
      t.vehicle_type_id,
      CASE
        WHEN t.trip_group_id IS NULL THEN NULL
        ELSE t.trip_group_id + group_shift
      END,
      t.is_active,
      t.idle_before_minutes,
      t.idle_after_minutes,
      t.is_pull_out,
      t.is_pull_back,
      NULL,
      NULL,
      NULL
    FROM trips t
    WHERE t.line_id = source_line.id;
  END LOOP;
END $$;

COMMIT;