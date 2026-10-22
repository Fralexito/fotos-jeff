"""Ventana principal: barra de módulos arriba, pantallas al centro, estado abajo."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import (QButtonGroup, QFrame, QHBoxLayout, QLabel, QMainWindow, QMessageBox, QStackedWidget,
                               QStatusBar, QVBoxLayout, QWidget)

from .ajustes import Ajustes
from .biblioteca import Biblioteca
from .comun import boton, etiqueta, preguntar
from .editor import Editor
from .produccion import Produccion
from .tema import C

VERSION = "0.1"


class Ventana(QMainWindow):
    def __init__(self, estado):
        super().__init__()
        self.e = estado
        self.setWindowTitle("FOTOS JEFFERSON Estudio")
        self.resize(1440, 900)
        self.setMinimumSize(1100, 700)
        raiz = QWidget()
        raiz.setObjectName("raiz")
        v = QVBoxLayout(raiz)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(0)
        v.addWidget(self._barra())
        self.paginas = QStackedWidget()
        self.biblioteca = Biblioteca(estado)
        self.editor = Editor(estado)
        self.produccion = Produccion(estado)
        self.ajustes = Ajustes(estado)
        for p in (self.biblioteca, self.editor, self.produccion, self.ajustes):
            self.paginas.addWidget(p)
        v.addWidget(self.paginas, 1)
        self.setCentralWidget(raiz)
        self.setStatusBar(QStatusBar())
        self.estado_lbl = QLabel()
        self.statusBar().addPermanentWidget(self.estado_lbl)
        self.e.aviso.connect(lambda m: self.statusBar().showMessage(m, 8000))
        self.e.abrir_foto.connect(lambda _: self.ir(1))
        self.e.fotos_cambiadas.connect(lambda _: self._conteo())
        self.e.salon_cambiado.connect(lambda _: self._conteo())
        for i, tecla in enumerate(("Ctrl+1", "Ctrl+2", "Ctrl+3", "Ctrl+4")):
            QShortcut(QKeySequence(tecla), self, lambda i=i: self.ir(i))
        self._conteo()

    def _barra(self):
        w = QWidget()
        w.setObjectName("barra")
        h = QHBoxLayout(w)
        h.setContentsMargins(14, 8, 14, 8)
        h.setSpacing(14)
        logo = QLabel("FJ")
        logo.setObjectName("logo")
        logo.setFixedSize(28, 28)
        logo.setAlignment(Qt.AlignCenter)
        h.addWidget(logo)
        h.addWidget(etiqueta("FOTOS JEFFERSON", "marca"))
        modulos = QFrame()
        modulos.setStyleSheet(f"background: {C['fondo']}; border-radius: 9px;")
        hm = QHBoxLayout(modulos)
        hm.setContentsMargins(3, 3, 3, 3)
        hm.setSpacing(2)
        self.grupo = QButtonGroup(self)
        for i, t in enumerate(("Biblioteca", "Editor", "Producción", "Ajustes")):
            b = boton(t, "modulo", chequeable=True, tip=f"Ctrl+{i + 1}")
            self.grupo.addButton(b, i)
            hm.addWidget(b)
        self.grupo.button(0).setChecked(True)
        self.grupo.idClicked.connect(self.ir)
        h.addWidget(modulos)
        h.addStretch(1)
        self.ocupado = etiqueta("", "tenue")
        h.addWidget(self.ocupado)
        h.addWidget(etiqueta(f"v{VERSION} · {self.e.base.usuario}", "tenue"))
        t = QTimer(self, interval=1000, timeout=self._pulso)
        t.start()
        return w

    def _pulso(self):
        self.ocupado.setText("Trabajando…" if self.e.colas.ocupado() else "")

    def ir(self, i: int):
        self.paginas.setCurrentIndex(i)
        self.grupo.button(i).setChecked(True)

    def _conteo(self):
        sid = self.e.salon_id
        if not sid:
            self.estado_lbl.setText("")
            return
        r = self.e.base.q1("""select count(*) total,
              sum(estado in ('lista','revisar','problema','aprobada')) editadas,
              sum(estado='aprobada') aprobadas, sum(estado='revisar') revisar, sum(estado='problema') problema
              from fotos where salon_id=? and elegida=1""", sid)
        self.estado_lbl.setText(f"Elegidas {r['total'] or 0} · Editadas {r['editadas'] or 0} · Aprobadas "
                                f"{r['aprobadas'] or 0} · Revisar {r['revisar'] or 0} · Con problema {r['problema'] or 0}")

    def closeEvent(self, ev):
        if self.e.colas.ocupado() and not preguntar(self, "Hay trabajo en curso",
                                                    "Se está importando o editando. Si cierras ahora, se termina la foto "
                                                    "actual y lo demás queda para después. ¿Cerrar?", si="Cerrar"):
            ev.ignore()
            return
        self.e.colas.cancelar_todo()
        self.e.colas.esperar(20000)
        self.e.base.cerrar()
        ev.accept()
