"""Ventanas pequeñas: nuevo salón, asignar alumno, reparto, medida."""
from __future__ import annotations

from datetime import date

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (QComboBox, QCompleter, QDialog, QDialogButtonBox, QDoubleSpinBox, QFormLayout,
                               QLabel, QLineEdit, QListWidget, QListWidgetItem, QSpinBox, QVBoxLayout, QCheckBox)

from ..db import validar_rgb
from .comun import avisar_error, etiqueta

TIPOS = ["Graduación", "Promoción", "Carnets", "Inicial", "Otro"]


class NuevoSalon(QDialog):
    def __init__(self, base, padre=None):
        super().__init__(padre)
        self.base = base
        self.setWindowTitle("Nuevo salón")
        self.setMinimumWidth(420)
        f = QFormLayout(self)
        self.anio = QSpinBox()
        self.anio.setRange(2000, 2100)
        self.anio.setValue(date.today().year)
        self.tipo = QComboBox()
        self.tipo.addItems(TIPOS)
        self.tipo.setEditable(True)
        self.campana = QLineEdit()
        self.campana.setPlaceholderText(f"Graduación {date.today().year}")
        self.sede = QComboBox()
        for s in base.sedes():
            self.sede.addItem(s["nombre"], s["codigo"])
        self.colegio = QComboBox()
        self.colegio.setEditable(True)
        self.colegio.addItems(sorted({r["nombre"] for r in base.q("select nombre from colegios")}))
        self.colegio.setCurrentText("")
        self.colegio.lineEdit().setPlaceholderText("Nombre del colegio")
        self.colegio.setCompleter(QCompleter(self.colegio.model()))
        self.grado = QLineEdit()
        self.grado.setPlaceholderText("5.º, 6.º, Inicial 5 años…")
        self.seccion = QLineEdit()
        self.seccion.setPlaceholderText("A, B, Única…")
        self.fondo = QLineEdit("107,201,237")
        f.addRow("Año", self.anio)
        f.addRow("Tipo", self.tipo)
        f.addRow("Campaña", self.campana)
        f.addRow("Sede", self.sede)
        f.addRow("Colegio", self.colegio)
        f.addRow("Grado", self.grado)
        f.addRow("Sección", self.seccion)
        f.addRow("Fondo (R,G,B)", self.fondo)
        bb = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        bb.button(QDialogButtonBox.Ok).setText("Crear salón")
        bb.button(QDialogButtonBox.Cancel).setText("Cancelar")
        bb.accepted.connect(self.crear)
        bb.rejected.connect(self.reject)
        f.addRow(bb)
        self.salon_id = None

    def crear(self):
        try:
            validar_rgb(self.fondo.text().strip())
            camp = self.campana.text().strip() or f"{self.tipo.currentText()} {self.anio.value()}"
            cid = self.base.campana(self.anio.value(), self.tipo.currentText(), camp, self.fondo.text().strip())
            col = self.base.colegio(self.colegio.currentText(), self.sede.currentData())
            self.salon_id = self.base.salon(cid, col, self.grado.text(), self.seccion.text())
        except ValueError as e:
            avisar_error(self, str(e))
            return
        self.accept()


class ElegirAlumno(QDialog):
    """Buscar y elegir un alumno del salón (escribiendo parte del nombre o del código)."""
    def __init__(self, base, salon_id: int, padre=None):
        super().__init__(padre)
        self.setWindowTitle("¿De qué alumno es?")
        self.setMinimumSize(380, 460)
        v = QVBoxLayout(self)
        self.buscar = QLineEdit()
        self.buscar.setPlaceholderText("Escribe apellido, nombre o código")
        self.lista = QListWidget()
        self.alumnos = list(base.alumnos(salon_id))
        for a in self.alumnos:
            it = QListWidgetItem(f"{a['apellidos']}, {a['nombres']}   ·   {a['codigo']}")
            it.setData(Qt.UserRole, a["id"])
            self.lista.addItem(it)
        self.buscar.textChanged.connect(self._filtrar)
        self.lista.itemDoubleClicked.connect(lambda _: self.accept())
        v.addWidget(self.buscar)
        v.addWidget(self.lista)
        self.nuevo = QLineEdit()
        self.nuevo.setPlaceholderText("¿No está? Escribe: Apellidos, Nombres")
        v.addWidget(etiqueta("Alumno nuevo", "seccion"))
        v.addWidget(self.nuevo)
        bb = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        bb.button(QDialogButtonBox.Ok).setText("Asignar")
        bb.button(QDialogButtonBox.Cancel).setText("Cancelar")
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        v.addWidget(bb)
        self.buscar.setFocus()

    def _filtrar(self, t):
        t = t.lower().strip()
        for i in range(self.lista.count()):
            it = self.lista.item(i)
            it.setHidden(bool(t) and t not in it.text().lower())

    def elegido(self) -> int | None:
        it = self.lista.currentItem()
        return it.data(Qt.UserRole) if it and not it.isHidden() else None


