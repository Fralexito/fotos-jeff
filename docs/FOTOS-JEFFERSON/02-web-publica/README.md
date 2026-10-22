# 02 · Web pública

Sitio para padres y colegios: ver el catálogo, elegir y pedir por WhatsApp a la sede correcta.

- URL: **https://fotos-jefferson.vercel.app**
- Código: carpeta `web-publica/` del repo.
- **Separada del panel** a pedido de FADG (todavía no quiere unirlas). Los precios viven en el código, no en la base.

## Tecnología

Vite 5 + React 18, `motion` (animaciones), `lenis` (scroll suave), fuentes locales Archivo, Inter y Cormorant Garamond (`@fontsource`). `vite-plugin-singlefile` genera **un solo** `dist/index.html` con todo dentro.

## Páginas (rutas con `#/`)

| Ruta | Página |
|---|---|
| `#/` | Inicio: portada oscura cálida y formulario "Cotiza en 1 minuto" (para mi hijo / para un colegio) |
| `#/catalogo` | Catálogo por categoría: Promociones (por nivel: inicial, primaria, secundaria, superior), Graduaciones, Carnets, Extras |
| `#/precios` | Paquetes (Esencial, etc.) |
| `#/proceso` | "Cómo trabajamos": 4 pasos con animación en PC; en celular o con animaciones reducidas, versión estática (cuadro arriba, pasos en lista) |
| `#/nosotros` | Historia y trayectoria |
| `#/contacto` | Dos formularios: pedido individual (padre) y pedido para un colegio |

Cada formulario pide **sede** (Nauta / Iquitos Liz / Iquitos Dan) y **desde dónde** (ciudad, carretera Iquitos–Nauta, pueblo por el río + nombre del lugar). Al enviar, abre WhatsApp de esa sede con el mensaje ya escrito, que empieza con `[Sede X · Encargado]`.

## Datos editables (en `web-publica/src/App.jsx`)

| Constante | Qué es |
|---|---|
| `SEDES` | Nombre, encargado, WhatsApp (`wa`, formato `51` + número) y teléfono. **Hoy son números de ejemplo** |
| `WA` | WhatsApp general |
| `PAGES` | Menú |
| `LEVELS`, `CATS` | Niveles y categorías |
| `ITEMS` | Productos: categoría, nivel, título, descripción, precio en soles (de ejemplo) |
| `PACKS` | Paquetes |

## Estilo (decisiones de FADG)

- Varias páginas (6), nada de "estilo genérico de IA".
- Base elegida: ejemplo editorial tipo ATRIUM (cabecera blanca flotante, mosaico de fichas en movimiento), luego **más compacto, cálido y familiar**.
- Formularios estilo tarjeta blanca, campos con borde, botón sólido (portadas 4/5).
- Rechazó el hero oscuro 3D complejo. Versiones descartadas en la carpeta del proyecto `web/` (portadas 1–9, sitio-simple).

## Desarrollo y despliegue

```bash
cd web-publica
npm install
npm run dev        # local
npm run build      # dist/index.html (un solo archivo)
```

Vercel: proyecto aparte **"fotos-jefferson"** (`prj_5eW7SiSejPQo6srqQ6et6X5Klqdu`), conectado al mismo repo con **Root Directory = `web-publica`**, framework Vite, salida `dist`. Autodeploy desde `main`.

## Unir con el panel (futuro, solo cuando FADG lo pida)

Leer `productos` (activo = true, categoria, nivel, precio) con la clave publicable; la RLS ya permite lectura `anon` de los activos. Los paquetes son `productos.es_combo = true`.
