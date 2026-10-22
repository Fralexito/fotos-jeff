-- Catálogo ordenado por nivel educativo. Vacío = sirve para todos los niveles.
alter table productos add column nivel text check (nivel in ('inicial', 'primaria', 'secundaria', 'superior'));
