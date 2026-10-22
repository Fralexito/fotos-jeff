# FOTOS JEFFERSON Estudio

Programa de PC para organizar, editar y preparar para imprimir las fotos escolares.

**Instalar (Windows):** doble clic en `instalar_estudio.bat`. Crea el acceso directo «FOTOS JEFFERSON Estudio» en el escritorio.
Si el motor ya está instalado en `C:\dev\fotos-jeff-motor`, reutiliza su entorno (GPU incluida).

## Qué hace

| Pantalla | Para qué |
|---|---|
| Biblioteca | Campaña › colegio › salón › alumno. Importa de la cámara sin tocar la tarjeta, carga la lista del colegio (Excel/CSV), reparte las tomas por alumno, elige la toma, registra pedidos. |
| Editor | Foto en grande (original / editada / IA), 12 recetas de IA combinables + pedido propio, versiones con revisión de rasgos, aprobar con Espacio y rechazar con R. |
| Producción | Lo que falta imprimir por medida, avance por salón, hojas de carnets con marcas de corte, copia a Google Drive. |
| Ajustes | Medidas (presets y libres, cm + DPI), claves de IA (OpenAI, Gemini u otra compatible), límite de gasto, modelos. |

## Reglas que el programa no rompe

- Los originales nunca se modifican ni se borran (la importación solo lee la tarjeta y verifica cada copia con su hash).
- 0 % de cambios en rasgos de la cara, el cuerpo o la piel: las reglas fijas van en todo pedido a la IA, los pedidos que
  cambiarían a la persona se bloquean y cada resultado se compara con el original (forma de cara, proporciones, tono).
- Todo archivo se escribe a un temporal y se renombra al final; la base usa transacciones y copia diaria (`_copias_base`).
- Las claves de IA van al Administrador de credenciales de Windows, nunca a archivos ni a Drive.

## Pruebas

```
cd estudio
python -m pytest -q tests
```
