# 04 · Programa de PC "FOTOS JEFFERSON Estudio"

Programa instalable para Windows, con interfaz gráfica, para editar, organizar y producir las fotos. Es **además** del panel web, no lo reemplaza.

**Estado (22-oct-2026):** diseño aprobado por FADG ("Si"); la construcción empezó el mismo día. Este archivo recoge el diseño y las decisiones; el código, cuando exista, irá en el repo.

## Usuarios

FADG, su tío y los encargados de sede.

## Requisitos de FADG

- Estilo parecido a **Lightroom/Photoshop pero más simple**, rápido, dinámico e intuitivo, y a la vez **muy completo y profesional**. La interfaz es MUY importante.
- **Organización total:** colegio → salón → alumno → tamaño.
- **Tamaños:** presets de los cuadros más usados **y** medida libre editable (cualquier cm y DPI).
- **Funciona sin internet** y sincroniza con el panel web cuando hay conexión (sube resultados, recibe fotos de las sedes).
- **Google Drive** con carpetas ordenadas para que las sedes vean, descarguen y editen (ver [drive_y_pendientes.md](drive_y_pendientes.md)). Drive gratis = 15 GB (≈1 500 originales); probablemente haga falta plan de pago (desde ~S/ 8/mes).
- **IA generativa conectable** con clave propia (OpenAI, Gemini u otra), eligiendo qué IA hace cada trabajo. Prompts propios + recetas listas combinables ([recetas_ia.md](recetas_ia.md)).
- **Blindado:** prever todos los riesgos (errores, cortes de luz, pérdida de datos) y prevenirlos.

## Regla de rostros (versión final)

- 0 % de cambio en rasgos faciales, corporales o fenotípicos.
- Permitido: mejorar calidad, corregir detalles leves de piel; con IA, correcciones leves (abrir ojos cerrados, enderezar cabeza, postura).
- Diseño: rasgos bloqueados, **verificación de identidad** contra el original después de cada cambio (si no coincide, se descarta solo) y el **original guardado siempre**.

## Pantallas (diseño aprobado)

Maquetas: https://claude.ai/artifact/GqujG9fp5tPfQg9YSGgPSk (ronda 1 "muy simple": A estudio oscuro, B claro por pasos, C una por una; ronda 2 profesional en el mismo enlace).

1. **Biblioteca:** árbol colegio/salón/alumno con tamaños, pagos y estado. Importa la lista de alumnos y reparte cada foto a su alumno.
2. **Editor:** ajustes tipo Lightroom, capas, barra para pedir cambios a la IA con texto, recetas como botones.
3. **Producción:** lo que falta imprimir por tamaño, hojas de carnets A4 armadas, entregas por salón, envío a Drive.
4. **IA:** claves de cada proveedor y qué IA hace qué trabajo.

## Blindaje previsto

Originales nunca se tocan · autoguardado continuo (corte de luz sin pérdida) · si falla internet/Drive/IA sigue trabajando y reintenta · pruebas automáticas con fotos reales antes de cada versión · errores explicados en palabras simples y registrados · doble respaldo (Drive no es respaldo: disco externo con copia nocturna).

## Plan de construcción

1. Base: base de datos local, medidas con presets, importar sin tocar originales.
2. Biblioteca: colegio, salón y alumno, asignar fotos, lista de alumnos.
3. Edición con el motor local ([03-motor-edicion](../03-motor-edicion/README.md) es el núcleo) y semáforo.
4. Recetas de IA con la clave del usuario y verificación de rasgos.
5. Producción: tamaños, hojas de carnets, carpeta de Drive.
6. Instalador para Windows y prueba en la PC de FADG.

**Nota técnica:** la IA de imagen devuelve fotos pequeñas (~1 MP); para 20x30 a 300 DPI el paso a HD lo hace el programa en la PC.

## Archivos de esta carpeta

- [recetas_ia.md](recetas_ia.md): 10 recetas de prompts combinables + reglas fijas de identidad y salida (basadas en el prompt de recorte que funcionó en ChatGPT).
- [drive_y_pendientes.md](drive_y_pendientes.md): orden de carpetas en Drive, nombre de archivos, permisos por sede y 12 cosas a considerar.
