# 01 · Panel web (CRM + ERP + Fotos)

Sistema interno del estudio. URL: **https://fotos-jeff.vercel.app/panel** (login en `/login`).

## Tecnología

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router, Server Components y Server Actions), React 19, TypeScript | Un solo código para PC y celular |
| Datos, login y archivos | Supabase (Postgres + Auth + Storage), paquetes `@supabase/ssr` y `@supabase/supabase-js` | Una sola base para panel, motor y web |
| Iconos | `lucide-react` | |
| Hosting | Vercel, región `gru1` (São Paulo, en `vercel.json`) junto a Supabase `sa-east-1` | Latencia mínima desde Perú |
| Estilos | CSS propio en `src/app/globals.css` (sin Tailwind), fuente local | Carga rápida |

## Estructura del código

```
src/
  middleware.ts                 refresca la sesión en /panel/* y /login
  lib/supabase/{client,server,middleware}.ts   clientes de Supabase
  lib/auth.ts                   requirePerfil(), roles y PERMISOS
  lib/preferencias.ts           ajustes visuales por persona (perfiles.preferencias)
  lib/sedes.ts                  SEDES y ZONAS
  lib/datos.ts                  `todas` (pagina >1000 filas), alumnosConPedidos
  lib/caja.ts, reportes.ts, formato.ts
  components/                   ui.tsx (PageHeader, etc.), hoja (tabla Excel), modal, imprimir, sparkline...
  app/login/                    página y acción de login
  app/panel/                    layout, nav, topbar y una carpeta por sección
  app/panel/actions.ts          acciones de colegios, alumnos, pedidos, pagos, catálogo, ajustes
  app/panel/acciones-erp.ts     CRM, producción, caja, inventario
  app/panel/acciones-fotos.ts   aprobar / rechazar / volver a editar, color de fondo
```

## Secciones (rutas)

| Ruta | Qué hace |
|---|---|
| `/panel` | Inicio: lo cobrado, por cobrar, gráfico y accesos grandes |
| `/panel/hoy` | **Resumen del día** (vista del abuelo): entradas por sede, deudas, entregas, fotos por aprobar, semana. Se refresca cada minuto |
| `/panel/clientes` | CRM: embudo de oportunidades (nuevo → contactado → reunión → propuesta → ganado/perdido), contactos, actividades, tareas |
| `/panel/colegios` | Árbol colegio → campaña → salón → alumnos (con deuda); importar lista de alumnos |
| `/panel/campanas/[id]` | Detalle de campaña |
| `/panel/alumnos/[id]` | Ficha del alumno: pedidos, pagos, fotos, hermanos, botones llamar/WhatsApp |
| `/panel/calendario` | Tomas, entregas y recordatorios; "Programar fechas" de una campaña |
| `/panel/tabla` | Tabla general tipo Excel (Alumnos, Pedidos, Pagos, Caja): ordenar, filtrar, totales, CSV |
| `/panel/fotos` | Subir fotos a la cola del motor, ver semáforo, aprobar/rechazar/volver a editar, color de fondo por campaña |
| `/panel/produccion` | Tablero de producción y entregas por salón |
| `/panel/pedidos/nuevo` | Nuevo pedido (toma la sede del colegio) |
| `/panel/cobros` | Pagos; Yape/Plin quedan *por verificar* hasta confirmar. `/panel/cobros/whatsapp`: cobro en lote, un mensaje por apoderado |
| `/panel/caja` | Movimientos y cierre diario **por sede** |
| `/panel/catalogo` | Productos por categoría (promoción por nivel, graduación, carnet, otro) |
| `/panel/inventario` | Materiales (marcos, vidrios, papel) y movimientos |
| `/panel/reportes` | Reportes; `/panel/reportes/deudores` descarga CSV |
| `/panel/buscar` | Búsqueda global |
| `/panel/ajustes` | Apariencia por persona y datos de sedes |
| `/panel/mas` | Todas las secciones (menú en celular) |

## Roles

| `perfiles.rol` | Ve |
|---|---|
| `dueno` | Todo, incluido Catálogo y edición de sedes |
| `operador` | Todo menos Catálogo: cobros, caja, pedidos, reportes, clientes |
| `fotografo` | Colegios/alumnos, fotos, producción (sin dinero) |

