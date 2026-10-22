"""
Galería (oscura): una foto por alumno con su punto de color. Tocas una y a la derecha aparece grande
con tres botones: Aprobar, Mejorar con IA y Otra toma. Abajo flotan Editar todo, Traer fotos e Imprimir.
"""
from __future__ import annotations

import os

from PySide6.QtCore import (QEasingCurve, QPoint, QPropertyAnimation, QRect, QRectF, QSize, Qt, QTimer, Signal)
from PySide6.QtGui import QColor, QKeySequence, QPainter, QPainterPath, QPixmap, QShortcut
from PySide6.QtWidgets import (QAbstractItemView, QButtonGroup, QFrame, QHBoxLayout,
                               QLabel, QListWidget, QListWidgetItem, QPushButton, QStyle, QStyledItemDelegate,
                               QVBoxLayout, QWidget)

from .. import flujo, miniaturas
from .comun import avisar_error
from .tema import OSC, PUNTO_ESTADO, QSS_GALERIA, TEXTO_ESTADO
from .vivo import BotonVivo, fuente, icono

FILTROS = ["Todas", "Por revisar", "Listas", "Sin editar"]
EDITADAS = ("lista", "revisar", "problema", "aprobada")
ROL = Qt.UserRole


def _silueta(p: QPainter, r: QRectF):
    p.fillRect(r, QColor("#2A2620"))
    p.setPen(Qt.NoPen)
    p.setBrush(QColor(107, 201, 237, 56))
    p.drawRect(r)
    p.setBrush(QColor("#7D6A55"))
    w, h = r.width(), r.height()
    p.drawEllipse(QRectF(r.x() + w * .3, r.y() + h * .24, w * .4, w * .4))
    p.setBrush(QColor("#1F2A44"))
    p.drawRoundedRect(QRectF(r.x() + w * .1, r.y() + h * .68, w * .8, h * .5), w * .3, w * .3)


