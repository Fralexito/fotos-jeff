"""Miniaturas en caché (<biblioteca>/_miniaturas): la cuadrícula carga rápido aunque haya miles de fotos."""
from __future__ import annotations

import os

from PIL import Image, ImageOps

CARPETA = "_miniaturas"
LADO = 360


def ruta(raiz: str, clave: str) -> str:
    return os.path.join(raiz, CARPETA, clave[:2], f"{clave}.jpg")


def obtener(raiz: str, origen: str, clave: str, lado: int = LADO) -> str | None:
    """Devuelve la ruta de la miniatura (la crea si falta o si el origen cambió). None si no se puede leer."""
    dest = ruta(raiz, f"{clave}_{lado}")
    try:
        if os.path.exists(dest) and os.path.getmtime(dest) >= os.path.getmtime(origen):
            return dest
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with Image.open(origen) as im:
            im.draft("RGB", (lado * 2, lado * 2))  # JPEG: decodifica reducido, mucho más rápido
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((lado, lado), Image.LANCZOS)
            tmp = dest + ".part.jpg"
            im.save(tmp, "JPEG", quality=85)
            os.replace(tmp, dest)
        return dest
    except (OSError, ValueError):
        return None
