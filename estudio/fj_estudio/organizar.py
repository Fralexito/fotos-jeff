"""
Orden de carpetas y nombres de archivo (igual en la PC y en Google Drive).

    <raíz>/<año>/<tipo>/<sede>/<colegio>/<grado sección>/
        1 Originales/      lo que vino de la cámara, nunca se toca
        2 Editadas/        una por alumno (la toma elegida)
        3 Para imprimir/<medida>/
        4 Grupal/

Archivo: NSL-5A-014_RIOS-PANDURO_Gabriela_20x30.jpg

Blindaje: nombres válidos en Windows (sin \\/:*?"<>|, sin CON/PRN/..., sin punto final, largo
acotado) y copias atómicas (se escribe a un temporal, se verifica y recién se renombra).
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import unicodedata

CARPETAS = ("1 Originales", "2 Editadas", "3 Para imprimir", "4 Grupal")
_PROHIBIDOS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_RESERVADOS = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
LARGO_MAX = 80


def nombre_seguro(texto: str, largo: int = LARGO_MAX) -> str:
    """Válido como nombre de carpeta o archivo en Windows, Drive y Mac. Conserva tildes y ñ."""
    t = _PROHIBIDOS.sub("-", unicodedata.normalize("NFC", str(texto)))
    t = " ".join(t.split()).strip(" .")
    if not t:
        t = "sin-nombre"
    if t.split(".")[0].upper() in _RESERVADOS:
        t = "_" + t
    return t[:largo].rstrip(" .")


def _ascii(texto: str) -> str:
    plano = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "-", plano).strip("-")


def carpeta_salon(info) -> str:
    """Ruta relativa del salón; `info` es la fila de Base.info_salon."""
    salon = f"{info['grado']} {info['seccion']}".strip()
    partes = [str(info["anio"]), info["tipo"], info["sede"], info["colegio"], salon]
    return os.path.join(*(nombre_seguro(p) for p in partes))


def nombre_archivo(alumno, etiqueta_medida: str | None = None, ext: str = "jpg") -> str:
    ap = _ascii(alumno["apellidos"]).upper() or "SIN-APELLIDO"
    no = _ascii(alumno["nombres"]).title().replace("-", " ").split()[:1] or ["Alumno"]
    partes = [alumno["codigo"], ap, no[0]]
    if etiqueta_medida:
        partes.append(etiqueta_medida)
    return nombre_seguro("_".join(partes), 120) + "." + ext


def libre(ruta: str) -> str:
    """Si ya existe, agrega ' (2)', ' (3)'... sin pisar nada."""
    if not os.path.exists(ruta):
        return ruta
    base, ext = os.path.splitext(ruta)
    i = 2
    while os.path.exists(f"{base} ({i}){ext}"):
        i += 1
    return f"{base} ({i}){ext}"


def sha256(ruta: str, bloque: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        while chunk := f.read(bloque):
            h.update(chunk)
    return h.hexdigest()


def copiar_seguro(origen: str, destino: str, hash_esperado: str | None = None) -> str:
    """Copia a `destino.part`, fuerza a disco, verifica y renombra. Devuelve el hash.
    Nunca deja un archivo a medias con el nombre final."""
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    tmp = destino + ".part"
    try:
        with open(origen, "rb") as fi, open(tmp, "wb") as fo:
            shutil.copyfileobj(fi, fo, 1 << 20)
            fo.flush()
            os.fsync(fo.fileno())
        h = sha256(tmp)
        if hash_esperado and h != hash_esperado:
            raise IOError(f"La copia de {os.path.basename(origen)} salió distinta. Revisa el disco o la memoria.")
        shutil.copystat(origen, tmp)
        os.replace(tmp, destino)
        return h
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def espejar(origen_raiz: str, destino_raiz: str, subcarpetas: tuple[str, ...] = CARPETAS[1:],
            avance=None) -> dict:
    """Copia a `destino_raiz` (p. ej. la carpeta de Google Drive) solo lo nuevo o cambiado, con la
    misma estructura. No borra nada en el destino. Devuelve conteos."""
    tareas = []
    for dirpath, _dirs, files in os.walk(origen_raiz):
        rel = os.path.relpath(dirpath, origen_raiz)
        if not any(f"{os.sep}{s}" in f"{os.sep}{rel}" for s in subcarpetas):
            continue
        for f in files:
            if f.endswith(".part") or f.startswith("."):
                continue
            o = os.path.join(dirpath, f)
            d = os.path.join(destino_raiz, rel, f)
            if os.path.exists(d):
                so, sd = os.stat(o), os.stat(d)
                if so.st_size == sd.st_size and int(so.st_mtime) <= int(sd.st_mtime):
                    continue
            tareas.append((o, d))
    hechas, errores = 0, []
    for i, (o, d) in enumerate(tareas):
        try:
            copiar_seguro(o, d)
            hechas += 1
        except OSError as e:
            errores.append(f"{os.path.relpath(o, origen_raiz)}: {e}")
        if avance:
            avance(i + 1, len(tareas))
    return {"copiadas": hechas, "pendientes": len(tareas) - hechas, "errores": errores}
