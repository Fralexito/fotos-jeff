"""Salón: 4 pasos grandes (traer, ordenar, editar, imprimir) y un solo botón con lo que sigue."""
from __future__ import annotations

import os

from PySide6.QtCore import QRectF, Qt, Signal
from PySide6.QtGui import QColor, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import (QFrame, QGridLayout, QHBoxLayout, QLabel, QPushButton, QScrollArea, QVBoxLayout,
                               QWidget)

from .. import flujo, miniaturas
from .tema import CL
from .vivo import Anillo, Barra, BotonVivo, Tarjeta, icono

LISTAS = ("lista", "aprobada")


class TarjetaPaso(Tarjeta):
    def __init__(self, n: int):
        super().__init__(radio=24)
        self.setMinimumHeight(200)
        v = QVBoxLayout(self)
        v.setContentsMargins(24, 24, 24, 24)
        v.setSpacing(18)
        arriba = QHBoxLayout()
        self.anillo = Anillo(56, 6, texto=str(n))
        arriba.addWidget(self.anillo)
        arriba.addStretch(1)
        self.estado = QLabel()
        arriba.addWidget(self.estado, 0, Qt.AlignTop)
        v.addLayout(arriba)
        self.titulo = QLabel()
        self.titulo.setStyleSheet("font-size: 22px; font-weight: 800;")
        self.detalle = QLabel()
        self.detalle.setObjectName("suave")
        self.detalle.setWordWrap(True)
        v.addWidget(self.titulo)
        v.addWidget(self.detalle)
        v.addStretch(1)

    def poner(self, p: flujo.Paso, n: int, retraso: int):
        hecho = p.avance >= 1
        self.titulo.setText(p.titulo)
        self.detalle.setText(p.detalle)
        fondo, tinta = ((CL["verde_bg"], CL["verde_txt"]) if hecho else
                        (CL["oro_bg"], CL["oro_txt"]) if p.avance > 0 else (CL["gris_bg"], CL["suave"]))
        self.estado.setText(p.estado)
        self.estado.setStyleSheet(f"background: {fondo}; color: {tinta}; border-radius: 13px; padding: 5px 12px; "
                                  "font-size: 13px; font-weight: 700;")
        self.anillo.valor(p.avance, CL["verde"] if hecho else CL["oro"], str(n), retraso)