class Mosaico(QStyledItemDelegate):
    def __init__(self, galeria):
        super().__init__(galeria)
        self.g = galeria

    def sizeHint(self, opt, idx):
        return self.g.tam_celda

    def paint(self, p: QPainter, opt, idx):
        ficha = idx.data(ROL)
        if not ficha:
            return
        p.save()
        p.setRenderHint(QPainter.Antialiasing)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        celda = QRectF(opt.rect).adjusted(8, 8, -8, -8)
        hover = bool(opt.state & QStyle.State_MouseOver)
        elegido = ficha["alumno_id"] == self.g.elegido_id
        foto_r = QRectF(celda.x(), celda.y(), celda.width(), celda.width() * 4 / 3)
        if hover and not elegido:
            foto_r.translate(0, -4)
        if elegido:
            p.setPen(QColor(OSC["oro"]))
            p.setBrush(Qt.NoBrush)
            p.drawRoundedRect(foto_r.adjusted(-4, -4, 4, 4), 22, 22)
        camino = QPainterPath()
        camino.addRoundedRect(foto_r, 18, 18)
        p.setClipPath(camino)
        pm = self.g.pixmap(ficha)
        if pm and not pm.isNull():
            esc = pm.scaled(foto_r.size().toSize(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
            p.drawPixmap(int(foto_r.x() + (foto_r.width() - esc.width()) / 2),
                         int(foto_r.y() + (foto_r.height() - esc.height()) / 2), esc)
        else:
            _silueta(p, foto_r)
        if hover:
            p.fillRect(foto_r, QColor(255, 255, 255, 18))
        p.setClipping(False)
        p.setPen(QColor("#121212"))
        p.setBrush(QColor(PUNTO_ESTADO.get(ficha["estado"], "#6B6B6B")))
        p.drawEllipse(QRectF(foto_r.x() + 10, foto_r.y() + 10, 16, 16))
        y = foto_r.bottom() + 10
        p.setPen(QColor(OSC["texto"]))
        p.setFont(fuente(15, 700))
        nombre = p.fontMetrics().elidedText(ficha["corto"] or ficha["nombre"], Qt.ElideRight, int(celda.width()))
        p.drawText(QRectF(celda.x(), y, celda.width(), 20), Qt.AlignLeft | Qt.AlignVCenter, nombre)
        p.setPen(QColor(OSC["tenue"]))
        p.setFont(fuente(13, 500))
        p.drawText(QRectF(celda.x(), y + 22, celda.width(), 18), Qt.AlignLeft | Qt.AlignVCenter,
                   TEXTO_ESTADO.get(ficha["estado"], ficha["estado"]))
        p.restore()


class FotoGrande(QWidget):
    def __init__(self):
        super().__init__()
        self.pm: QPixmap | None = None
        self.setMinimumHeight(300)

    def poner(self, ruta: str | None):
        self.pm = QPixmap(ruta) if ruta and os.path.exists(ruta) else None
        self.update()

    def paintEvent(self, _):
        p = QPainter(self)
        p.setRenderHint(QPainter.Antialiasing)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        alto = self.height()
        ancho = min(self.width(), alto * 3 / 4)
        r = QRectF((self.width() - ancho) / 2, 0, ancho, alto)
        camino = QPainterPath()
        camino.addRoundedRect(r, 22, 22)
        p.setClipPath(camino)
        if self.pm and not self.pm.isNull():
            esc = self.pm.scaled(r.size().toSize(), Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)
            p.drawPixmap(int(r.x() + (r.width() - esc.width()) / 2), int(r.y() + (r.height() - esc.height()) / 2), esc)
        else:
            _silueta(p, r)
        p.end()


class Galeria(QWidget):
    volver = Signal()
    abrir_editor = Signal(int)  # foto_id -> herramientas avanzadas

    def __init__(self, estado, acciones):
        super().__init__()
        self.setObjectName("galeria")
        self.setAttribute(Qt.WA_StyledBackground, True)
        self.setStyleSheet(QSS_GALERIA)
        self.e, self.a = estado, acciones
        self.sid = None
        self.fichas: list[dict] = []
        self.filtro = "Todas"
        self.elegido_id: int | None = None
        self._pix: dict[str, QPixmap] = {}
        self._cargando: set[str] = set()
        self.tam_celda = QSize(200, 320)

        raiz = QHBoxLayout(self)
        raiz.setContentsMargins(0, 0, 0, 0)
        raiz.setSpacing(0)
        self.centro = QWidget()
        cv = QVBoxLayout(self.centro)
        cv.setContentsMargins(40, 12, 40, 0)
        cv.setSpacing(22)
        cab = QHBoxLayout()
        cab.setSpacing(16)
        tt = QVBoxLayout()
        tt.setSpacing(4)
        self.sub = QLabel()
        self.sub.setObjectName("tenue")
        self.titulo = QLabel()
        self.titulo.setObjectName("h1")
        tt.addWidget(self.sub)
        tt.addWidget(self.titulo)
        cab.addLayout(tt, 1)
        caja = QFrame()
        caja.setObjectName("filtros")
        fh = QHBoxLayout(caja)
        fh.setContentsMargins(6, 6, 6, 6)
        fh.setSpacing(4)
        self.grupo = QButtonGroup(self)
        self.btn_filtros = {}
        for f in FILTROS:
            b = QPushButton(f)
            b.setObjectName("filtro")
            b.setCheckable(True)
            b.setCursor(Qt.PointingHandCursor)
            self.grupo.addButton(b)
            fh.addWidget(b)
            self.btn_filtros[f] = b
            b.clicked.connect(lambda _=False, f=f: self.filtrar(f))
        self.btn_filtros["Todas"].setChecked(True)
        cab.addWidget(caja, 0, Qt.AlignBottom)
        cv.addLayout(cab)

        self.lista = QListWidget()
        self.lista.setViewMode(QListWidget.IconMode)
        self.lista.setResizeMode(QListWidget.Adjust)
        self.lista.setMovement(QListWidget.Static)
        self.lista.setUniformItemSizes(True)
        self.lista.setSelectionMode(QAbstractItemView.SingleSelection)
        self.lista.setMouseTracking(True)
        self.lista.setVerticalScrollMode(QAbstractItemView.ScrollPerPixel)
        self.lista.verticalScrollBar().setSingleStep(24)
        self.lista.setItemDelegate(Mosaico(self))
        self.lista.setSpacing(0)
        self.lista.itemClicked.connect(lambda it: self.elegir(it.data(ROL)["alumno_id"]))
        self.lista.verticalScrollBar().valueChanged.connect(lambda _: QTimer.singleShot(60, self._cargar_visibles))
        self.vacio = QLabel()
        self.vacio.setAlignment(Qt.AlignCenter)
        self.vacio.setWordWrap(True)
        self.vacio.setStyleSheet(f"color: {OSC['suave']}; font-size: 18px;")
        self.vacio.hide()
        cv.addWidget(self.lista, 1)
        cv.addWidget(self.vacio, 1)
        raiz.addWidget(self.centro, 1)

        # panel derecho
        self.lateral = QFrame()
        self.lateral.setObjectName("lateral")
        self.lateral.setMaximumWidth(0)
        self.lateral.setMinimumWidth(0)
        lv = QVBoxLayout(self.lateral)
        lv.setContentsMargins(28, 28, 28, 28)
        lv.setSpacing(18)
        arriba = QHBoxLayout()
        self.nombre = QLabel()
        self.nombre.setWordWrap(True)
        self.nombre.setStyleSheet(f"font-size: 22px; font-weight: 800; color: {OSC['texto']};")
        cerrar = QPushButton()
        cerrar.setIcon(icono("cerrar", OSC["texto"], 18))
        cerrar.setFixedSize(44, 44)
        cerrar.setStyleSheet("border-radius: 22px; padding: 0;")
        cerrar.setToolTip("Cerrar (Esc)")
        cerrar.clicked.connect(lambda: self.elegir(None))
        arriba.addWidget(self.nombre, 1)
        arriba.addWidget(cerrar, 0, Qt.AlignTop)
        lv.addLayout(arriba)
        self.grande = FotoGrande()
        lv.addWidget(self.grande, 1)
        self.nota = QLabel()
        self.nota.setObjectName("suave")
        self.nota.setWordWrap(True)
        lv.addWidget(self.nota)
        self.aprobar = BotonVivo("Aprobar")
        self.aprobar.clicked.connect(self._principal)
        lv.addWidget(self.aprobar)
        dos = QHBoxLayout()
        dos.setSpacing(10)
        self.btn_ia = QPushButton("  Mejorar con IA")
        self.btn_ia.setObjectName("borde")
        self.btn_ia.setIcon(icono("ia", OSC["texto"], 18))
        self.btn_ia.clicked.connect(lambda: self.foto_actual() and self.abrir_editor.emit(self.foto_actual()))
        self.btn_otra = QPushButton("  Otra toma")
        self.btn_otra.setObjectName("borde")
        self.btn_otra.setIcon(icono("otra", OSC["texto"], 18))
        self.btn_otra.clicked.connect(self._otra_toma)
        for b in (self.btn_ia, self.btn_otra):
            b.setCursor(Qt.PointingHandCursor)
            dos.addWidget(b)
        lv.addLayout(dos)
        raiz.addWidget(self.lateral)
        self._anim_lat = QPropertyAnimation(self.lateral, b"maximumWidth", self, duration=380,
                                            easingCurve=QEasingCurve.OutCubic)
        self._anim_lat.valueChanged.connect(lambda v: self.lateral.setMinimumWidth(int(v)))

        # barra flotante
        self.flotante = QFrame(self.centro)
        self.flotante.setObjectName("flotante")
        fl = QHBoxLayout(self.flotante)
        fl.setContentsMargins(10, 10, 10, 10)
        fl.setSpacing(8)
        self.btn_editar = BotonVivo("Editar todo", respirar=False)
        self.btn_editar.setStyleSheet("QPushButton { background: #E8C46A; color: #121212; border: 0; border-radius: 24px;"
                                      " padding: 13px 24px; font-size: 16px; font-weight: 800; }"
                                      "QPushButton:hover { background: #F0D283; }"
                                      "QPushButton:disabled { background: #3A3A3A; color: #8A857C; }")
        self.btn_editar.clicked.connect(lambda: self.sid and self.a.editar(self.sid))
        traer = QPushButton("  Traer fotos")
        traer.setIcon(icono("camara", OSC["texto"], 18))
        traer.clicked.connect(lambda: self.sid and self.a.traer(self.sid))
        imprimir = QPushButton("  Imprimir")
        imprimir.setIcon(icono("imprimir", OSC["texto"], 18))
        imprimir.clicked.connect(lambda: self.sid and self.a.imprimir(self.sid))
        for b in (self.btn_editar, traer, imprimir):
            b.setCursor(Qt.PointingHandCursor)
            fl.addWidget(b)
        self._anim_flot = QPropertyAnimation(self.flotante, b"pos", self, duration=600, easingCurve=QEasingCurve.OutBack)

        QShortcut(QKeySequence(Qt.Key_Escape), self, lambda: self.elegir(None))
        QShortcut(QKeySequence(Qt.Key_Right), self, lambda: self.mover(1))
        QShortcut(QKeySequence(Qt.Key_Left), self, lambda: self.mover(-1))
        QShortcut(QKeySequence("A"), self, lambda: self.elegido_id and self._principal())
        self.e.fotos_cambiadas.connect(lambda sid: sid == self.sid and self.isVisible() and self.recargar())

    # ------------------------------------------------------------------ datos
    def mostrar(self, sid: int, filtro: str = "Todas"):
        self.sid = sid
        self.elegido_id = None
        self._ocultar_lateral(animar=False)
        info = self.e.base.info_salon(sid)
        self.sub.setText(info["colegio"])
        self.titulo.setText(f"{info['grado']} {info['seccion']}".strip() or "Salón")
        self.filtro = filtro if filtro in FILTROS else "Todas"
        self.btn_filtros[self.filtro].setChecked(True)
        self.recargar()
        QTimer.singleShot(0, self._entrar_flotante)

    def recargar(self):
        if not self.sid:
            return
        self.fichas = flujo.alumnos_galeria(self.e.base, self.sid)
        pend = sum(1 for f in self.fichas if f["foto"] and f["estado"] == "nueva")
        self.btn_editar.setText(f"Editar todo ({pend})" if pend else "Editar todo")
        self.btn_editar.setEnabled(bool(pend))
        self._llenar()
        if self.elegido_id:
            self._panel()

    def filtrar(self, f: str):
        self.filtro = f
        self._llenar()

    def _llenar(self):
        self.lista.clear()
        visibles = [f for f in self.fichas if self.filtro == "Todas" or flujo.grupo_filtro(f["estado"]) == self.filtro]
        for f in visibles:
            it = QListWidgetItem()
            it.setData(ROL, f)
            it.setSizeHint(self.tam_celda)
            self.lista.addItem(it)
        hay = bool(visibles)
        self.lista.setVisible(hay)
        self.vacio.setVisible(not hay)
        if not hay:
            self.vacio.setText("Aún no hay alumnos con foto. Trae las fotos y ordénalas en el salón."
                               if not self.fichas else f"No hay fotos en «{self.filtro}».")
        self._ajustar_celdas()
        QTimer.singleShot(30, self._cargar_visibles)

    def _ajustar_celdas(self):
        ancho = self.lista.viewport().width() - 4
        cols = max(2, ancho // 196)
        w = ancho // cols
        self.tam_celda = QSize(w, int((w - 16) * 4 / 3) + 16 + 52)
        self.lista.setGridSize(self.tam_celda)
        for i in range(self.lista.count()):
            self.lista.item(i).setSizeHint(self.tam_celda)

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        QTimer.singleShot(0, self._ajustar_celdas)
        QTimer.singleShot(0, self._ubicar_flotante)
        QTimer.singleShot(80, self._cargar_visibles)

    # ------------------------------------------------------------------ miniaturas
    def _fuente_ficha(self, ficha) -> tuple[str, str] | None:
        f = ficha["foto"]
        if not f:
            return None
        b = self.e.base
        if f["estado"] in EDITADAS:
            s = b.q1("select ruta, creada_en from salidas where foto_id=? order by id limit 1", f["id"])
            if s and os.path.exists(os.path.join(b.raiz, s["ruta"])):
                return os.path.join(b.raiz, s["ruta"]), f["hash"][:20] + "e" + str(abs(hash(s["creada_en"])) % 10 ** 6)
        return os.path.join(b.raiz, f["ruta_original"]), f["hash"][:20]

    def pixmap(self, ficha) -> QPixmap | None:
        clave = ficha.get("_clave")
        return self._pix.get(clave) if clave else None

    def _cargar_visibles(self):
        vp = self.lista.viewport().rect().adjusted(0, -300, 0, 600)
        pend = []
        for i in range(self.lista.count()):
            it = self.lista.item(i)
            if not self.lista.visualItemRect(it).intersects(vp):
                continue
            ficha = it.data(ROL)
            src = self._fuente_ficha(ficha)
            if not src:
                continue
            ruta, clave = src
            ficha["_clave"] = clave
            it.setData(ROL, ficha)
            if clave in self._pix or clave in self._cargando:
                continue
            self._cargando.add(clave)
            pend.append((ruta, clave))
        if not pend:
            return
        raiz = self.e.base.raiz

        def hacer(t, lote):
            return [(c, miniaturas.obtener(raiz, r, c)) for r, c in lote]

        def poner(res):
            for c, r in res:
                self._cargando.discard(c)
                if r:
                    self._pix[c] = QPixmap(r)
            self.lista.viewport().update()

        for k in range(0, len(pend), 10):
            self.e.colas.lanzar(hacer, pend[k:k + 10], al_listo=poner)

    # ------------------------------------------------------------------ panel
    def ficha_actual(self):
        return next((f for f in self.fichas if f["alumno_id"] == self.elegido_id), None)

    def foto_actual(self) -> int | None:
        f = self.ficha_actual()
        return f["foto"]["id"] if f and f["foto"] else None

    def elegir(self, alumno_id: int | None):
        self.elegido_id = alumno_id
        self.lista.viewport().update()
        if alumno_id is None:
            self._ocultar_lateral()
            return
        self._panel()
        if self.lateral.maximumWidth() < 10:
            self._anim_lat.stop()
            self._anim_lat.setStartValue(0)
            self._anim_lat.setEndValue(420)
            self._anim_lat.start()

    def _ocultar_lateral(self, animar=True):
        if not animar:
            self.lateral.setMaximumWidth(0)
            self.lateral.setMinimumWidth(0)
            return
        self._anim_lat.stop()
        self._anim_lat.setStartValue(self.lateral.maximumWidth())
        self._anim_lat.setEndValue(0)
        self._anim_lat.start()

    def _panel(self):
        f = self.ficha_actual()
        if not f:
            return self.elegir(None)
        self.nombre.setText(f["nombre"])
        src = self._fuente_ficha(f)
        self.grande.poner(src[0] if src else None)
        n = len(f["tomas"])
        estado = f["estado"]
        nota = TEXTO_ESTADO.get(estado, estado)
        if f["foto"] and estado in ("revisar", "problema"):
            import json
            qa = json.loads(f["foto"]["qa"] or "{}")
            if qa.get("alertas"):
                nota += ": " + "; ".join(qa["alertas"][:2])
        self.nota.setText(f"{nota} · {n} {'toma' if n == 1 else 'tomas'}")
        if not f["foto"]:
            self.aprobar.setText("Sin foto")
            self.aprobar.setEnabled(False)
        elif estado == "aprobada":
            self.aprobar.setText("Aprobada ✓  (siguiente)")
            self.aprobar.setEnabled(True)
        elif estado in EDITADAS:
            self.aprobar.setText("Aprobar")
            self.aprobar.setEnabled(True)
        else:
            self.aprobar.setText("Editar esta foto")
            self.aprobar.setEnabled(True)
        self.btn_otra.setEnabled(n > 1)
        self.btn_ia.setEnabled(bool(f["foto"]))

    def _principal(self):
        f = self.ficha_actual()
        if not f or not f["foto"]:
            return
        if f["estado"] in ("lista", "revisar", "problema"):
            self.e.base.cambiar_estado([f["foto"]["id"]], "aprobada")
            self.e.fotos_cambiadas.emit(self.sid)
            self.mover(1)
        elif f["estado"] == "aprobada":
            self.mover(1)
        else:
            self.a.editar(self.sid, [f["foto"]["id"]])

    def _otra_toma(self):
        f = self.ficha_actual()
        if not f or len(f["tomas"]) < 2:
            return
        actual = f["foto"]["id"]
        i = f["tomas"].index(actual) if actual in f["tomas"] else 0
        try:
            self.e.base.elegir(f["tomas"][(i + 1) % len(f["tomas"])])
        except ValueError as ex:
            return avisar_error(self, str(ex))
        self.e.fotos_cambiadas.emit(self.sid)

    def mover(self, paso: int):
        ids = [self.lista.item(i).data(ROL)["alumno_id"] for i in range(self.lista.count())]
        if not ids:
            return
        if self.elegido_id not in ids:
            return self.elegir(ids[0])
        k = ids.index(self.elegido_id) + paso
        if 0 <= k < len(ids):
            self.elegir(ids[k])
            self.lista.scrollToItem(self.lista.item(k))

    # ------------------------------------------------------------------ barra flotante
    def _ubicar_flotante(self):
        self.flotante.adjustSize()
        x = (self.centro.width() - self.flotante.width()) // 2
        self.flotante.move(x, self.centro.height() - self.flotante.height() - 28)
        self.flotante.raise_()

    def _entrar_flotante(self):
        self.flotante.adjustSize()
        x = (self.centro.width() - self.flotante.width()) // 2
        fin = QPoint(x, self.centro.height() - self.flotante.height() - 28)
        self._anim_flot.stop()
        self._anim_flot.setStartValue(QPoint(x, self.centro.height() + 20))
        self._anim_flot.setEndValue(fin)
        self.flotante.raise_()
        self._anim_flot.start()
