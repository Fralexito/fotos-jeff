"""
Registro de errores: todo lo que falla queda anotado en <biblioteca>/_registro/estudio.log
(rotativo, 5 archivos de 2 MB) y el usuario ve un mensaje en palabras simples, nunca un
volcado técnico. Un error inesperado no cierra el programa sin guardar.
"""
from __future__ import annotations

import logging
import logging.handlers
import os
import platform
import sys
import traceback

log = logging.getLogger("fj_estudio")


def iniciar(carpeta: str) -> str:
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, "estudio.log")
    if not any(isinstance(h, logging.handlers.RotatingFileHandler) for h in log.handlers):
        h = logging.handlers.RotatingFileHandler(ruta, maxBytes=2_000_000, backupCount=5, encoding="utf-8")
        h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(threadName)s %(message)s"))
        log.addHandler(h)
        log.setLevel(logging.INFO)
    log.info("inicio: python %s, %s", platform.python_version(), platform.platform())
    return ruta


def en_palabras(e: BaseException) -> str:
    """Mensaje para la persona: qué pasó y qué hacer."""
    if isinstance(e, MemoryError):
        return "La PC se quedó sin memoria. Cierra otros programas y vuelve a intentar."
    if isinstance(e, PermissionError):
        return "Windows no dejó abrir o guardar un archivo. Revisa que no esté abierto en otro programa."
    if isinstance(e, FileNotFoundError):
        return "No encontré un archivo. Puede que lo hayan movido o borrado fuera del programa."
    if isinstance(e, OSError) and getattr(e, "errno", None) == 28:
        return "El disco está lleno. Libera espacio y vuelve a intentar."
    if isinstance(e, (ValueError, KeyError)) and str(e):
        return str(e).strip("'\"")
    if isinstance(e, ConnectionError) or e.__class__.__name__ in ("ConnectionError", "Timeout", "ReadTimeout"):
        return "No hay conexión a internet. El trabajo local sigue; lo de internet se reintenta después."
    return "Algo salió mal. Ya quedó anotado para revisarlo; puedes seguir trabajando."


def capturar_todo(al_fallar=None):
    """Excepciones no atrapadas: se anotan y se muestran en palabras simples sin cerrar el programa."""
    def gancho(tipo, valor, tb):
        if issubclass(tipo, KeyboardInterrupt):
            sys.__excepthook__(tipo, valor, tb)
            return
        log.error("no atrapado: %s", "".join(traceback.format_exception(tipo, valor, tb)))
        if al_fallar:
            try:
                al_fallar(en_palabras(valor))
            except Exception:
                pass
    sys.excepthook = gancho
    try:
        import threading
        threading.excepthook = lambda a: gancho(a.exc_type, a.exc_value, a.exc_traceback)
    except AttributeError:
        pass
