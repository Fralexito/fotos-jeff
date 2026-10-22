"""
Lista de alumnos y reparto de fotos.

1. Leer la lista del colegio (Excel o CSV) aunque venga desordenada: busca solas las columnas
   de apellidos, nombres, nombre completo y código.
2. Repartir las fotos: el fotógrafo toma a los alumnos en el orden de la lista, varias tomas
   seguidas por alumno. Se agrupan las tomas por cercanía en el tiempo y cada grupo va al
   siguiente alumno de la lista. Lo dudoso queda marcado para que una persona lo confirme.
"""
from __future__ import annotations

import csv
import os
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", s).split())


_COL = {
    "apellidos": ("apellidos", "apellido", "apellidos paterno y materno", "ap paterno", "apellido paterno"),
    "materno": ("apellido materno", "ap materno", "materno"),
    "nombres": ("nombres", "nombre", "nombres completos"),
    "completo": ("apellidos y nombres", "nombres y apellidos", "alumno", "estudiante", "nombre completo",
                 "apellidos nombres"),
    "codigo": ("codigo", "cod", "dni", "codigo del estudiante", "id"),
    "orden": ("n", "no", "nro", "numero", "n orden", "orden", "item"),
}


@dataclass
class FilaAlumno:
    apellidos: str
    nombres: str
    codigo: str | None = None


