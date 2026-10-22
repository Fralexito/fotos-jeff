"""Piezas compartidas por las pantallas."""
from __future__ import annotations

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtGui import QColor, QIcon, QPainter, QPixmap
from PySide6.QtWidgets import (QFrame, QHBoxLayout, QLabel, QMessageBox, QPushButton, QSizePolicy, QVBoxLayout,
                               QWidget)

from .tema import C


class Estado(QObject):
    """Lo que comparten todas las pantallas: base, colas de trabajo y qué está seleccionado."""
    salon_cambiado = Signal(int)
    fotos_cambiadas = Signal(int)      # salon_id
    abrir_foto = Signal(int)           # foto_id -> Editor
    aviso = Signal(str)                # mensaje corto en la barra de estado
    medidas_cambiadas = Signal()

    def __init__(self, base, colas, ajustes_app):
        super().__init__()
        self.base = base
        self.colas = colas
        self.app = ajustes_app          # QSettings
        self.salon_id: int | None = None

    def elegir_salon(self, salon_id: int | None):
        self.salon_id = salon_id
        if salon_id:
            self.salon_cambiado.emit(salon_id)


def etiqueta(texto: str, nombre: str | None = None, ajustar: bool = False) -> QLabel:
    l = QLabel(texto)
    if nombre:
        l.setObjectName(nombre)
    if ajustar:
        l.setWordWrap(True)
    return l


def boton(texto: str, nombre: str | None = None, al_click=None, tip: str | None = None,
          chequeable: bool = False) -> QPushButton:
    b = QPushButton(texto)
    if nombre:
        b.setObjectName(nombre)
    if al_click:
        b.clicked.connect(al_click)
    if tip:
        b.setToolTip(tip)
    b.setCheckable(chequeable)
    b.setCursor(Qt.PointingHandCursor)
    return b


def fila(*widgets, margen=0, espacio=8, estirar_en: int | None = None) -> QHBoxLayout:
    h = QHBoxLayout()
    h.setContentsMargins(margen, margen, margen, margen)
    h.setSpacing(espacio)
    for w in widgets:
        if w is None:
            h.addStretch(1)
        elif isinstance(w, QWidget):
            h.addWidget(w)
        else:
            h.addLayout(w)
    return h


def columna(*widgets, margen=0, espacio=8) -> QVBoxLayout:
    v = QVBoxLayout()
    v.setContentsMargins(margen, margen, margen, margen)
    v.setSpacing(espacio)
    for w in widgets:
        if w is None:
            v.addStretch(1)
        elif isinstance(w, QWidget):
            v.addWidget(w)
        else:
            v.addLayout(w)
    return v


def tarjeta() -> QFrame:
    f = QFrame()
    f.setObjectName("tarjeta")
    return f


def punto(color: str, lado: int = 10) -> QIcon:
    pm = QPixmap(lado, lado)
    pm.fill(Qt.transparent)
    p = QPainter(pm)
    p.setRenderHint(QPainter.Antialiasing)
    p.setBrush(QColor(color))
    p.setPen(Qt.NoPen)
    p.drawEllipse(0, 0, lado, lado)
    p.end()
    return QIcon(pm)


def preguntar(padre, titulo: str, texto: str, si="Sí", no="Cancelar") -> bool:
    m = QMessageBox(padre)
    m.setWindowTitle(titulo)
    m.setText(texto)
    bs = m.addButton(si, QMessageBox.AcceptRole)
    m.addButton(no, QMessageBox.RejectRole)
    m.exec()
    return m.clickedButton() is bs


def avisar_error(padre, texto: str):
    QMessageBox.warning(padre, "FOTOS JEFFERSON", texto)


def separador() -> QFrame:
    f = QFrame()
    f.setFixedHeight(1)
    f.setStyleSheet(f"background: {C['borde']};")
    f.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
    return f
