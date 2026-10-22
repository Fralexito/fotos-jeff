-- Categorías del catálogo (como en la página web). Solo las promociones se dividen por nivel.
alter table productos add column categoria text not null default 'otro'
  check (categoria in ('promocion', 'graduacion', 'carnet', 'otro'));
update productos set categoria = 'carnet' where codigo ilike '%carnet%' or nombre ilike '%carnet%';
update productos set nivel = null where categoria <> 'promocion';
