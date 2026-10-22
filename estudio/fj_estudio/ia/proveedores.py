"""
Conexión con IAs de imagen: OpenAI, Google Gemini y cualquier servicio compatible con la API de
OpenAI (para lo que salga después). Cada una recibe la foto + el pedido y devuelve una imagen.

Blindaje: tiempo máximo por pedido, reintentos con espera creciente ante saturación (429) o
fallas del servidor (5xx), y errores traducidos a palabras simples (clave mala, sin saldo,
pedido rechazado por la política de la IA, sin internet).
"""
from __future__ import annotations

import base64
import io
import time
from dataclasses import dataclass

import requests
from PIL import Image

TIEMPO_MAX_S = 180
REINTENTOS = 3


class ErrorIA(Exception):
    """Error con mensaje listo para mostrar."""


@dataclass
class Proveedor:
    id: str            # 'openai', 'gemini', 'compatible'
    nombre: str
    modelo: str
    url_base: str = ""
    costo_por_imagen_usd: float = 0.0

    def editar(self, imagen: Image.Image, pedido: str, clave: str, sesion: requests.Session | None = None,
               referencia: Image.Image | None = None) -> Image.Image:
        if not clave:
            raise ErrorIA(f"Falta la clave de {self.nombre}. Ponla en Ajustes > Inteligencia artificial.")
        s = sesion or requests.Session()
        fn = {"openai": _openai, "compatible": _openai, "gemini": _gemini}.get(self.id)
        if not fn:
            raise ErrorIA(f"Proveedor desconocido: {self.id}")
        return _con_reintentos(lambda: fn(self, imagen, pedido, clave, s, referencia))


PROVEEDORES = {
    "openai": Proveedor("openai", "OpenAI", "gpt-image-1", "https://api.openai.com/v1", 0.25),
    "gemini": Proveedor("gemini", "Google Gemini", "gemini-2.5-flash-image",
                        "https://generativelanguage.googleapis.com/v1beta", 0.04),
    "compatible": Proveedor("compatible", "Otra IA (compatible)", "", "", 0.0),
}


def _png(im: Image.Image, lado_max: int = 2048) -> bytes:
    im = im.convert("RGB")
    im.thumbnail((lado_max, lado_max), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def _tamano_openai(im: Image.Image) -> str:
    w, h = im.size
    return "1024x1536" if h > w * 1.15 else ("1536x1024" if w > h * 1.15 else "1024x1024")


def _openai(p: Proveedor, im, pedido, clave, s, referencia):
    url = (p.url_base or "https://api.openai.com/v1").rstrip("/") + "/images/edits"
    archivos = [("image[]", ("foto.png", _png(im), "image/png"))]
    if referencia is not None:
        archivos.append(("image[]", ("referencia.png", _png(referencia, 1024), "image/png")))
    datos = {"model": p.modelo or "gpt-image-1", "prompt": pedido, "size": _tamano_openai(im),
             "quality": "high", "input_fidelity": "high", "n": "1"}
    r = s.post(url, headers={"Authorization": f"Bearer {clave}"}, data=datos, files=archivos, timeout=TIEMPO_MAX_S)
    _revisar(r, p.nombre)
    try:
        b64 = r.json()["data"][0]["b64_json"]
    except (KeyError, IndexError, ValueError):
        raise ErrorIA(f"{p.nombre} respondió algo inesperado. Intenta de nuevo.")
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def _gemini(p: Proveedor, im, pedido, clave, s, referencia):
    url = f"{p.url_base.rstrip('/')}/models/{p.modelo}:generateContent"
    partes = [{"text": pedido}, {"inline_data": {"mime_type": "image/png",
                                                  "data": base64.b64encode(_png(im)).decode()}}]
    if referencia is not None:
        partes.append({"inline_data": {"mime_type": "image/png",
                                       "data": base64.b64encode(_png(referencia, 1024)).decode()}})
    cuerpo = {"contents": [{"parts": partes}], "generationConfig": {"responseModalities": ["IMAGE"]}}
    r = s.post(url, headers={"x-goog-api-key": clave}, json=cuerpo, timeout=TIEMPO_MAX_S)
    _revisar(r, p.nombre)
    try:
        for parte in r.json()["candidates"][0]["content"]["parts"]:
            dato = parte.get("inline_data") or parte.get("inlineData")
            if dato:
                return Image.open(io.BytesIO(base64.b64decode(dato["data"]))).convert("RGB")
    except (KeyError, IndexError, ValueError):
        pass
    raise ErrorIA(f"{p.nombre} no devolvió una imagen (puede que haya rechazado el pedido). Prueba con otra receta.")


class _Reintentar(Exception):
    pass


def _revisar(r: requests.Response, nombre: str):
    if r.ok:
        return
    try:
        msg = str(r.json().get("error", {}).get("message", ""))[:200]
    except ValueError:
        msg = ""
    if r.status_code in (401, 403):
        raise ErrorIA(f"La clave de {nombre} no es válida o no tiene permiso. Revísala en Ajustes.")
    if r.status_code == 402 or "billing" in msg.lower() or "quota" in msg.lower():
        raise ErrorIA(f"La cuenta de {nombre} no tiene saldo. Recarga en su página y vuelve a intentar.")
    if r.status_code == 400 and ("safety" in msg.lower() or "policy" in msg.lower() or "moderation" in msg.lower()):
        raise ErrorIA(f"{nombre} rechazó el pedido por sus reglas. Prueba con otra receta o con menos cambios.")
    if r.status_code == 429 or r.status_code >= 500:
        raise _Reintentar(f"{nombre} está saturada ({r.status_code}).")
    raise ErrorIA(f"{nombre} no aceptó el pedido ({r.status_code}). {msg}".strip())


def _con_reintentos(fn):
    espera = 4
    for intento in range(REINTENTOS + 1):
        try:
            return fn()
        except _Reintentar as e:
            if intento == REINTENTOS:
                raise ErrorIA(f"{e} Intenta en unos minutos.")
        except requests.Timeout:
            if intento == REINTENTOS:
                raise ErrorIA("La IA tardó demasiado en responder. Intenta de nuevo más tarde.")
        except requests.ConnectionError:
            raise ErrorIA("No hay conexión a internet. Lo local sigue funcionando.")
        time.sleep(espera)
        espera *= 2
