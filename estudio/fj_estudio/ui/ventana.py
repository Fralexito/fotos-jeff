"""Ventanas: la principal (colegios → salón → galería) y la de herramientas avanzadas (las pantallas de antes)."""
from __future__ import annotations

from PySide6.QtCore import Qt, QTimer
from PySide6.QtGui import QKeySequence, QShortcut
from PySide6.QtWidgets import (QButtonGroup, QFrame, QHBoxLayout, QLabel, QMainWindow, QMessageBox, QPushButton,
                               QStackedWidget, QStatusBar, QVBoxLayout, QWidget)

from .ajustes import Ajustes
from .biblioteca import Biblioteca
from .comun import boton, etiqueta, preguntar
from .dialogos import NuevoSalon
from .editor import Editor
from .produccion import Produccion
from .acciones import Acciones
from .galeria import Galeria
from .inicio import Inicio
from .salon import Salon
from .tema import C, CL, QSS
from .vivo import Aviso, Pila, icono

VERSION = "0.2"


class VentanaAvanzada(QMainWindow):
    """Biblioteca, editor, producción y ajustes con todos sus controles. Se abre desde «Herramientas»."""

    def __init__(self, estado, padre=None):
        super().__init__(padre)
        self.e = estado
        self.setStyleSheet(QSS)
        self.setWindowTitle("FOTOS JEFFERSON Estudio · Herramientas")
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


