"""
Prueba en la PC con tarjeta gráfica: las mismas 14 fotos con BiRefNet_HR (recorte con IA de alta calidad).
Uso (en C:\\dev\\fotos-jeff-prueba):  python comparar_birefnet.py [modelo] [carpeta_salida]
Salida: salida_birefnet\\<NOMBRE>_20x30.jpg, hoja_de_contactos.jpg y resultados.json
"""
import json
import os
import sys
import time
import urllib.request

import pipeline_fotos as pf
from PIL import Image, ImageDraw

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = r"D:\Users\Alexander\Pictures\FOTOS PROMO PAPA JEFF 2024"
FOTOS = {
    "CHRYSTELLE": r"NSL 2024\NSL 5to A\CHRYSTELLE\IMG_2041.JPG",
    "DANIEL": r"NSL 2024\NSL 5to A\DANIEL\IMG_2039.JPG",
    "GREYSI": r"NSL 2024\NSL 5to A\GREYSI SARITA\IMG_1745.JPG",
    "SARA": r"NSL 2024\NSL 5to A\SARA\IMG_1774.JPG",
    "VALENTINA": r"NSL 2024\NSL 5to A\VALENTINA\IMG_1771.JPG",
    "CIELO": r"NSL 2024\NSL 5to B\CIELO\IMG_1801.JPG",
    "GABRIELA": r"NSL 2024\NSL 5to B\GABRIELA\IMG_1798.JPG",
    "GENESIS": r"NSL 2024\NSL 5to B\GENESIS\IMG_1790.JPG",
    "JUNIOR": r"NSL 2024\NSL 5to B\JUNIOR\IMG_2077.JPG",
    "MILY": r"NSL 2024\NSL 5to B\MILY\IMG_1788.JPG",
    "SAYRI": r"NSL 2024\NSL 5to A\SAYRI\IMG_2101.JPG",
    "CLAUDIO": r"NSL 2024\NSL 5to B\CLAUDIO\IMG_2068.JPG",
    "SARAMURILLO_1298": r"SARAMURILLO PRIMARIA\COPIA DE RESPALDO\IMG_1298.JPG",
    "INICIAL_0775": r"PROMO INICIAL IQUITOS\IMG_0775.JPG",
}
CARA = os.path.join(AQUI, "face_landmarker.task")
URL_CARA = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task")
FONDO = (107 / 255, 201 / 255, 237 / 255)  # celeste que usa el estudio


def main():
    if not os.path.exists(CARA):
        urllib.request.urlretrieve(URL_CARA, CARA)
    modelo = sys.argv[1] if len(sys.argv) > 1 else "ZhengPeng7/BiRefNet_HR"
    carpeta = sys.argv[2] if len(sys.argv) > 2 else "salida_birefnet"
    salida = os.path.join(AQUI, carpeta)
    os.makedirs(salida, exist_ok=True)
    resultados = {}
    for nombre, rel in FOTOS.items():
        t0 = time.time()
        destino = os.path.join(salida, f"{nombre}_20x30.jpg")
        try:
            qa = pf.procesar(os.path.join(BASE, rel), destino, "20x30", fondo_rgb=FONDO,
                             modelo_cara=CARA, modelo_birefnet=modelo)
            resultados[nombre] = dict(semaforo=qa["semaforo"], alertas=qa["alertas"],
                                      segundos=round(time.time() - t0, 1))
        except Exception as e:  # una foto rota no detiene el lote
            resultados[nombre] = dict(semaforo="error", alertas=[repr(e)], segundos=round(time.time() - t0, 1))
        print(nombre, resultados[nombre], flush=True)
    json.dump(dict(modelo=modelo, fotos=resultados), open(os.path.join(salida, "resultados.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)

    col = {"verde": (30, 138, 76), "amarillo": (214, 150, 20), "rojo": (194, 65, 12)}
    hoja = Image.new("RGB", (7 * 260 + 20, 2 * 430 + 20), "white")
    d = ImageDraw.Draw(hoja)
    for k, nombre in enumerate(FOTOS):
        ruta = os.path.join(salida, f"{nombre}_20x30.jpg")
        if not os.path.exists(ruta):
            continue
        i = Image.open(ruta)
        i.thumbnail((240, 360))
        x, y = 20 + (k % 7) * 260, 20 + (k // 7) * 430
        sem = resultados[nombre]["semaforo"]
        d.rectangle((x - 6, y - 6, x + i.width + 5, y + i.height + 5), fill=col.get(sem, (0, 0, 0)))
        hoja.paste(i, (x, y))
        d.text((x, y + 372), f"{nombre}  {sem}", fill="black")
    hoja.save(os.path.join(salida, "hoja_de_contactos.jpg"), quality=90)
    print("LISTO")


if __name__ == "__main__":
    main()
