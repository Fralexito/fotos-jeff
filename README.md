# Fotos Jeff

Plataforma del negocio de fotografía escolar Fotos Jeff (Nauta e Iquitos, Loreto, Perú):
promociones, graduaciones y carnets.

Objetivo: modernizar un negocio con décadas de trayectoria, con pantallas mínimas y la mayor
automatización posible.

## Partes

| Carpeta | Qué es |
|---|---|
| `src/app/` | Web pública y panel de gestión (Next.js, App Router) |
| `src/lib/supabase/` | Clientes de Supabase para navegador y servidor |
| `supabase/migrations/` | Esquema SQL compartido (colegios, alumnos, pedidos, fotos) |
| `pipeline/` | Edición automática de fotos en lote (Python) |
| `docs/` | Propuestas y decisiones |

Las tres partes usan **un solo proyecto de Supabase** (Postgres + Storage + Auth) para no duplicar listas.

## Empezar

```bash
cp .env.example .env.local   # y rellenar con los datos de Supabase
npm install
npm run dev                  # http://localhost:3000
```

Pipeline de edición:

```bash
cd pipeline
pip install -r requirements.txt
python pipeline_fotos.py foto.jpg salida.jpg --producto 15x21
```

## Panel de gestión (`/panel`)

CRM + ERP del estudio: colegios, campañas, alumnos, pedidos, cobros y catálogo.

| Rol (`perfiles.rol`) | Ve |
|---|---|
| `dueno` | Todo: inicio con lo cobrado y por cobrar, cobros, catálogo |
| `operador` | Inicio, colegios y alumnos, pedidos y cobros |
| `fotografo` | Inicio y colegios/alumnos (sin dinero) |

Dar acceso a una persona:

1. Supabase > Authentication > Users > *Add user* (correo y contraseña).
2. En el SQL Editor: `insert into perfiles (id, nombre, rol) values ('<id del usuario>', 'Nombre', 'operador');`

Los pagos en efectivo quedan confirmados al anotarlos; los de Yape y Plin quedan *por verificar* hasta que
alguien confirme en Cobros que llegaron al celular del negocio.

## Despliegue

- Web: Vercel, conectado a este repositorio.
- Datos y fotos: Supabase.
