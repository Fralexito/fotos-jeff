# FOTOS JEFFERSON · Manual maestro

Manual de todo lo construido hasta el **22 de octubre de 2026**. Sirve para dos cosas:

1. Que una persona nueva entienda el negocio y los sistemas.
2. Que Claude u otra IA pueda **reconstruir todo idéntico** (leer en el orden de abajo).

> Nunca guardes aquí claves, contraseñas ni tokens. Donde haga falta una, se indica *dónde* sacarla.

## Carpetas

| Carpeta | Sistema | Estado |
|---|---|---|
| [`01-panel-web/`](01-panel-web/README.md) | Panel de gestión (CRM + ERP + Fotos) en Next.js + Supabase + Vercel | En uso |
| [`01-panel-web/base-de-datos.md`](01-panel-web/base-de-datos.md) | Esquema de Supabase (tablas, roles, seguridad) | Aplicado |
| [`02-web-publica/`](02-web-publica/README.md) | Web pública de catálogo y pedidos por WhatsApp | Publicada |
| [`03-motor-edicion/`](03-motor-edicion/README.md) | Motor de edición automática de fotos (Python, PC con GPU) | Instalado y conectado |
| [`04-programa-pc/`](04-programa-pc/README.md) | Programa de escritorio "FOTOS JEFFERSON Estudio" | Diseño aprobado, en construcción |
| [`05-marketing/`](05-marketing/README.md) | Plan de marketing y modelo de negocio | Entregado |
| [`PENDIENTES.md`](PENDIENTES.md) | Lo que falta, por sistema | Vivo |
| [`MEMORIA-PARA-IA.md`](MEMORIA-PARA-IA.md) | Texto corto para pegar como memoria/contexto en cualquier IA | Vivo |

## El negocio

- **Nombre:** FOTOS JEFFERSON (siempre así en todo lo público; nunca "Fotos Jeff").
- **Rubro:** fotografía escolar en Loreto, Perú: promociones (por nivel: inicial, primaria, secundaria, superior), graduaciones, carnets/fotochecks y extras.
- **Producto físico:** cuadros con vidrio y marco (15x21, 20x30 y otros) y carnets. Un error de milímetros en el corte arruina el margen.
- **Historia:** décadas operando de forma artesanal (Photoshop manual, sin control de ventas). El dueño es el abuelo, persona mayor muy conocida en Nauta.
- **Meta:** modernizar, ahorrarle tiempo y estrés al abuelo, y poder contratar personal.
- **Quién usa el sistema:** sobre todo jóvenes capacitados (familia y futuros empleados). El abuelo solo necesita una vista simple ("Resumen del día").
- **Responsable técnico del proyecto:** FADG (GitHub `Fralexito`).

### Sedes

| id | Sede | Encargado |
|---|---|---|
| `nauta` | Nauta | Jefferson Gómez Tuesta (el abuelo, dueño) |
| `iquitos` | Iquitos (Liz) | Liz Nery Gómez Ríos |
| `iquitos2` | Iquitos (Dan) | Dan Jefferson Gómez Ríos (sede distinta a la de Liz) |

También llegan pedidos de zonas aledañas: carretera Iquitos–Nauta y pueblos por los ríos (`zona`: `ciudad`, `carretera`, `rio`). **Todo pedido o formulario registra su sede.**

## Reglas fijas (no negociables)

1. **Rostros:** 0 % de cambio en rasgos faciales, corporales o fenotípicos. Solo se permite mejorar calidad, corregir detalles leves de piel y, con IA, correcciones leves (abrir ojos, enderezar cabeza/postura) con verificación de identidad y original siempre guardado.
2. **Estilo de foto aprobado:** corte limpio (sobre todo el cabello) sobre **fondo liso**, sin brillos ni resplandor. Fondo por defecto del estudio: celeste `107,201,237`.
3. **Simplicidad visual:** "me mareo con cada cosa en la pantalla". Todo arranca en *Vista sencilla*; lo secundario se oculta.
4. **Respuestas al usuario:** muy cortas, resultado primero.
5. **Antes de construir algo grande nuevo:** preguntar diseño y requisitos, mostrar maquetas y esperar visto bueno.
6. **Autonomía:** en GitHub y Supabase actuar sin pedir permiso e informar después, salvo borrar datos reales, costos o cambios irreversibles.
7. **Secretos:** nunca en el repo ni en el chat. La clave secreta de Supabase solo vive en `motor.env` de la PC y en Vercel.

