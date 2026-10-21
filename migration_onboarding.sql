-- =====================================================================
-- Migracion: tutorial de bienvenida
-- Como usarlo: Supabase > SQL Editor > pegar todo > Run.
-- Es seguro correrlo mas de una vez.
-- =====================================================================

-- Cuando la persona termino (o salteo) el tutorial. NULL = todavia no lo vio.
alter table profiles
  add column if not exists onboarded_at timestamptz;

-- ---------------------------------------------------------------------
-- OPCIONAL: las cuentas que YA existen tambien van a ver el tutorial una vez.
-- Si preferis que solo lo vean las cuentas nuevas, descomenta esta linea
-- (sacale los dos guiones del principio) y ejecutala:
-- ---------------------------------------------------------------------
-- update profiles set onboarded_at = now() where onboarded_at is null;

-- ---------------------------------------------------------------------
-- OPCIONAL: para volver a ver el tutorial como si fueras una cuenta nueva,
-- reemplaza el email y ejecuta:
-- ---------------------------------------------------------------------
-- update profiles set onboarded_at = null
--  where id = (select id from auth.users where email = 'TU-EMAIL@EJEMPLO.COM');