class Ventana(QMainWindow):
    """Lo de todos los días, en tres pantallas que se deslizan: colegios → salón → galería."""

    def __init__(self, estado):
        super().__init__()
        self.e = estado
        self.setWindowTitle("FOTOS JEFFERSON Estudio")
        self.resize(1440, 900)
        self.setMinimumSize(1000, 660)
        self._avanzada: VentanaAvanzada | None = None
        self._actual: QWidget | None = None
        raiz = QWidget()
        raiz.setObjectName("raiz")
        v = QVBoxLayout(raiz)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(0)
        v.addWidget(self._cabecera())
        self.pila = Pila()
        v.addWidget(self.pila, 1)
        self.setCentralWidget(raiz)
        self.aviso = Aviso(raiz)
        self.acciones = Acciones(estado, self.aviso, self)
        self.inicio = Inicio(estado)
        self.salon = Salon(estado, self.acciones)
        self.galeria = Galeria(estado, self.acciones)
        for w in (self.inicio, self.salon, self.galeria):
            self.pila.addWidget(w)
        self._actual = self.inicio
        self.inicio.abrir_salon.connect(self.abrir_salon)
        self.inicio.nuevo_salon.connect(self.nuevo_salon)
        self.salon.ver_galeria.connect(self.ver_galeria)
        self.galeria.volver.connect(self.atras)
        self.galeria.abrir_editor.connect(self.abrir_editor)
        self.e.aviso.connect(lambda m: self.aviso.mensaje(m))
        QShortcut(QKeySequence("Alt+Left"), self, self.atras)
        QShortcut(QKeySequence("Backspace"), self, lambda: self._actual is self.salon and self.atras())
        self._migas()

    def _cabecera(self):
        w = self.cabecera = QWidget()
        w.setObjectName("cabecera")
        w.setAttribute(Qt.WA_StyledBackground, True)
        h = QHBoxLayout(w)
        h.setContentsMargins(28, 16, 28, 10)
        h.setSpacing(12)
        self.btn_atras = QPushButton()
        self.btn_atras.setObjectName("redondo")
        self.btn_atras.setIcon(icono("atras", CL["tinta"], 20, 2.4))
        self.btn_atras.setToolTip("Volver (Alt+←)")
        self.btn_atras.setCursor(Qt.PointingHandCursor)
        self.btn_atras.clicked.connect(self.atras)
        h.addWidget(self.btn_atras)
        logo = QLabel("FJ")
        logo.setFixedSize(40, 40)
        logo.setAlignment(Qt.AlignCenter)
        logo.setStyleSheet(f"background: {CL['tinta']}; color: {CL['oro_claro']}; border-radius: 12px;"
                           "font-size: 15px; font-weight: 800;")
        h.addWidget(logo)
        marca = QLabel("FOTOS JEFFERSON")
        marca.setObjectName("marca")
        h.addWidget(marca)
        self.migas = QLabel()
        self.migas.setObjectName("tenue")
        h.addWidget(self.migas)
        h.addStretch(1)
        herr = self.btn_herr = QPushButton("  Herramientas")
        herr.setObjectName("fantasma")
        herr.setIcon(icono("herramientas", CL["suave"], 20))
        herr.setToolTip("Las pantallas completas: biblioteca, editor, producción")
        herr.setCursor(Qt.PointingHandCursor)
        herr.clicked.connect(lambda: self.avanzada(0))
        h.addWidget(herr)
        aj = self.btn_aj = QPushButton()
        aj.setObjectName("redondo")
        aj.setIcon(icono("ajustes", CL["tinta"], 20))
        aj.setToolTip("Ajustes")
        aj.setCursor(Qt.PointingHandCursor)
        aj.clicked.connect(lambda: self.avanzada(3))
        h.addWidget(aj)
        return w

    def _ir(self, w: QWidget, adelante: bool):
        # la pila cambia su pantalla actual recién al terminar el deslizamiento; la cabecera cambia ya
        self._actual = w
        self.pila.ir(w, adelante)
        self._migas()

    def _migas(self):
        actual = self._actual
        oscuro = actual is self.galeria
        self.cabecera.setStyleSheet(f"QWidget#cabecera {{ background: {'#121212' if oscuro else CL['fondo']}; }}"
                                    + ("QWidget#cabecera QLabel { color: #F2EEE6; } QWidget#cabecera QPushButton#redondo "
                                       "{ background: #2C2C2C; border: 0; } QWidget#cabecera QPushButton#fantasma "
                                       "{ color: #CFC9BD; }" if oscuro else ""))
        tinta = "#F2EEE6" if oscuro else CL["tinta"]
        self.btn_atras.setIcon(icono("atras", tinta, 20, 2.4))
        self.btn_aj.setIcon(icono("ajustes", tinta, 20))
        self.btn_herr.setIcon(icono("herramientas", "#CFC9BD" if oscuro else CL["suave"], 20))
        self.btn_atras.setVisible(actual is not self.inicio)
        if actual is self.inicio or not self.e.salon_id:
            self.migas.setText("")
            return
        info = self.e.base.info_salon(self.e.salon_id)
        txt = f"·  {info['colegio']}  ·  {info['grado']} {info['seccion']}".strip()
        self.migas.setText(txt + ("  ·  Galería" if actual is self.galeria else ""))

    # ------------------------------------------------------------------ navegación
    def abrir_salon(self, sid: int):
        self.e.elegir_salon(sid)
        self.salon.mostrar(sid)
        self._ir(self.salon, True)

    def ver_galeria(self, filtro: str = "Todas"):
        if not self.e.salon_id:
            return
        self.galeria.mostrar(self.e.salon_id, filtro)
        self._ir(self.galeria, True)

    def atras(self):
        if self._actual is self.galeria:
            self.salon.refrescar(animar=False)
            self._ir(self.salon, False)
        elif self._actual is self.salon:
            self._ir(self.inicio, False)

    def nuevo_salon(self):
        d = NuevoSalon(self.e.base, self)
        if d.exec() and d.salon_id:
            self.abrir_salon(d.salon_id)

    def avanzada(self, pagina: int = 0) -> VentanaAvanzada:
        if self._avanzada is None:
            self._avanzada = VentanaAvanzada(self.e, self)
        self._avanzada.ir(pagina)
        self._avanzada.show()
        self._avanzada.raise_()
        self._avanzada.activateWindow()
        return self._avanzada

    def abrir_editor(self, foto_id: int):
        self.avanzada(1)
        self.e.abrir_foto.emit(foto_id)

    def closeEvent(self, ev):
        if self.e.colas.ocupado() and not preguntar(self, "Hay trabajo en curso",
                                                    "Se está importando o editando. Si cierras ahora, se termina la foto "
                                                    "actual y lo demás queda para después. ¿Cerrar?", si="Cerrar"):
            ev.ignore()
            return
        self.e.colas.cancelar_todo()
        self.e.colas.esperar(20000)
        if self._avanzada:
            self._avanzada.close()  # sin esto el programa seguiría abierto con las herramientas a la vista
        self.e.base.cerrar()
        ev.accept()
