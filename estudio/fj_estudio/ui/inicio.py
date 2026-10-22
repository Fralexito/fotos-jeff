"""Inicio: tus colegios como tarjetas de colores con su avance. Al tocar una se ven sus salones."""
from __future__ import annotations

from PySide6.QtCore import QEasingCurve, QPropertyAnimation, Qt, Signal
from PySide6.QtWidgets import (QFrame, QGridLayout, QHBoxLayout, QLabel, QLineEdit, QPushButton, QScrollArea,
                               QVBoxLayout, QWidget)

from .. import flujo
from .tema import CL, PALETAS_COLEGIO
from .vivo import Anillo, Barra, BotonVivo, Tarjeta, icono


class FilaSalon(Tarjeta):
    def __init__(self, s: dict, tinta: str):
        super().__init__(fondo="rgba(255,255,255,0.62)", borde="transparent", radio=16, sombra=False)
        self.sid = s["id"]
        h = QHBoxLayout(self)
        h.setContentsMargins(16, 12, 16, 12)
        h.setSpacing(14)
        n = QLabel(s["nombre"] or "Salón")
        n.setStyleSheet("font-size: 16px; font-weight: 800;")
        n.setFixedWidth(96)
        h.addWidget(n)
        self.barra = Barra(8, tinta, "#1A15233A")
        h.addWidget(self.barra, 1)
        t = QLabel("Listo" if s["avance"] >= 1 else s["detalle"])
        t.setStyleSheet("font-size: 14px; font-weight: 700;")
        t.setFixedWidth(110)
        t.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
        h.addWidget(t)
        self._av = s["avance"]
        self.setToolTip(f"{s['campana']} · {s['alumnos']} alumnos")

    def animar(self, retraso):
        self.barra.valor(self._av, retraso)


class TarjetaColegio(Tarjeta):
    abrir_salon = Signal(int)

    def __init__(self, col: dict, paleta: tuple[str, str]):
        fondo, tinta = paleta
        super().__init__(fondo=fondo, borde=fondo, radio=28)
        self.col, self.tinta = col, tinta
        self.abierto = False
        v = QVBoxLayout(self)
        v.setContentsMargins(26, 26, 26, 26)
        v.setSpacing(16)
        arriba = QHBoxLayout()
        arriba.setSpacing(18)
        self.anillo = Anillo(84, 9, tinta, "#1A15233A", px_texto=19)
        arriba.addWidget(self.anillo)
        textos = QVBoxLayout()
        textos.setSpacing(4)
        nombre = QLabel(col["nombre"])
        nombre.setWordWrap(True)
        nombre.setStyleSheet("font-size: 20px; font-weight: 800;")
        n = len(col["salones"])
        info = QLabel(f"{col['sede']} · {n} {'salón' if n == 1 else 'salones'} · {col['alumnos']} alumnos")
        info.setStyleSheet("font-size: 14px; color: #3D4C63;")
        textos.addWidget(nombre)
        textos.addWidget(info)
        arriba.addLayout(textos, 1)
        self.flecha = QLabel()
        self._flecha()
        arriba.addWidget(self.flecha)
        v.addLayout(arriba)
        self.lista = QWidget()
        lv = QVBoxLayout(self.lista)
        lv.setContentsMargins(0, 0, 0, 0)
        lv.setSpacing(8)
        self.filas = []
        for s in col["salones"]:
            f = FilaSalon(s, tinta)
            f.clicked.connect(lambda sid=s["id"]: self.abrir_salon.emit(sid))
            lv.addWidget(f)
            self.filas.append(f)
        self.lista.setMaximumHeight(0)
        v.addWidget(self.lista)
        self._anim = QPropertyAnimation(self.lista, b"maximumHeight", self, duration=380,
                                        easingCurve=QEasingCurve.OutCubic)
        self.clicked.connect(self.alternar)

    def _flecha(self):
        self.flecha.setPixmap(icono("arriba" if self.abierto else "abajo", CL["tinta"], 22, 2.4).pixmap(22, 22))

    def animar(self, retraso):
        av = self.col["avance"]
        self.anillo.valor(av, texto=f"{round(av * 100)}%", retraso_ms=retraso + 150)

    def alternar(self, abrir: bool | None = None):
        self.abierto = (not self.abierto) if abrir is None else abrir
        self._flecha()
        alto = self.lista.sizeHint().height()
        self._anim.stop()
        self._anim.setStartValue(self.lista.maximumHeight() if self.lista.maximumHeight() < 10000 else alto)
        self._anim.setEndValue(alto if self.abierto else 0)
        self._anim.start()
        if self.abierto:
            for i, f in enumerate(self.filas):
                f.animar(120 + 60 * i)


