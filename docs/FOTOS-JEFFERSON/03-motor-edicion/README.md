# 03 · Motor de edición automática de fotos

Edita en lote los retratos de promoción/graduación: recorta al alumno con el cabello limpio, pone fondo liso, encuadra para el marco, corrige color y exporta a 300 DPI con un semáforo de calidad.

- Código: `pipeline/` del repo (`pipeline_fotos.py` = edición, `motor.py` = conexión con el panel).
- Corre en la **PC del estudio con GPU NVIDIA** (hoy: laptop de FADG con RTX 3050 6 GB). También funciona en CPU (más lento).

## Decisiones clave

| Decisión | Motivo |
|---|---|
| Sistema propio en Python, no ChatGPT | ChatGPT da color bonito pero solo ~1086x1448 px (≈9x12 cm a 300 DPI), suaviza piel y es foto por foto. El motor da resolución de impresión y cara fiel |
| IA **solo** para la silueta (BiRefNet_HR, licencia MIT; ISNet ONNX como modo ligero) | Lo demás es matemático y determinista: predecible y sin alterar rasgos |
| Evitar RMBG-2.0 e InsightFace | Licencias no comerciales |
| Motor local + panel web en la nube | El internet de Nauta no permite procesar en la nube; el panel solo sube y muestra |
| Estilo **plano**: corte limpio, fondo liso, sin resplandor | Elegido por FADG. Fondo del estudio: celeste `107,201,237` (por campaña, `campanas.fondo_rgb`) |

## Etapas del pipeline (`procesar()`)

1. **Segmentación (IA):** `segmentar_birefnet` (BiRefNet_HR a 2048 px, fp16 en GPU) o `segmentar_isnet` (ONNX, CPU). Salida: alfa inicial.
2. **Anclajes:** MediaPipe Face Landmarker (`face_landmarker.task`, se descarga solo) da cara, mentón, inclinación y hombros. Respaldo sin MediaPipe: perfil de anchos de la silueta.
3. **Solo el alumno:** se quedan las regiones conectadas al rostro (fuera mano del ayudante, cartel con el nombre, otra persona).
4. **Trimapa** por erosión/dilatación elíptica (radio ≈ 3,5 % del alto de cara) y **limpieza de huecos de pared** entre mechones (distancia de Mahalanobis en LAB al color del fondo).
5. **Matting del cabello:** forma cerrada de Levin (`pymatting.estimate_alpha_cf`) solo en la banda gris, a la mayor resolución que quepa (3 MP).
6. **Defringe:** se despeja el color real del primer plano con `I = αF + (1−α)B` (`estimate_foreground_ml`, Germer). Sin halos del fondo viejo.
7. **Borla dorada:** máscara LAB (L 45–92, b ≥ 25, −5 ≤ a ≤ 22, b/a ≥ 1,6) excluyendo píxeles parecidos al fondo, para que no se vuelva gris o transparente.
8. **Birrete sólido y uniforme limpio:** polígono desde el azul real del birrete; croma azul/dorado llevado a objetivo, plancha de pliegues por tela, toga opaca bajo los hombros (desactivable con `--sin-limpiar-uniforme`).
9. **Color en LAB** (`corregir_color`): CLAHE solo en L* de la toga, curva de sombras con pivote L=40, NLM en sombras, rodilla de altas luces en L>90 con `tanh`, croma comprimida con `tanh`. **La piel queda protegida** por máscara en todos los pasos.
10. **Geometría:** escala `s = max(k_h·H / alto(birrete→mentón), base-lock)`, birrete a `rebaje + h_r·H` del borde superior (headroom), cuerpo hasta abajo (base-lock, sin pecho flotando). Rotación solo si 1°–8°. Render con Lanczos en alfa premultiplicado.
11. **Exportación:** JPG con 300 DPI incrustado (o el DPI pedido) y metadatos; reporte QA.

## Medidas (plantillas en `PRODUCTOS`)

`10x15`, `13x18`, `15x21`, `20x25`, `20x30`, `30x40` (cuadros a medio cuerpo, con rebaje de moldura y sangrado), `carnet` (3x4), `carnet35x45`, `fotocheck` (5,4x8,6). También **medida libre** `ANCHOxALTO` en cm (ej. `18x24`) y varias a la vez (`20x30,13x18,carnet`).

