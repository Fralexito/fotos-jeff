"""
Piezas con movimiento para el diseño simple: anillos y barras que se llenan, tarjetas que se elevan
al pasar el mouse, botón principal que "respira", pantallas que se deslizan y avisos que aparecen
abajo. Todo con QPropertyAnimation, sin dependencias extra.
"""
from __future__ import annotations

from PySide6.QtCore import (Property, QByteArray, QEasingCurve, QParallelAnimationGroup, QPoint, QPropertyAnimation,
                            QRectF, QSequentialAnimationGroup, QSize, Qt, QTimer, QVariantAnimation, Signal)
from PySide6.QtGui import QColor, QFont, QIcon, QPainter, QPainterPath, QPen, QPixmap
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtWidgets import (QFrame, QGraphicsDropShadowEffect, QGraphicsOpacityEffect, QHBoxLayout, QLabel,
                               QProgressBar, QPushButton, QSizePolicy, QStackedWidget, QVBoxLayout, QWidget)

from .tema import CL, FUENTE

SUAVE = QEasingCurve.OutCubic

# ------------------------------------------------------------------ íconos (trazos simples)
_SVG = {
    "atras": '<path d="M15 18l-6-6 6-6"/>',
    "abajo": '<path d="M6 9l6 6 6-6"/>',
    "arriba": '<path d="M6 15l6-6 6 6"/>',
    "buscar": '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    "ajustes": '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1'
               'M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    "mas": '<path d="M12 5v14M5 12h14"/>',
    "camara": '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    "lista": '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/>'
             '<circle cx="4.5" cy="18" r="1"/>',
    "varita": '<path d="M4 20L16 8"/><path d="M15 4v3M18 2v2M20 6h-3M19 10h2"/>',
    "imprimir": '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    "check": '<path d="M5 12l5 5 9-10"/>',
    "cerrar": '<path d="M6 6l12 12M18 6L6 18"/>',
    "fotos": '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/>'
             '<rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    "ia": '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8'
          'L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    "otra": '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/>'
            '<path d="M4 20v-5h5"/>',
    "drive": '<path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="M8 3l6 10h8M2 13h12l-4 7"/>',
    "carpeta": '<path d="M3 6h6l2 2h10v11H3z"/>',
    "herramientas": '<path d="M14 7l3-3 3 3-3 3M17 4l-9 9M5 15l4 4M3 21l3-3"/>',
}


def icono(nombre: str, color: str = CL["tinta"], lado: int = 22, grosor: float = 2.0) -> QIcon:
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="{color}" '
           f'stroke-width="{grosor}" stroke-linecap="round" stroke-linejoin="round">{_SVG[nombre]}</svg>')
    r = QSvgRenderer(QByteArray(svg.encode()))
    ic = QIcon()
    for escala in (1, 2):
        pm = QPixmap(lado * escala, lado * escala)
        pm.fill(Qt.transparent)
        p = QPainter(pm)
        p.setRenderHint(QPainter.Antialiasing)
        r.render(p)
        p.end()
        pm.setDevicePixelRatio(escala)
        ic.addPixmap(pm)
    return ic


def fuente(px: int, peso: int = 400) -> QFont:
    f = QFont(FUENTE)
    f.setPixelSize(px)
    f.setWeight(QFont.Weight(peso))
    return f


