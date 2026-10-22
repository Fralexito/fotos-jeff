"""
Biblioteca: todo ordenado por campaña > colegio > salón > alumno.

Izquierda: árbol de salones. Centro: fotos del salón (cuadrícula) o vista por alumno (tabla).
Derecha: la foto o el alumno seleccionado. Arriba: importar, cargar lista, repartir, editar.
"""
from __future__ import annotations

import json
import os

from PySide6.QtCore import QSize, Qt, QTimer
from PySide6.QtGui import QAction, QColor, QIcon, QKeySequence, QPixmap, QShortcut
from PySide6.QtWidgets import (QAbstractItemView, QButtonGroup, QFileDialog, QFrame, QHBoxLayout, QHeaderView,
                               QLabel, QLineEdit, QListWidget, QListWidgetItem, QMenu, QProgressBar, QPushButton,
                               QStackedWidget, QTableWidget, QTableWidgetItem, QTreeWidget, QTreeWidgetItem,
                               QVBoxLayout, QWidget)

from .. import alumnos as al
from .. import importar as imp
from .. import miniaturas
from ..motor_local import EditorLocal
from .comun import (avisar_error, boton, columna, etiqueta, fila, preguntar, punto, separador)
from .dialogos import ElegirAlumno, NuevoSalon, Pedidos
from .tema import C, ESTADO_COLOR, ESTADO_TEXTO

FILTROS = [("Todas", None), ("Sin alumno", "sin_alumno"), ("Elegidas", "elegidas"), ("Revisar", "revisar"),
           ("Con problema", "problema"), ("Aprobadas", "aprobada")]


