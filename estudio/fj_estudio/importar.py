"""
Traer fotos de la tarjeta o de una carpeta a la biblioteca.

Reglas que no se rompen:
- La carpeta de origen solo se LEE. Nunca se mueve, renombra ni borra nada ahí.
- Cada foto se copia verificada (hash) a '1 Originales' del salón.
- Una foto ya importada (mismo contenido) no se vuelve a importar, aunque cambie de nombre.
- Un archivo dañado o raro se salta y se informa; no detiene el resto.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime

from PIL import Image, ImageOps, UnidentifiedImageError

from . import organizar as org

EXT_FOTO = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
EXT_RAW = {".cr2", ".cr3", ".nef", ".arw", ".raf", ".orf", ".rw2", ".dng"}
Image.MAX_IMAGE_PIXELS = 300_000_000  # tope ante archivos maliciosos o rotos


@dataclass
class Resultado:
    importadas: list[int] = field(default_factory=list)
    repetidas: list[str] = field(default_factory=list)
    saltadas: list[str] = field(default_factory=list)   # "archivo: motivo"
    raw: list[str] = field(default_factory=list)

    def resumen(self) -> str:
        p = [f"{len(self.importadas)} fotos nuevas"]
        if self.repetidas:
            p.append(f"{len(self.repetidas)} ya estaban")
        if self.raw:
            p.append(f"{len(self.raw)} RAW sin importar (usa los JPG)")
        if self.saltadas:
            p.append(f"{len(self.saltadas)} con problema")
        return ", ".join(p) + "."


def buscar(carpeta: str) -> tuple[list[str], list[str]]:
    fotos, raws = [], []
    for dirpath, dirs, files in os.walk(carpeta):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("$RECYCLE.BIN", "System Volume Information")]
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if f.startswith("._"):
                continue  # basura de Mac en tarjetas
            if ext in EXT_FOTO:
                fotos.append(os.path.join(dirpath, f))
            elif ext in EXT_RAW:
                raws.append(os.path.join(dirpath, f))
    return sorted(fotos), sorted(raws)


def leer_datos(ruta: str) -> tuple[int, int, str | None]:
    """(ancho, alto, fecha de toma 'YYYY-MM-DD HH:MM:SS'). Verifica que la imagen se pueda leer entera."""
    with Image.open(ruta) as im:
        im.verify()
    with Image.open(ruta) as im:
        exif = im.getexif()
        fecha = exif.get_ifd(0x8769).get(36867) or exif.get(306)
        im = ImageOps.exif_transpose(im)
        w, h = im.size
    tomada = None
    if fecha:
        try:
            tomada = datetime.strptime(str(fecha).strip("\x00 ")[:19], "%Y:%m:%d %H:%M:%S").strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            tomada = None
    if not tomada:
        tomada = datetime.fromtimestamp(os.path.getmtime(ruta)).strftime("%Y-%m-%d %H:%M:%S")
    return w, h, tomada


def importar(base, salon_id: int, carpeta: str, avance=None, cancelado=lambda: False) -> Resultado:
    if not os.path.isdir(carpeta):
        raise ValueError("Esa carpeta no existe o no se puede abrir.")
    raiz_lib = os.path.abspath(base.raiz)
    if os.path.abspath(carpeta).startswith(raiz_lib + os.sep) or os.path.abspath(carpeta) == raiz_lib:
        raise ValueError("Esa carpeta ya es parte de la biblioteca. Elige la carpeta de la cámara o de la tarjeta.")
    info = base.info_salon(salon_id)
    dest_dir = os.path.join(base.raiz, org.carpeta_salon(info), org.CARPETAS[0])
    fotos, raws = buscar(carpeta)
    res = Resultado(raw=[os.path.basename(r) for r in raws])
    for i, ruta in enumerate(fotos):
        if cancelado():
            break
        nombre = os.path.basename(ruta)
        try:
            h = org.sha256(ruta)
            if base.q1("select 1 from fotos where hash = ?", h):
                res.repetidas.append(nombre)
                continue
            w, hgt, tomada = leer_datos(ruta)
            destino = org.libre(os.path.join(dest_dir, org.nombre_seguro(nombre, 120)))
            org.copiar_seguro(ruta, destino, h)
            rel = os.path.relpath(destino, base.raiz)
            try:
                with base.tx() as cx:
                    fid = cx.execute(
                        "insert into fotos(salon_id, ruta_original, nombre_camara, hash, bytes, ancho, alto, tomada_en)"
                        " values (?,?,?,?,?,?,?,?)",
                        (salon_id, rel, nombre, h, os.path.getsize(destino), w, hgt, tomada)).lastrowid
            except Exception:
                os.remove(destino)  # sin fila en la base, la copia no debe quedar huérfana
                raise
            res.importadas.append(fid)
        except OSError as e:
            if getattr(e, "errno", None) == 28:
                raise OSError(28, "El disco está lleno. Libera espacio y vuelve a importar: lo ya copiado no se repite.")
            res.saltadas.append(f"{nombre}: {_motivo(e)}")
        except (UnidentifiedImageError, Image.DecompressionBombError, SyntaxError, ValueError) as e:
            res.saltadas.append(f"{nombre}: {_motivo(e)}")
        finally:
            if avance:
                avance(i + 1, len(fotos))
    base.anotar("importar", "salon", salon_id, {"carpeta": carpeta, "resumen": res.resumen()})
    return res


def _motivo(e: Exception) -> str:
    if isinstance(e, UnidentifiedImageError):
        return "no es una imagen o está dañada"
    if isinstance(e, Image.DecompressionBombError):
        return "imagen demasiado grande"
    if isinstance(e, PermissionError):
        return "sin permiso para leerla"
    if isinstance(e, OSError) and getattr(e, "errno", None) == 28:
        return "disco lleno"
    return str(e) or e.__class__.__name__
