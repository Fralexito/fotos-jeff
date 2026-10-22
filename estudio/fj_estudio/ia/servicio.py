"""
Pedido completo a la IA para una foto:
    recetas + pedido libre -> control de gasto -> IA -> tamaño original -> verificación de rasgos
    -> se guarda como versión (el original nunca se toca) -> la persona acepta o descarta.

Una versión aceptada pasa a ser la fuente de la edición local (recorte, encuadre y medidas).
"""
from __future__ import annotations

import json
import os
from datetime import datetime

import numpy as np
from PIL import Image, ImageOps

from .. import organizar as org
from ..registro import log
from . import recetas as rc
from .proveedores import PROVEEDORES, ErrorIA, Proveedor
from .verificar import Veredicto, verificar

CARPETA_IA = "_IA"
TIPO_CAMBIO_SOLES = 3.8  # aproximado, solo para mostrar el gasto en soles


def gasto_hoy_usd(base) -> float:
    r = base.q1("select coalesce(sum(costo_usd), 0) from versiones_ia where date(creada_en) = date('now','localtime')")
    return float(r[0])


def gasto_mes_usd(base) -> float:
    r = base.q1("select coalesce(sum(costo_usd), 0) from versiones_ia "
                "where strftime('%Y-%m', creada_en) = strftime('%Y-%m', 'now', 'localtime')")
    return float(r[0])


def proveedor_para(base, pid: str | None = None) -> Proveedor:
    pid = pid or base.ajuste("ia_proveedor", "openai")
    p = PROVEEDORES.get(pid)
    if not p:
        raise ErrorIA("Elige una IA en Ajustes > Inteligencia artificial.")
    extra = base.ajuste(f"ia_{pid}", {}) or {}
    return Proveedor(p.id, p.nombre, extra.get("modelo") or p.modelo, extra.get("url_base") or p.url_base,
                     float(extra.get("costo_usd", p.costo_por_imagen_usd)))


def pedir(base, foto_id: int, ids_recetas: list[str], texto_libre: str = "", clave: str = "",
          proveedor: Proveedor | None = None, detector=None, variables: dict | None = None,
          confirmar_gasto=lambda msg: True, sesion=None) -> dict:
    f = base.q1("select * from fotos where id = ?", foto_id)
    if not f:
        raise KeyError(f"foto {foto_id} no existe")
    info = base.info_salon(f["salon_id"])
    v = {"fondo_rgb": info["fondo_rgb"].replace(",", ", "), **(variables or {})}
    pedido = rc.componer(ids_recetas, texto_libre, v)
    p = proveedor or proveedor_para(base)

    limite = float(base.ajuste("ia_limite_diario_usd", 5.0))
    if gasto_hoy_usd(base) + p.costo_por_imagen_usd > limite:
        if not confirmar_gasto(f"Hoy ya se gastaron unos S/ {gasto_hoy_usd(base) * TIPO_CAMBIO_SOLES:.2f} en IA "
                               f"(límite S/ {limite * TIPO_CAMBIO_SOLES:.2f}). ¿Seguir?"):
            raise ErrorIA("Pedido cancelado por el límite de gasto del día.")

    ruta_fuente = ruta_fuente_actual(base, f)
    original = ImageOps.exif_transpose(Image.open(ruta_fuente)).convert("RGB")
    resultado = p.editar(original, pedido, clave, sesion)
    # la IA devuelve imágenes pequeñas: se lleva al tamaño del original para no perder resolución al
    # encuadrar (la nitidez real la pone la edición local / el ampliador)
    resultado = ajustar_a(resultado, original.size)

    if detector is not None:
        ver = verificar(np.asarray(original), np.asarray(resultado), detector)
    else:
        ver = Veredicto(False, ["verificación de rasgos no disponible: revísala tú antes de aceptar"])

    carpeta = os.path.join(base.raiz, org.carpeta_salon(info), CARPETA_IA)
    os.makedirs(carpeta, exist_ok=True)
    n = base.q1("select count(*) from versiones_ia where foto_id = ?", foto_id)[0] + 1
    destino = org.libre(os.path.join(carpeta, f"{foto_id:06d}_v{n}.jpg"))
    tmp = destino + ".part.jpg"
    try:
        resultado.save(tmp, "JPEG", quality=95, subsampling=0)
        os.replace(tmp, destino)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    with base.tx() as cx:
        vid = cx.execute(
            "insert into versiones_ia(foto_id, ruta, recetas, pedido_libre, proveedor, modelo, costo_usd, "
            "verificacion, aprobada_rasgos) values (?,?,?,?,?,?,?,?,?)",
            (foto_id, os.path.relpath(destino, base.raiz), json.dumps(ids_recetas), texto_libre, p.id, p.modelo,
             p.costo_por_imagen_usd, json.dumps({"motivos": ver.motivos, "medidas": ver.medidas},
                                                ensure_ascii=False), int(ver.aprobado))).lastrowid
    base.anotar("ia", "foto", foto_id, {"version": vid, "recetas": ids_recetas, "rasgos_ok": ver.aprobado})
    log.info("ia foto=%s version=%s rasgos_ok=%s %s", foto_id, vid, ver.aprobado, ver.medidas)
    return {"version_id": vid, "ruta": destino, "veredicto": ver, "pedido": pedido}


def aceptar(base, version_id: int, forzar: bool = False):
    """Usa esa versión como fuente. Si la verificación de rasgos falló, solo con `forzar`
    (la persona la revisó a ojo y confirma que es igual)."""
    v = base.q1("select * from versiones_ia where id = ?", version_id)
    if not v:
        raise KeyError("versión no existe")
    if not v["aprobada_rasgos"] and not forzar:
        raise ValueError("Esta versión no pasó la revisión de rasgos. Revísala y confirma que la persona es igual.")
    with base.tx() as cx:
        cx.execute("update fotos set version_ia_id = ?, estado = 'nueva' where id = ?", (version_id, v["foto_id"]))
    base.anotar("aceptar_ia", "foto", v["foto_id"], {"version": version_id, "forzado": forzar})


def volver_al_original(base, foto_id: int):
    with base.tx() as cx:
        cx.execute("update fotos set version_ia_id = null, estado = 'nueva' where id = ?", (foto_id,))
    base.anotar("quitar_ia", "foto", foto_id)


def ruta_fuente_actual(base, f) -> str:
    if f["version_ia_id"]:
        v = base.q1("select ruta from versiones_ia where id = ?", f["version_ia_id"])
        if v and os.path.exists(os.path.join(base.raiz, v[0])):
            return os.path.join(base.raiz, v[0])
    return os.path.join(base.raiz, f["ruta_original"])


def ajustar_a(im: Image.Image, tam: tuple[int, int]) -> Image.Image:
    """Lleva la imagen al tamaño `tam` sin deformar: escala por el lado justo y recorta al centro."""
    W, H = tam
    w, h = im.size
    s = max(W / w, H / h)
    im = im.resize((max(W, round(w * s)), max(H, round(h * s))), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))
