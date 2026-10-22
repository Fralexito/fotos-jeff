"""
Catálogo local del estudio (SQLite, un solo archivo junto a la biblioteca).

Todo lo que el programa sabe vive aquí: colegios, salones, alumnos, fotos, medidas, pedidos
y el historial de quién hizo qué. Las fotos en sí están en disco; aquí solo van sus rutas
relativas a la raíz de la biblioteca, para que la carpeta entera se pueda mover de disco.

Blindaje:
- WAL + synchronous=NORMAL: un corte de luz no corrompe la base (a lo sumo pierde el último cambio).
- Cada escritura va en una transacción (`with db.tx():`); si algo falla, no queda nada a medias.
- Migraciones numeradas: una base vieja se actualiza sola al abrir, con copia previa.
- Copia de seguridad diaria rotativa de la base (las últimas 14).
"""
from __future__ import annotations

import json
import os
import shutil
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta

ARCHIVO = "estudio.db"
COPIAS = "_copias_base"
COPIAS_A_GUARDAR = 14

ESTADOS_FOTO = ("nueva", "editando", "lista", "revisar", "problema", "aprobada", "rechazada", "descartada")

MIGRACIONES: list[str] = [
    # 1: esquema inicial
    """
    create table sedes (
        id integer primary key,
        codigo text not null unique,
        nombre text not null
    );
    create table colegios (
        id integer primary key,
        nombre text not null,
        abreviatura text not null,
        sede_id integer references sedes(id),
        unique (nombre, sede_id)
    );
    create table campanas (
        id integer primary key,
        anio integer not null,
        tipo text not null,                 -- Graduación, Promoción, Carnets, ...
        nombre text not null,
        fondo_rgb text not null default '107,201,237',
        creada_en text not null default (datetime('now','localtime')),
        unique (anio, tipo, nombre)
    );
    create table salones (
        id integer primary key,
        campana_id integer not null references campanas(id) on delete cascade,
        colegio_id integer not null references colegios(id),
        grado text not null,
        seccion text not null default '',
        unique (campana_id, colegio_id, grado, seccion)
    );
    create table alumnos (
        id integer primary key,
        salon_id integer not null references salones(id) on delete cascade,
        codigo text not null unique,
        apellidos text not null,
        nombres text not null,
        orden integer not null default 0,
        notas text not null default ''
    );
    create table fotos (
        id integer primary key,
        salon_id integer not null references salones(id) on delete cascade,
        alumno_id integer references alumnos(id) on delete set null,
        ruta_original text not null,        -- relativa a la raíz de la biblioteca
        nombre_camara text not null,        -- nombre del archivo tal como vino de la cámara
        hash text not null unique,          -- sha256 del archivo: evita importar dos veces
        bytes integer not null,
        ancho integer not null,
        alto integer not null,
        tomada_en text,                     -- fecha EXIF (o del archivo)
        elegida integer not null default 0, -- la toma que se usa para ese alumno
        estado text not null default 'nueva',
        qa text not null default '{}',
        importada_en text not null default (datetime('now','localtime'))
    );
    create index fotos_salon on fotos(salon_id, tomada_en);
    create index fotos_alumno on fotos(alumno_id);
    create table medidas (
        id integer primary key,
        nombre text not null unique,        -- '20x30', 'Carnet 3x4', 'Mi cuadro especial'
        ancho_cm real not null check (ancho_cm between 1 and 200),
        alto_cm real not null check (alto_cm between 1 and 200),
        dpi integer not null default 300 check (dpi between 72 and 1200),
        tipo text not null default 'cuadro' check (tipo in ('cuadro','carnet')),
        favorita integer not null default 0,
        orden integer not null default 100,
        activa integer not null default 1
    );
    create table pedidos (
        id integer primary key,
        alumno_id integer not null references alumnos(id) on delete cascade,
        medida_id integer not null references medidas(id),
        copias integer not null default 1 check (copias between 1 and 99),
        pagado integer not null default 0,
        estado text not null default 'pendiente' check (estado in ('pendiente','impreso','entregado')),
        unique (alumno_id, medida_id)
    );
    create table salidas (
        id integer primary key,
        foto_id integer not null references fotos(id) on delete cascade,
        medida_id integer not null references medidas(id),
        ruta text not null,
        semaforo text not null,
        creada_en text not null default (datetime('now','localtime')),
        unique (foto_id, medida_id)
    );
    create table historial (
        id integer primary key,
        cuando text not null default (datetime('now','localtime')),
        usuario text not null,
        accion text not null,
        entidad text not null,
        entidad_id integer,
        detalle text not null default ''
    );
    create table ajustes (
        clave text primary key,
        valor text not null
    );
    """,
    # 2: versiones hechas con IA (el original nunca se reemplaza)
    """
    create table versiones_ia (
        id integer primary key,
        foto_id integer not null references fotos(id) on delete cascade,
        ruta text not null,
        recetas text not null default '[]',
        pedido_libre text not null default '',
        proveedor text not null,
        modelo text not null default '',
        costo_usd real not null default 0,
        verificacion text not null default '{}',
        aprobada_rasgos integer not null default 0,
        creada_en text not null default (datetime('now','localtime'))
    );
    alter table fotos add column version_ia_id integer references versiones_ia(id) on delete set null;
    """,
]