## Semáforo QA

- **Rojo:** birrete cortado en la toma, inclinación > 8°, ampliación > 1,15x (resolución insuficiente), ojos cerrados.
- **Amarillo:** cualquier otra alerta (sujeto flotando en la toma, birrete borroso, residuo de prenda > 4 %, manchas blancas).
- **Verde:** sin alertas → `procesada`. Amarillo/rojo → `excepcion` para revisión humana. Con varias medidas, vale la peor.

## Uso por línea de comandos

```bash
python pipeline_fotos.py foto.jpg salida.jpg --producto 20x30 --fondo 107,201,237
python pipeline_fotos.py foto.jpg salida.jpg --producto 18x24 --dpi 254
python pipeline_fotos.py foto.jpg salida.jpg --modelo-onnx isnet.onnx   # PC sin GPU
```

Opciones: `--alpha` (máscara precalculada), `--prenda` + `--prenda-json` (toga digital por capa PNG con Umeyama), `--sin-refinar`, `--sin-limpiar-uniforme`, `--estilo plano|resplandor`, `--modelo-cara`.

## Motor conectado al panel (`motor.py`)

Ciclo cada 5 s:
1. RPC `tomar_fotos(p_motor = nombre de la PC, p_max = 1)` → fila con `ruta_original`, `producto`, `fondo_rgb`.
2. Baja el original del bucket `originales`, procesa cada medida, sube a `procesadas/<campaña>/<foto>_<medida>.jpg` y la vista previa a `procesadas/<campaña>/vistas/<foto>.jpg` (1200 px).
3. Actualiza la fila: `estado` (procesada/excepcion), `ruta_procesada`, `ruta_vista`, `qa` (semaforo, alertas, salidas, por_medida).
4. Si falla, deja `excepcion` con el error. Si la PC se apaga a medias, la foto vuelve sola a la cola a los 20 min.

Se autentica con la **clave secreta** de Supabase (`sb_secret_...`), enviada solo en la cabecera `apikey` (PR #20).

## Instalar en una PC Windows

1. Python 3.11+ y Git. Clonar el repo y copiar `pipeline/` a `C:\dev\fotos-jeff-motor\pipeline`.
2. En esa carpeta: `python -m venv .venv` y `.venv\Scripts\activate`.
3. `pip install -r requirements.txt requests transformers mediapipe` y PyTorch con CUDA: `pip install torch --index-url https://download.pytorch.org/whl/cu124` (sin GPU: `pip install onnxruntime` y poner `MODELO_ONNX=isnet.onnx`).
4. Copiar `motor.env.ejemplo` a `motor.env` y pegar la clave secreta (Supabase → Settings → API Keys). `motor.env` **nunca** se sube.
5. Doble clic en `iniciar_motor.bat`. Dejar la ventana abierta mientras haya fotos.
6. Probar subiendo una foto en `/panel/fotos`.

Varias PCs pueden correr el motor a la vez (opcional `NOMBRE_PC=...`), no se pisan.

## Resultados de pruebas reales

| Prueba | Resultado |
|---|---|
| 14 retratos de promos 2024 (CPU) | 12 verdes, 1 amarillo (SAYRI: estantes detrás), 1 rojo (Inicial 0775: cabeza inclinada 10°). ~30 s/foto |
| Mismo lote, BiRefNet_HR en RTX 3050 | 12/1/1, ~40 s/foto (el matting en CPU es el cuello de botella) |
| Con birrete sólido + uniforme limpio | 11 verdes, 2 amarillos, 1 rojo, ~35 s/foto |

Salidas de muestra en la carpeta del proyecto `automatizacion-fotos/` (prueba-promos-2024, prueba-birefnet-gpu, comparacion_ia_vs_chatgpt.jpg). Las tomas originales son 6000x4000 con pared de mayólica y un ayudante sosteniendo el cartel con el nombre.

## Documentos de diseño

- Recomendación técnica: https://claude.ai/artifact/PH6JRwTTzGAcs24VLsxrzs
- Maqueta clicable de la sección Fotos: https://claude.ai/artifact/DTjGqp4j1GzLtyCVahu2cm
