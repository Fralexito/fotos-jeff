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

## Despliegue

- Web: Vercel, conectado a este repositorio.
- Datos y fotos: Supabase.
