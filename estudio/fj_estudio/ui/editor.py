"""
Editor: una foto en grande, antes y después, recetas de IA combinables, aprobar o rechazar.

Atajos: Espacio o A = aprobar y siguiente · R = rechazar · ← → = anterior / siguiente ·
C = comparar con el original · 0 = ajustar a la ventana.
"""
from __future__ import annotations

import json
import os

from PySide6.QtCore import QRectF, QSize, Qt
from PySide6.QtGui import QColor, QIcon, QKeySequence, QPainter, QPixmap, QShortcut
from PySide6.QtWidgets import (QButtonGroup, QComboBox, QFrame, QGraphicsPixmapItem, QGraphicsScene, QGraphicsView,
                               QGridLayout, QHBoxLayout, QListWidget, QListWidgetItem, QPlainTextEdit, QScrollArea,
                               QVBoxLayout, QWidget)

from .. import miniaturas, secretos
from ..ia import recetas as rc
from ..ia import servicio as sv
from ..ia.proveedores import ErrorIA
from ..motor_local import EditorLocal
from .comun import avisar_error, boton, columna, etiqueta, fila, preguntar, separador
from .tema import C, ESTADO_COLOR, ESTADO_TEXTO


class Visor(QGraphicsView):
    """Foto con zoom (rueda) y arrastre."""
    def __init__(self):
        super().__init__()
        self.setScene(QGraphicsScene(self))
        self.item = QGraphicsPixmapItem()
        self.item.setTransformationMode(Qt.SmoothTransformation)
        self.scene().addItem(self.item)
        self.setRenderHints(QPainter.Antialiasing | QPainter.SmoothPixmapTransform)
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setStyleSheet(f"background: #101214; border: 0;")
        self._ajustar = True

    def mostrar(self, ruta: str | None):
        pm = QPixmap(ruta) if ruta and os.path.exists(ruta) else QPixmap()
        self.item.setPixmap(pm)
        self.scene().setSceneRect(QRectF(pm.rect()))
        self._ajustar = True
        self.ajustar()

    def ajustar(self):
        if not self.item.pixmap().isNull():
            self.fitInView(self.item, Qt.KeepAspectRatio)

    def wheelEvent(self, ev):
        self._ajustar = False
        f = 1.15 if ev.angleDelta().y() > 0 else 1 / 1.15
        self.scale(f, f)

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        if self._ajustar:
            self.ajustar()


