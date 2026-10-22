-- Segunda sede en Iquitos, a cargo de Dan Jefferson Gómez Ríos (separada de la de Liz Nery).
alter table sedes drop constraint sedes_id_check;
alter table sedes add constraint sedes_id_check check (id ~ '^[a-z0-9]+$');
insert into sedes (id, nombre, encargado, orden) values ('iquitos2', 'Iquitos 2', 'Dan Jefferson Gómez Ríos', 3)
on conflict (id) do update set nombre = excluded.nombre, encargado = excluded.encargado, orden = excluded.orden;
-- Las dos de Iquitos se distinguen por quién la atiende.
update sedes set nombre = 'Iquitos (Liz)' where id = 'iquitos';
update sedes set nombre = 'Iquitos (Dan)' where id = 'iquitos2';