SEDES_INICIALES = [("nauta", "Nauta"), ("iquitos", "Iquitos (Liz)"), ("iquitos2", "Iquitos (Dan)")]


class Base:
    def __init__(self, raiz: str, usuario: str = "estudio"):
        self.raiz = os.path.abspath(raiz)
        os.makedirs(self.raiz, exist_ok=True)
        self.ruta = os.path.join(self.raiz, ARCHIVO)
        self.usuario = usuario
        self._lock = threading.RLock()
        nueva = not os.path.exists(self.ruta)
        if not nueva:
            self._copia_diaria()
        self.cx = sqlite3.connect(self.ruta, check_same_thread=False, isolation_level=None, timeout=15)
        self.cx.row_factory = sqlite3.Row
        self.cx.execute("pragma journal_mode=wal")
        self.cx.execute("pragma synchronous=normal")
        self.cx.execute("pragma foreign_keys=on")
        self._migrar()
        if nueva:
            self._sembrar()

    # ------------------------------------------------------------ infraestructura
    @contextmanager
    def tx(self):
        """Transacción: todo o nada. Reentrante (una tx dentro de otra se suma a la de afuera)."""
        with self._lock:
            if self.cx.in_transaction:
                yield self.cx
                return
            self.cx.execute("begin immediate")
            try:
                yield self.cx
            except BaseException:
                self.cx.execute("rollback")
                raise
            else:
                self.cx.execute("commit")

    def q(self, sql: str, *args) -> list[sqlite3.Row]:
        with self._lock:
            return self.cx.execute(sql, args).fetchall()

    def q1(self, sql: str, *args) -> sqlite3.Row | None:
        with self._lock:
            return self.cx.execute(sql, args).fetchone()

    def cerrar(self):
        with self._lock:
            try:
                self.cx.execute("pragma wal_checkpoint(truncate)")
            finally:
                self.cx.close()

    def version(self) -> int:
        return self.q1("pragma user_version")[0]

    def _migrar(self):
        v = self.version()
        if v > len(MIGRACIONES):
            raise RuntimeError("Esta base es de una versión más nueva del programa. Actualiza el programa.")
        if v < len(MIGRACIONES) and v > 0:
            self._copia(f"antes_de_migrar_v{v}")
        for i in range(v, len(MIGRACIONES)):
            with self.tx():
                for stmt in _sentencias(MIGRACIONES[i]):
                    self.cx.execute(stmt)
                self.cx.execute(f"pragma user_version = {i + 1}")

    def _sembrar(self):
        from .medidas import PRESETS
        with self.tx():
            for cod, nom in SEDES_INICIALES:
                self.cx.execute("insert into sedes(codigo, nombre) values (?, ?)", (cod, nom))
            for i, m in enumerate(PRESETS):
                self.cx.execute(
                    "insert into medidas(nombre, ancho_cm, alto_cm, dpi, tipo, favorita, orden) values (?,?,?,?,?,?,?)",
                    (m.nombre, m.ancho_cm, m.alto_cm, m.dpi, m.tipo, int(m.favorita), i))

    def _copia(self, etiqueta: str):
        dest = os.path.join(self.raiz, COPIAS)
        os.makedirs(dest, exist_ok=True)
        tmp = sqlite3.connect(self.ruta)
        try:
            out = sqlite3.connect(os.path.join(dest, f"estudio_{etiqueta}.db"))
            with out:
                tmp.backup(out)
            out.close()
        finally:
            tmp.close()

    def _copia_diaria(self):
        hoy = datetime.now().strftime("%Y-%m-%d")
        dest = os.path.join(self.raiz, COPIAS)
        if os.path.exists(os.path.join(dest, f"estudio_{hoy}.db")):
            return
        try:
            self._copia(hoy)
        except sqlite3.Error:
            return  # base dañada: no copiar basura encima de copias buenas
        viejas = sorted(f for f in os.listdir(dest) if f.startswith("estudio_20"))
        for f in viejas[:-COPIAS_A_GUARDAR]:
            os.remove(os.path.join(dest, f))

    # ------------------------------------------------------------ historial y ajustes
    def anotar(self, accion: str, entidad: str, entidad_id: int | None = None, detalle: str | dict = ""):
        if isinstance(detalle, dict):
            detalle = json.dumps(detalle, ensure_ascii=False)
        with self.tx():
            self.cx.execute("insert into historial(usuario, accion, entidad, entidad_id, detalle) values (?,?,?,?,?)",
                            (self.usuario, accion, entidad, entidad_id, detalle))

    def ajuste(self, clave: str, defecto=None):
        r = self.q1("select valor from ajustes where clave = ?", clave)
        return json.loads(r[0]) if r else defecto

    def guardar_ajuste(self, clave: str, valor):
        with self.tx():
            self.cx.execute("insert into ajustes(clave, valor) values (?, ?) "
                            "on conflict(clave) do update set valor = excluded.valor",
                            (clave, json.dumps(valor, ensure_ascii=False)))

    # ------------------------------------------------------------ catálogo
    def sedes(self):
        return self.q("select * from sedes order by id")

    def colegio(self, nombre: str, sede_codigo: str, abreviatura: str | None = None) -> int:
        nombre = _limpio(nombre)
        if not nombre:
            raise ValueError("El colegio necesita un nombre.")
        sede = self.q1("select id from sedes where codigo = ?", sede_codigo)
        if not sede:
            raise ValueError(f"Sede desconocida: {sede_codigo}")
        with self.tx():
            r = self.q1("select id from colegios where nombre = ? and sede_id = ?", nombre, sede[0])
            if r:
                return r[0]
            abrev = _limpio(abreviatura or "") or abreviar(nombre)
            return self.cx.execute("insert into colegios(nombre, abreviatura, sede_id) values (?,?,?)",
                                   (nombre, abrev, sede[0])).lastrowid

    def campana(self, anio: int, tipo: str, nombre: str, fondo_rgb: str = "107,201,237") -> int:
        tipo, nombre = _limpio(tipo), _limpio(nombre)
        if not (2000 <= int(anio) <= 2100):
            raise ValueError("Año fuera de rango.")
        validar_rgb(fondo_rgb)
        with self.tx():
            r = self.q1("select id from campanas where anio=? and tipo=? and nombre=?", anio, tipo, nombre)
            if r:
                return r[0]
            return self.cx.execute("insert into campanas(anio, tipo, nombre, fondo_rgb) values (?,?,?,?)",
                                   (anio, tipo, nombre, fondo_rgb)).lastrowid

    def salon(self, campana_id: int, colegio_id: int, grado: str, seccion: str = "") -> int:
        grado, seccion = _limpio(grado), _limpio(seccion).upper()
        if not grado:
            raise ValueError("El salón necesita un grado.")
        with self.tx():
            r = self.q1("select id from salones where campana_id=? and colegio_id=? and grado=? and seccion=?",
                        campana_id, colegio_id, grado, seccion)
            if r:
                return r[0]
            sid = self.cx.execute("insert into salones(campana_id, colegio_id, grado, seccion) values (?,?,?,?)",
                                  (campana_id, colegio_id, grado, seccion)).lastrowid
        self.anotar("crear", "salon", sid, f"{grado} {seccion}".strip())
        return sid

    def info_salon(self, salon_id: int) -> sqlite3.Row:
        r = self.q1("""
            select s.*, c.nombre colegio, c.abreviatura, se.codigo sede_codigo, se.nombre sede,
                   ca.anio, ca.tipo, ca.nombre campana, ca.fondo_rgb
            from salones s join colegios c on c.id = s.colegio_id join sedes se on se.id = c.sede_id
            join campanas ca on ca.id = s.campana_id where s.id = ?""", salon_id)
        if not r:
            raise KeyError(f"salón {salon_id} no existe")
        return r

    def arbol(self) -> list[dict]:
        """Campañas > colegios > salones con conteos, para el panel izquierdo."""
        filas = self.q("""
            select ca.id campana_id, ca.anio, ca.tipo, ca.nombre campana,
                   c.id colegio_id, c.nombre colegio, se.nombre sede,
                   s.id salon_id, s.grado, s.seccion,
                   (select count(*) from alumnos a where a.salon_id = s.id) n_alumnos,
                   (select count(*) from fotos f where f.salon_id = s.id and f.estado != 'descartada') n_fotos,
                   (select count(*) from fotos f where f.salon_id = s.id and f.alumno_id is null
                        and f.estado != 'descartada') n_sin_alumno
            from campanas ca join salones s on s.campana_id = ca.id
            join colegios c on c.id = s.colegio_id join sedes se on se.id = c.sede_id
            order by ca.anio desc, ca.tipo, ca.nombre, c.nombre, s.grado, s.seccion""")
        return [dict(f) for f in filas]

    # ------------------------------------------------------------ alumnos
    def alumnos(self, salon_id: int):
        return self.q("select * from alumnos where salon_id = ? order by orden, apellidos, nombres", salon_id)

    def agregar_alumno(self, salon_id: int, apellidos: str, nombres: str, codigo: str | None = None,
                       orden: int | None = None) -> int:
        apellidos, nombres = _limpio(apellidos), _limpio(nombres)
        if not (apellidos or nombres):
            raise ValueError("El alumno necesita nombre o apellidos.")
        info = self.info_salon(salon_id)
        with self.tx():
            if orden is None:
                orden = self.q1("select coalesce(max(orden), 0) + 1 from alumnos where salon_id=?", salon_id)[0]
            if not codigo:
                codigo = self._siguiente_codigo(info)
            codigo = _limpio(codigo).upper()
            if self.q1("select 1 from alumnos where codigo = ?", codigo):
                raise ValueError(f"El código {codigo} ya existe.")
            return self.cx.execute(
                "insert into alumnos(salon_id, codigo, apellidos, nombres, orden) values (?,?,?,?,?)",
                (salon_id, codigo, apellidos, nombres, orden)).lastrowid

    def _siguiente_codigo(self, info) -> str:
        pref = f"{info['abreviatura']}-{codigo_grado(info['grado'])}{info['seccion']}".upper()
        n = self.q1("select count(*) from alumnos where codigo like ?", pref + "-%")[0] + 1
        while self.q1("select 1 from alumnos where codigo = ?", f"{pref}-{n:03d}"):
            n += 1
        return f"{pref}-{n:03d}"

    # ------------------------------------------------------------ fotos
    def fotos(self, salon_id: int, estado: str | None = None, alumno_id: int | None = None,
              sin_alumno: bool = False):
        sql, args = "select * from fotos where salon_id = ? and estado != 'descartada'", [salon_id]
        if estado:
            sql += " and estado = ?"
            args.append(estado)
        if alumno_id is not None:
            sql += " and alumno_id = ?"
            args.append(alumno_id)
        if sin_alumno:
            sql += " and alumno_id is null"
        return self.q(sql + " order by coalesce(tomada_en, ''), nombre_camara", *args)

    def asignar(self, foto_ids: list[int], alumno_id: int | None):
        if alumno_id is not None:
            a = self.q1("select salon_id from alumnos where id = ?", alumno_id)
            if not a:
                raise KeyError("alumno no existe")
            otras = self.q(f"select id from fotos where id in ({_marcas(foto_ids)}) and salon_id != ?",
                           *foto_ids, a[0])
            if otras:
                raise ValueError("Esas fotos son de otro salón.")
        with self.tx():
            self.cx.execute(f"update fotos set alumno_id = ? where id in ({_marcas(foto_ids)})",
                            (alumno_id, *foto_ids))
            if alumno_id is not None:
                # si el alumno no tenía toma elegida, la primera asignada queda elegida
                if not self.q1("select 1 from fotos where alumno_id = ? and elegida = 1", alumno_id):
                    self.cx.execute("update fotos set elegida = 1 where id = ?", (min(foto_ids),))
            else:
                self.cx.execute(f"update fotos set elegida = 0 where id in ({_marcas(foto_ids)})", foto_ids)
        self.anotar("asignar", "fotos", alumno_id, {"fotos": foto_ids})

    def elegir(self, foto_id: int):
        f = self.q1("select alumno_id from fotos where id = ?", foto_id)
        if not f or f[0] is None:
            raise ValueError("Primero asigna la foto a un alumno.")
        with self.tx():
            self.cx.execute("update fotos set elegida = 0 where alumno_id = ?", (f[0],))
            self.cx.execute("update fotos set elegida = 1 where id = ?", (foto_id,))
        self.anotar("elegir", "foto", foto_id)

    def cambiar_estado(self, foto_ids: list[int], estado: str):
        if estado not in ESTADOS_FOTO:
            raise ValueError(f"estado no válido: {estado}")
        with self.tx():
            self.cx.execute(f"update fotos set estado = ? where id in ({_marcas(foto_ids)})", (estado, *foto_ids))
        self.anotar(estado, "fotos", None, {"fotos": foto_ids})

    # ------------------------------------------------------------ medidas y pedidos
    def medidas(self, solo_activas: bool = True):
        sql = "select * from medidas" + (" where activa = 1" if solo_activas else "")
        return self.q(sql + " order by favorita desc, orden, alto_cm * ancho_cm")

    def guardar_medida(self, nombre: str, ancho_cm: float, alto_cm: float, dpi: int = 300,
                       tipo: str | None = None, favorita: bool = False, medida_id: int | None = None) -> int:
        from .medidas import Medida
        m = Medida(_limpio(nombre), float(ancho_cm), float(alto_cm), int(dpi), tipo or "", favorita)
        m.validar()
        with self.tx():
            if medida_id:
                self.cx.execute("update medidas set nombre=?, ancho_cm=?, alto_cm=?, dpi=?, tipo=?, favorita=? "
                                "where id=?", (m.nombre, m.ancho_cm, m.alto_cm, m.dpi, m.tipo, int(m.favorita),
                                               medida_id))
                return medida_id
            if self.q1("select 1 from medidas where nombre = ?", m.nombre):
                raise ValueError(f"Ya existe una medida llamada {m.nombre}.")
            return self.cx.execute(
                "insert into medidas(nombre, ancho_cm, alto_cm, dpi, tipo, favorita) values (?,?,?,?,?,?)",
                (m.nombre, m.ancho_cm, m.alto_cm, m.dpi, m.tipo, int(m.favorita))).lastrowid

    def pedir(self, alumno_id: int, medida_id: int, copias: int = 1, pagado: bool = False):
        with self.tx():
            self.cx.execute("""insert into pedidos(alumno_id, medida_id, copias, pagado) values (?,?,?,?)
                               on conflict(alumno_id, medida_id) do update set copias=excluded.copias,
                               pagado=excluded.pagado""", (alumno_id, medida_id, copias, int(pagado)))