class Biblioteca(QWidget):
    def __init__(self, estado):
        super().__init__()
        self.e = estado
        self.filtro = None
        self._cargando = set()
        raiz = QHBoxLayout(self)
        raiz.setContentsMargins(0, 0, 0, 0)
        raiz.setSpacing(0)
        raiz.addWidget(self._lateral())
        raiz.addWidget(self._centro(), 1)
        raiz.addWidget(self._derecha())
        self.e.salon_cambiado.connect(self.mostrar_salon)
        self.e.fotos_cambiadas.connect(lambda sid: sid == self.e.salon_id and self.refrescar())
        QShortcut(QKeySequence("Ctrl+I"), self, self.importar)
        QShortcut(QKeySequence("Ctrl+A"), self.grilla, self.grilla.selectAll)
        QShortcut(QKeySequence("Return"), self.grilla, self._abrir_seleccion)
        self.cargar_arbol()

    # ------------------------------------------------------------------ armado
    def _lateral(self):
        w = QWidget()
        w.setObjectName("lateral")
        w.setFixedWidth(260)
        self.btn_importar = boton("Importar de la cámara", "primario", self.importar, "Ctrl+I")
        self.arbol = QTreeWidget()
        self.arbol.setHeaderHidden(True)
        self.arbol.setColumnCount(2)
        self.arbol.header().setStretchLastSection(False)
        self.arbol.header().setSectionResizeMode(0, QHeaderView.Stretch)
        self.arbol.header().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.arbol.itemSelectionChanged.connect(self._salon_desde_arbol)
        w.setLayout(columna(self.btn_importar, boton("+ Nuevo salón", None, self.nuevo_salon),
                            etiqueta("CAMPAÑAS", "seccion"), self.arbol, margen=12))
        return w

    def _centro(self):
        w = QWidget()
        self.titulo = etiqueta("Elige o crea un salón", "titulo")
        self.subtitulo = etiqueta("", "tenue")
        self.buscar = QLineEdit()
        self.buscar.setPlaceholderText("Buscar alumno o código…")
        self.buscar.setClearButtonEnabled(True)
        self.buscar.setMaximumWidth(260)
        self.buscar.textChanged.connect(lambda _: self._timer_buscar.start(200))
        self._timer_buscar = QTimer(self, singleShot=True, timeout=self.refrescar)
        # vista
        self.btn_fotos = boton("Fotos", "modulo", chequeable=True)
        self.btn_alumnos = boton("Por alumno", "modulo", chequeable=True)
        g = QButtonGroup(self)
        g.addButton(self.btn_fotos, 0)
        g.addButton(self.btn_alumnos, 1)
        self.btn_fotos.setChecked(True)
        g.idClicked.connect(lambda i: (self.vistas.setCurrentIndex(i), self.refrescar()))
        vista = QFrame()
        vista.setStyleSheet(f"background: {C['panel']}; border-radius: 8px;")
        vista.setLayout(fila(self.btn_fotos, self.btn_alumnos, margen=3, espacio=2))
        cab = fila(columna(self.titulo, self.subtitulo, espacio=2), None, self.buscar, vista)
        # acciones
        self.btn_lista = boton("Cargar lista de alumnos", None, self.cargar_lista, "Excel o CSV del colegio")
        self.btn_repartir = boton("Repartir fotos por alumno", None, self.repartir,
                                  "Agrupa las tomas por tiempo y las asigna en el orden de la lista")
        self.btn_pedidos = boton("Pedidos…", None, self.pedidos,
                                 "Medidas y copias por alumno (selecciona varios o ninguno para todo el salón)")
        self.btn_editar = boton("Editar elegidas", "primario", self.editar_elegidas,
                                "Edita en esta PC la toma elegida de cada alumno, en las medidas marcadas")
        self.medidas_box = QHBoxLayout()
        self.medidas_box.setSpacing(4)
        acciones = fila(self.btn_lista, self.btn_repartir, self.btn_pedidos, None, etiqueta("Medidas:", "tenue"), self.medidas_box,
                        self.btn_editar)
        # aviso
        self.aviso = QFrame()
        self.aviso.setObjectName("aviso_ia")
        self.aviso_txt = QLabel()
        self.aviso_btn = boton("Repartir ahora", "ia", self.repartir)
        self.aviso.setLayout(fila(self.aviso_txt, None, self.aviso_btn, margen=10))
        self.aviso.hide()
        # filtros
        self.filtros = QButtonGroup(self)
        caja_f = QHBoxLayout()
        caja_f.setSpacing(6)
        for i, (txt, clave) in enumerate(FILTROS):
            b = boton(txt, "chip", chequeable=True)
            self.filtros.addButton(b, i)
            caja_f.addWidget(b)
            if i == 0:
                b.setChecked(True)
        caja_f.addStretch(1)
        self.filtros.idClicked.connect(self._cambiar_filtro)
        # grilla
        self.grilla = QListWidget()
        self.grilla.setViewMode(QListWidget.IconMode)
        self.grilla.setIconSize(QSize(150, 220))
        self.grilla.setGridSize(QSize(172, 262))
        self.grilla.setResizeMode(QListWidget.Adjust)
        self.grilla.setMovement(QListWidget.Static)
        self.grilla.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.grilla.setUniformItemSizes(True)
        self.grilla.setWordWrap(True)
        self.grilla.setSpacing(6)
        self.grilla.itemSelectionChanged.connect(self._detalle_foto)
        self.grilla.itemDoubleClicked.connect(lambda it: self.e.abrir_foto.emit(it.data(Qt.UserRole)))
        self.grilla.setContextMenuPolicy(Qt.CustomContextMenu)
        self.grilla.customContextMenuRequested.connect(self._menu_foto)
        self.grilla.verticalScrollBar().valueChanged.connect(lambda _: self._cargar_visibles())
        # tabla por alumno
        self.tabla = QTableWidget(0, 6)
        self.tabla.setHorizontalHeaderLabels(["", "ALUMNO", "CÓDIGO", "TOMAS", "ESTADO", "PEDIDOS"])
        self.tabla.verticalHeader().hide()
        self.tabla.setShowGrid(False)
        self.tabla.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.tabla.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.tabla.setIconSize(QSize(36, 50))
        self.tabla.verticalHeader().setDefaultSectionSize(58)
        self.tabla.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self.tabla.itemDoubleClicked.connect(self._abrir_alumno)
        self.vistas = QStackedWidget()
        self.vistas.addWidget(self.grilla)
        self.vistas.addWidget(self.tabla)
        # progreso
        self.progreso = QProgressBar()
        self.progreso.setTextVisible(False)
        self.progreso.setFixedHeight(6)
        self.progreso_txt = etiqueta("", "tenue")
        self.btn_cancelar = boton("Cancelar", None, self._cancelar)
        self.caja_prog = QWidget()
        self.caja_prog.setLayout(fila(self.progreso_txt, self.progreso, self.btn_cancelar))
        self.caja_prog.hide()
        w.setLayout(columna(cab, acciones, self.aviso, caja_f, self.vistas, self.caja_prog, margen=16, espacio=10))
        self._pintar_medidas()
        self.e.medidas_cambiadas.connect(self._pintar_medidas)
        return w

    def _derecha(self):
        w = QWidget()
        w.setObjectName("derecha")
        w.setFixedWidth(300)
        self.d_img = QLabel()
        self.d_img.setAlignment(Qt.AlignCenter)
        self.d_img.setMinimumHeight(330)
        self.d_img.setStyleSheet(f"background: {C['fondo']}; border-radius: 8px;")
        self.d_nombre = etiqueta("", "titulo", ajustar=True)
        self.d_info = etiqueta("", "tenue", ajustar=True)
        self.d_estado = etiqueta("", None, ajustar=True)
        self.d_alertas = etiqueta("", None, ajustar=True)
        self.d_alertas.setStyleSheet(f"color: {C['ambar_txt']};")
        self.btn_abrir = boton("Abrir en editor", "primario", self._abrir_seleccion)
        self.btn_asignar = boton("Asignar a alumno…", None, self.asignar_seleccion)
        self.btn_elegir = boton("Usar esta toma", None, self._elegir_toma,
                                "Esta es la foto que se edita e imprime para el alumno")
        w.setLayout(columna(self.d_img, self.d_nombre, self.d_info, self.d_estado, self.d_alertas, None,
                            self.btn_elegir, self.btn_asignar, self.btn_abrir, margen=14))
        self._detalle_vacio()
        return w

    # ------------------------------------------------------------------ árbol
    def cargar_arbol(self, seleccionar: int | None = None):
        self.arbol.blockSignals(True)
        self.arbol.clear()
        nodos_c, nodos_col = {}, {}
        elegir = None
        for r in self.e.base.arbol():
            kc = r["campana_id"]
            if kc not in nodos_c:
                nodos_c[kc] = QTreeWidgetItem(self.arbol, [f"{r['anio']} · {r['campana']}", ""])
                nodos_c[kc].setFlags(Qt.ItemIsEnabled)
                f = nodos_c[kc].font(0)
                f.setBold(True)
                nodos_c[kc].setFont(0, f)
            kcol = (kc, r["colegio_id"])
            if kcol not in nodos_col:
                nodos_col[kcol] = QTreeWidgetItem(nodos_c[kc], [f"{r['colegio']} · {r['sede']}", ""])
                nodos_col[kcol].setFlags(Qt.ItemIsEnabled)
            it = QTreeWidgetItem(nodos_col[kcol], [f"{r['grado']} {r['seccion']}".strip(), str(r["n_fotos"])])
            it.setData(0, Qt.UserRole, r["salon_id"])
            if r["n_sin_alumno"]:
                it.setIcon(0, punto(C["ambar"], 8))
                it.setToolTip(0, f"{r['n_sin_alumno']} fotos sin alumno")
            if r["salon_id"] == (seleccionar or self.e.salon_id):
                elegir = it
        self.arbol.expandAll()
        self.arbol.blockSignals(False)
        if elegir:
            self.arbol.setCurrentItem(elegir)
        elif not self.e.base.arbol():
            self.titulo.setText("Empieza creando un salón")
            self.subtitulo.setText("Botón «+ Nuevo salón» a la izquierda. Luego importas las fotos de la cámara.")

    def _salon_desde_arbol(self):
        it = self.arbol.currentItem()
        sid = it.data(0, Qt.UserRole) if it else None
        if sid and sid != self.e.salon_id:
            self.e.elegir_salon(sid)

    def nuevo_salon(self):
        d = NuevoSalon(self.e.base, self)
        if d.exec() and d.salon_id:
            self.e.elegir_salon(d.salon_id)
            self.cargar_arbol(d.salon_id)

    # ------------------------------------------------------------------ salón
    def mostrar_salon(self, salon_id: int):
        info = self.e.base.info_salon(salon_id)
        self.titulo.setText(f"{info['colegio']} · {info['grado']} {info['seccion']}".strip())
        self.refrescar()

    def refrescar(self):
        sid = self.e.salon_id
        hay = bool(sid)
        for b in (self.btn_lista, self.btn_repartir, self.btn_editar, self.btn_pedidos):
            b.setEnabled(hay)
        if not hay:
            return
        b = self.e.base
        info = b.info_salon(sid)
        n_al = len(b.alumnos(sid))
        fotos = b.fotos(sid)
        sin = sum(1 for f in fotos if f["alumno_id"] is None)
        self.subtitulo.setText(f"{info['campana']} · {info['sede']} · {n_al} alumnos · {len(fotos)} fotos")
        if sin and n_al:
            self.aviso_txt.setText(f"{sin} fotos todavía no tienen alumno. El programa puede repartirlas solo "
                                   "según el orden de la lista y la hora de cada toma.")
            self.aviso.show()
        else:
            self.aviso.hide()
        if self.vistas.currentIndex() == 0:
            self._llenar_grilla(fotos)
        else:
            self._llenar_tabla()

    def _cambiar_filtro(self, i):
        self.filtro = FILTROS[i][1]
        self.refrescar()

    def _pasa(self, f, alumnos_por_id) -> bool:
        if self.filtro == "sin_alumno" and f["alumno_id"] is not None:
            return False
        if self.filtro == "elegidas" and not f["elegida"]:
            return False
        if self.filtro in ("revisar", "problema", "aprobada") and f["estado"] != self.filtro:
            return False
        t = self.buscar.text().strip().lower()
        if t:
            a = alumnos_por_id.get(f["alumno_id"])
            texto = f"{f['nombre_camara']} {a['apellidos']} {a['nombres']} {a['codigo']}" if a else f["nombre_camara"]
            if t not in texto.lower():
                return False
        return True

    def _llenar_grilla(self, fotos):
        seleccion = {it.data(Qt.UserRole) for it in self.grilla.selectedItems()}
        alumnos = {a["id"]: a for a in self.e.base.alumnos(self.e.salon_id)}
        self.grilla.setUpdatesEnabled(False)
        self.grilla.clear()
        vacio = QPixmap(150, 220)
        vacio.fill(QColor(C["elev"]))
        for f in fotos:
            if not self._pasa(f, alumnos):
                continue
            a = alumnos.get(f["alumno_id"])
            nombre = f"{a['apellidos'].split()[0]}, {a['nombres'].split()[0]}" if a else f["nombre_camara"]
            marca = "★ " if f["elegida"] else ""
            it = QListWidgetItem(QIcon(vacio), f"{marca}{nombre}\n{ESTADO_TEXTO.get(f['estado'], f['estado'])}")
            it.setData(Qt.UserRole, f["id"])
            it.setData(Qt.UserRole + 1, os.path.join(self.e.base.raiz, f["ruta_original"]))
            it.setData(Qt.UserRole + 2, f["hash"][:20])
            it.setForeground(QColor(ESTADO_COLOR.get(f["estado"], C["texto"])) if f["estado"] != "nueva"
                             else QColor(C["suave"]))
            it.setToolTip(f"{f['nombre_camara']} · {f['tomada_en'] or ''}")
            self.grilla.addItem(it)
            if f["id"] in seleccion:
                it.setSelected(True)
        self.grilla.setUpdatesEnabled(True)
        QTimer.singleShot(0, self._cargar_visibles)

    def _cargar_visibles(self):
        """Miniaturas solo de lo que se ve, en segundo plano."""
        vp = self.grilla.viewport().rect()
        pendientes = []
        for i in range(self.grilla.count()):
            it = self.grilla.item(i)
            if it.data(Qt.UserRole + 3) or not self.grilla.visualItemRect(it).intersects(vp.adjusted(0, -400, 0, 800)):
                continue
            clave = it.data(Qt.UserRole + 2)
            if clave in self._cargando:
                continue
            self._cargando.add(clave)
            pendientes.append((it.data(Qt.UserRole), it.data(Qt.UserRole + 1), clave))
        if not pendientes:
            return

        def hacer(t, lote):
            return [(fid, miniaturas.obtener(self.e.base.raiz, ruta, clave)) for fid, ruta, clave in lote]

        def poner(res):
            por_id = {fid: r for fid, r in res}
            for i in range(self.grilla.count()):
                it = self.grilla.item(i)
                r = por_id.get(it.data(Qt.UserRole))
                if r:
                    it.setIcon(QIcon(r))
                    it.setData(Qt.UserRole + 3, True)
            for _, _, c in pendientes:
                self._cargando.discard(c)

        for k in range(0, len(pendientes), 12):
            self.e.colas.lanzar(hacer, pendientes[k:k + 12], al_listo=poner)

    def _llenar_tabla(self):
        b, sid = self.e.base, self.e.salon_id
        t = self.buscar.text().strip().lower()
        filas = []
        for a in b.alumnos(sid):
            if t and t not in f"{a['apellidos']} {a['nombres']} {a['codigo']}".lower():
                continue
            fotos = b.fotos(sid, alumno_id=a["id"])
            elegida = next((f for f in fotos if f["elegida"]), None)
            if self.filtro in ("revisar", "problema", "aprobada") and (not elegida or elegida["estado"] != self.filtro):
                continue
            if self.filtro == "sin_alumno":
                continue
            pedidos = b.q("select m.nombre, p.copias, p.pagado from pedidos p join medidas m on m.id=p.medida_id "
                          "where p.alumno_id=?", a["id"])
            filas.append((a, fotos, elegida, pedidos))
        self.tabla.setRowCount(len(filas))
        for r, (a, fotos, elegida, pedidos) in enumerate(filas):
            ic = QTableWidgetItem()
            if elegida:
                mini = miniaturas.ruta(b.raiz, f"{elegida['hash'][:20]}_{miniaturas.LADO}")
                if os.path.exists(mini):
                    ic.setIcon(QIcon(mini))
            ic.setData(Qt.UserRole, elegida["id"] if elegida else None)
            self.tabla.setItem(r, 0, ic)
            self.tabla.setItem(r, 1, QTableWidgetItem(f"{a['apellidos']}, {a['nombres']}"))
            self.tabla.setItem(r, 2, QTableWidgetItem(a["codigo"]))
            self.tabla.setItem(r, 3, QTableWidgetItem(str(len(fotos))))
            est = elegida["estado"] if elegida else None
            ie = QTableWidgetItem(ESTADO_TEXTO.get(est, "Sin foto") if est else "Sin foto")
            ie.setForeground(QColor(ESTADO_COLOR.get(est, C["rojo"]) if est else C["rojo_txt"]))
            self.tabla.setItem(r, 4, ie)
            txt = ", ".join(f"{p['nombre']}{' ×' + str(p['copias']) if p['copias'] > 1 else ''}"
                            f"{'' if p['pagado'] else ' (debe)'}" for p in pedidos) or "—"
            self.tabla.setItem(r, 5, QTableWidgetItem(txt))
        self.tabla.resizeColumnToContents(0)

    # ------------------------------------------------------------------ medidas
    def _pintar_medidas(self):
        while self.medidas_box.count():
            w = self.medidas_box.takeAt(0).widget()
            if w:
                w.deleteLater()
        elegidas = set(self.e.base.ajuste("medidas_elegidas", []) or [])
        favs = [m for m in self.e.base.medidas() if m["favorita"]][:6]
        if not elegidas and favs:
            elegidas = {favs[0]["id"]}
        self._botones_medida = []
        for m in favs:
            bt = boton(m["nombre"], "medida", chequeable=True)
            bt.setChecked(m["id"] in elegidas)
            bt.setProperty("medida_id", m["id"])
            bt.toggled.connect(self._guardar_medidas)
            self.medidas_box.addWidget(bt)
            self._botones_medida.append(bt)

    def _guardar_medidas(self):
        self.e.base.guardar_ajuste("medidas_elegidas", self.medidas_marcadas())

    def medidas_marcadas(self) -> list[int]:
        return [b.property("medida_id") for b in getattr(self, "_botones_medida", []) if b.isChecked()]

    # ------------------------------------------------------------------ detalle
    def _detalle_vacio(self):
        self.d_img.setText("Selecciona una foto")
        self.d_img.setPixmap(QPixmap())
        self.d_nombre.setText("")
        self.d_info.setText("")
        self.d_estado.setText("")
        self.d_alertas.setText("")
        for bt in (self.btn_abrir, self.btn_asignar, self.btn_elegir):
            bt.setEnabled(False)

    def _ids_seleccion(self) -> list[int]:
        return [it.data(Qt.UserRole) for it in self.grilla.selectedItems()]

    def _detalle_foto(self):
        ids = self._ids_seleccion()
        if not ids:
            return self._detalle_vacio()
        b = self.e.base
        f = b.q1("select * from fotos where id=?", ids[-1])
        if not f:
            return self._detalle_vacio()
        mini = miniaturas.obtener(b.raiz, os.path.join(b.raiz, f["ruta_original"]), f["hash"][:20])
        if mini:
            self.d_img.setPixmap(QPixmap(mini).scaled(272, 330, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        a = b.q1("select * from alumnos where id=?", f["alumno_id"]) if f["alumno_id"] else None
        self.d_nombre.setText(f"{a['apellidos']}, {a['nombres']}" if a else "Sin alumno")
        extra = f" · {len(ids)} seleccionadas" if len(ids) > 1 else ""
        self.d_info.setText(f"{a['codigo'] + ' · ' if a else ''}{f['nombre_camara']} · {f['ancho']}×{f['alto']} px{extra}")
        self.d_estado.setText(("★ Toma elegida · " if f["elegida"] else "") + ESTADO_TEXTO.get(f["estado"], f["estado"]))
        self.d_estado.setStyleSheet(f"color: {ESTADO_COLOR.get(f['estado'], C['texto'])}; font-weight: 600;")
        qa = json.loads(f["qa"] or "{}")
        self.d_alertas.setText("\n".join(f"• {x}" for x in qa.get("alertas", [])))
        self.btn_abrir.setEnabled(True)
        self.btn_asignar.setEnabled(True)
        self.btn_elegir.setEnabled(bool(a) and not f["elegida"] and len(ids) == 1)

    def _abrir_seleccion(self):
        ids = self._ids_seleccion()
        if ids:
            self.e.abrir_foto.emit(ids[-1])

    def _abrir_alumno(self, it):
        fid = self.tabla.item(it.row(), 0).data(Qt.UserRole)
        if fid:
            self.e.abrir_foto.emit(fid)

    def _elegir_toma(self):
        ids = self._ids_seleccion()
        try:
            self.e.base.elegir(ids[-1])
        except ValueError as ex:
            return avisar_error(self, str(ex))
        self.e.fotos_cambiadas.emit(self.e.salon_id)

    def _menu_foto(self, pos):
        if not self._ids_seleccion():
            return
        m = QMenu(self)
        m.addAction("Asignar a alumno…", self.asignar_seleccion)
        m.addAction("Quitar alumno", lambda: self._asignar(None))
        m.addAction("Usar esta toma", self._elegir_toma)
        m.addSeparator()
        m.addAction("Abrir en editor", self._abrir_seleccion)
        m.addSeparator()
        m.addAction("Descartar (no se borra del disco)", self._descartar)
        m.exec(self.grilla.mapToGlobal(pos))

    def asignar_seleccion(self):
        ids = self._ids_seleccion()
        if not ids:
            return
        d = ElegirAlumno(self.e.base, self.e.salon_id, self)
        if not d.exec():
            return
        aid = d.elegido()
        if not aid and d.nuevo.text().strip():
            ap, no = al.partir_completo(d.nuevo.text())
            try:
                aid = self.e.base.agregar_alumno(self.e.salon_id, ap, no)
            except ValueError as ex:
                return avisar_error(self, str(ex))
        if aid:
            self._asignar(aid)

    def _asignar(self, aid):
        try:
            self.e.base.asignar(self._ids_seleccion(), aid)
        except ValueError as ex:
            return avisar_error(self, str(ex))
        self.e.fotos_cambiadas.emit(self.e.salon_id)
        self.cargar_arbol()

    def _descartar(self):
        ids = self._ids_seleccion()
        if preguntar(self, "Descartar", f"¿Ocultar {len(ids)} foto(s)? El archivo original se queda en el disco."):
            self.e.base.cambiar_estado(ids, "descartada")
            self.e.fotos_cambiadas.emit(self.e.salon_id)

    # ------------------------------------------------------------------ acciones
    def _ocupar(self, texto: str, trabajo=None):
        self._trabajo = trabajo
        self.progreso_txt.setText(texto)
        self.progreso.setRange(0, 0)
        self.btn_cancelar.setVisible(trabajo is not None)
        self.caja_prog.show()

    def _avance(self, hecho, total, texto=""):
        self.progreso.setRange(0, max(1, total))
        self.progreso.setValue(hecho)
        if texto:
            self.progreso_txt.setText(texto)

    def _libre(self):
        self.caja_prog.hide()
        self._trabajo = None

    def _cancelar(self):
        if getattr(self, "_trabajo", None):
            self._trabajo.cancelado = True
            self.progreso_txt.setText("Cancelando… (termina la foto actual)")

    def importar(self):
        if not self.e.salon_id:
            return avisar_error(self, "Primero elige o crea el salón al que pertenecen las fotos.")
        ultima = self.e.app.value("ultima_carpeta_importar", os.path.expanduser("~"))
        carpeta = QFileDialog.getExistingDirectory(self, "Carpeta de la cámara o de la tarjeta", ultima)
        if not carpeta:
            return
        self.e.app.setValue("ultima_carpeta_importar", carpeta)
        sid = self.e.salon_id

        def hacer(t):
            return imp.importar(self.e.base, sid, carpeta, avance=lambda h, n: t.avanzar(h, n, f"Importando {h} de {n}…"),
                                cancelado=lambda: t.cancelado)

        def listo(res):
            self._libre()
            self.e.fotos_cambiadas.emit(sid)
            self.cargar_arbol()
            self.e.aviso.emit(res.resumen())
            if res.saltadas:
                avisar_error(self, res.resumen() + "\n\nCon problema:\n" + "\n".join(res.saltadas[:15]))

        t = self.e.colas.lanzar(hacer, al_listo=listo, al_error=lambda m: (self._libre(), avisar_error(self, m)),
                                al_avance=self._avance)
        self._ocupar("Buscando fotos…", t)

    def cargar_lista(self):
        ruta, _ = QFileDialog.getOpenFileName(self, "Lista de alumnos", os.path.expanduser("~"),
                                              "Listas (*.xlsx *.xlsm *.csv *.txt)")
        if not ruta:
            return
        try:
            filas = al.leer_lista(ruta)
        except Exception as ex:
            return avisar_error(self, str(ex) if isinstance(ex, ValueError) else "No pude leer ese archivo.")
        muestra = "\n".join(f"{f.apellidos}, {f.nombres}" for f in filas[:6])
        if not preguntar(self, "Lista de alumnos", f"Encontré {len(filas)} alumnos:\n\n{muestra}\n…\n\n¿Agregarlos al salón?",
                         si="Agregar"):
            return
        r = al.cargar_lista(self.e.base, self.e.salon_id, filas)
        self.e.aviso.emit(f"{r['nuevos']} alumnos agregados" + (f", {r['repetidos']} ya estaban" if r["repetidos"] else ""))
        self.refrescar()

    def repartir(self):
        b, sid = self.e.base, self.e.salon_id
        if not b.alumnos(sid):
            return avisar_error(self, "Primero carga la lista de alumnos del salón (en el orden en que se tomaron las fotos).")
        prop = al.proponer_reparto(b, sid)
        if not prop["pares"]:
            return avisar_error(self, "No hay fotos sin alumno o todos los alumnos ya tienen fotos.")
        resumen = "\n".join(f"{p['alumno']['apellidos']}, {p['alumno']['nombres']}: {len(p['fotos'])} tomas"
                            for p in prop["pares"][:8])
        texto = f"Así quedaría:\n\n{resumen}\n…\n"
        if prop["aviso"]:
            texto += f"\n⚠ {prop['aviso']}\n"
        texto += "\nDespués puedes corregir cualquier foto con clic derecho > Asignar."
        if preguntar(self, "Repartir fotos", texto, si="Repartir"):
            al.aplicar_reparto(b, prop["pares"])
            self.e.fotos_cambiadas.emit(sid)
            self.cargar_arbol()

    def pedidos(self):
        b, sid = self.e.base, self.e.salon_id
        if self.vistas.currentIndex() == 1:
            filas = {i.row() for i in self.tabla.selectedIndexes()}
            nombres = {self.tabla.item(r, 2).text() for r in filas}
            ids = [a["id"] for a in b.alumnos(sid) if a["codigo"] in nombres]
        else:
            ids = sorted({r[0] for r in b.q(f"select alumno_id from fotos where id in ({','.join('?' * len(self._ids_seleccion()))})"
                                              " and alumno_id is not null", *self._ids_seleccion())}) if self._ids_seleccion() else []
        if not ids:
            ids = [a["id"] for a in b.alumnos(sid)]
            if not ids:
                return avisar_error(self, "El salón no tiene alumnos todavía.")
        if Pedidos(b, ids, self).exec():
            self.e.fotos_cambiadas.emit(sid)

    def editar_elegidas(self):
        medidas = self.medidas_marcadas()
        if not medidas:
            return avisar_error(self, "Marca al menos una medida (arriba, junto a «Editar elegidas»).")
        b, sid = self.e.base, self.e.salon_id
        ed = EditorLocal(b, b.ajuste("modelo_onnx") or None, b.ajuste("modelo_cara") or None,
                         b.ajuste("ruta_motor") or None)
        ids = ed.pendientes(sid)
        if not ids:
            return avisar_error(self, "No hay tomas elegidas sin editar. Asigna las fotos a sus alumnos primero.")

        def hacer(t):
            res = {"verde": 0, "amarillo": 0, "rojo": 0}
            for i, fid in enumerate(ids):
                if t.cancelado:
                    break
                t.avanzar(i, len(ids), f"Editando {i + 1} de {len(ids)}…")
                qa = ed.editar(fid, medidas)
                res[qa["semaforo"]] = res.get(qa["semaforo"], 0) + 1
            t.avanzar(len(ids), len(ids))
            return res

        def listo(r):
            self._libre()
            self.e.fotos_cambiadas.emit(sid)
            self.e.aviso.emit(f"Listas: {r['verde']} · Revisar: {r['amarillo']} · Con problema: {r['rojo']}")

        t = self.e.colas.lanzar(hacer, pesado=True, al_listo=listo,
                                al_error=lambda m: (self._libre(), avisar_error(self, m)), al_avance=self._avance)
        self._ocupar("Preparando el motor de edición…", t)

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        QTimer.singleShot(50, self._cargar_visibles)
