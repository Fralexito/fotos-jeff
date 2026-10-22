-- Dos sedes (Nauta e Iquitos). Cada colegio pertenece a una sede, y los pedidos y la caja
-- quedan marcados con la sede para filtrar y cuadrar por separado.
create table sedes (
  id text primary key check (id ~ '^[a-z]+$'),
  nombre text not null,
  encargado text,
  telefono text,
  direccion text,
  orden smallint not null default 0
);
insert into sedes (id, nombre, encargado, orden) values
  ('nauta', 'Nauta', 'Jefferson Gómez Tuesta', 1),
  ('iquitos', 'Iquitos', 'Liz Nery Gómez Ríos', 2);

alter table sedes enable row level security;
create policy "staff lee sedes" on sedes for select to authenticated using (privado.es_staff());
create policy "dueno edita sedes" on sedes for update to authenticated
  using (exists (select 1 from perfiles where id = (select auth.uid()) and rol = 'dueno'))
  with check (exists (select 1 from perfiles where id = (select auth.uid()) and rol = 'dueno'));

-- Colegios: sede que los atiende y dónde están (ciudad, carretera o pueblo por el río).
alter table colegios
  add column sede text not null default 'nauta' references sedes (id),
  add column zona text not null default 'ciudad' check (zona in ('ciudad', 'carretera', 'rio'));
update colegios set sede = 'iquitos' where ciudad ilike 'iquitos%';

-- Pedidos: toman la sede del colegio si no se indica otra.
alter table pedidos add column sede text references sedes (id);
update pedidos p set sede = c.sede from campanas k join colegios c on c.id = k.colegio_id where k.id = p.campana_id;
alter table pedidos alter column sede set not null;
create index pedidos_sede_idx on pedidos (sede);

create function sede_del_pedido() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.sede is null then
    select c.sede into new.sede from campanas k join colegios c on c.id = k.colegio_id where k.id = new.campana_id;
  end if;
  return new;
end;
$$;
create trigger pedidos_sede before insert on pedidos for each row execute function sede_del_pedido();

-- Caja: cada sede tiene su caja y su cierre diario.
alter table movimientos_caja add column sede text not null default 'nauta' references sedes (id);
create index movimientos_caja_sede_idx on movimientos_caja (sede, fecha);
alter table cierres_caja add column sede text not null default 'nauta' references sedes (id);
alter table cierres_caja drop constraint cierres_caja_pkey;
alter table cierres_caja add primary key (fecha, sede);

-- La vista de saldos expone la sede para filtrar deudores y reportes.
create or replace view pedidos_saldo with (security_invoker = true) as
select p.id, p.numero, p.campana_id, p.alumno_id, p.estado, p.total,
       coalesce(sum(pg.monto) filter (where pg.estado = 'confirmado'), 0) as pagado,
       p.total - coalesce(sum(pg.monto) filter (where pg.estado = 'confirmado'), 0) as saldo,
       p.sede
from pedidos p
left join pagos pg on pg.pedido_id = p.id
group by p.id;