class Miniatura(QLabel):
    """Foto pequeña redondeada, con un check verde si ya está lista."""

    def __init__(self, lado_w=86, lado_h=114):
        super().__init__()
        self.setFixedSize(lado_w, lado_h)
        self._pm = None
        self.lista = False

    def poner(self, ruta: str | None, lista: bool):
        self._pm = QPixmap(ruta) if ruta else None
        self.lista = lista
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        r = QRectF(self.rect())
        camino = QPainterPath()
        camino.addRoundedRect(r, 14, 14)
        p.setClipPath(camino)
        p.fillRect(r, QColor("#3A342A"))
        if self._pm and not self._pm.isNull():
            pm = self._pm.scaled(self.size(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
            p.drawPixmap((self.width() - pm.width()) // 2, (self.height() - pm.height()) // 2, pm)
        else:
            p.setBrush(QColor("#D9C7A7"))
            p.setPen(Qt.NoPen)
            w, h = self.width(), self.height()
            p.drawEllipse(QRectF(w * .3, h * .22, w * .4, w * .4))
            p.drawRoundedRect(QRectF(w * .12, h * .68, w * .76, h * .5), w * .3, w * .3)
        if self.lista:
            p.setClipping(False)
            p.setBrush(QColor(CL["verde"]))
            p.setPen(Qt.NoPen)
            p.drawEllipse(QRectF(self.width() - 30, self.height() - 30, 22, 22))
            p.drawPixmap(self.width() - 26, self.height() - 26, icono("check", "#FFFFFF", 14, 3).pixmap(14, 14))
        p.end()


class Salon(QWidget):
    ver_galeria = Signal(str)  # filtro inicial

    def __init__(self, estado, acciones):
        super().__init__()
        self.e, self.a = estado, acciones
        self.sid = None
        self.elegido = 0
        self.datos: flujo.Salon | None = None
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
        v.setSpacing(32)

        cab = QVBoxLayout()
        cab.setSpacing(14)
        self.sub = QLabel()
        self.sub.setObjectName("tenue")
        self.titulo = QLabel()
        self.titulo.setObjectName("h1")
        self.frase = QLabel()
        self.frase.setStyleSheet(f"font-size: 18px; color: {CL['suave']}; font-weight: 600;")
        fila = QHBoxLayout()
        fila.setSpacing(16)
        self.barra = Barra(12)
        self.barra.setMaximumWidth(640)
        self.pct = QLabel()
        self.pct.setStyleSheet("font-size: 20px; font-weight: 800;")
        fila.addWidget(self.barra, 1)
        fila.addWidget(self.pct)
        fila.addStretch(1)
        cab.addWidget(self.sub)
        cab.addWidget(self.titulo)
        cab.addWidget(self.frase)
        cab.addLayout(fila)
        v.addLayout(cab)

        self.grilla = QGridLayout()
        self.grilla.setSpacing(20)
        self.pasos = []
        for i in range(4):
            t = TarjetaPaso(i + 1)
            t.clicked.connect(lambda i=i: self.elegir(i))
            self.pasos.append(t)
        v.addLayout(self.grilla)
        self._columnas = 0

        # "Ahora": lo que sigue, con un solo botón grande
        self.ahora = QFrame()
        self.ahora.setObjectName("ahora")
        self.ahora.setStyleSheet(f"QFrame#ahora {{ background: {CL['tinta']}; border-radius: 28px; }}"
                                 "QFrame#ahora QLabel { color: #FBF8F2; }")
        ah = QHBoxLayout(self.ahora)
        ah.setContentsMargins(36, 32, 36, 32)
        ah.setSpacing(32)
        izq = QVBoxLayout()
        izq.setSpacing(12)
        etq = QLabel("AHORA")
        etq.setStyleSheet(f"color: {CL['oro_claro']}; font-size: 13px; font-weight: 800; letter-spacing: 2px;")
        self.pregunta = QLabel()
        self.pregunta.setWordWrap(True)
        self.pregunta.setStyleSheet("font-size: 30px; font-weight: 800; color: #FBF8F2;")
        self.ayuda = QLabel()
        self.ayuda.setWordWrap(True)
        self.ayuda.setStyleSheet("font-size: 16px; color: #CFC6B5;")
        botones = QHBoxLayout()
        botones.setSpacing(12)
        self.boton = BotonVivo()
        self.boton.clicked.connect(self.hacer)
        self.ver = QPushButton("  Ver fotos")
        self.ver.setIcon(icono("fotos", "#FBF8F2", 18))
        self.ver.setCursor(Qt.PointingHandCursor)
        self.ver.setStyleSheet("QPushButton { background: transparent; color: #FBF8F2; border: 1px solid #4A4438; "
                               "border-radius: 18px; padding: 17px 22px; font-size: 16px; font-weight: 600; }"
                               "QPushButton:hover { border-color: #E8C46A; }")
        self.ver.clicked.connect(lambda: self.ver_galeria.emit("Todas"))
        botones.addWidget(self.boton)
        botones.addWidget(self.ver)
        botones.addStretch(1)
        izq.addWidget(etq)
        izq.addWidget(self.pregunta)
        izq.addWidget(self.ayuda)
        izq.addSpacing(6)
        izq.addLayout(botones)
        ah.addLayout(izq, 5)
        self.minis = []
        mg = QGridLayout()
        mg.setSpacing(12)
        for i in range(8):
            m = Miniatura()
            self.minis.append(m)
            mg.addWidget(m, i // 4, i % 4)
        self.caja_minis = QWidget()
        self.caja_minis.setLayout(mg)
        ah.addWidget(self.caja_minis, 4, Qt.AlignVCenter)
        v.addWidget(self.ahora)
        v.addStretch(1)
        self.e.fotos_cambiadas.connect(lambda sid: sid == self.sid and self.isVisible() and self.refrescar(False))

    # ------------------------------------------------------------------
    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        cols = 4 if self.width() >= 1100 else 2
        if cols != self._columnas:
            self._columnas = cols
            for i, t in enumerate(self.pasos):
                self.grilla.addWidget(t, i // cols, i % cols)
        self.caja_minis.setVisible(self.width() >= 1000)

    def mostrar(self, sid: int):
        self.sid = sid
        self.e.elegir_salon(sid)
        self.elegido = None
        self.refrescar(True)

    def refrescar(self, animar: bool = True):
        if not self.sid:
            return
        d = self.datos = flujo.salon(self.e.base, self.sid)
        if self.elegido is None or (not animar and d.pasos[self.elegido].avance >= 1):
            self.elegido = d.siguiente
        self.sub.setText(d.subtitulo)
        self.titulo.setText(d.titulo)
        self.frase.setText(d.frase)
        self.pct.setText(f"{round(d.avance * 100)} %")
        self.barra.valor(d.avance, 250 if animar else 0)
        for i, (t, p) in enumerate(zip(self.pasos, d.pasos)):
            t.poner(p, i + 1, (90 * i + 200) if animar else 0)
            if animar:
                t.entrar(70 * i)
        self.elegir(self.elegido)
        self._minis()

    def elegir(self, i: int):
        self.elegido = i
        for k, t in enumerate(self.pasos):
            t.marcar(k == i)
        p = self.datos.pasos[i]
        self.pregunta.setText(p.pregunta)
        self.ayuda.setText(p.ayuda)
        self.boton.setText(p.boton)
        self.boton.setEnabled(p.habilitado)

    def _minis(self):
        b = self.e.base
        fotos = b.q("""select f.*, (select s.ruta from salidas s where s.foto_id = f.id order by s.id limit 1) salida
                       from fotos f where f.salon_id = ? and f.estado != 'descartada'
                       order by f.elegida desc, (f.estado in ('lista','aprobada')) desc, f.tomada_en limit 8""", self.sid)
        for m in self.minis:
            m.poner(None, False)
        pend = []
        for m, f in zip(self.minis, fotos):
            origen = os.path.join(b.raiz, f["salida"]) if f["salida"] else os.path.join(b.raiz, f["ruta_original"])
            clave = (f["hash"][:20] + ("e" if f["salida"] else ""))
            r = miniaturas.ruta(b.raiz, clave)
            if os.path.exists(r):
                m.poner(r, f["estado"] in LISTAS)
            else:
                pend.append((m, origen, clave, f["estado"] in LISTAS))
        if pend:
            def hacer(t):
                return [(m, miniaturas.obtener(b.raiz, o, c), l) for m, o, c, l in pend]

            def poner(res):
                for m, r, l in res:
                    m.poner(r, l)
            self.e.colas.lanzar(hacer, al_listo=poner)

    # ------------------------------------------------------------------
    def hacer(self):
        p = self.datos.pasos[self.elegido]
        sid = self.sid
        if p.clave == "traer":
            self.a.traer(sid)
        elif p.clave == "ordenar":
            c = flujo.conteos(self.e.base, sid)
            if not c["alumnos"]:
                if self.a.cargar_lista(sid) and c["sin_alumno"]:
                    self.a.repartir(sid)
            elif c["sin_alumno"]:
                self.a.repartir(sid)
            else:
                self.ver_galeria.emit("Todas")
        elif p.clave == "editar":
            c = flujo.conteos(self.e.base, sid)
            if c["elegidas"] > c["editadas"]:
                self.a.editar(sid)
            else:
                self.ver_galeria.emit("Por revisar" if c["por_revisar"] else "Todas")
        elif p.clave == "imprimir":
            self.a.imprimir(sid)
        self.refrescar(False)
