"""
Claves de IA guardadas en el Administrador de credenciales de Windows (keyring), nunca en la
base, en archivos de texto ni en Drive. Si alguien copia la biblioteca, las claves no van con ella.
"""
from __future__ import annotations

SERVICIO = "FOTOS JEFFERSON Estudio"


def guardar(proveedor: str, clave: str):
    import keyring
    clave = (clave or "").strip()
    if not clave:
        borrar(proveedor)
        return
    keyring.set_password(SERVICIO, proveedor, clave)


def leer(proveedor: str) -> str:
    try:
        import keyring
        return keyring.get_password(SERVICIO, proveedor) or ""
    except Exception:
        return ""


def borrar(proveedor: str):
    try:
        import keyring
        keyring.delete_password(SERVICIO, proveedor)
    except Exception:
        pass


def oculta(clave: str) -> str:
    return "" if not clave else (clave[:3] + "•" * 8 + clave[-4:] if len(clave) > 10 else "•" * 8)