## Mapa de la arquitectura

```
                 ┌──────────────── Supabase "Fotos Jefferson" (São Paulo) ────────────────┐
                 │ Postgres (tablas + RLS)   Auth (usuarios)   Storage: originales,        │
                 │                                             procesadas, vouchers        │
                 └───────▲───────────────────────▲───────────────────────▲─────────────────┘
                         │ sesión del usuario     │ clave secreta          │ (futuro: solo lectura)
   Panel /panel (Next.js, Vercel gru1)     Motor de edición (PC con GPU)    Web pública (Vite, Vercel)
   fotos-jeff.vercel.app/panel             C:\dev\fotos-jeff-motor           fotos-jefferson.vercel.app
   CRM + ERP + Fotos (subir, semáforo)     toma la cola `fotos` y edita      catálogo + WhatsApp por sede
                                                    ▲
                                    Programa de PC (en construcción): biblioteca offline,
                                    editor, IA con clave propia, Google Drive por sede
```

## Recursos

| Recurso | Dónde |
|---|---|
| Repositorio | `github.com/Fralexito/fotos-jeff` (privado). Rama principal `main`, cambios por PR. |
| Panel | https://fotos-jeff.vercel.app/panel (Vercel, autodeploy desde `main`) |
| Web pública | https://fotos-jefferson.vercel.app (Vercel aparte, Root Directory `web-publica/`) |
| Supabase | Proyecto "Fotos Jefferson", ref `eaubdmwvqijgtdlevuje`, región `sa-east-1`, plan gratis |
| Motor en la PC | `C:\dev\fotos-jeff-motor\pipeline` → doble clic en `iniciar_motor.bat` |
| Fotos reales de referencia | `D:\Users\Alexander\Pictures\FOTOS PROMO PAPA JEFF 2024`, `... 2025 PAPA JEFF`, `... 2026 PAPA JEFF` |
| Documentos de diseño (Claude) | Ver enlaces en cada carpeta |

**Ojo:** la organización de Supabase y la cuenta de Vercel se comparten con otro proyecto ajeno (Phoenix Evolution / Galaxy League). **No tocarlo.**

## Cómo reconstruir todo desde cero (resumen)

1. Clonar `Fralexito/fotos-jeff`.
2. Crear proyecto Supabase (región São Paulo) y aplicar `supabase/migrations/*.sql` **en orden de nombre** → ver [base-de-datos.md](01-panel-web/base-de-datos.md).
3. Crear el primer usuario en Auth y su fila en `perfiles` con `rol = 'dueno'`.
4. Panel: proyecto Vercel desde la raíz del repo, región `gru1`, variables de [01-panel-web](01-panel-web/README.md#variables-de-entorno).
5. Web pública: segundo proyecto Vercel con Root Directory `web-publica` → [02-web-publica](02-web-publica/README.md).
6. Motor: en la PC con GPU NVIDIA, carpeta `pipeline/`, venv, `motor.env` → [03-motor-edicion](03-motor-edicion/README.md).
7. Programa de PC y marketing: leer sus carpetas (diseño y decisiones).

## Historial de cambios (PRs fusionados en `main`)

| PR | Qué |
|---|---|
| #1 | Panel: login con roles, inicio, colegios/alumnos, pedidos, cobros, catálogo |
| #2–#4 | Diseño profesional, paleta turquesa `#2a97a8`, Ajustes personalizables, búsqueda global, menú Nuevo |
| #5 | CRM (Clientes) + ERP (Producción, Caja, Inventario, Reportes) |
| #6 | Vista sencilla por defecto, colores por sección |
| #7 | Rapidez: Vercel en São Paulo, una consulta de perfil por página |
| #8 | Colegios en árbol + Tabla general tipo Excel |
| #9 | Pipeline: medidas libres, DPI, birrete sólido, uniforme limpio |
| #10 | Motor: cola en la tabla `fotos` y worker para la PC |
| #11 | Sección Fotos: subir, semáforo, aprobar |
| #12–#13 | Nombre FOTOS JEFFERSON, catálogo por nivel/categoría, sedes |
| #14–#19 | Web pública, tercera sede, arreglos de la página "Cómo trabajamos" |
| #20 | Motor acepta la clave nueva `sb_secret_` |
| #21 | Arreglo de botones Aprobar/Rechazar en Fotos |
| #22 | Resumen del día, ficha del alumno, cobro por WhatsApp en lote, calendario |