class Inicio(QWidget):
    abrir_salon = Signal(int)
    nuevo_salon = Signal()

    def __init__(self, estado):
        super().__init__()
        self.e = estado
        scroll = QScrollArea(self)
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        raiz = QVBoxLayout(self)
        raiz.setContentsMargins(0, 0, 0, 0)
        raiz.addWidget(scroll)
        cont = QWidget()
        scroll.setWidget(cont)
        fuera = QHBoxLayout(cont)
        fuera.setContentsMargins(40, 12, 40, 48)
        centro = QWidget()
        centro.setMaximumWidth(1240)
        fuera.addStretch(1)
        fuera.addWidget(centro, 100)
        fuera.addStretch(1)
        v = QVBoxLayout(centro)
        v.setContentsMargins(0, 0, 0, 0)
        v.setSpacing(28)

        cab = QHBoxLayout()
        cab.setSpacing(16)
        tt = QVBoxLayout()
        tt.setSpacing(6)
        h1 = QLabel("Tus colegios")
        h1.setObjectName("h1")
        self.sub = QLabel("Toca uno para ver sus salones.")
        self.sub.setObjectName("suave")
        tt.addWidget(h1)
        tt.addWidget(self.sub)
        cab.addLayout(tt, 1)
        self.buscar = QLineEdit()
        self.buscar.setObjectName("buscar")
        self.buscar.setPlaceholderText("Busca un colegio o un alumno")
        self.buscar.addAction(icono("buscar", CL["suave"], 20), QLineEdit.LeadingPosition)
        self.buscar.setMinimumWidth(320)
        self.buscar.setMaximumWidth(420)
        self.buscar.setClearButtonEnabled(True)
        self.buscar.textChanged.connect(lambda _: self.cargar(animar=False))
        cab.addWidget(self.buscar, 0, Qt.AlignBottom)
        nuevo = QPushButton("  Nuevo salón")
        nuevo.setObjectName("oscuro")
        nuevo.setIcon(icono("mas", "#FFFFFF", 18, 2.6))
        nuevo.setCursor(Qt.PointingHandCursor)
        nuevo.clicked.connect(self.nuevo_salon)
        cab.addWidget(nuevo, 0, Qt.AlignBottom)
        v.addLayout(cab)

        self.grilla = QGridLayout()
        self.grilla.setSpacing(24)
        self.grilla.setAlignment(Qt.AlignTop)
        v.addLayout(self.grilla)
        v.addStretch(1)
        self.tarjetas: list[TarjetaColegio] = []
        self._columnas = 0
        self.e.fotos_cambiadas.connect(lambda _: self.isVisible() and self.cargar(animar=False))

    def showEvent(self, ev):
        super().showEvent(ev)
        self.cargar()

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        cols = max(1, min(3, (self.width() - 80) // 390))
        if cols != self._columnas:
            self._columnas = cols
            self._ubicar()

    def _ubicar(self):
        for i, t in enumerate(self.tarjetas):
            self.grilla.addWidget(t, i // max(1, self._columnas), i % max(1, self._columnas), Qt.AlignTop)

    def cargar(self, animar: bool = True):
        abiertos = {t.col["id"] for t in self.tarjetas if t.abierto}
        while self.grilla.count():
            w = self.grilla.takeAt(0).widget()
            if w:
                w.deleteLater()
        self.tarjetas = []
        cols = flujo.colegios(self.e.base)
        texto = self.buscar.text().strip().lower()
        if texto:
            con_alumno = {r[0] for r in self.e.base.q(
                "select distinct salon_id from alumnos where lower(nombres || ' ' || apellidos) like ?", f"%{texto}%")}
            filtrados = []
            for c in cols:
                if texto in c["nombre"].lower():
                    filtrados.append(c)
                    continue
                ss = [s for s in c["salones"] if s["id"] in con_alumno or texto in s["nombre"].lower()]
                if ss:
                    filtrados.append({**c, "salones": ss, "_abrir": True})
            cols = filtrados
        if not cols:
            self.grilla.addWidget(self._vacio(bool(texto)), 0, 0, 1, max(1, self._columnas))
            return
        total_salones = sum(len(c["salones"]) for c in cols)
        self.sub.setText(f"{len(cols)} {'colegio' if len(cols) == 1 else 'colegios'} · "
                         f"{total_salones} {'salón' if total_salones == 1 else 'salones'}. Toca uno para ver sus salones.")
        for i, c in enumerate(cols):
            t = TarjetaColegio(c, PALETAS_COLEGIO[i % len(PALETAS_COLEGIO)])
            t.abrir_salon.connect(self.abrir_salon)
            self.tarjetas.append(t)
            if animar:
                t.entrar(70 * i)
            t.animar(70 * i if animar else 0)
            if c["id"] in abiertos or c.get("_abrir") or len(cols) == 1:
                t.alternar(True)
        self._ubicar()

    def _vacio(self, buscando: bool) -> QWidget:
        c = Tarjeta(clicable=False, radio=28, sombra=False)
        v = QVBoxLayout(c)
        v.setContentsMargins(40, 48, 40, 48)
        v.setSpacing(14)
        v.setAlignment(Qt.AlignCenter)
        t = QLabel("No encontré nada con eso" if buscando else "Aún no hay salones")
        t.setObjectName("h2")
        t.setAlignment(Qt.AlignCenter)
        s = QLabel("Prueba con otro nombre." if buscando else
                   "Crea el primero: eliges el colegio, el grado y la sección. Después traes las fotos.")
        s.setObjectName("suave")
        s.setAlignment(Qt.AlignCenter)
        s.setWordWrap(True)
        v.addWidget(t)
        v.addWidget(s)
        if not buscando:
            b = BotonVivo("Crear el primer salón")
            b.clicked.connect(self.nuevo_salon)
            v.addWidget(b, 0, Qt.AlignCenter)
        c.entrar(0)
        return c
