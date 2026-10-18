-- =====================================================================
-- Migracion: una sola molestia ACTIVA por zona y por usuario
-- Como usarlo: Supabase > SQL Editor.
-- Corre los pasos EN ORDEN. El paso 1 es solo lectura.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PASO 1 (solo lectura): ver si hay molestias activas duplicadas.
-- Si no devuelve filas, saltea directo al PASO 4.
-- ---------------------------------------------------------------------
select user_id, zone_code, count(*) as activas
from pain_reports
where resolved_on is null
group by user_id, zone_code
having count(*) > 1;

-- ---------------------------------------------------------------------
-- PASO 2: fusionar. En cada zona duplicada se conserva la molestia activa
-- MAS ANTIGUA (donde empezo el episodio) y se le copian el tipo y la
-- intensidad de la MAS RECIENTE (el estado actual).
-- ---------------------------------------------------------------------
with latest as (
  select distinct on (user_id, zone_code)
         user_id, zone_code, intensity, pain_type
  from pain_reports
  where resolved_on is null
  order by user_id, zone_code, reported_on desc, created_at desc
),
first_rows as (
  select distinct on (user_id, zone_code)
         id, user_id, zone_code
  from pain_reports
  where resolved_on is null
  order by user_id, zone_code, reported_on asc, created_at asc
)
update pain_reports p
set intensity = l.intensity,
    pain_type = l.pain_type
from first_rows f
join latest l using (user_id, zone_code)
where p.id = f.id;

-- ---------------------------------------------------------------------
-- PASO 3: borrar las activas sobrantes (las notas de esas filas se pierden).
-- ---------------------------------------------------------------------
delete from pain_reports
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by user_id, zone_code
             order by reported_on asc, created_at asc
           ) as rn
    from pain_reports
    where resolved_on is null
  ) t
  where rn > 1
);

-- ---------------------------------------------------------------------
-- PASO 4: regla de la base de datos. Impide que haya dos molestias activas
-- en la misma zona para el mismo usuario. Las resueltas no cuentan.
-- ---------------------------------------------------------------------
create unique index if not exists pain_one_active_per_zone
  on pain_reports (user_id, zone_code)
  where resolved_on is null;
