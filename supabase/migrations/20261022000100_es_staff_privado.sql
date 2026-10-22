-- Saca es_staff() del esquema expuesto por la API y deja el catálogo público sin depender de ella.

create schema if not exists privado;
grant usage on schema privado to authenticated;

create function privado.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = (select auth.uid()));
$$;
revoke execute on function privado.es_staff() from public, anon;
grant execute on function privado.es_staff() to authenticated;

alter policy "staff lee perfiles" on perfiles using (privado.es_staff());
alter policy "staff colegios" on colegios using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff campanas" on campanas using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff alumnos" on alumnos using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff fotos" on fotos using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff pedidos" on pedidos using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff pedido_items" on pedido_items using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff pagos" on pagos using (privado.es_staff()) with check (privado.es_staff());
alter policy "staff edita catalogo" on productos using (privado.es_staff()) with check (privado.es_staff());

drop policy "catalogo publico" on productos;
create policy "catalogo publico" on productos for select to anon, authenticated using (activo);

alter policy "staff storage" on storage.objects
  using (bucket_id in ('originales', 'procesadas', 'vouchers') and privado.es_staff())
  with check (bucket_id in ('originales', 'procesadas', 'vouchers') and privado.es_staff());

drop function public.es_staff();
