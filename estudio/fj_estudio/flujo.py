"""
El trabajo de un salón en 4 pasos, con su avance: lo que muestran las pantallas simples.

    1 Traer fotos   2 Ordenar (cada alumno con su foto)   3 Editar   4 Imprimir

Todo sale de la base local; aquí no hay nada de pantalla para poder probarlo.
"""
from __future__ import annotations

from dataclasses import dataclass, field

EDITADAS = ("lista", "revisar", "problema", "aprobada")


@dataclass
class Paso:
    clave: str
    titulo: str
    detalle: str
    avance: float          # 0 a 1
    pregunta: str          # lo que se muestra en "Ahora"
    ayuda: str
    boton: str             # acción principal
    habilitado: bool = True

    @property
    def estado(self) -> str:
        return "Listo" if self.avance >= 1 else ("En curso" if self.avance > 0 else "Pendiente")


@dataclass
class Salon:
    id: int
    titulo: str
    subtitulo: str
    pasos: list[Paso] = field(default_factory=list)

    @property
    def avance(self) -> float:
        return sum(p.avance for p in self.pasos) / len(self.pasos) if self.pasos else 0.0

    @property
    def siguiente(self) -> int:
        """El primer paso sin terminar (o el último)."""
        for i, p in enumerate(self.pasos):
            if p.avance < 1:
                return i
        return len(self.pasos) - 1

    @property
    def frase(self) -> str:
        a = self.avance
        if a >= 1:
            return "Este salón está terminado"
        if a == 0:
            return "Empecemos con este salón"
        if a < 0.4:
            return "Este salón recién empieza"
        if a < 0.7:
            return "Este salón va por la mitad"
        return "Ya casi terminas este salón"


def conteos(base, salon_id: int) -> dict:
    r = base.q1("""
        select
          (select count(*) from alumnos where salon_id = :s) alumnos,
          (select count(*) from fotos where salon_id = :s and estado != 'descartada') fotos,
          (select count(*) from fotos where salon_id = :s and alumno_id is null and estado != 'descartada') sin_alumno,
          (select count(distinct alumno_id) from fotos where salon_id = :s and alumno_id is not null
               and estado != 'descartada') con_foto,
          (select count(*) from fotos where salon_id = :s and elegida = 1) elegidas,
          (select count(*) from fotos where salon_id = :s and elegida = 1
               and estado in ('lista','revisar','problema','aprobada')) editadas,
          (select count(*) from fotos where salon_id = :s and elegida = 1 and estado = 'aprobada') aprobadas,
          (select count(*) from fotos where salon_id = :s and elegida = 1 and estado in ('revisar','problema')) por_revisar,
          (select count(*) from pedidos p join alumnos a on a.id = p.alumno_id where a.salon_id = :s) pedidos,
          (select count(*) from pedidos p join alumnos a on a.id = p.alumno_id
               where a.salon_id = :s and p.estado != 'pendiente') impresos
        """.replace(":s", "?"), *([salon_id] * 10))
    return {k: int(r[k] or 0) for k in r.keys()}


