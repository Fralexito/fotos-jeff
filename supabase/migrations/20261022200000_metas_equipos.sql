-- Meta de cobros de cada sede por mes, y las cámaras y equipos del estudio.

create table metas (
  sede text not null references sedes (id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),  -- primer día del mes
  monto numeric(12,2) not null check (monto >= 0),
  primary key (sede, mes)
);
alter table metas enable row level security;
create policy "staff lee metas" on metas for select to authenticated using (privado.es_staff());
create policy "dueno pone metas" on metas for all to authenticated
  using (exists (select 1 from perfiles where id = (select auth.uid()) and rol = 'dueno'))
  with check (exists (select 1 from perfiles where id = (select auth.uid()) and rol = 'dueno'));

create table equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'otro' check (tipo in ('camara', 'lente', 'flash', 'iluminacion', 'fondo', 'impresora', 'computadora', 'otro')),
  marca_modelo text,
  serie text,
  sede text not null default 'nauta' references sedes (id),
  estado text not null default 'disponible' check (estado in ('disponible', 'en_uso', 'mantenimiento', 'baja')),
  asignado_a text,
  proximo_mantenimiento date,
  notas text,
  creado_en timestamptz not null default now()
);
create index equipos_sede_idx on equipos (sede, tipo);
alter table equipos enable row level security;
create policy "staff ve y edita equipos" on equipos for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