# ---------------------------------------------------------------- utilidades
def _sentencias(script: str) -> list[str]:
    """Parte un script en sentencias (sin executescript, que haría commit fuera de la transacción)."""
    out, buf = [], []
    for linea in script.splitlines():
        sin_com = linea.split("--", 1)[0]
        buf.append(sin_com)
        if sin_com.rstrip().endswith(";"):
            s = "\n".join(buf).strip()
            if s.strip(";").strip():
                out.append(s)
            buf = []
    resto = "\n".join(buf).strip()
    if resto:
        out.append(resto)
    return out


def _marcas(xs) -> str:
    if not xs:
        raise ValueError("No hay fotos seleccionadas.")
    return ",".join("?" * len(xs))


def _limpio(s: str) -> str:
    return " ".join(str(s or "").split())


def validar_rgb(rgb: str):
    try:
        partes = [int(v) for v in rgb.split(",")]
    except ValueError:
        raise ValueError("Color de fondo no válido (usa R,G,B).")
    if len(partes) != 3 or not all(0 <= v <= 255 for v in partes):
        raise ValueError("Color de fondo no válido (usa R,G,B entre 0 y 255).")


_PALABRAS_VACIAS = {"de", "del", "la", "las", "los", "el", "y", "i.e.", "ie", "iep", "colegio", "institucion",
                    "institución", "educativa"}


def abreviar(nombre: str) -> str:
    """'Nuestra Señora de Loreto' -> 'NSL'; 'Saramurillo' -> 'SARA'."""
    import unicodedata
    plano = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    palabras = [p for p in plano.replace(".", " ").split() if p.lower() not in _PALABRAS_VACIAS and len(p) > 1]
    if len(palabras) >= 2:
        return "".join(p[0] for p in palabras[:4]).upper()
    return (palabras[0][:4] if palabras else "COL").upper()


def codigo_grado(grado: str) -> str:
    """'5.º' -> '5', '3 años' -> '3A', 'Inicial 5 años' -> '5A'."""
    import re
    g = grado.lower()
    n = re.search(r"\d+", g)
    if not n:
        return "".join(ch for ch in grado.upper() if ch.isalnum())[:3] or "G"
    return n.group() + ("A" if "año" in g or "ano" in g else "")
