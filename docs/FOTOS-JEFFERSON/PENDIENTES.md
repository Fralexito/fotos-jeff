# Pendientes (al 22-oct-2026)

## Urgente
- [ ] **Rotar la clave secreta de Supabase**: se pegó en un chat. Supabase → Settings → API Keys → nueva *secret key* → pegarla en `motor.env` de la PC (y en Vercel si se usa) → borrar la vieja.

## Panel web
- [ ] Cargar datos reales: colegios, campañas, alumnos, precios del catálogo.
- [ ] Probar el flujo completo de fotos subiendo un lote real en `/panel/fotos`.
- [ ] Crear usuarios para Liz y otros encargados cuando lo pidan.

## Web pública
- [ ] Poner el **WhatsApp real de cada sede** (`SEDES` en `web-publica/src/App.jsx`); hoy son de ejemplo y los pedidos no llegan a nadie.
- [ ] Precios, dirección e historia reales.
- [ ] Unir con el panel (leer `productos`) **solo cuando FADG lo pida**.

## Motor de edición
- [ ] Quitar el cartel pegado al cuerpo (caso SARA) y arrugas finas de la toga.
- [ ] Color: la toga a veces vira a morado; birrete roto en fondos cargados.
- [ ] Velocidad: el matting en CPU es el cuello de botella (~35–40 s/foto); evaluar ViTMatte en GPU.
- [ ] Calibrar encuadre con los marcos reales (rebaje de moldura por tamaño).

## Programa de PC
- [ ] Construirlo según [04-programa-pc](04-programa-pc/README.md) (empezado el 22-oct).
- [ ] Definir presets de tamaños más usados con FADG.
- [ ] Decidir plan de Google Drive (espacio) y respaldo en disco externo.

## Marketing
- [ ] Validar costos con el proveedor y número de colegios con ESCALE.
- [ ] Ejecutar el plan de 90 días (lista maestra, WhatsApp Business, muestras).
