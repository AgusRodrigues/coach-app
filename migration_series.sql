-- =====================================================================
-- Migracion: series de eventos repetidos
-- Como usarlo: Supabase > SQL Editor > pegar todo > Run.
-- Correrlo ANTES de publicar el codigo nuevo. Es seguro correrlo mas de una vez.
-- =====================================================================

-- Todos los eventos creados juntos (por ejemplo "martes y sabado durante 8 semanas")
-- comparten el mismo series_id. Los eventos sueltos y los que ya existian quedan en NULL.
alter table calendar_events
  add column if not exists series_id uuid;

-- Para encontrar rapido los eventos de una misma serie
create index if not exists calendar_events_series_idx
  on calendar_events (user_id, series_id)
  where series_id is not null;
