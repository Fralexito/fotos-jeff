# Base de datos (Supabase "Fotos Jefferson")

- Proyecto: ref `eaubdmwvqijgtdlevuje`, región `sa-east-1` (São Paulo), plan gratis.
- **Fuente de verdad:** los archivos de `supabase/migrations/` del repo. Este documento los resume.
- Nombres en **español** y `snake_case` (el esquema real aplicado; los documentos antiguos en inglés quedaron obsoletos).

## Reconstruir

Aplicar en este orden (todas aplicadas en producción, verificado el 2026-10-22):

| # | Archivo | Qué crea |
|---|---|---|
| 1 | `20261022000000_esquema_inicial.sql` | Tipos, perfiles, colegios, campañas, alumnos, fotos, productos, pedidos, items, pagos, vista `pedidos_saldo`, RLS, buckets |
| 2 | `20261022000100_es_staff_privado.sql` | Mueve `es_staff()` al esquema `privado` (aviso de seguridad) |
| 3 | `20261022050000_preferencias_perfil.sql` | `perfiles.preferencias jsonb` |
| 4 | `20261022060000_crm_erp.sql` | CRM (contactos, oportunidades, actividades, tareas) y ERP (caja, cierres, inventario) |
| 5 | `20261022140000_motor_fotos.sql` | Cola del motor: columnas en `fotos`, `campanas.fondo_rgb`, RPC `tomar_fotos` |
| 6 | `20261022150000_nivel_productos.sql` | `productos.nivel` |
| 7 | `20261022160000_sedes.sql` | Tabla `sedes`, sede en colegios, pedidos y caja |
| 8 | `20261022170000_categoria_productos.sql` | `productos.categoria` |
| 9 | `20261022180000_sede_iquitos2.sql` | Tercera sede `iquitos2` |

Con la CLI: `supabase link --project-ref <ref>` y `supabase db push`. Sin CLI: pegar cada archivo en el SQL Editor, en orden.

## Tipos (enums)

| Tipo | Valores |
|---|---|
| `rol_staff` | dueno, operador, fotografo |
| `tipo_campana` | promocion, graduacion, carnet, otro |
| `estado_campana` | planificada, en_captura, en_edicion, en_entrega, cerrada |
| `estado_foto` | subida, procesando, procesada, excepcion, aprobada, rechazada |
| `estado_pedido` | pendiente, procesado, en_impresion, entregado, anulado |
| `metodo_pago` | efectivo, yape, plin, transferencia, tarjeta |
| `estado_pago` | por_verificar, confirmado, rechazado |
| `cargo_contacto` | director, subdirector, docente, comite, padre, otro |
| `etapa_oportunidad` | nuevo, contactado, reunion, propuesta, ganado, perdido |
| `tipo_actividad` | llamada, whatsapp, visita, reunion, nota |
| `tipo_movimiento` | ingreso, egreso |
| `motivo_inventario` | compra, uso, ajuste |

## Tablas

**Gestión escolar**

| Tabla | Columnas clave |
|---|---|
| `perfiles` | id (= auth.users.id), nombre, telefono, rol, preferencias jsonb |
| `sedes` | id (`nauta`, `iquitos`, `iquitos2`), nombre, encargado, telefono, direccion, orden |
| `colegios` | codigo único corto (para nombres de archivo), nombre, ciudad, director, contacto, **sede**, **zona** (ciudad/carretera/rio) |
| `campanas` | colegio_id, anio, tipo, nombre, estado, fecha_captura, fecha_entrega, producto_principal (`15x21`), **fondo_rgb** (`107,201,237`) |
| `alumnos` | campana_id, **codigo** (único por campaña; va en QR/cartel), nombres, apellidos, grado, seccion, dni, apoderado_nombre, apoderado_telefono |
| `fotos` | campana_id, alumno_id, ruta_original (bucket originales), ruta_procesada, ruta_vista, producto (una o varias medidas separadas por coma), estado, qa jsonb, motivo_excepcion, es_principal, intentos, tomada_en, tomada_por, revisada_por/en |

**Ventas**

| Tabla | Columnas clave |
|---|---|
| `productos` | codigo, nombre, descripcion, precio, es_combo, activo, **categoria** (promocion/graduacion/carnet/otro), **nivel** (inicial/primaria/secundaria/superior, solo promociones) |
| `pedidos` | numero (corto, autoincremental), campana_id, alumno_id, **sede** (si falta, la toma del colegio por trigger), estado, total, entregado_en (trigger) |
| `pedido_items` | pedido_id, producto_id, foto_id, cantidad, precio_unitario |
| `pagos` | pedido_id, monto, metodo, estado (efectivo → confirmado; Yape/Plin → por_verificar), ruta_voucher, operacion, registrado_por |
| vista `pedidos_saldo` | total, pagado (solo pagos confirmados), saldo, sede |

**CRM**: `contactos` (colegio, cargo, teléfono), `oportunidades` (embudo por etapa, monto y alumnos estimados, próxima acción, responsable), `actividades` (llamada/whatsapp/visita...), `tareas` (vence, hecha, asignado_a).

**ERP**: `movimientos_caja` (fecha Lima, ingreso/egreso, categoría, monto, método, **sede**), `cierres_caja` (PK fecha+sede; esperado, contado, diferencia calculada), `materiales` (stock, mínimo, costo), `movimientos_inventario` (trigger que actualiza el stock).

## Seguridad (RLS)

- RLS activado en **todas** las tablas.
- `privado.es_staff()`: el usuario tiene fila en `perfiles` → puede leer/escribir lo operativo.
- `privado.maneja_dinero()`: rol `dueno` u `operador` → caja y cierres.
- `sedes`: solo el `dueno` edita.
- `productos`: lectura pública (`anon`) de los activos (para la web pública a futuro); edición solo staff.
- RPC `tomar_fotos(p_motor, p_max)`: **solo `service_role`** (el motor). Usa `FOR UPDATE SKIP LOCKED` para que dos PCs no tomen la misma foto; si una queda "procesando" >20 min vuelve a la cola; al 3.er fallo pasa a excepción.

## Storage (buckets privados)

| Bucket | Contenido |
|---|---|
| `originales` | Fotos de cámara subidas desde el panel |
| `procesadas` | Salidas a 300 DPI por medida y `vistas/` (previas livianas de 1200 px) |
| `vouchers` | Capturas de Yape/Plin |

Acceso: staff autenticado. El panel muestra archivos con URLs firmadas.

## Notas operativas

- El conector de Supabase pide confirmación ante `DROP` y puede expirar: preferir `alter`/`revoke`.
- Plan gratis: máximo 2 proyectos activos por dueño.
- Tras cambios de esquema, revisar *Advisors* de seguridad (deben quedar limpios).
