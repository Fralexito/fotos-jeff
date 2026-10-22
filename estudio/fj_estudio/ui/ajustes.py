"""Ajustes: medidas, inteligencia artificial, motor de edición y carpetas."""
from __future__ import annotations

import os

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QAbstractItemView, QComboBox, QDoubleSpinBox, QFileDialog, QFormLayout, QHeaderView,
                               QLineEdit, QTableWidget, QTableWidgetItem, QTabWidget, QWidget, QVBoxLayout)

from .. import secretos
from ..ia import servicio as sv
from ..ia.proveedores import PROVEEDORES
from .comun import avisar_error, boton, columna, etiqueta, fila, preguntar, tarjeta
from .dialogos import EditarMedida
from .tema import C


class Ajustes(QWidget):
    def __init__(self, estado):
        super().__init__()
        self.e = estado
        tabs = QTabWidget()
        tabs.addTab(self._medidas(), "Medidas")
        tabs.addTab(self._ia(), "Inteligencia artificial")
        tabs.addTab(self._motor(), "Motor y carpetas")
        lay = QVBoxLayout(self)
        lay.setContentsMargins(16, 12, 16, 16)
        lay.addWidget(tabs)

    # ------------------------------------------------------------------ medidas
    def _medidas(self):
        w = QWidget()
        self.t_med = QTableWidget(0, 6)
        self.t_med.setHorizontalHeaderLabels(["MEDIDA", "ANCHO (cm)", "ALTO (cm)", "DPI", "ENCUADRE", "LA USO SIEMPRE"])
        self.t_med.verticalHeader().hide()
        self.t_med.setShowGrid(False)
        self.t_med.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.t_med.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.t_med.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        self.t_med.itemDoubleClicked.connect(lambda _: self._editar_medida())
        w.setLayout(columna(
            etiqueta("Las que marques como «la uso siempre» salen como botones en la Biblioteca. Puedes crear "
                     "cualquier medida.", "tenue", ajustar=True),
            fila(boton("+ Nueva medida", "primario", self._nueva_medida), boton("Editar", None, self._editar_medida),
                 boton("Ocultar", None, self._ocultar_medida), None),
            self.t_med, margen=8))
        self._llenar_medidas()
        return w

    def _llenar_medidas(self):
        filas = self.e.base.medidas()
        self.t_med.setRowCount(len(filas))
        for r, m in enumerate(filas):
            vals = [m["nombre"], f"{m['ancho_cm']:g}", f"{m['alto_cm']:g}", m["dpi"],
                    "Rostro" if m["tipo"] == "carnet" else "Medio cuerpo", "★" if m["favorita"] else ""]
            for c, v in enumerate(vals):
                it = QTableWidgetItem(str(v))
                it.setData(Qt.UserRole, m["id"])
                if c == 5:
                    it.setForeground(QColor(C["acento"]))
                self.t_med.setItem(r, c, it)

    def _medida_sel(self):
        it = self.t_med.currentItem()
        return self.e.base.q1("select * from medidas where id=?", it.data(Qt.UserRole)) if it else None

    def _nueva_medida(self):
        d = EditarMedida(self)
        if d.exec():
            try:
                self.e.base.guardar_medida(**d.valores())
            except ValueError as ex:
                return avisar_error(self, str(ex))
            self._tras_medidas()

    def _editar_medida(self):
        m = self._medida_sel()
        if not m:
            return
        d = EditarMedida(self, m)
        if d.exec():
            try:
                self.e.base.guardar_medida(**d.valores(), medida_id=m["id"])
            except ValueError as ex:
                return avisar_error(self, str(ex))
            self._tras_medidas()

    def _ocultar_medida(self):
        m = self._medida_sel()
        if m and preguntar(self, "Ocultar medida", f"¿Ocultar «{m['nombre']}»? Lo ya editado no se borra."):
            with self.e.base.tx() as cx:
                cx.execute("update medidas set activa=0, favorita=0 where id=?", (m["id"],))
            self._tras_medidas()

    def _tras_medidas(self):
        self._llenar_medidas()
        self.e.medidas_cambiadas.emit()

    # ------------------------------------------------------------------ IA
    def _ia(self):
        b = self.e.base
        w = QWidget()
        self.prov = QComboBox()
        for pid, p in PROVEEDORES.items():
            self.prov.addItem(p.nombre, pid)
        self.prov.setCurrentIndex(max(0, self.prov.findData(b.ajuste("ia_proveedor", "openai"))))
        self.prov.currentIndexChanged.connect(lambda _: b.guardar_ajuste("ia_proveedor", self.prov.currentData()))
        self.claves = {}
        form = QFormLayout()
        form.addRow("IA para editar", self.prov)
        for pid, p in PROVEEDORES.items():
            ed = QLineEdit()
            ed.setEchoMode(QLineEdit.Password)
            ed.setPlaceholderText(secretos.oculta(secretos.leer(pid)) or "Pega aquí la clave")
            self.claves[pid] = ed
            extra = b.ajuste(f"ia_{pid}", {}) or {}
            modelo = QLineEdit(extra.get("modelo", p.modelo))
            url = QLineEdit(extra.get("url_base", p.url_base))
            url.setPlaceholderText("https://… (solo para «Otra IA»)")
            form.addRow(etiqueta(p.nombre, "seccion"))
            form.addRow("Clave", ed)
            form.addRow("Modelo", modelo)
            if pid == "compatible":
                form.addRow("Dirección", url)
            guardar = boton("Guardar", None, lambda _=False, pid=pid, ed=ed, modelo=modelo, url=url:
                            self._guardar_ia(pid, ed, modelo, url))
            form.addRow("", guardar)
        self.limite = QDoubleSpinBox()
        self.limite.setRange(0, 1000)
        self.limite.setPrefix("US$ ")
        self.limite.setValue(float(b.ajuste("ia_limite_diario_usd", 5.0)))
        self.limite.valueChanged.connect(lambda v: b.guardar_ajuste("ia_limite_diario_usd", v))
        form.addRow(etiqueta("GASTO", "seccion"))
        form.addRow("Límite por día", self.limite)
        self.gasto = etiqueta("", "tenue")
        form.addRow("Este mes", self.gasto)
        reglas = tarjeta()
        reglas.setLayout(columna(
            etiqueta("Protecciones fijas", "titulo"),
            etiqueta("• 0 % de cambios en rasgos de la cara, el cuerpo o la piel.\n"
                     "• Cada resultado se compara con el original; si cambió la persona, se marca y no se usa solo.\n"
                     "• El original nunca se borra ni se reemplaza.\n"
                     "• Las claves se guardan en el Administrador de credenciales de Windows.", None, ajustar=True),
            margen=14))
        cont = QWidget()
        cont.setLayout(form)
        w.setLayout(columna(fila(cont, reglas), None, margen=8))
        self._gasto()
        return w

    def _gasto(self):
        g = sv.gasto_mes_usd(self.e.base)
        self.gasto.setText(f"US$ {g:.2f}  (≈ S/ {g * sv.TIPO_CAMBIO_SOLES:.2f})")

    def _guardar_ia(self, pid, ed, modelo, url):
        try:
            if ed.text().strip():
                secretos.guardar(pid, ed.text().strip())
        except Exception:
            return avisar_error(self, "No pude guardar la clave en Windows. Prueba de nuevo.")
        self.e.base.guardar_ajuste(f"ia_{pid}", {"modelo": modelo.text().strip(), "url_base": url.text().strip()})
        ed.clear()
        ed.setPlaceholderText(secretos.oculta(secretos.leer(pid)) or "Pega aquí la clave")
        self.e.aviso.emit(f"{PROVEEDORES[pid].nombre}: guardado.")

    # ------------------------------------------------------------------ motor y carpetas
    def _motor(self):
        b = self.e.base
        w = QWidget()
        form = QFormLayout()
        self.campos = {}
        for clave, titulo, filtro in (("modelo_cara", "Modelo de cara (face_landmarker.task)", "*.task"),
                                      ("modelo_onnx", "Modelo para PCs sin tarjeta gráfica (isnet.onnx)", "*.onnx")):
            ed = QLineEdit(b.ajuste(clave) or "")
            ed.setPlaceholderText("(opcional)")
            self.campos[clave] = ed
            elegir = boton("Elegir…", None, lambda _=False, c=clave, f=filtro, e=ed: self._elegir_archivo(c, f, e))
            form.addRow(titulo, fila(ed, elegir))
        ruta_motor = QLineEdit(b.ajuste("ruta_motor") or "")
        ruta_motor.setPlaceholderText("Automático (carpeta pipeline junto al programa)")
        ruta_motor.editingFinished.connect(lambda: b.guardar_ajuste("ruta_motor", ruta_motor.text().strip()))
        form.addRow("Carpeta del motor", ruta_motor)
        form.addRow(etiqueta("BIBLIOTECA", "seccion"))
        form.addRow("Carpeta", etiqueta(b.raiz, None, ajustar=True))
        form.addRow("", etiqueta("Para usar otra carpeta, ciérralo y ábrelo con la tecla Mayús presionada.", "tenue",
                                 ajustar=True))
        cont = QWidget()
        cont.setLayout(form)
        w.setLayout(columna(cont, None, margen=8))
        return w

    def _elegir_archivo(self, clave, filtro, ed):
        r, _ = QFileDialog.getOpenFileName(self, "Elegir archivo", os.path.expanduser("~"), filtro)
        if r:
            ed.setText(r)
            self.e.base.guardar_ajuste(clave, r)