def leer_lista(ruta: str) -> list[FilaAlumno]:
    ext = os.path.splitext(ruta)[1].lower()
    if ext in (".xlsx", ".xlsm"):
        import openpyxl
        wb = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
        try:
            filas = [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
        finally:
            wb.close()
    elif ext in (".csv", ".txt"):
        filas = _leer_csv(ruta)
    else:
        raise ValueError("Usa un Excel (.xlsx) o un CSV. Si tienes una foto o PDF de la lista, usa la receta de IA para leerla.")
    return interpretar_filas(filas)


def _leer_csv(ruta: str) -> list[list]:
    crudo = open(ruta, "rb").read()
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            texto = crudo.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    dialecto = csv.Sniffer().sniff(texto[:4096], delimiters=",;\t") if texto.strip() else csv.excel
    return [r for r in csv.reader(texto.splitlines(), dialecto)]


def interpretar_filas(filas: list[list]) -> list[FilaAlumno]:
    filas = [[("" if c is None else str(c).strip()) for c in f] for f in filas]
    filas = [f for f in filas if any(f)]
    if not filas:
        raise ValueError("La lista está vacía.")
    # la cabecera es la primera fila (de las 10 primeras) donde se reconoce alguna columna
    cab_i, cols = None, {}
    for i, f in enumerate(filas[:10]):
        c = _columnas(f)
        if "apellidos" in c or "completo" in c or "nombres" in c:
            cab_i, cols = i, c
            break
    if cab_i is None:
        # sin cabecera: una sola columna de texto = nombre completo
        cab_i, cols = -1, {"completo": max(range(len(filas[0])), key=lambda j: len(filas[0][j]))}
    out = []
    for f in filas[cab_i + 1:]:
        get = lambda k: f[cols[k]].strip() if k in cols and cols[k] < len(f) else ""
        ap, no = get("apellidos"), get("nombres")
        if get("materno"):
            ap = f"{ap} {get('materno')}".strip()
        if not (ap or no) and get("completo"):
            ap, no = partir_completo(get("completo"))
        if not (ap or no) or _norm(ap + no) in ("total", ""):
            continue
        cod = get("codigo") or None
        out.append(FilaAlumno(" ".join(ap.split()).title(), " ".join(no.split()).title(), cod))
    if not out:
        raise ValueError("No encontré alumnos en la lista. Revisa que tenga una columna de apellidos o de nombres.")
    return out


def _columnas(fila: list[str]) -> dict[str, int]:
    out = {}
    for j, c in enumerate(fila):
        n = _norm(c)
        for k, alias in _COL.items():
            if n in alias and k not in out:
                out[k] = j
    return out


def partir_completo(texto: str) -> tuple[str, str]:
    """'RIOS PANDURO, Gabriela Sofía' -> apellidos, nombres. Sin coma: los 2 primeros son apellidos
    (formato de las listas escolares peruanas: paterno, materno, nombres)."""
    texto = " ".join(texto.split())
    if "," in texto:
        a, n = texto.split(",", 1)
        return a.strip(), n.strip()
    p = texto.split()
    if len(p) <= 2:
        return p[0], " ".join(p[1:])
    return " ".join(p[:2]), " ".join(p[2:])


def cargar_lista(base, salon_id: int, filas: list[FilaAlumno]) -> dict:
    """Agrega los alumnos que falten (no duplica por nombre). Devuelve conteos."""
    ya = {(_norm(a["apellidos"]), _norm(a["nombres"])) for a in base.alumnos(salon_id)}
    nuevos, repetidos = 0, 0
    with base.tx():
        for f in filas:
            clave = (_norm(f.apellidos), _norm(f.nombres))
            if clave in ya:
                repetidos += 1
                continue
            codigo = f.codigo if f.codigo and not base.q1("select 1 from alumnos where codigo=?", f.codigo) else None
            base.agregar_alumno(salon_id, f.apellidos, f.nombres, codigo)
            ya.add(clave)
            nuevos += 1
    base.anotar("lista", "salon", salon_id, {"nuevos": nuevos, "repetidos": repetidos})
    return {"nuevos": nuevos, "repetidos": repetidos}


# ---------------------------------------------------------------- reparto de fotos
def agrupar_por_tiempo(fotos: list[dict], umbral_s: float | None = None) -> list[list[dict]]:
    """Corta la secuencia donde hay una pausa larga entre tomas. Si no se da umbral, lo calcula:
    pausas de cambio de alumno ~ mucho más largas que las pausas entre tomas del mismo alumno."""
    fs = sorted(fotos, key=lambda f: (f["tomada_en"] or "", f["nombre_camara"]))
    if not fs:
        return []
    t = [_seg(f["tomada_en"]) for f in fs]
    gaps = [b - a for a, b in zip(t, t[1:])]
    if umbral_s is None:
        umbral_s = umbral_automatico(gaps)
    grupos, actual = [], [fs[0]]
    for f, g in zip(fs[1:], gaps):
        if g > umbral_s:
            grupos.append(actual)
            actual = []
        actual.append(f)
    grupos.append(actual)
    return grupos


def umbral_automatico(gaps: list[float]) -> float:
    if len(gaps) < 4:
        return 15.0  # muy pocas tomas para estimar: 15 s separa bien a un alumno del siguiente
    s = sorted(gaps)
    mediana = s[len(s) // 2]
    # el mayor salto relativo entre pausas consecutivas ordenadas separa "misma persona" de "otra"
    mejor, umbral = 0.0, max(8.0, mediana * 3)
    for a, b in zip(s, s[1:]):
        if a >= 1 and b / a > mejor and b >= 5:
            mejor, umbral = b / a, (a + b) / 2
    return max(5.0, umbral)


def _seg(fecha: str | None) -> float:
    try:
        return datetime.strptime(fecha or "", "%Y-%m-%d %H:%M:%S").timestamp()
    except ValueError:
        return 0.0


def proponer_reparto(base, salon_id: int, umbral_s: float | None = None) -> dict:
    """Propone qué grupo de fotos va a qué alumno (no guarda nada). Solo usa fotos sin alumno y
    alumnos sin fotos, en orden. Si los números no cuadran, lo dice para que una persona decida."""
    fotos = [dict(f) for f in base.fotos(salon_id, sin_alumno=True)]
    con_fotos = {r[0] for r in base.q("select distinct alumno_id from fotos where salon_id=? and alumno_id is not null",
                                       salon_id)}
    alumnos = [dict(a) for a in base.alumnos(salon_id) if a["id"] not in con_fotos]
    grupos = agrupar_por_tiempo(fotos, umbral_s)
    pares = [{"alumno": a, "fotos": g} for a, g in zip(alumnos, grupos)]
    aviso = None
    if len(grupos) != len(alumnos):
        aviso = (f"Hay {len(grupos)} grupos de fotos y {len(alumnos)} alumnos sin fotos. "
                 "Revisa el reparto antes de aceptarlo (alguien faltó o se repitió una toma).")
    return {"pares": pares, "grupos_sobrantes": grupos[len(alumnos):], "alumnos_sin_fotos": alumnos[len(grupos):],
            "aviso": aviso}


def aplicar_reparto(base, pares: list[dict]):
    with base.tx():
        for p in pares:
            base.asignar([f["id"] for f in p["fotos"]], p["alumno"]["id"])