def _plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def salon(base, salon_id: int) -> Salon:
    info = base.info_salon(salon_id)
    c = conteos(base, salon_id)
    n_al = c["alumnos"]
    titulo = f"{info['colegio']} · {info['grado']} {info['seccion']}".strip()
    sub = f"{info['campana']} · {info['sede']} · {_plural(n_al, 'alumno', 'alumnos')}"

    traer = Paso("traer", "Traer fotos",
                 _plural(c["fotos"], "foto copiada", "fotos copiadas") if c["fotos"] else "Aún no hay fotos",
                 1.0 if c["fotos"] else 0.0,
                 "¿Hay más fotos en la cámara?" if c["fotos"] else "Trae las fotos de la cámara",
                 "Elige la carpeta de la tarjeta. Se copian solo las nuevas y nunca se borra nada de la cámara.",
                 "Traer fotos nuevas" if c["fotos"] else "Traer fotos")

    if not n_al:
        ordenar = Paso("ordenar", "Ordenar", "Falta la lista de alumnos", 0.0,
                       "Carga la lista de alumnos",
                       "Un Excel o CSV con los nombres en el orden en que se tomaron las fotos.",
                       "Cargar lista de alumnos", habilitado=True)
    else:
        av = c["con_foto"] / n_al
        if c["sin_alumno"]:
            ordenar = Paso("ordenar", "Ordenar", f"{c['con_foto']} de {n_al} alumnos con su foto", min(av, 0.99),
                           f"{_plural(c['sin_alumno'], 'foto no tiene', 'fotos no tienen')} alumno",
                           "El programa las reparte solo según el orden de la lista y la hora de cada toma. "
                           "Antes de guardar te muestra cómo quedaría.",
                           "Repartir fotos", habilitado=bool(c["fotos"]))
        else:
            ordenar = Paso("ordenar", "Ordenar", f"{c['con_foto']} de {n_al} alumnos con su foto", av,
                           "Cada alumno ya tiene su foto" if av >= 1 else
                           f"{_plural(n_al - c['con_foto'], 'alumno no tiene', 'alumnos no tienen')} foto",
                           "Si alguna quedó cruzada, cámbiala en la galería.", "Ver la galería")

    base_editar = c["elegidas"] or 0
    faltan = base_editar - c["editadas"]
    if not base_editar:
        editar = Paso("editar", "Editar", "Primero ordena las fotos", 0.0, "Aún no hay fotos para editar",
                      "Cuando cada alumno tenga su foto, aquí se editan todas de una vez.", "Editar", habilitado=False)
    elif faltan:
        editar = Paso("editar", "Editar", f"{c['editadas']} de {base_editar} editadas", c["editadas"] / base_editar,
                      f"{_plural(faltan, 'foto falta', 'fotos faltan')} por editar",
                      "Fondo, color, toga y tamaño se hacen solos. Tú solo revisas y apruebas.",
                      f"Editar {'la que falta' if faltan == 1 else f'las {faltan} que faltan'}")
    else:
        pend = base_editar - c["aprobadas"]
        editar = Paso("editar", "Editar", f"{c['aprobadas']} de {base_editar} aprobadas",
                      0.5 + 0.5 * c["aprobadas"] / base_editar,
                      "Todo aprobado" if not pend else f"{_plural(pend, 'foto espera', 'fotos esperan')} tu visto bueno",
                      "Mira cada foto en la galería y apruébala. Las dudosas salen marcadas en amarillo.",
                      "Revisar y aprobar" if pend else "Ver la galería")

    if not c["aprobadas"]:
        imprimir = Paso("imprimir", "Imprimir", "Se activa al aprobar fotos", 0.0, "Aún no hay nada para imprimir",
                        "Cuando apruebes las fotos, aquí salen listas por tamaño.", "Ver qué falta", habilitado=False)
    else:
        total = c["pedidos"] or c["aprobadas"]
        hechos = c["impresos"]
        imprimir = Paso("imprimir", "Imprimir",
                        f"{hechos} de {total} pedidos impresos" if c["pedidos"] else
                        f"{_plural(c['aprobadas'], 'foto lista', 'fotos listas')} para imprimir",
                        (hechos / total) if c["pedidos"] else 0.0,
                        f"{_plural(c['aprobadas'], 'foto está lista', 'fotos están listas')} para imprimir",
                        "Abre la carpeta con todo ordenado por tamaño, arma hojas de carnets o copia a Drive.",
                        "Imprimir")

    return Salon(salon_id, titulo, sub, [traer, ordenar, editar, imprimir])


def colegios(base) -> list[dict]:
    """Colegios con sus salones y el avance de cada uno, para la pantalla de inicio."""
    por_colegio: dict[int, dict] = {}
    for f in base.arbol():
        col = por_colegio.setdefault(f["colegio_id"], {"id": f["colegio_id"], "nombre": f["colegio"],
                                                        "sede": f["sede"], "salones": []})
        s = salon(base, f["salon_id"])
        col["salones"].append({"id": f["salon_id"], "nombre": f"{f['grado']} {f['seccion']}".strip(),
                               "campana": f["campana"], "alumnos": f["n_alumnos"], "avance": s.avance,
                               "detalle": "Listo" if s.avance >= 1 else s.pasos[s.siguiente].titulo})
    out = []
    for col in por_colegio.values():
        ss = col["salones"]
        col["avance"] = sum(s["avance"] for s in ss) / len(ss) if ss else 0.0
        col["alumnos"] = sum(s["alumnos"] for s in ss)
        out.append(col)
    return out


def alumnos_galeria(base, salon_id: int) -> list[dict]:
    """Una ficha por alumno: su toma elegida (o la primera), estado y cuántas tomas tiene."""
    fotos = base.q("""select * from fotos where salon_id = ? and alumno_id is not null and estado != 'descartada'
                      order by elegida desc, tomada_en""", salon_id)
    por_alumno: dict[int, list] = {}
    for f in fotos:
        por_alumno.setdefault(f["alumno_id"], []).append(f)
    fichas = []
    for a in base.alumnos(salon_id):
        tomas = por_alumno.get(a["id"], [])
        f = tomas[0] if tomas else None
        fichas.append({"alumno_id": a["id"], "nombre": f"{a['nombres']} {a['apellidos']}".strip(),
                       "corto": f"{a['nombres'].split()[0] if a['nombres'] else ''} "
                                f"{a['apellidos'].split()[0] if a['apellidos'] else ''}".strip(),
                       "codigo": a["codigo"], "foto": dict(f) if f else None, "tomas": [t["id"] for t in tomas],
                       "estado": (f["estado"] if f else "sin_foto")})
    return fichas


def grupo_filtro(estado: str) -> str:
    if estado in ("revisar", "problema"):
        return "Por revisar"
    if estado in ("lista", "aprobada"):
        return "Listas"
    return "Sin editar"
