"""FOTOS JEFFERSON Estudio: programa de PC para organizar, editar y preparar las fotos escolares."""
from __future__ import annotations

import getpass
import os
import sys

from PySide6.QtCore import QSettings, Qt
from PySide6.QtGui import QGuiApplication
from PySide6.QtWidgets import QApplication, QFileDialog, QMessageBox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fj_estudio import registro  # noqa: E402
from fj_estudio.db import Base  # noqa: E402
from fj_estudio.ui.comun import Estado  # noqa: E402
from fj_estudio.ui.tema import QSS  # noqa: E402
from fj_estudio.ui.trabajos import Colas  # noqa: E402
from fj_estudio.ui.ventana import Ventana  # noqa: E402

CARPETA_DEFECTO = os.path.join(os.path.expanduser("~"), "FOTOS JEFFERSON Estudio")


def elegir_biblioteca(ajustes: QSettings, forzar: bool) -> str | None:
    actual = ajustes.value("biblioteca", "")
    if actual and os.path.isdir(actual) and not forzar:
        return actual
    m = QMessageBox()
    m.setWindowTitle("FOTOS JEFFERSON Estudio")
    m.setText("¿Dónde guardo la biblioteca de fotos?\n\nAhí van las copias de la cámara, las fotos editadas y todo "
              "el orden. Conviene un disco con mucho espacio.")
    usar = m.addButton(f"Usar {CARPETA_DEFECTO}", QMessageBox.AcceptRole)
    otra = m.addButton("Elegir otra carpeta…", QMessageBox.ActionRole)
    m.addButton("Salir", QMessageBox.RejectRole)
    m.exec()
    if m.clickedButton() is usar:
        ruta = CARPETA_DEFECTO
    elif m.clickedButton() is otra:
        ruta = QFileDialog.getExistingDirectory(None, "Carpeta de la biblioteca", os.path.expanduser("~"))
        if not ruta:
            return None
    else:
        return None
    os.makedirs(ruta, exist_ok=True)
    ajustes.setValue("biblioteca", ruta)
    return ruta


def main():
    QGuiApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    app = QApplication(sys.argv)
    app.setApplicationName("FOTOS JEFFERSON Estudio")
    app.setOrganizationName("FOTOS JEFFERSON")
    app.setStyle("Fusion")
    app.setStyleSheet(QSS)
    ajustes = QSettings()
    forzar = bool(QGuiApplication.queryKeyboardModifiers() & Qt.ShiftModifier)
    raiz = elegir_biblioteca(ajustes, forzar)
    if not raiz:
        return 0
    registro.iniciar(os.path.join(raiz, "_registro"))
    try:
        base = Base(raiz, usuario=getpass.getuser())
    except Exception as e:
        registro.log.exception("abrir base")
        QMessageBox.critical(None, "FOTOS JEFFERSON Estudio",
                             f"No pude abrir la biblioteca.\n\n{registro.en_palabras(e)}\n\n"
                             "Hay copias diarias de la base en la carpeta _copias_base.")
        return 1
    estado = Estado(base, Colas(), ajustes)
    v = Ventana(estado)
    registro.capturar_todo(lambda msg: estado.aviso.emit(msg))
    v.show()
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