# ------------------------------------------------------------------ anillo y barra
class Anillo(QWidget):
    """Avance en círculo que se llena con animación. Texto al centro (número del paso o %)."""

    def __init__(self, lado=56, grosor=6, color=CL["oro"], pista=CL["pista"], texto="", px_texto=18, padre=None):
        super().__init__(padre)
        self.setFixedSize(lado, lado)
        self.grosor, self.color, self.pista, self.texto, self.px_texto = grosor, QColor(color), QColor(pista), texto, px_texto
        self._v = 0.0
        self._anim = QVariantAnimation(self, duration=1100, easingCurve=SUAVE)
        self._anim.valueChanged.connect(self._poner)

    def _poner(self, v):
        self._v = float(v)
        self.update()

    def valor(self, v: float, color: str | None = None, texto: str | None = None, retraso_ms: int = 0):
        if color:
            self.color = QColor(color)
        if texto is not None:
            self.texto = texto
        self._anim.stop()
        self._anim.setStartValue(0.0)
        self._anim.setEndValue(max(0.0, min(1.0, v)))
        QTimer.singleShot(retraso_ms, self._anim.start)

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        m = self.grosor / 2 + 1
        r = QRectF(m, m, self.width() - 2 * m, self.height() - 2 * m)
        pen = QPen(self.pista, self.grosor, Qt.SolidLine, Qt.RoundCap)
        p.setPen(pen)
        p.drawEllipse(r)
        if self._v > 0.001:
            pen.setColor(self.color)
            p.setPen(pen)
            p.drawArc(r, 90 * 16, int(-self._v * 360 * 16))
        if self.texto:
            p.setPen(QColor(CL["tinta"]))
            p.setFont(fuente(self.px_texto, 800))
            p.drawText(self.rect(), Qt.AlignCenter, self.texto)
        p.end()


class Barra(QWidget):
    def __init__(self, alto=12, color=CL["oro"], pista=CL["pista"], padre=None):
        super().__init__(padre)
        self.setFixedHeight(alto)
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.color, self.pista = QColor(color), QColor(pista)
        self._v = 0.0
        self._anim = QVariantAnimation(self, duration=1400, easingCurve=SUAVE)
        self._anim.valueChanged.connect(lambda v: (setattr(self, "_v", float(v)), self.update()))

    def valor(self, v: float, retraso_ms: int = 250, color: str | None = None):
        if color:
            self.color = QColor(color)
        self._anim.stop()
        self._anim.setStartValue(0.0)
        self._anim.setEndValue(max(0.0, min(1.0, v)))
        QTimer.singleShot(retraso_ms, self._anim.start)

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setPen(Qt.NoPen)
        h = self.height()
        p.setBrush(self.pista)
        p.drawRoundedRect(QRectF(0, 0, self.width(), h), h / 2, h / 2)
        if self._v > 0.001:
            p.setBrush(self.color)
            p.drawRoundedRect(QRectF(0, 0, max(h, self.width() * self._v), h), h / 2, h / 2)
        p.end()


# ------------------------------------------------------------------ tarjeta que se eleva
class Tarjeta(QFrame):
    """Caja redondeada clicable: al pasar el mouse gana sombra. Con sombra=False (si va dentro de otra tarjeta o
    lleva un BotonVivo: Qt no dibuja bien efectos anidados) se marca el borde en vez de la sombra."""
    clicked = Signal()

    def __init__(self, fondo=CL["tarjeta"], borde=CL["borde"], radio=24, clicable=True, padre=None, sombra=True):
        super().__init__(padre)
        self.fondo, self.borde, self.radio, self.clicable = fondo, borde, radio, clicable
        self.con_sombra = sombra
        self.sombra = None
        self._estilo()
        self._crear_sombra()
        self._anim = QVariantAnimation(self, duration=260, easingCurve=SUAVE)
        self._anim.valueChanged.connect(self._hover)
        if clicable:
            self.setCursor(Qt.PointingHandCursor)
            self.setFocusPolicy(Qt.StrongFocus)

    def _crear_sombra(self):
        if not self.con_sombra:
            self.setGraphicsEffect(None)
            return
        self.sombra = QGraphicsDropShadowEffect(self, blurRadius=0, offset=QPoint(0, 0), color=QColor(60, 40, 10, 0))
        self.setGraphicsEffect(self.sombra)

    def entrar(self, retraso_ms: int = 0):
        """Aparece suavemente (para entrar en cascada) y después recupera su sombra."""
        aparecer(self, retraso_ms, al_terminar=self._crear_sombra)

    def _estilo(self, borde=None):
        self.setStyleSheet(f"Tarjeta {{ background: {self.fondo}; border: 2px solid {borde or self.borde}; "
                           f"border-radius: {self.radio}px; }}")

    def marcar(self, si: bool, color=CL["oro"]):
        self._estilo(color if si else None)

    def _hover(self, t):
        t = float(t)
        self.sombra.setBlurRadius(40 * t)
        self.sombra.setOffset(0, 14 * t)
        self.sombra.setColor(QColor(60, 40, 10, int(40 * t)))

    def _ir(self, fin):
        if not self.con_sombra:
            self._estilo(CL["oro"] if fin else None)
            return
        if not isinstance(self.graphicsEffect(), QGraphicsDropShadowEffect):
            return
        self._anim.stop()
        self._anim.setStartValue(self.sombra.blurRadius() / 40)
        self._anim.setEndValue(fin)
        self._anim.start()

    def enterEvent(self, ev):
        if self.clicable:
            self._ir(1.0)
        super().enterEvent(ev)

    def leaveEvent(self, ev):
        self._ir(0.0)
        super().leaveEvent(ev)

    def mouseReleaseEvent(self, ev):
        if self.clicable and ev.button() == Qt.LeftButton and self.rect().contains(ev.position().toPoint()):
            self.clicked.emit()
        super().mouseReleaseEvent(ev)

    def keyPressEvent(self, ev):
        if self.clicable and ev.key() in (Qt.Key_Return, Qt.Key_Enter, Qt.Key_Space):
            self.clicked.emit()
            return
        super().keyPressEvent(ev)


