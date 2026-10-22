"""Producción: lo que falta imprimir por medida, hojas de carnets, avance por salón y copia a Drive."""
from __future__ import annotations

import os
from datetime import datetime

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (QComboBox, QFileDialog, QGridLayout, QHeaderView, QLabel, QProgressBar, QTableWidget,
                               QTableWidgetItem, QAbstractItemView, QWidget, QHBoxLayout)

from .. import organizar as org
from .. import produccion as pr
from .comun import avisar_error, boton, columna, etiqueta, fila, tarjeta
from .tema import C


class Produccion(QWidget):
    def __init__(self, estado):
        super().__init__()
        self.e = estado
        self.tarjetas = QGridLayout()
        self.tarjetas.setSpacing(12)
        # hojas
        self.hoja = QComboBox()
        self.hoja.addItems(list(pr.HOJAS))
        self.medida_hoja = QComboBox()
        self.btn_hojas = boton("Armar hojas del salón", "primario", self.armar_hojas)
        caja_hojas = tarjeta()
        caja_hojas.setLayout(columna(etiqueta("Hojas de carnets", "titulo"),
                                     etiqueta("Junta los carnets aprobados del salón elegido en hojas listas para "
                                              "imprimir, con marcas de corte.", "tenue", ajustar=True),
                                     fila(etiqueta("Hoja"), self.hoja, etiqueta("Medida"), self.medida_hoja, None),
                                     self.btn_hojas, margen=14))
        # drive
        self.drive_lbl = etiqueta("", "tenue", ajustar=True)
        self.drive_lbl.setMinimumHeight(64)
        self.drive_prog = QProgressBar()
        self.drive_prog.setTextVisible(False)
        self.drive_prog.hide()
        self.btn_drive = boton("Copiar a Drive ahora", "primario", self.copiar_drive)
        caja_drive = tarjeta()
        caja_drive.setLayout(columna(etiqueta("Google Drive", "titulo"), self.drive_lbl, self.drive_prog,
                                     fila(boton("Elegir carpeta de Drive…", None, self.elegir_drive), None,
                                          self.btn_drive), margen=14))
        # avance
        self.tabla = QTableWidget(0, 6)
        self.tabla.setHorizontalHeaderLabels(["SALÓN", "SEDE", "ALUMNOS", "EDITADAS", "APROBADAS", "IMPRESOS"])
        self.tabla.verticalHeader().hide()
        self.tabla.setShowGrid(False)
        self.tabla.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self.tabla.horizontalHeader().setSectionResizeMode(0, QHeaderView.Stretch)
        caja_tabla = tarjeta()
        caja_tabla.setLayout(columna(etiqueta("Avance por salón", "titulo"), self.tabla, margen=14))
        izq = columna(etiqueta("Por imprimir", "titulo"),
                      etiqueta("Fotos aprobadas con pedido pendiente, agrupadas por medida.", "tenue"),
                      self.tarjetas, caja_tabla, espacio=12)
        der = columna(caja_hojas, caja_drive, None, espacio=12)
        raiz = QHBoxLayout(self)
        raiz.setContentsMargins(16, 16, 16, 16)
        raiz.setSpacing(16)
        raiz.addLayout(izq, 3)
        dw = QWidget()
        dw.setLayout(der)
        dw.setFixedWidth(380)
        raiz.addWidget(dw)
        self.e.fotos_cambiadas.connect(lambda _: self.refrescar())
        self.e.medidas_cambiadas.connect(self.refrescar)

    def showEvent(self, ev):
        super().showEvent(ev)
        self.refrescar()

    def refrescar(self):
        b = self.e.base
        while self.tarjetas.count():
            w = self.tarjetas.takeAt(0).widget()
            if w:
                w.deleteLater()
        datos = pr.por_imprimir(b)
        if not datos:
            self.tarjetas.addWidget(etiqueta("Nada pendiente: aprueba fotos y registra pedidos para verlas aquí.",
                                             "tenue"), 0, 0)
        for i, d in enumerate(datos):
            t = tarjeta()
            n = QLabel(str(d["copias"]))
            n.setStyleSheet(f"font-size: 26px; font-weight: 700; color: {C['acento']};")
            t.setLayout(columna(fila(etiqueta(d["medida"], "titulo"), None, n),
                                etiqueta(f"{d['alumnos']} alumnos · {d['pagadas']} copias pagadas", "tenue"),
                                margen=14))
            self.tarjetas.addWidget(t, i // 3, i % 3)
        filas = pr.avance_salones(b)
        self.tabla.setRowCount(len(filas))
        for r, s in enumerate(filas):
            vals = [f"{s['colegio']} · {s['grado']} {s['seccion']}".strip(), s["sede"], s["alumnos"],
                    f"{s['editadas']}/{s['alumnos']}", f"{s['aprobadas']}/{s['alumnos']}", s["impresos"]]
            for c, v in enumerate(vals):
                it = QTableWidgetItem(str(v))
                if c == 4 and s["alumnos"] and s["aprobadas"] == s["alumnos"]:
                    it.setForeground(QColor(C["verde_txt"]))
                self.tabla.setItem(r, c, it)
        self.medida_hoja.clear()
        for m in b.medidas():
            if m["tipo"] == "carnet":
                self.medida_hoja.addItem(m["nombre"], m["id"])
        carpeta = b.ajuste("carpeta_drive")
        ultimo = b.ajuste("ultimo_drive")
        if carpeta:
            self.drive_lbl.setText(f"Carpeta: {carpeta}\n" + (f"Última copia: {ultimo}" if ultimo else "Aún no se copió nada."))
        else:
            self.drive_lbl.setText("Instala «Google Drive para escritorio» y elige su carpeta. El programa copia ahí "
                                   "las fotos editadas y para imprimir, ya ordenadas por colegio, salón y medida.")
        self.btn_drive.setEnabled(bool(carpeta))

    def armar_hojas(self):
        b, sid = self.e.base, self.e.salon_id
        if not sid:
            return avisar_error(self, "Elige un salón en la Biblioteca.")
        mid = self.medida_hoja.currentData()
        if not mid:
            return avisar_error(self, "No hay medidas de carnet. Agrega una en Ajustes > Medidas.")
        m = b.q1("select * from medidas where id=?", mid)
        rutas = [os.path.join(b.raiz, r[0]) for r in b.q(
            "select s.ruta from salidas s join fotos f on f.id = s.foto_id join alumnos a on a.id = f.alumno_id "
            "where f.salon_id=? and f.elegida=1 and f.estado='aprobada' and s.medida_id=? order by a.orden", sid, mid)]
        rutas = [r for r in rutas if os.path.exists(r)]
        if not rutas:
            return avisar_error(self, f"No hay carnets {m['nombre']} aprobados en este salón. Edítalos con esa medida y apruébalos.")
        info = b.info_salon(sid)
        destino = os.path.join(b.raiz, org.carpeta_salon(info), org.CARPETAS[2], org.nombre_seguro(m["nombre"]), "Hojas")
        prefijo = org.nombre_seguro(f"{info['abreviatura']}-{info['grado']}{info['seccion']}_{m['nombre']}")
        hoja = self.hoja.currentText()

        def listo(salidas):
            self.e.aviso.emit(f"{len(salidas)} hojas listas en «{destino}».")
            os.startfile(destino) if hasattr(os, "startfile") else None

        self.e.colas.lanzar(lambda t: pr.armar_hojas(rutas, hoja, (m["ancho_cm"], m["alto_cm"]), destino, prefijo, m["dpi"]),
                            al_listo=listo, al_error=lambda msg: avisar_error(self, msg))

    def elegir_drive(self):
        actual = self.e.base.ajuste("carpeta_drive") or os.path.expanduser("~")
        c = QFileDialog.getExistingDirectory(self, "Carpeta de Google Drive (ej.: G:\\Mi unidad\\FOTOS JEFFERSON)", actual)
        if c:
            if os.path.abspath(c).startswith(os.path.abspath(self.e.base.raiz)):
                return avisar_error(self, "Esa carpeta está dentro de la biblioteca. Elige la carpeta de Google Drive.")
            self.e.base.guardar_ajuste("carpeta_drive", c)
            self.refrescar()

    def copiar_drive(self):
        b = self.e.base
        destino = b.ajuste("carpeta_drive")
        if not destino or not os.path.isdir(destino):
            return avisar_error(self, "No encuentro la carpeta de Drive. ¿Está abierto Google Drive para escritorio?")
        self.btn_drive.setEnabled(False)
        self.drive_prog.show()
        self.drive_prog.setRange(0, 0)

        def avance(h, n, _t=""):
            self.drive_prog.setRange(0, max(1, n))
            self.drive_prog.setValue(h)

        def listo(r):
            self.drive_prog.hide()
            self.btn_drive.setEnabled(True)
            b.guardar_ajuste("ultimo_drive", datetime.now().strftime("%d/%m/%Y %H:%M") + f" · {r['copiadas']} archivos")
            self.refrescar()
            msg = f"Drive al día: {r['copiadas']} archivos copiados."
            if r["errores"]:
                avisar_error(self, msg + f"\n\n{len(r['errores'])} no se pudieron copiar:\n" + "\n".join(r["errores"][:10]))
            self.e.aviso.emit(msg)

        def error(m):
            self.drive_prog.hide()
            self.btn_drive.setEnabled(True)
            avisar_error(self, m)

        self.e.colas.lanzar(lambda t: org.espejar(b.raiz, destino, avance=lambda h, n: t.avanzar(h, n)),
                            al_listo=listo, al_error=error, al_avance=avance)
