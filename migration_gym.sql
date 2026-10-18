-- =====================================================================
-- Migracion: dias de rutina de gimnasio
-- Como usarlo: Supabase > SQL Editor > pegar todo > Run
-- Es seguro correrlo una sola vez (usa "if not exists").
-- =====================================================================

-- A que dia de rutina corresponde la sesion (ej: "Dia A", "Piernas").
-- Es texto libre: cada usuario define sus propios dias.
alter table session_logs
  add column if not exists gym_day text
  check (gym_day is null or char_length(gym_day) between 1 and 40);

-- Orden en que se hizo cada ejercicio dentro de la sesion
alter table gym_sets
  add column if not exists exercise_order smallint not null default 1;

-- Para encontrar rapido "lo ultimo que hice en el dia X"
create index if not exists session_logs_gym_day_idx
  on session_logs (user_id, gym_day, started_at desc);

create index if not exists gym_sets_session_order_idx
  on gym_sets (session_id, exercise_order, set_number);
