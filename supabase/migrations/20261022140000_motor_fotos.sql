-- Cola de edición: la tabla fotos es la cola. El panel sube la foto (estado 'subida') y el motor
-- de la PC del estudio la toma, la procesa y escribe el resultado. Sin tabla aparte: una foto
-- vuelve a la cola con solo poner estado = 'subida' (botón "volver a procesar").

alter table campanas add column fondo_rgb text not null default '107,201,237'
  check (fondo_rgb ~ '^\d{1,3},\d{1,3},\d{1,3}$');  -- color del fondo liso de la campaña (celeste del estudio)

alter table fotos
  add column ruta_vista text,                       -- vista previa liviana (bucket "procesadas", carpeta vistas/)
  add column intentos smallint not null default 0,
  add column tomada_en timestamptz,                -- cuándo la tomó el motor
  add column tomada_por text;                      -- nombre de la PC que la procesa

create index fotos_cola_idx on fotos (creado_en) where estado = 'subida';

-- Toma hasta p_max fotos pendientes sin chocar con otra PC (FOR UPDATE SKIP LOCKED).
-- Una foto que quedó "procesando" más de 20 min (PC apagada a medias) vuelve a la cola;
-- al tercer intento pasa a excepción para que una persona la mire.
create function public.tomar_fotos(p_motor text, p_max int default 1)
returns table (id uuid, campana_id uuid, ruta_original text, producto text, fondo_rgb text)
language plpgsql security definer set search_path = public as $$
begin
  update fotos f set estado = case when f.intentos >= 3 then 'excepcion'::estado_foto else 'subida'::estado_foto end,
                     motivo_excepcion = case when f.intentos >= 3 then 'el motor falló 3 veces con esta foto' else f.motivo_excepcion end
  where f.estado = 'procesando' and f.tomada_en < now() - interval '20 minutes';

  return query
  with elegidas as (
    select f.id from fotos f
    where f.estado = 'subida'
    order by f.creado_en
    for update skip locked
    limit greatest(1, least(p_max, 20))
  )
  update fotos f set estado = 'procesando', tomada_en = now(), tomada_por = p_motor, intentos = f.intentos + 1
  from elegidas e, campanas c
  where f.id = e.id and c.id = f.campana_id
  returning f.id, f.campana_id, f.ruta_original, f.producto, c.fondo_rgb;
end;
$$;
revoke execute on function public.tomar_fotos(text, int) from public, anon, authenticated;
grant execute on function public.tomar_fotos(text, int) to service_role;