Definido en `src/lib/auth.ts` (`PERMISOS`) y reforzado en la base con RLS (`privado.es_staff()`, `privado.maneja_dinero()`).

## Diseño (decisiones de FADG)

- Paleta por defecto **turquesa suave `#2a97a8`**. Cada persona elige en Ajustes: color (turquesa, azul, verde, violeta, coral, grafito), tema claro/oscuro, letra normal/grande/muy grande, densidad, sede por defecto y vista.
- **Vista sencilla por defecto** con interruptor a *Completa*. En pantallas nuevas: marcar bloques secundarios con la clase `detalle` (se ocultan en vista sencilla) y pasar `modulo` a `PageHeader` para el color de la sección.
- Filtro de sede arriba ("Todas las sedes", Nauta, Iquitos (Liz), Iquitos (Dan)).
- Debe verse bien en PC y en celular.

## Variables de entorno

Archivo `.env.local` (local) y Environment Variables del proyecto en Vercel. Plantilla: `.env.example` en la raíz.

| Variable | Valor / de dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://eaubdmwvqijgtdlevuje.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **publicable** (`sb_publishable_...`), está en `.env.example` (es pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave **secreta**: Supabase → Settings → API Keys. Solo servidor. **Nunca** en el repo |
| `SUPABASE_BUCKET_ORIGINALES` | `originales` |
| `SUPABASE_BUCKET_PROCESADAS` | `procesadas` |

## Instalar y probar en local

```bash
git clone https://github.com/Fralexito/fotos-jeff && cd fotos-jeff
cp .env.example .env.local      # completar la clave secreta
npm install
npm run dev                     # http://localhost:3000/panel
npm run build                   # comprobar antes de un PR
```

## Despliegue

- Proyecto Vercel conectado a `Fralexito/fotos-jeff`, Root Directory = raíz, framework Next.js, región `gru1`.
- Cada merge a `main` se publica solo. Cada PR tiene su vista previa.
- IDs (no secretos): proyecto `prj_DHvIAL14x0aBObmy7jYlZIamQ3XC`, equipo `team_B5iJFt0TEJdwlndED4XDfGca`.

## Dar acceso a una persona

1. Supabase → Authentication → Users → *Add user* (correo y contraseña, marcar confirmado).
2. SQL Editor: `insert into perfiles (id, nombre, rol) values ('<id del usuario>', 'Nombre', 'operador');`
3. Pasarle la contraseña por un canal privado (no por el chat del proyecto).

Usuarios actuales: FADG (`dueno`) y Dan Gómez (`operador`). Las contraseñas no se documentan.

## Flujo de fotos en el panel

1. En **Fotos** se elige campaña y medidas; el navegador sube cada archivo directo al bucket `originales` y crea la fila en `fotos` con `estado = 'subida'`.
2. El motor de la PC la toma, la edita y la deja `procesada` (verde) o `excepcion` (amarillo/rojo) → ver [03-motor-edicion](../03-motor-edicion/README.md).
3. El panel muestra la vista previa (`ruta_vista`, URL firmada), el semáforo (`qa.semaforo`) y las alertas (`qa.alertas`).
4. Botones: **Aprobar** (`aprobada`), **Rechazar** (`rechazada`), **Volver a editar** (vuelve a `subida`). La acción viaja en un campo oculto del formulario (arreglo del PR #21).

Esquema completo de la base: [base-de-datos.md](base-de-datos.md).

## Tablero, equipos y asistente (22-oct-2026, PRs #34–#36)
- **Inicio (vista completa)**: meta del mes con anillo (tabla `metas`, una fila por sede y mes; la fija el dueño), caja de hoy, 4 tarjetas, evolución de ingresos 7/30/60 días con meta diaria, demanda por tipo. Datos en `src/lib/tablero.ts`. La vista sencilla no cambia.
- **Cámaras y equipos** (`/panel/equipos`, tabla `equipos`): por tipo y sede, estado, quién lo tiene, aviso de mantenimiento a 7 días.
- **Asistente IA** (`/panel/asistente`, solo dueño y operador): chat que responde con una foto de los datos del panel (sin teléfonos). Usa la API de Claude (`claude-opus-5-5`, esfuerzo bajo) y necesita `ANTHROPIC_API_KEY` en Vercel; sin la clave muestra un aviso.