class Editor(QWidget):
    def __init__(self, estado):
        super().__init__()
        self.e = estado
        self.foto_id: int | None = None
        self.ids: list[int] = []
        self.version_vista: int | None = None
        raiz = QHBoxLayout(self)
        raiz.setContentsMargins(0, 0, 0, 0)
        raiz.setSpacing(0)
        raiz.addLayout(self._centro(), 1)
        raiz.addWidget(self._panel())
        self.e.abrir_foto.connect(self.abrir)
        self.e.fotos_cambiadas.connect(lambda sid: self.foto_id and self._cargar_tira())
        for tecla, fn in (("Space", self.aprobar_y_siguiente), ("A", self.aprobar_y_siguiente), ("R", self.rechazar),
                          ("Right", lambda: self.mover(1)), ("Left", lambda: self.mover(-1)),
                          ("C", self._alternar_comparar), ("0", self.visor.ajustar)):
            sc = QShortcut(QKeySequence(tecla), self)
            sc.setContext(Qt.WidgetWithChildrenShortcut)
            sc.activated.connect(lambda fn=fn: None if self.pedido.hasFocus() else fn())

    # ------------------------------------------------------------------ armado
    def _centro(self):
        self.nombre = etiqueta("Abre una foto desde la Biblioteca", "titulo")
        self.info = etiqueta("", "tenue")
        self.vista = QButtonGroup(self)
        cajas = QHBoxLayout()
        cajas.setSpacing(2)
        for i, t in enumerate(("Original", "Editada", "IA")):
            b = boton(t, "modulo", chequeable=True)
            self.vista.addButton(b, i)
            cajas.addWidget(b)
        self.vista.button(1).setChecked(True)
        self.vista.idClicked.connect(lambda _: self._mostrar())
        marco = QFrame()
        marco.setStyleSheet(f"background: {C['panel']}; border-radius: 8px;")
        marco.setLayout(cajas)
        cajas.setContentsMargins(3, 3, 3, 3)
        cab = fila(columna(self.nombre, self.info, espacio=2), None, marco, margen=0)
        self.visor = Visor()
        self.tira = QListWidget()
        self.tira.setFlow(QListWidget.LeftToRight)
        self.tira.setViewMode(QListWidget.IconMode)
        self.tira.setIconSize(QSize(46, 68))
        self.tira.setFixedHeight(96)
        self.tira.setHorizontalScrollBarPolicy(Qt.ScrollBarAsNeeded)
        self.tira.setWrapping(False)
        self.tira.itemClicked.connect(lambda it: self.abrir(it.data(Qt.UserRole), recargar_tira=False))
        v = QVBoxLayout()
        v.setContentsMargins(16, 12, 16, 8)
        v.setSpacing(10)
        v.addLayout(cab)
        v.addWidget(self.visor, 1)
        v.addWidget(self.tira)
        return v

    def _panel(self):
        w = QWidget()
        w.setObjectName("derecha")
        w.setFixedWidth(360)
        self.estado_lbl = etiqueta("", None, ajustar=True)
        self.alertas = etiqueta("", None, ajustar=True)
        self.alertas.setStyleSheet(f"color: {C['ambar_txt']};")
        self.btn_aprobar = boton("Aprobar  (Espacio)", "aprobar", self.aprobar_y_siguiente)
        self.btn_rechazar = boton("Rechazar  (R)", "rechazar", self.rechazar)
        # recetas
        self.chips: dict[str, object] = {}
        rejilla = QGridLayout()
        rejilla.setSpacing(6)
        for i, r in enumerate(rc.RECETAS):
            b = boton(r.titulo, "chip", chequeable=True, tip=r.texto[:220] + "…")
            self.chips[r.id] = b
            rejilla.addWidget(b, i // 2, i % 2)
        self.combo = QComboBox()
        self.combo.addItem("Combos rápidos…", None)
        for n, ids in rc.COMBOS.items():
            self.combo.addItem(n, ids)
        self.combo.activated.connect(self._aplicar_combo)
        self.pedido = QPlainTextEdit()
        self.pedido.setPlaceholderText("Pedido propio (opcional). Ej.: quita la pelusa del hombro izquierdo.\n"
                                       "Las reglas que protegen la cara y el cuerpo se agregan solas.")
        self.pedido.setFixedHeight(92)
        self.btn_ia = boton("Pedir a la IA", "ia", self.pedir_ia)
        self.proveedor_lbl = etiqueta("", "tenue")
        # versiones
        self.versiones = QListWidget()
        self.versiones.setFixedHeight(110)
        self.versiones.itemClicked.connect(self._ver_version)
        self.btn_aceptar_v = boton("Usar esta versión", None, self._aceptar_version)
        self.btn_original = boton("Volver al original", None, self._volver_original)
        self.ver_lbl = etiqueta("", None, ajustar=True)
        # edición local
        self.btn_local = boton("Editar en esta PC", "primario", self.editar_local,
                               "Recorte, color, birrete y encuadre en las medidas marcadas en la Biblioteca")
        cont = QWidget()
        cont.setLayout(columna(
            etiqueta("ESTADO", "seccion"), self.estado_lbl, self.alertas,
            fila(self.btn_aprobar, self.btn_rechazar), separador(),
            etiqueta("RECETAS DE IA (se combinan)", "seccion"), rejilla, self.combo, self.pedido,
            fila(self.proveedor_lbl, None, self.btn_ia), separador(),
            etiqueta("VERSIONES CON IA", "seccion"), self.versiones, self.ver_lbl,
            fila(self.btn_aceptar_v, self.btn_original), separador(),
            etiqueta("EDICIÓN LOCAL (gratis)", "seccion"), self.btn_local, None, margen=14, espacio=8))
        sc = QScrollArea()
        sc.setWidgetResizable(True)
        sc.setWidget(cont)
        sc.setFrameShape(QFrame.NoFrame)
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(sc)
        self._habilitar(False)
        return w

    def _habilitar(self, si: bool):
        for b in (self.btn_aprobar, self.btn_rechazar, self.btn_ia, self.btn_local, self.btn_aceptar_v,
                  self.btn_original):
            b.setEnabled(si)

    # ------------------------------------------------------------------ cargar
    def abrir(self, foto_id: int, recargar_tira: bool = True):
        f = self.e.base.q1("select * from fotos where id=?", foto_id)
        if not f:
            return
        self.foto_id = foto_id
        self.version_vista = None
        if f["salon_id"] != self.e.salon_id:
            self.e.elegir_salon(f["salon_id"])
        if recargar_tira or foto_id not in self.ids:
            self._cargar_tira()
        self._refrescar()
        if not any(self.vista.button(i).isChecked() for i in (0, 1)) or not self._ruta_editada():
            self.vista.button(1 if self._ruta_editada() else 0).setChecked(True)
        self._mostrar()
        self._habilitar(True)
        self.setFocus()

    def _cargar_tira(self):
        b = self.e.base
        f = b.q1("select salon_id, alumno_id from fotos where id=?", self.foto_id)
        if not f:
            return
        fotos = b.q("select * from fotos where salon_id=? and estado != 'descartada' and (elegida=1 or id=?) "
                    "order by coalesce(tomada_en,''), nombre_camara", f["salon_id"], self.foto_id)
        self.ids = [x["id"] for x in fotos]
        self.tira.clear()
        for x in fotos:
            mini = miniaturas.ruta(b.raiz, f"{x['hash'][:20]}_{miniaturas.LADO}")
            it = QListWidgetItem(QIcon(mini) if os.path.exists(mini) else QIcon(), "")
            it.setData(Qt.UserRole, x["id"])
            it.setBackground(QColor(ESTADO_COLOR.get(x["estado"], C["elev"])).darker(260))
            it.setToolTip(ESTADO_TEXTO.get(x["estado"], x["estado"]))
            self.tira.addItem(it)
            if x["id"] == self.foto_id:
                self.tira.setCurrentItem(it)
                self.tira.scrollToItem(it)

    def _refrescar(self):
        b = self.e.base
        f = b.q1("select * from fotos where id=?", self.foto_id)
        a = b.q1("select * from alumnos where id=?", f["alumno_id"]) if f["alumno_id"] else None
        self.nombre.setText(f"{a['apellidos']}, {a['nombres']}" if a else f"Sin alumno · {f['nombre_camara']}")
        info = b.info_salon(f["salon_id"])
        pos = f"{self.ids.index(self.foto_id) + 1} de {len(self.ids)} · " if self.foto_id in self.ids else ""
        self.info.setText(f"{pos}{info['colegio']} · {info['grado']} {info['seccion']} · "
                          f"{a['codigo'] if a else ''}")
        self.estado_lbl.setText(ESTADO_TEXTO.get(f["estado"], f["estado"]) + ("  ·  versión IA en uso" if f["version_ia_id"] else ""))
        self.estado_lbl.setStyleSheet(f"color: {ESTADO_COLOR.get(f['estado'], C['texto'])}; font-weight: 700; font-size: 15px;")
        qa = json.loads(f["qa"] or "{}")
        self.alertas.setText("\n".join(f"• {x}" for x in qa.get("alertas", [])))
        p = sv.proveedor_para(b)
        clave = secretos.leer(p.id)
        self.proveedor_lbl.setText(f"{p.nombre}" + ("" if clave else " · falta la clave"))
        self.versiones.clear()
        for v in b.q("select * from versiones_ia where foto_id=? order by id desc", self.foto_id):
            ok = "✓" if v["aprobada_rasgos"] else "⚠"
            en_uso = "  (en uso)" if v["id"] == f["version_ia_id"] else ""
            recetas = ", ".join(rc.POR_ID[i].titulo for i in json.loads(v["recetas"]) if i in rc.POR_ID) or "pedido propio"
            it = QListWidgetItem(f"{ok} v{v['id']} · {recetas}{en_uso}")
            it.setData(Qt.UserRole, v["id"])
            it.setForeground(QColor(C["verde_txt"] if v["aprobada_rasgos"] else C["ambar_txt"]))
            self.versiones.addItem(it)
        self.ver_lbl.setText("")

    def _ruta_editada(self) -> str | None:
        r = self.e.base.q1("select ruta from salidas where foto_id=? order by id limit 1", self.foto_id)
        if r:
            p = os.path.join(self.e.base.raiz, r[0])
            return p if os.path.exists(p) else None
        return None

    def _mostrar(self):
        b = self.e.base
        f = b.q1("select * from fotos where id=?", self.foto_id) if self.foto_id else None
        if not f:
            return self.visor.mostrar(None)
        modo = self.vista.checkedId()
        if modo == 2:
            vid = self.version_vista or f["version_ia_id"] or (b.q1(
                "select id from versiones_ia where foto_id=? order by id desc limit 1", self.foto_id) or [None])[0]
            v = b.q1("select ruta from versiones_ia where id=?", vid) if vid else None
            ruta = os.path.join(b.raiz, v[0]) if v else None
        elif modo == 1:
            ruta = self._ruta_editada()
        else:
            ruta = os.path.join(b.raiz, f["ruta_original"])
        if not ruta:
            self.e.aviso.emit("Todavía no hay versión editada de esta foto." if modo == 1 else "Esta foto aún no tiene versiones con IA.")
            ruta = os.path.join(b.raiz, f["ruta_original"])
        self.visor.mostrar(ruta)

    def _alternar_comparar(self):
        self.vista.button(0 if self.vista.checkedId() != 0 else 1).setChecked(True)
        self._mostrar()

    # ------------------------------------------------------------------ revisar
    def mover(self, paso: int):
        if self.foto_id in self.ids:
            i = self.ids.index(self.foto_id) + paso
            if 0 <= i < len(self.ids):
                self.abrir(self.ids[i], recargar_tira=False)
                self.tira.setCurrentRow(i)

    def aprobar_y_siguiente(self):
        if not self.foto_id:
            return
        f = self.e.base.q1("select estado, alumno_id from fotos where id=?", self.foto_id)
        if f["alumno_id"] is None:
            return avisar_error(self, "Esta foto no tiene alumno. Asígnala en la Biblioteca antes de aprobarla.")
        if f["estado"] in ("nueva", "editando") and not preguntar(self, "Aprobar", "Esta foto todavía no está editada. ¿Aprobarla igual?"):
            return
        self.e.base.cambiar_estado([self.foto_id], "aprobada")
        self._tras_revisar()

    def rechazar(self):
        if self.foto_id:
            self.e.base.cambiar_estado([self.foto_id], "rechazada")
            self._tras_revisar()

    def _tras_revisar(self):
        sid = self.e.salon_id
        actual = self.foto_id
        self.e.fotos_cambiadas.emit(sid)
        if actual in self.ids and self.ids.index(actual) + 1 < len(self.ids):
            self.abrir(self.ids[self.ids.index(actual) + 1], recargar_tira=False)
        else:
            self.abrir(actual, recargar_tira=False)
            self.e.aviso.emit("Llegaste a la última foto del salón.")

    # ------------------------------------------------------------------ IA
    def _aplicar_combo(self, i):
        ids = self.combo.itemData(i)
        if ids:
            for k, b in self.chips.items():
                b.setChecked(k in ids)
        self.combo.setCurrentIndex(0)

    def pedir_ia(self):
        ids = [k for k, b in self.chips.items() if b.isChecked()]
        libre = self.pedido.toPlainText().strip()
        b = self.e.base
        try:
            rc.componer(ids, libre)  # valida antes de gastar
        except ValueError as ex:
            return avisar_error(self, str(ex))
        p = sv.proveedor_para(b)
        clave = secretos.leer(p.id)
        if not clave:
            return avisar_error(self, f"Falta la clave de {p.nombre}. Ponla en Ajustes > Inteligencia artificial.")
        detector = None
        from ..motor_local import buscar_modelo_cara
        modelo_cara = b.ajuste("modelo_cara") or buscar_modelo_cara()
        if modelo_cara and os.path.exists(modelo_cara):
            try:
                from ..ia.verificar import detector_mediapipe
                detector = detector_mediapipe(modelo_cara)
            except Exception:
                detector = None
        fid = self.foto_id

        def hacer(t):
            return sv.pedir(b, fid, ids, libre, clave, p, detector, confirmar_gasto=lambda m: False)

        def listo(r):
            self.btn_ia.setEnabled(True)
            self.btn_ia.setText("Pedir a la IA")
            self.version_vista = r["version_id"]
            self._refrescar()
            self.vista.button(2).setChecked(True)
            self._mostrar()
            v = r["veredicto"]
            self.ver_lbl.setText("✓ Rasgos iguales al original. Puedes usar esta versión." if v.aprobado
                                 else "⚠ " + "; ".join(v.motivos) + ". Revísala antes de usarla.")
            self.ver_lbl.setStyleSheet(f"color: {C['verde_txt'] if v.aprobado else C['ambar_txt']};")

        def error(m):
            self.btn_ia.setEnabled(True)
            self.btn_ia.setText("Pedir a la IA")
            avisar_error(self, m)

        self.btn_ia.setEnabled(False)
        self.btn_ia.setText("La IA está trabajando…")
        self.e.colas.lanzar(hacer, pesado=True, al_listo=listo, al_error=error)

    def _ver_version(self, it):
        self.version_vista = it.data(Qt.UserRole)
        self.vista.button(2).setChecked(True)
        self._mostrar()
        v = self.e.base.q1("select * from versiones_ia where id=?", self.version_vista)
        ver = json.loads(v["verificacion"] or "{}")
        self.ver_lbl.setText("✓ Rasgos iguales al original." if v["aprobada_rasgos"]
                             else "⚠ " + "; ".join(ver.get("motivos", [])))
        self.ver_lbl.setStyleSheet(f"color: {C['verde_txt'] if v['aprobada_rasgos'] else C['ambar_txt']};")

    def _aceptar_version(self):
        it = self.versiones.currentItem()
        if not it:
            return avisar_error(self, "Elige una versión de la lista.")
        vid = it.data(Qt.UserRole)
        v = self.e.base.q1("select aprobada_rasgos from versiones_ia where id=?", vid)
        forzar = False
        if not v["aprobada_rasgos"]:
            if not preguntar(self, "Revisa con cuidado",
                             "Esta versión no pasó la revisión automática de rasgos.\n\n"
                             "¿La revisaste y la persona se ve exactamente igual (cara, piel y cuerpo)?",
                             si="Sí, es igual"):
                return
            forzar = True
        sv.aceptar(self.e.base, vid, forzar)
        self.e.aviso.emit("Versión de IA en uso. Ahora edítala en esta PC para sacar las medidas.")
        self._refrescar()
        self.e.fotos_cambiadas.emit(self.e.salon_id)

    def _volver_original(self):
        sv.volver_al_original(self.e.base, self.foto_id)
        self._refrescar()
        self.e.fotos_cambiadas.emit(self.e.salon_id)

    # ------------------------------------------------------------------ local
    def editar_local(self):
        b = self.e.base
        medidas = b.ajuste("medidas_elegidas", []) or []
        if not medidas:
            return avisar_error(self, "Marca las medidas en la Biblioteca (junto a «Editar elegidas»).")
        ed = EditorLocal(b, b.ajuste("modelo_onnx") or None, b.ajuste("modelo_cara") or None,
                         b.ajuste("ruta_motor") or None)
        fid = self.foto_id

        def listo(qa):
            self.btn_local.setEnabled(True)
            self.btn_local.setText("Editar en esta PC")
            self.vista.button(1).setChecked(True)
            self.abrir(fid, recargar_tira=False)
            self.e.fotos_cambiadas.emit(self.e.salon_id)

        def error(m):
            self.btn_local.setEnabled(True)
            self.btn_local.setText("Editar en esta PC")
            avisar_error(self, m)

        self.btn_local.setEnabled(False)
        self.btn_local.setText("Editando…")
        self.e.colas.lanzar(lambda t: ed.editar(fid, medidas), pesado=True, al_listo=listo, al_error=error)