# ------------------------------------------------------------------ botón principal
class BotonVivo(QPushButton):
    """Botón dorado grande que "respira" (un brillo suave que va y viene) para marcar qué sigue."""

    def __init__(self, texto="", fondo=CL["oro_claro"], tinta=CL["tinta"], respirar=True, padre=None):
        super().__init__(texto, padre)
        self.setCursor(Qt.PointingHandCursor)
        self.setStyleSheet(f"QPushButton {{ background: {fondo}; color: {tinta}; border: 0; border-radius: 18px; "
                           f"padding: 18px 28px; font-size: 18px; font-weight: 800; }}"
                           f"QPushButton:hover {{ background: #F0D283; }}"
                           f"QPushButton:disabled {{ background: #5A5347; color: #A59E90; }}")
        self.brillo = QGraphicsDropShadowEffect(self, blurRadius=0, offset=QPoint(0, 0), color=QColor(fondo))
        if respirar:
            self.setGraphicsEffect(self.brillo)
        self._anim = QVariantAnimation(self, startValue=0.0, endValue=1.0, duration=1800, loopCount=-1)
        self._anim.setEasingCurve(QEasingCurve.InOutSine)
        self._anim.valueChanged.connect(self._latir)
        if respirar:
            self._anim.start()

    def _latir(self, t):
        t = float(t)
        k = 1 - abs(2 * t - 1)  # 0 → 1 → 0
        self.brillo.setBlurRadius(10 + 26 * k)
        c = QColor(self.brillo.color())
        c.setAlpha(int(90 + 120 * k) if self.isEnabled() else 0)
        self.brillo.setColor(c)


