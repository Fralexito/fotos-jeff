-- Preferencias visuales de cada persona (color, tamaño de letra, modo oscuro, densidad).
alter table perfiles add column preferencias jsonb not null default '{}'::jsonb;

-- Cada uno edita solo sus datos personales; el rol lo cambia el dueño desde Supabase.
revoke update on perfiles from authenticated;
grant update (nombre, telefono, preferencias) on perfiles to authenticated;
