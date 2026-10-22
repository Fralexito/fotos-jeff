"""Fotos Studio J (antes "FOTOS JEFFERSON Estudio"): programa de PC para organizar, editar y preparar las fotos escolares."""
from __future__ import annotations

import getpass
import os
import sys

from PySide6.QtCore import QSettings, Qt
from PySide6.QtGui import QGuiApplication, QIcon
from PySide6.QtWidgets import QApplication, QFileDialog, QMessageBox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if getattr(sys, "frozen", False):
    # instalado (.exe): numba (pymatting) no puede guardar su caché en Archivos de programa
    os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
                                                          "FOTOS JEFFERSON Estudio", "numba"))

from fj_estudio import registro  # noqa: E402
from fj_estudio.db import Base  # noqa: E402
from fj_estudio.ui.comun import Estado  # noqa: E402
from fj_estudio.ui.tema import QSS_CLARO, cargar_fuentes  # noqa: E402
from fj_estudio.ui.trabajos import Colas  # noqa: E402
from fj_estudio.ui.ventana import Ventana  # noqa: E402

CARPETA_DEFECTO = os.path.join(os.path.expanduser("~"), "FOTOS JEFFERSON Estudio")


def elegir_biblioteca(ajustes: QSettings, forzar: bool) -> str | None:
    actual = ajustes.value("biblioteca", "")
    if actual and os.path.isdir(actual) and not forzar:
        return actual
    m = QMessageBox()
    m.setWindowTitle("Fotos Studio J")
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


def autoprueba(salida: str) -> int:
    """Prueba del .exe ya armado (la corre GitHub antes de publicar): abre todas las pantallas sin mostrarlas,
    carga cada librería y edita una foto sintética con el motor real. Resultado en `salida` (JSON)."""
    import json
    import tempfile
    import traceback
    res = {"ok": False, "pasos": []}
    try:
        app = QApplication.instance() or QApplication(sys.argv)
        cargar_fuentes()
        app.setStyleSheet(QSS_CLARO)
        tmp = tempfile.mkdtemp(prefix="fj_prueba_")
        base = Base(os.path.join(tmp, "biblioteca"), usuario="prueba")
        v = Ventana(Estado(base, Colas(), QSettings(os.path.join(tmp, "a.ini"), QSettings.IniFormat)))
        v.show()
        app.processEvents()
        v.avanzada(1)
        app.processEvents()
        res["pasos"].append("ventana")
        import cv2
        import keyring
        import mediapipe  # noqa: F401
        import numpy as np
        import onnxruntime  # noqa: F401
        import openpyxl  # noqa: F401
        from PIL import Image
        res["pasos"].append(f"librerías (keyring: {keyring.get_keyring().__class__.__name__})")
        from fj_estudio import modelos
        from fj_estudio.ia.verificar import detector_mediapipe
        from fj_estudio.motor_local import cargar_pipeline
        cara = modelos.cara()
        detector_mediapipe(cara)
        res["pasos"].append("modelo de cara")
        h, w = 1600, 1200
        img = np.full((h, w, 3), 128, np.uint8)
        m = np.zeros((h, w), np.uint8)
        cv2.fillPoly(m, [np.array([[300, 1000], [900, 1000], [1050, 1600], [150, 1600]])], 255)
        cv2.rectangle(m, (540, 820), (660, 1010), 255, -1)
        cv2.ellipse(m, (600, 700), (130, 170), 0, 0, 360, 255, -1)
        img[m > 0] = (190, 140, 115)
        Image.fromarray(img).save(os.path.join(tmp, "in.jpg"), quality=95)
        Image.fromarray(cv2.GaussianBlur(m, (5, 5), 1.2)).save(os.path.join(tmp, "a.png"))
        pf = cargar_pipeline()
        qa = pf.procesar(os.path.join(tmp, "in.jpg"), os.path.join(tmp, "out.jpg"), "20x30",
                         os.path.join(tmp, "a.png"), modelo_cara=cara)
        assert os.path.getsize(os.path.join(tmp, "out.jpg")) > 10_000
        res["pasos"].append(f"motor: {qa.get('semaforo')}")
        v.close()
        res["ok"] = True
    except BaseException:
        res["error"] = traceback.format_exc()
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    return 0 if res["ok"] else 1


def main():
    if "--autoprueba" in sys.argv:
        os.environ["QT_QPA_PLATFORM"] = "offscreen"
        return autoprueba(sys.argv[sys.argv.index("--autoprueba") + 1])
    QGuiApplication.setHighDpiScaleFactorRoundingPolicy(Qt.HighDpiScaleFactorRoundingPolicy.PassThrough)
    app = QApplication(sys.argv)
    # nombre interno de antes: con él siguen valiendo los ajustes guardados (carpeta de la biblioteca)
    app.setApplicationName("FOTOS JEFFERSON Estudio")
    app.setOrganizationName("FOTOS JEFFERSON")
    app.setStyle("Fusion")
    icono = os.path.join(getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__))), "empaque", "icono.png")
    if os.path.exists(icono):
        app.setWindowIcon(QIcon(icono))
    cargar_fuentes()
    app.setStyleSheet(QSS_CLARO)
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
        QMessageBox.critical(None, "Fotos Studio J",
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
