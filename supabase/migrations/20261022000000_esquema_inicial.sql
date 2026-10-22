-- Esquema compartido de Fotos Jeff: web, panel de gestión y pipeline de edición.
-- Una fila de alumno es la misma para las tres partes; nada se duplica.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type rol_staff as enum ('dueno', 'operador', 'fotografo');
create type tipo_campana as enum ('promocion', 'graduacion', 'carnet', 'otro');
create type estado_campana as enum ('planificada', 'en_captura', 'en_edicion', 'en_entrega', 'cerrada');
create type estado_foto as enum ('subida', 'procesando', 'procesada', 'excepcion', 'aprobada', 'rechazada');
create type estado_pedido as enum ('pendiente', 'procesado', 'en_impresion', 'entregado', 'anulado');
create type metodo_pago as enum ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta');
create type estado_pago as enum ('por_verificar', 'confirmado', 'rechazado');

-- ---------------------------------------------------------------------------
-- Personal (enlazado a Supabase Auth)
-- ---------------------------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  telefono text,
  rol rol_staff not null default 'operador',
  creado_en timestamptz not null default now()
);

create function es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfiles where id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Colegios, campañas y alumnos
-- ---------------------------------------------------------------------------
create table colegios (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,              -- corto, para nomenclatura de archivos: p. ej. "IEP601"
  nombre text not null,
  ciudad text not null default 'Nauta',
  direccion text,
  director text,
  contacto_nombre text,                      -- comité / APAFA
  contacto_telefono text,
  notas text,
  creado_en timestamptz not null default now()
);

create table campanas (
  id uuid primary key default gen_random_uuid(),
  colegio_id uuid not null references colegios (id) on delete restrict,
  anio smallint not null,
  tipo tipo_campana not null,
  nombre text not null,                      -- p. ej. "Promoción 2026 - 5to secundaria"
  estado estado_campana not null default 'planificada',
  fecha_captura date,
  fecha_entrega date,
  producto_principal text not null default '15x21',
  notas text,
  creado_en timestamptz not null default now(),
  unique (colegio_id, anio, tipo, nombre)
);

create table alumnos (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references campanas (id) on delete cascade,
  codigo text not null,                      -- impreso en QR/código de barras; asocia la foto
  nombres text not null,
  apellidos text not null,
  grado text,
  seccion text,
  dni text,
  apoderado_nombre text,
  apoderado_telefono text,
  creado_en timestamptz not null default now(),
  unique (campana_id, codigo)
);
create index alumnos_campana_idx on alumnos (campana_id, grado, seccion, apellidos);

-- ---------------------------------------------------------------------------
-- Fotos (originales y procesadas viven en Storage; aquí van rutas y QA)
-- ---------------------------------------------------------------------------
create table fotos (
  id uuid primary key default gen_random_uuid(),
  campana_id uuid not null references campanas (id) on delete cascade,
  alumno_id uuid references alumnos (id) on delete set null,  -- null hasta asociarla
  ruta_original text not null unique,        -- bucket "originales"
  ruta_procesada text,                       -- bucket "procesadas"
  producto text not null default '15x21',
  estado estado_foto not null default 'subida',
  qa jsonb not null default '{}'::jsonb,     -- reporte del pipeline: headroom, base-lock, ojos, resolución...
  motivo_excepcion text,
  es_principal boolean not null default false,
  procesada_en timestamptz,
  revisada_por uuid references perfiles (id),
  revisada_en timestamptz,
  creado_en timestamptz not null default now()
);
create index fotos_campana_estado_idx on fotos (campana_id, estado);
create index fotos_alumno_idx on fotos (alumno_id);
create unique index fotos_una_principal_idx on fotos (alumno_id, producto) where es_principal;

-- ---------------------------------------------------------------------------
-- Catálogo, pedidos y pagos
-- ---------------------------------------------------------------------------
create table productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,               -- '15x21', '20x30', 'carnet', 'digital', 'combo_basico'...
  nombre text not null,
  descripcion text,
  precio numeric(10,2) not null check (precio >= 0),
  es_combo boolean not null default false,
  activo boolean not null default true
);

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,  -- número corto para el recibo
  campana_id uuid not null references campanas (id) on delete restrict,
  alumno_id uuid not null references alumnos (id) on delete restrict,
  estado estado_pedido not null default 'pendiente',
  total numeric(10,2) not null default 0 check (total >= 0),
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index pedidos_campana_estado_idx on pedidos (campana_id, estado);

create table pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  producto_id uuid not null references productos (id) on delete restrict,
  foto_id uuid references fotos (id) on delete set null,
  cantidad smallint not null default 1 check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);

create table pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  monto numeric(10,2) not null check (monto > 0),
  metodo metodo_pago not null,
  estado estado_pago not null default 'por_verificar',
  ruta_voucher text,                         -- captura de Yape/Plin en bucket "vouchers"
  operacion text,                            -- número de operación
  registrado_por uuid references perfiles (id),
  creado_en timestamptz not null default now()
);
create index pagos_pedido_idx on pagos (pedido_id);

-- Saldo de cada pedido para el panel (lo pagado confirmado vs. el total)
create view pedidos_saldo with (security_invoker = true) as
select p.id, p.numero, p.campana_id, p.alumno_id, p.estado, p.total,
       coalesce(sum(pg.monto) filter (where pg.estado = 'confirmado'), 0) as pagado,
       p.total - coalesce(sum(pg.monto) filter (where pg.estado = 'confirmado'), 0) as saldo
from pedidos p
left join pagos pg on pg.pedido_id = p.id
group by p.id;

create function tocar_actualizado_en() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
create trigger pedidos_actualizado_en before update on pedidos
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------------
-- Seguridad: todo cerrado salvo para el personal autenticado.
-- El pipeline usa la service_role (salta RLS). El portal de padres se abrirá después.
-- ---------------------------------------------------------------------------
alter table perfiles enable row level security;
alter table colegios enable row level security;
alter table campanas enable row level security;
alter table alumnos enable row level security;
alter table fotos enable row level security;
alter table productos enable row level security;
alter table pedidos enable row level security;
alter table pedido_items enable row level security;
alter table pagos enable row level security;

create policy "staff lee perfiles" on perfiles for select to authenticated using (es_staff());
create policy "cada uno edita su perfil" on perfiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "staff colegios" on colegios for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff campanas" on campanas for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff alumnos" on alumnos for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff fotos" on fotos for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff pedidos" on pedidos for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff pedido_items" on pedido_items for all to authenticated using (es_staff()) with check (es_staff());
create policy "staff pagos" on pagos for all to authenticated using (es_staff()) with check (es_staff());

-- El catálogo activo es público (la web muestra precios); solo el personal lo edita.
create policy "catalogo publico" on productos for select to anon, authenticated using (activo or es_staff());
create policy "staff edita catalogo" on productos for all to authenticated using (es_staff()) with check (es_staff());

-- ---------------------------------------------------------------------------
-- Storage: buckets privados
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('originales', 'originales', false),
  ('procesadas', 'procesadas', false),
  ('vouchers', 'vouchers', false)
on conflict (id) do nothing;

create policy "staff storage" on storage.objects for all to authenticated
  using (bucket_id in ('originales', 'procesadas', 'vouchers') and public.es_staff())
  with check (bucket_id in ('originales', 'procesadas', 'vouchers') and public.es_staff());
