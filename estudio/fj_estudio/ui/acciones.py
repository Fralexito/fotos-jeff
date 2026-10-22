"""
Lo que hacen los botones grandes (traer fotos, ordenar, editar, imprimir), igual para el salón y la galería.
Los trabajos largos van en segundo plano y su avance sale en el aviso de abajo.
"""
from __future__ import annotations

import os

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QCheckBox, QComboBox, QDialog, QFileDialog, QGridLayout, QHBoxLayout, QLabel,
                               QPushButton, QVBoxLayout)

from .. import alumnos as al
from .. import importar as imp
from .. import organizar as org
from .. import produccion as pr
from ..motor_local import EditorLocal
from .comun import avisar_error, preguntar
from .tema import CL
from .vivo import BotonVivo, Tarjeta, icono


class Acciones:
    def __init__(self, estado, aviso, padre):
        self.e, self.aviso, self.padre = estado, aviso, padre
        self._trabajo = None
        aviso.cancelar.connect(self._cancelar)

    # ------------------------------------------------------------------ apoyo
    def _empezar(self, texto, trabajo, cancelable=True):
        self._trabajo = trabajo
        self.aviso.trabajando(texto, cancelable)

    def _fin(self, texto=""):
        self._trabajo = None
        self.aviso.listo(texto)

    def _error(self, msg):
        self._fin()
        avisar_error(self.padre, msg)

    def _cancelar(self):
        if self._trabajo:
            self._trabajo.cancelado = True
            self.aviso.avance(0, 0, "Cancelando… (termina la foto actual)")

    def ocupado(self) -> bool:
        return self._trabajo is not None

    # ------------------------------------------------------------------ 1 traer
    def traer(self, sid: int):
        if self.ocupado():
            return self.aviso.mensaje("Espera a que termine lo que se está haciendo.")
        ultima = self.e.app.value("ultima_carpeta_importar", os.path.expanduser("~"))
        carpeta = QFileDialog.getExistingDirectory(self.padre, "Carpeta de la cámara o de la tarjeta", ultima)
        if not carpeta:
            return
        self.e.app.setValue("ultima_carpeta_importar", carpeta)

        def hacer(t):
            return imp.importar(self.e.base, sid, carpeta, avance=lambda h, n: t.avanzar(h, n, f"Copiando {h} de {n} fotos…"),
                                cancelado=lambda: t.cancelado)

        def listo(res):
            self._fin(res.resumen())
            self.e.fotos_cambiadas.emit(sid)
            if res.saltadas:
                avisar_error(self.padre, res.resumen() + "\n\nCon problema:\n" + "\n".join(res.saltadas[:15]))

        t = self.e.colas.lanzar(hacer, al_listo=listo, al_error=self._error, al_avance=self.aviso.avance)
        self._empezar("Buscando fotos…", t)

    # ------------------------------------------------------------------ 2 ordenar
    def cargar_lista(self, sid: int) -> bool:
        ruta, _ = QFileDialog.getOpenFileName(self.padre, "Lista de alumnos", os.path.expanduser("~"),
                                              "Listas (*.xlsx *.xlsm *.csv *.txt)")
        if not ruta:
            return False
        try:
            filas = al.leer_lista(ruta)
        except Exception as ex:
            avisar_error(self.padre, str(ex) if isinstance(ex, ValueError) else "No pude leer ese archivo.")
            return False
        muestra = "\n".join(f"{f.apellidos}, {f.nombres}" for f in filas[:6])
        if not preguntar(self.padre, "Lista de alumnos",
                         f"Encontré {len(filas)} alumnos:\n\n{muestra}\n…\n\n¿Agregarlos al salón?", si="Agregar"):
            return False
        r = al.cargar_lista(self.e.base, sid, filas)
        self.aviso.mensaje(f"{r['nuevos']} alumnos agregados" + (f", {r['repetidos']} ya estaban" if r["repetidos"] else ""))
        self.e.fotos_cambiadas.emit(sid)
        return True

    def repartir(self, sid: int):
        b = self.e.base
        prop = al.proponer_reparto(b, sid)
        if not prop["pares"]:
            return avisar_error(self.padre, "No hay fotos sin alumno, o todos los alumnos ya tienen fotos.")
        resumen = "\n".join(f"{p['alumno']['apellidos']}, {p['alumno']['nombres']}: {len(p['fotos'])} tomas"
                            for p in prop["pares"][:8])
        texto = f"Así quedaría:\n\n{resumen}\n…\n"
        if prop["aviso"]:
            texto += f"\n⚠ {prop['aviso']}\n"
        texto += "\nDespués puedes cambiar cualquier foto desde la galería."
        if preguntar(self.padre, "Repartir fotos", texto, si="Repartir"):
            al.aplicar_reparto(b, prop["pares"])
            self.aviso.mensaje("Fotos repartidas. Revísalas en la galería.")
            self.e.fotos_cambiadas.emit(sid)

    # ------------------------------------------------------------------ 3 editar
    def elegir_medidas(self) -> list[int] | None:
        d = ElegirMedidas(self.e.base, self.padre)
        return d.elegidas if d.exec() else None

    def editar(self, sid: int, ids: list[int] | None = None):
        if self.ocupado():
            return self.aviso.mensaje("Espera a que termine lo que se está haciendo.")
        medidas = self.elegir_medidas()
        if not medidas:
            return
        b = self.e.base
        ed = EditorLocal(b, b.ajuste("modelo_onnx") or None, b.ajuste("modelo_cara") or None,
                         b.ajuste("ruta_motor") or None)
        ids = ids or ed.pendientes(sid)
        if not ids:
            return avisar_error(self.padre, "No hay fotos sin editar. Cada alumno necesita su foto primero.")

        def hacer(t):
            res = {"verde": 0, "amarillo": 0, "rojo": 0}
            for i, fid in enumerate(ids):
                if t.cancelado:
                    break
                t.avanzar(i, len(ids), f"Editando {i + 1} de {len(ids)}…")
                qa = ed.editar(fid, medidas)
                res[qa["semaforo"]] = res.get(qa["semaforo"], 0) + 1
                self.e.fotos_cambiadas.emit(sid)
            t.avanzar(len(ids), len(ids))
            return res

        def listo(r):
            partes = [f"{r['verde']} listas"]
            if r["amarillo"]:
                partes.append(f"{r['amarillo']} para revisar")
            if r["rojo"]:
                partes.append(f"{r['rojo']} con problema")
            self._fin("Edición terminada: " + ", ".join(partes) + ".")
            self.e.fotos_cambiadas.emit(sid)

        t = self.e.colas.lanzar(hacer, pesado=True, al_listo=listo, al_error=self._error, al_avance=self.aviso.avance)
        self._empezar("Preparando el motor de edición…", t)

    # ------------------------------------------------------------------ 4 imprimir
    def imprimir(self, sid: int):
        Imprimir(self, sid, self.padre).exec()


