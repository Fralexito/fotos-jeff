"""
Modelos que el programa necesita y que no van dentro del instalador (pesan mucho o se actualizan):
se descargan una sola vez a %LOCALAPPDATA%\\FOTOS JEFFERSON Estudio\\modelos.

    face_landmarker.task      revisión de rasgos y encuadre de la cara (MediaPipe, ~4 MB)
    isnet-general-use.onnx    recorte para PCs sin tarjeta gráfica NVIDIA (ISNet, ~170 MB)

La descarga va a un temporal y se renombra al final: un corte de internet no deja un modelo roto.
"""
from __future__ import annotations

import os

import requests

from .registro import log

URL_CARA = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
            "face_landmarker/float16/1/face_landmarker.task")
URL_ISNET = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
MINIMOS = {"face_landmarker.task": 1_000_000, "isnet-general-use.onnx": 50_000_000}


def carpeta() -> str:
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), ".local", "share")
    c = os.path.join(base, "FOTOS JEFFERSON Estudio", "modelos")
    os.makedirs(c, exist_ok=True)
    return c


def ruta(nombre: str) -> str | None:
    r = os.path.join(carpeta(), nombre)
    return r if os.path.exists(r) and os.path.getsize(r) >= MINIMOS.get(nombre, 1) else None


def descargar(url: str, nombre: str, avance=None) -> str:
    destino = os.path.join(carpeta(), nombre)
    tmp = destino + ".part"
    try:
        with requests.get(url, stream=True, timeout=(15, 120)) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length") or 0)
            hecho = 0
            with open(tmp, "wb") as f:
                for trozo in r.iter_content(1 << 20):
                    f.write(trozo)
                    hecho += len(trozo)
                    if avance:
                        avance(hecho, total)
        if os.path.getsize(tmp) < MINIMOS.get(nombre, 1):
            raise OSError(f"La descarga de {nombre} llegó incompleta. Revisa el internet y vuelve a intentar.")
        os.replace(tmp, destino)
    except requests.RequestException as e:
        raise ConnectionError(f"No pude descargar {nombre}. Revisa el internet y vuelve a intentar.") from e
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    log.info("modelo descargado: %s", destino)
    return destino


def cara(descargar_si_falta: bool = True) -> str | None:
    return ruta("face_landmarker.task") or (descargar(URL_CARA, "face_landmarker.task") if descargar_si_falta else None)


def isnet(avance=None) -> str:
    return ruta("isnet-general-use.onnx") or descargar(URL_ISNET, "isnet-general-use.onnx", avance)
