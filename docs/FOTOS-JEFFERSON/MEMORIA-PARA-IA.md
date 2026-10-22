# Memoria para IA (pegar como contexto)

Copia el bloque de abajo en la memoria, instrucciones o primer mensaje de Claude, ChatGPT, Gemini u otra IA. Luego dale acceso a este manual (`docs/FOTOS-JEFFERSON/` del repo).

```
Proyecto: FOTOS JEFFERSON (nombre exacto; nunca "Fotos Jeff"). Fotografía escolar en Loreto, Perú: promociones (inicial, primaria, secundaria, superior), graduaciones, carnets. Décadas de trayectoria con operación artesanal; el dueño es el abuelo (persona mayor, muy conocido en Nauta). Meta: modernizar, ahorrarle tiempo y poder contratar personal.

Sedes: nauta (Jefferson Gómez Tuesta, dueño), iquitos (Liz Nery Gómez Ríos), iquitos2 (Dan Jefferson Gómez Ríos). También zonas aledañas: carretera y pueblos por el río. Todo pedido registra su sede.

Yo soy FADG (GitHub Fralexito), nieto y responsable técnico. Respóndeme MUY corto, resultado primero. Antes de construir algo grande nuevo, muéstrame opciones de diseño y espera mi visto bueno. En GitHub y Supabase actúa sin pedir permiso e infórmame después, salvo borrar datos, gastar dinero o cambios irreversibles.

Sistemas:
1) Panel web /panel (CRM + ERP + Fotos): Next.js 15 + Supabase, Vercel región gru1. https://fotos-jeff.vercel.app/panel. Roles dueno/operador/fotografo. Vista sencilla por defecto; paleta turquesa #2a97a8.
2) Supabase "Fotos Jefferson" ref eaubdmwvqijgtdlevuje (São Paulo). Esquema en español en supabase/migrations (9 migraciones). Buckets: originales, procesadas, vouchers.
3) Web pública Vite+React en web-publica/, https://fotos-jefferson.vercel.app, separada del panel. Pedidos por WhatsApp por sede (números aún de ejemplo).
4) Motor de edición Python (pipeline/) en la PC con GPU: C:\dev\fotos-jeff-motor, iniciar_motor.bat. BiRefNet para silueta, todo lo demás determinista. Toma la cola de la tabla fotos (RPC tomar_fotos), semáforo verde/amarillo/rojo.
5) Programa de PC "FOTOS JEFFERSON Estudio" (en construcción): tipo Lightroom simplificado, offline + sync, Google Drive por sede, IA generativa con clave propia, presets de tamaños + medida libre.
6) Plan de marketing: paquetes S/40, S/70, S/120; ver docs.

Reglas de fotos: 0 % de cambio en rasgos faciales, corporales o fenotípicos. Solo mejorar calidad y detalles leves de piel; con IA, correcciones leves (ojos, cabeza, postura) con verificación de identidad y original guardado. Estilo: corte limpio del cabello, fondo liso (celeste 107,201,237), sin resplandor. 300 DPI, headroom para el birrete, cuerpo anclado a la base.

Se trabaja desde DOS cuentas de Claude que no comparten memoria: la fuente de verdad es main en GitHub. Sigue docs/FOTOS-JEFFERSON/TRABAJO-DOS-CUENTAS.md (rama por tarea desde main, anotar en EN-CURSO.md, un cambio de Supabase a la vez con migración fechada, fusionar y actualizar este archivo y PENDIENTES.md al terminar).

Nunca escribas claves ni contraseñas en el repo ni en chats.
```

## Orden de lectura para reconstruir

1. [README.md](README.md) (negocio, reglas, mapa)
2. [01-panel-web/base-de-datos.md](01-panel-web/base-de-datos.md) y [01-panel-web/README.md](01-panel-web/README.md)
3. [03-motor-edicion/README.md](03-motor-edicion/README.md)
4. [02-web-publica/README.md](02-web-publica/README.md)
5. [04-programa-pc/README.md](04-programa-pc/README.md), [05-marketing/README.md](05-marketing/README.md)
6. [PENDIENTES.md](PENDIENTES.md), [EN-CURSO.md](EN-CURSO.md) y [TRABAJO-DOS-CUENTAS.md](TRABAJO-DOS-CUENTAS.md)

## Mantener al día

Cada vez que se termine algo importante, actualizar la carpeta del sistema, `PENDIENTES.md` y el historial de PRs del `README.md`.