class ElegirMedidas(QDialog):
    """Qué tamaños se preparan al editar. Recuerda la última elección."""

    def __init__(self, base, padre=None):
        super().__init__(padre)
        self.base = base
        self.setWindowTitle("Tamaños")
        self.setMinimumWidth(460)
        v = QVBoxLayout(self)
        v.setContentsMargins(28, 28, 28, 24)
        v.setSpacing(16)
        t = QLabel("¿En qué tamaños?")
        t.setObjectName("h2")
        v.addWidget(t)
        s = QLabel("Cada foto se prepara lista para imprimir en los tamaños que marques.")
        s.setObjectName("suave")
        s.setWordWrap(True)
        v.addWidget(s)
        antes = set(base.ajuste("medidas_elegidas", []) or [])
        g = QGridLayout()
        g.setSpacing(10)
        self.chk = []
        medidas = list(base.medidas())
        if not antes:
            antes = {m["id"] for m in medidas if m["nombre"] == "20x30"}
        for i, m in enumerate(medidas[:12]):
            c = QCheckBox(m["nombre"])
            c.setChecked(m["id"] in antes)
            c.setProperty("mid", m["id"])
            self.chk.append(c)
            g.addWidget(c, i // 3, i % 3)
        v.addLayout(g)
        h = QHBoxLayout()
        h.addStretch(1)
        no = QPushButton("Cancelar")
        no.setObjectName("fantasma")
        no.clicked.connect(self.reject)
        si = BotonVivo("Editar", respirar=False)
        si.clicked.connect(self._ok)
        h.addWidget(no)
        h.addWidget(si)
        v.addLayout(h)
        self.elegidas: list[int] = []

    def _ok(self):
        self.elegidas = [c.property("mid") for c in self.chk if c.isChecked()]
        if not self.elegidas:
            return avisar_error(self, "Marca al menos un tamaño.")
        self.base.guardar_ajuste("medidas_elegidas", self.elegidas)
        self.accept()


class Imprimir(QDialog):
    """Lo que se puede hacer con las fotos aprobadas del salón, en tres botones."""

    def __init__(self, acciones: Acciones, sid: int, padre=None):
        super().__init__(padre)
        self.a, self.sid = acciones, sid
        self.b = acciones.e.base
        self.setWindowTitle("Imprimir")
        self.setMinimumWidth(620)
        v = QVBoxLayout(self)
        v.setContentsMargins(32, 32, 32, 28)
        v.setSpacing(18)
        info = self.b.info_salon(sid)
        t = QLabel("Imprimir")
        t.setObjectName("h1")
        v.addWidget(t)
        aprob = self.b.q1("select count(*) from fotos where salon_id=? and elegida=1 and estado='aprobada'", sid)[0]
        s = QLabel(f"{info['colegio']} · {info['grado']} {info['seccion']} · {aprob} fotos aprobadas")
        s.setObjectName("suave")
        v.addWidget(s)
        self.carpeta = os.path.join(self.b.raiz, org.carpeta_salon(info), org.CARPETAS[2])
        g = QGridLayout()
        g.setSpacing(14)
        opciones = [("carpeta", "Abrir la carpeta", "Todo ordenado por tamaño, listo para mandar a la impresora.",
                     self.abrir_carpeta),
                    ("imprimir", "Hojas de carnets", "Junta los carnets en hojas A4 con marcas de corte.", self.hojas),
                    ("drive", "Copiar a Drive", "Para que las otras sedes lo vean y descarguen.", self.drive)]
        for i, (ic, titulo, texto, fn) in enumerate(opciones):
            c = Tarjeta()
            c.clicked.connect(fn)
            cv = QVBoxLayout(c)
            cv.setContentsMargins(20, 20, 20, 20)
            cv.setSpacing(8)
            l = QLabel()
            l.setPixmap(icono(ic, CL["oro"], 30).pixmap(30, 30))
            cv.addWidget(l)
            tt = QLabel(titulo)
            tt.setStyleSheet("font-size: 18px; font-weight: 800;")
            cv.addWidget(tt)
            dd = QLabel(texto)
            dd.setObjectName("suave")
            dd.setWordWrap(True)
            cv.addWidget(dd)
            cv.addStretch(1)
            c.setMinimumHeight(170)
            g.addWidget(c, 0, i)
            c.entrar(80 * i)
        v.addLayout(g)
        h = QHBoxLayout()
        h.addStretch(1)
        cerrar = QPushButton("Listo")
        cerrar.setObjectName("oscuro")
        cerrar.clicked.connect(self.accept)
        h.addWidget(cerrar)
        v.addLayout(h)

    def abrir_carpeta(self):
        if not os.path.isdir(self.carpeta):
            return avisar_error(self, "Todavía no hay fotos editadas en este salón.")
        if hasattr(os, "startfile"):
            os.startfile(self.carpeta)

    def hojas(self):
        b, sid = self.b, self.sid
        carnets = [m for m in b.medidas() if m["tipo"] == "carnet"]
        if not carnets:
            return avisar_error(self, "No hay tamaños de carnet. Agrégalos en Ajustes.")
        d = QDialog(self)
        d.setWindowTitle("Hojas de carnets")
        dv = QVBoxLayout(d)
        dv.setContentsMargins(24, 24, 24, 20)
        medida = QComboBox()
        for m in carnets:
            medida.addItem(m["nombre"], m["id"])
        hoja = QComboBox()
        hoja.addItems(list(pr.HOJAS))
        for etq, w in (("Carnet", medida), ("Hoja", hoja)):
            dv.addWidget(QLabel(etq))
            dv.addWidget(w)
        ok = BotonVivo("Armar hojas", respirar=False)
        ok.clicked.connect(d.accept)
        dv.addWidget(ok)
        if not d.exec():
            return
        mid = medida.currentData()
        m = b.q1("select * from medidas where id=?", mid)
        rutas = [os.path.join(b.raiz, r[0]) for r in b.q(
            "select s.ruta from salidas s join fotos f on f.id = s.foto_id join alumnos a on a.id = f.alumno_id "
            "where f.salon_id=? and f.elegida=1 and f.estado='aprobada' and s.medida_id=? order by a.orden", sid, mid)]
        rutas = [r for r in rutas if os.path.exists(r)]
        if not rutas:
            return avisar_error(self, f"No hay carnets {m['nombre']} aprobados. Edita con ese tamaño y aprueba.")
        info = b.info_salon(sid)
        destino = os.path.join(self.carpeta, org.nombre_seguro(m["nombre"]), "Hojas")
        prefijo = org.nombre_seguro(f"{info['abreviatura']}-{info['grado']}{info['seccion']}_{m['nombre']}")
        nombre_hoja = hoja.currentText()

        def listo(salidas):
            self.a._fin(f"{len(salidas)} hojas listas.")
            if hasattr(os, "startfile"):
                os.startfile(destino)

        t = self.a.e.colas.lanzar(lambda t: pr.armar_hojas(rutas, nombre_hoja, (m["ancho_cm"], m["alto_cm"]), destino,
                                                           prefijo, m["dpi"]),
                                  al_listo=listo, al_error=self.a._error)
        self.a._empezar("Armando hojas…", t, cancelable=False)

    def drive(self):
        b = self.b
        destino = b.ajuste("carpeta_drive")
        if not destino or not os.path.isdir(destino):
            c = QFileDialog.getExistingDirectory(self, "Carpeta de Google Drive (ej.: G:\\Mi unidad\\FOTOS JEFFERSON)",
                                                 os.path.expanduser("~"))
            if not c:
                return
            if os.path.abspath(c).startswith(os.path.abspath(b.raiz)):
                return avisar_error(self, "Esa carpeta está dentro de la biblioteca. Elige la de Google Drive.")
            b.guardar_ajuste("carpeta_drive", c)
            destino = c

        def listo(r):
            msg = f"Drive al día: {r['copiadas']} archivos copiados."
            self.a._fin(msg)
            if r["errores"]:
                avisar_error(self.a.padre, msg + f"\n\n{len(r['errores'])} no se pudieron copiar:\n" +
                             "\n".join(r["errores"][:10]))

        t = self.a.e.colas.lanzar(lambda t: org.espejar(b.raiz, destino, avance=lambda h, n: t.avanzar(h, n, f"Copiando {h} de {n}…")),
                                  al_listo=listo, al_error=self.a._error, al_avance=self.a.aviso.avance)
        self.a._empezar("Copiando a Drive…", t, cancelable=False)