# ------------------------------------------------------------------ pantallas que se deslizan
class Pila(QStackedWidget):
    """Como QStackedWidget, pero la pantalla nueva entra deslizándose (adelante → desde la derecha)."""

    def __init__(self, padre=None):
        super().__init__(padre)
        self._grupo = None

    def ir(self, widget: QWidget, adelante: bool = True):
        actual = self.currentWidget()
        if actual is widget or actual is None or not self.isVisible():
            self.setCurrentWidget(widget)
            return
        if self._grupo:
            self._grupo.stop()
        ancho = self.width()
        dx = ancho if adelante else -ancho
        widget.setGeometry(0, 0, ancho, self.height())
        widget.move(dx, 0)
        widget.show()
        widget.raise_()
        g = QParallelAnimationGroup(self)
        for w, ini, fin in ((actual, QPoint(0, 0), QPoint(-dx // 3, 0)), (widget, QPoint(dx, 0), QPoint(0, 0))):
            a = QPropertyAnimation(w, b"pos", self)
            a.setDuration(420)
            a.setEasingCurve(QEasingCurve.OutQuart)
            a.setStartValue(ini)
            a.setEndValue(fin)
            g.addAnimation(a)

        def fin():
            self.setCurrentWidget(widget)
            actual.move(0, 0)
            actual.hide() if actual is not self.currentWidget() else None
            self._grupo = None

        g.finished.connect(fin)
        self._grupo = g
        g.start()


# ------------------------------------------------------------------ aviso flotante abajo
class Aviso(QFrame):
    """Píldora oscura que aparece abajo: mensajes cortos o el avance de un trabajo (con Cancelar)."""
    cancelar = Signal()

    def __init__(self, padre: QWidget):
        super().__init__(padre)
        self.setObjectName("aviso")
        self.setStyleSheet(f"QFrame#aviso {{ background: {CL['tinta']}; border-radius: 26px; }}"
                           "QFrame#aviso QLabel { color: #FBF8F2; font-weight: 600; }"
                           "QFrame#aviso QPushButton { background: transparent; color: #E8C46A; border: 0; "
                           "padding: 6px 10px; font-weight: 800; }"
                           "QFrame#aviso QProgressBar { background: #3A352C; border: 0; border-radius: 3px; }"
                           "QFrame#aviso QProgressBar::chunk { background: #E8C46A; border-radius: 3px; }")
        h = QHBoxLayout(self)
        h.setContentsMargins(24, 12, 14, 12)
        h.setSpacing(14)
        self.texto = QLabel()
        self.barra = QProgressBar()
        self.barra.setTextVisible(False)
        self.barra.setFixedSize(160, 6)
        self.btn = QPushButton("Cancelar")
        self.btn.setCursor(Qt.PointingHandCursor)
        self.btn.clicked.connect(self.cancelar)
        h.addWidget(self.texto)
        h.addWidget(self.barra)
        h.addWidget(self.btn)
        self.opacidad = QGraphicsOpacityEffect(self, opacity=0.0)
        self.setGraphicsEffect(self.opacidad)
        self._anim = QPropertyAnimation(self.opacidad, b"opacity", self, duration=260)
        self._ocultar = QTimer(self, singleShot=True, timeout=self.esconder)
        self.ocupado = False
        self.hide()

    def _ubicar(self):
        self.adjustSize()
        p = self.parentWidget()
        self.move((p.width() - self.width()) // 2, p.height() - self.height() - 28)
        self.raise_()

    def _mostrar(self):
        self.show()
        self._ubicar()
        if self.opacidad.opacity() < 1:
            self._anim.stop()
            self._anim.setStartValue(self.opacidad.opacity())
            self._anim.setEndValue(1.0)
            self._anim.start()

    def mensaje(self, texto: str, segundos: int = 5):
        if self.ocupado:
            return
        self.texto.setText(texto)
        self.barra.hide()
        self.btn.hide()
        self._mostrar()
        self._ocultar.start(segundos * 1000)

    def trabajando(self, texto: str, cancelable: bool = True):
        self.ocupado = True
        self._ocultar.stop()
        self.texto.setText(texto)
        self.barra.setRange(0, 0)
        self.barra.show()
        self.btn.setVisible(cancelable)
        self._mostrar()

    def avance(self, hecho: int, total: int, texto: str = ""):
        self.barra.setRange(0, max(1, total))
        self.barra.setValue(hecho)
        if texto:
            self.texto.setText(texto)
            self._ubicar()

    def listo(self, texto: str = ""):
        self.ocupado = False
        if texto:
            self.mensaje(texto)
        else:
            self.esconder()

    def esconder(self):
        if self.ocupado:
            return
        self._anim.stop()
        self._anim.setStartValue(self.opacidad.opacity())
        self._anim.setEndValue(0.0)
        self._anim.start()
        QTimer.singleShot(280, lambda: self.hide() if not self.ocupado and self.opacidad.opacity() < .05 else None)


def aparecer(widget: QWidget, retraso_ms: int = 0, ms: int = 520, al_terminar=None):
    """Entrada suave (de transparente a visible). Reemplaza el efecto gráfico del widget mientras dura."""
    ef = QGraphicsOpacityEffect(widget, opacity=0.0)
    widget.setGraphicsEffect(ef)
    a = QPropertyAnimation(ef, b"opacity", widget, duration=ms, startValue=0.0, endValue=1.0, easingCurve=SUAVE)

    def fin():
        if al_terminar:
            al_terminar()
        else:
            widget.setGraphicsEffect(None)

    a.finished.connect(fin)
    QTimer.singleShot(retraso_ms, a.start)