class EditarMedida(QDialog):
    def __init__(self, padre=None, fila=None):
        super().__init__(padre)
        self.setWindowTitle("Medida" if fila else "Nueva medida")
        f = QFormLayout(self)
        self.nombre = QLineEdit(fila["nombre"] if fila else "")
        self.nombre.setPlaceholderText("Ej.: 24x36 o Cuadro especial")
        self.ancho = QDoubleSpinBox()
        self.alto = QDoubleSpinBox()
        for s in (self.ancho, self.alto):
            s.setRange(1, 200)
            s.setDecimals(1)
            s.setSuffix(" cm")
        self.ancho.setValue(fila["ancho_cm"] if fila else 20)
        self.alto.setValue(fila["alto_cm"] if fila else 30)
        self.dpi = QSpinBox()
        self.dpi.setRange(72, 1200)
        self.dpi.setValue(fila["dpi"] if fila else 300)
        self.tipo = QComboBox()
        self.tipo.addItem("Cuadro (medio cuerpo)", "cuadro")
        self.tipo.addItem("Carnet (rostro)", "carnet")
        if fila:
            self.tipo.setCurrentIndex(1 if fila["tipo"] == "carnet" else 0)
        self.fav = QCheckBox("La uso siempre (sale primero)")
        self.fav.setChecked(bool(fila["favorita"]) if fila else False)
        f.addRow("Nombre", self.nombre)
        f.addRow("Ancho", self.ancho)
        f.addRow("Alto", self.alto)
        f.addRow("DPI", self.dpi)
        f.addRow("Encuadre", self.tipo)
        f.addRow("", self.fav)
        self.px = QLabel()
        f.addRow("Píxeles", self.px)
        for w in (self.ancho, self.alto, self.dpi):
            w.valueChanged.connect(self._px)
        self._px()
        bb = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        bb.button(QDialogButtonBox.Ok).setText("Guardar")
        bb.button(QDialogButtonBox.Cancel).setText("Cancelar")
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        f.addRow(bb)

    def _px(self):
        from ..medidas import cm_a_px
        d = self.dpi.value()
        self.px.setText(f"{cm_a_px(self.ancho.value(), d)} × {cm_a_px(self.alto.value(), d)} px")

    def valores(self) -> dict:
        nombre = self.nombre.text().strip() or f"{self.ancho.value():g}x{self.alto.value():g}"
        return dict(nombre=nombre, ancho_cm=self.ancho.value(), alto_cm=self.alto.value(), dpi=self.dpi.value(),
                    tipo=self.tipo.currentData(), favorita=self.fav.isChecked())


class Pedidos(QDialog):
    """Qué medidas lleva cada alumno. Sirve para uno, para varios o para todo el salón a la vez."""
    def __init__(self, base, alumno_ids: list[int], padre=None):
        super().__init__(padre)
        self.base, self.alumno_ids = base, alumno_ids
        n = len(alumno_ids)
        self.setWindowTitle("Pedido" if n == 1 else f"Pedido para {n} alumnos")
        self.setMinimumWidth(420)
        v = QVBoxLayout(self)
        if n == 1:
            a = base.q1("select apellidos, nombres from alumnos where id=?", alumno_ids[0])
            v.addWidget(etiqueta(f"{a['apellidos']}, {a['nombres']}", "titulo"))
        else:
            v.addWidget(etiqueta(f"Se aplica a {n} alumnos. Lo que no marques no se cambia.", "tenue", ajustar=True))
        actual = {}
        if n == 1:
            for p in base.q("select * from pedidos where alumno_id=?", alumno_ids[0]):
                actual[p["medida_id"]] = p
        self.filas = []
        f = QFormLayout()
        for m in base.medidas():
            chk = QCheckBox(m["nombre"])
            cop = QSpinBox()
            cop.setRange(1, 99)
            cop.setPrefix("× ")
            pag = QCheckBox("Pagado")
            if m["id"] in actual:
                chk.setChecked(True)
                cop.setValue(actual[m["id"]]["copias"])
                pag.setChecked(bool(actual[m["id"]]["pagado"]))
            from PySide6.QtWidgets import QHBoxLayout
            h = QHBoxLayout()
            h.addWidget(cop)
            h.addWidget(pag)
            f.addRow(chk, h)
            self.filas.append((m["id"], chk, cop, pag))
        v.addLayout(f)
        bb = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        bb.button(QDialogButtonBox.Ok).setText("Guardar pedido")
        bb.button(QDialogButtonBox.Cancel).setText("Cancelar")
        bb.accepted.connect(self.guardar)
        bb.rejected.connect(self.reject)
        v.addWidget(bb)

    def guardar(self):
        with self.base.tx() as cx:
            for aid in self.alumno_ids:
                for mid, chk, cop, pag in self.filas:
                    if chk.isChecked():
                        self.base.pedir(aid, mid, cop.value(), pag.isChecked())
                    elif len(self.alumno_ids) == 1:
                        cx.execute("delete from pedidos where alumno_id=? and medida_id=? and estado='pendiente'",
                                   (aid, mid))
        self.base.anotar("pedido", "alumnos", None, {"alumnos": self.alumno_ids})
        self.accept()
