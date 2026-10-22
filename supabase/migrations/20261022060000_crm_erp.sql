-- Módulos CRM + ERP: clientes, oportunidades, seguimiento, producción, caja, inventario.

-- Solo dueño y operador manejan dinero (caja y cierres).
create function privado.maneja_dinero() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()) and rol in ('dueno', 'operador'));
$$;
revoke execute on function privado.maneja_dinero() from public, anon;
grant execute on function privado.maneja_dinero() to authenticated;

-- ---------------------------------------------------------------- Clientes (CRM)
create type cargo_contacto as enum ('director', 'subdirector', 'docente', 'comite', 'padre', 'otro');
create type etapa_oportunidad as enum ('nuevo', 'contactado', 'reunion', 'propuesta', 'ganado', 'perdido');
create type tipo_actividad as enum ('llamada', 'whatsapp', 'visita', 'reunion', 'nota');

create table contactos (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid references colegios (id) on delete cascade,
  nombre text not null,
  cargo cargo_contacto not null default 'otro',
  telefono text,
  email text,
  notas text,
  creado_en timestamptz not null default now()
);
create index contactos_colegio_idx on contactos (colegio_id);

-- Colegios o grupos por conseguir (o renovar), en un embudo de ventas.
create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,                       -- "Promoción 2027 – I.E. Santa Rosa"
  colegio_id uuid references colegios (id) on delete set null,
  colegio_nombre text,                        -- si aún no es cliente
  contacto_nombre text,
  telefono text,
  tipo tipo_campana not null default 'promocion',
  etapa etapa_oportunidad not null default 'nuevo',
  alumnos_estimados int check (alumnos_estimados >= 0),
  monto_estimado numeric(10,2) check (monto_estimado >= 0),
  proxima_accion date,
  responsable uuid references perfiles (id) on delete set null,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index oportunidades_etapa_idx on oportunidades (etapa, proxima_accion);
create trigger oportunidades_actualizado_en before update on oportunidades
  for each row execute function tocar_actualizado_en();

-- Historial de llamadas, visitas y mensajes.
create table actividades (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_actividad not null default 'nota',
  detalle text not null,
  colegio_id uuid references colegios (id) on delete cascade,
  oportunidad_id uuid references oportunidades (id) on delete cascade,
  contacto_id uuid references contactos (id) on delete set null,
  registrado_por uuid references perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index actividades_colegio_idx on actividades (colegio_id, creado_en desc);
create index actividades_oportunidad_idx on actividades (oportunidad_id, creado_en desc);

-- Recordatorios con fecha.
create table tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  vence date not null default (now() at time zone 'America/Lima')::date,
  hecha boolean not null default false,
  colegio_id uuid references colegios (id) on delete cascade,
  oportunidad_id uuid references oportunidades (id) on delete cascade,
  asignado_a uuid references perfiles (id) on delete set null,
  creado_por uuid references perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index tareas_pendientes_idx on tareas (hecha, vence);

-- ---------------------------------------------------------------- Producción
alter table pedidos add column entregado_en timestamptz;

create function marcar_entrega() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    new.entregado_en := now();
  elsif new.estado <> 'entregado' then
    new.entregado_en := null;
  end if;
  return new;
end;
$$;
create trigger pedidos_marcar_entrega before update of estado on pedidos
  for each row execute function marcar_entrega();

-- ---------------------------------------------------------------- Caja
create type tipo_movimiento as enum ('ingreso', 'egreso');

-- Ingresos y gastos que no son pagos de pedidos (los pagos confirmados ya cuentan solos).
create table movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default (now() at time zone 'America/Lima')::date,
  tipo tipo_movimiento not null,
  categoria text not null,
  concepto text not null,
  monto numeric(10,2) not null check (monto > 0),
  metodo metodo_pago not null default 'efectivo',
  registrado_por uuid references perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index movimientos_caja_fecha_idx on movimientos_caja (fecha);

create table cierres_caja (
  fecha date primary key,
  efectivo_esperado numeric(10,2) not null,
  efectivo_contado numeric(10,2) not null,
  diferencia numeric(10,2) generated always as (efectivo_contado - efectivo_esperado) stored,
  notas text,
  cerrado_por uuid references perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------- Inventario
create table materiales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text not null default 'Otros',     -- Papel, Marcos, Tinta, Empaque...
  unidad text not null default 'unid.',
  stock numeric(10,2) not null default 0,
  minimo numeric(10,2) not null default 0 check (minimo >= 0),
  costo_unitario numeric(10,2) check (costo_unitario >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create type motivo_inventario as enum ('compra', 'uso', 'ajuste');
create table movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiales (id) on delete cascade,
  motivo motivo_inventario not null,
  cantidad numeric(10,2) not null check (cantidad <> 0),  -- positivo entra, negativo sale
  nota text,
  registrado_por uuid references perfiles (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index movimientos_inventario_material_idx on movimientos_inventario (material_id, creado_en desc);

create function aplicar_movimiento_inventario() returns trigger
language plpgsql set search_path = public as $$
begin
  update materiales set stock = stock + new.cantidad where id = new.material_id;
  return new;
end;
$$;
create trigger movimientos_inventario_stock after insert on movimientos_inventario
  for each row execute function aplicar_movimiento_inventario();

-- ---------------------------------------------------------------- Seguridad
alter table contactos enable row level security;
alter table oportunidades enable row level security;
alter table actividades enable row level security;
alter table tareas enable row level security;
alter table movimientos_caja enable row level security;
alter table cierres_caja enable row level security;
alter table materiales enable row level security;
alter table movimientos_inventario enable row level security;

create policy "staff contactos" on contactos for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
create policy "staff oportunidades" on oportunidades for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
create policy "staff actividades" on actividades for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
create policy "staff tareas" on tareas for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
create policy "dinero movimientos" on movimientos_caja for all to authenticated using (privado.maneja_dinero()) with check (privado.maneja_dinero());
create policy "dinero cierres" on cierres_caja for all to authenticated using (privado.maneja_dinero()) with check (privado.maneja_dinero());
create policy "staff materiales" on materiales for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
create policy "staff movimientos_inventario" on movimientos_inventario for all to authenticated using (privado.es_staff()) with check (privado.es_staff());
