"""
Edición en esta PC con el motor de FOTOS JEFFERSON (pipeline/pipeline_fotos.py): recorte,
color, birrete, toga y encuadre por medida. Sin internet y sin costo.

Salidas por foto elegida de cada alumno:
    <salón>/3 Para imprimir/<medida>/<CÓDIGO_APELLIDOS_Nombre_medida>.jpg
    <salón>/2 Editadas/<CÓDIGO_APELLIDOS_Nombre>.jpg      (vista grande de la medida principal)

Semáforo -> estado: verde = 'lista', amarillo = 'revisar', rojo o error = 'problema'.
Cada archivo se escribe a un temporal y se renombra al final: nunca queda una salida a medias.
"""
from __future__ import annotations

import importlib
import json
import os
import subprocess
import sys
import threading
import time

from PIL import Image

from . import modelos
from . import organizar as org
from .medidas import Medida
from .registro import en_palabras, log

LADO_VISTA = 1800


def carpeta_pipeline(ruta_pipeline: str | None = None) -> str:
    """Carpeta con pipeline_fotos.py: la elegida en Ajustes, la del repo o la que va dentro del .exe."""
    candidatas = [ruta_pipeline] if ruta_pipeline else []
    aqui = os.path.dirname(os.path.abspath(__file__))
    candidatas += [os.path.join(aqui, "..", "..", "pipeline"), os.path.join(aqui, "..", "pipeline"),
                   os.path.join(getattr(sys, "_MEIPASS", aqui), "pipeline")]
    for c in candidatas:
        if c and os.path.exists(os.path.join(c, "pipeline_fotos.py")):
            return os.path.abspath(c)
    raise FileNotFoundError("No encontré el motor de edición (pipeline_fotos.py).")


def cargar_pipeline(ruta_pipeline: str | None = None):
    """Importa pipeline_fotos desde la carpeta del motor."""
    c = carpeta_pipeline(ruta_pipeline)
    if c not in sys.path:
        sys.path.insert(0, c)
    return importlib.import_module("pipeline_fotos")


def buscar_modelo_cara() -> str | None:
    """face_landmarker.task: junto al motor, o en la carpeta de modelos del programa."""
    aqui = os.path.dirname(os.path.abspath(__file__))
    for c in (os.path.join(aqui, "..", "..", "pipeline"), os.path.join(aqui, "..", "pipeline"),
              os.path.dirname(PYTHON_MOTOR), os.path.join(getattr(sys, "_MEIPASS", aqui), "pipeline")):
        r = os.path.join(c, "face_landmarker.task")
        if os.path.exists(r):
            return os.path.abspath(r)
    return modelos.ruta("face_landmarker.task")


# ------------------------------------------------------------------ motor con tarjeta gráfica (fuera del .exe)
PYTHON_MOTOR = r"C:\dev\fotos-jeff-motor\pipeline\.venv\Scripts\python.exe"


def python_motor() -> str | None:
    """Python del motor ya instalado (con torch y BiRefNet). Sin él, se edita con ISNet en esta misma app."""
    for c in (os.environ.get("FJ_PYTHON_MOTOR"), PYTHON_MOTOR):
        if c and os.path.exists(c):
            return c
    return None


def _tiene_torch() -> bool:
    try:
        importlib.import_module("torch")
        return True
    except Exception:
        return False


class MotorExterno:
    """Un solo proceso del motor para toda la sesión: BiRefNet se carga una vez, no por cada foto."""
    MARCA = "@@FJ@@"
    _uno = None
    _candado = threading.Lock()

    def __init__(self, python: str, carpeta: str):
        self.python, self.carpeta, self.p = python, carpeta, None

    @classmethod
    def compartido(cls, python: str, carpeta: str) -> "MotorExterno":
        with cls._candado:
            if cls._uno is None or (cls._uno.python, cls._uno.carpeta) != (python, carpeta):
                cls._uno = cls(python, carpeta)
            return cls._uno

    def _script(self) -> str:
        aqui = os.path.dirname(os.path.abspath(__file__))
        for c in (os.path.join(getattr(sys, "_MEIPASS", aqui), "motor_servidor.py"),
                  os.path.join(aqui, "..", "motor_servidor.py")):
            if os.path.exists(c):
                return os.path.abspath(c)
        raise FileNotFoundError("Falta motor_servidor.py junto al programa. Reinstala el programa.")

    def _arrancar(self):
        env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
        self.p = subprocess.Popen([self.python, "-u", self._script(), self.carpeta], stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding="utf-8",
                                  errors="replace", env=env, cwd=self.carpeta,
                                  creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        self._leer()  # espera el "listo" (carga de librerías)

    def _leer(self) -> dict:
        while True:
            linea = self.p.stdout.readline()
            if not linea:
                self.p = None
                raise RuntimeError("El motor con tarjeta gráfica se cerró. Revisa C:\\dev\\fotos-jeff-motor "
                                   "o vuelve a intentar.")
            if linea.startswith(self.MARCA):
                return json.loads(linea[len(self.MARCA):])

    def __call__(self, ruta_in, ruta_out, producto, fondo_rgb=(0.92, 0.92, 0.92), dpi=300,
                 modelo_onnx=None, modelo_cara=None) -> dict:
        with self._candado:
            if self.p is None or self.p.poll() is not None:
                self._arrancar()
            self.p.stdin.write(json.dumps({"in": ruta_in, "out": ruta_out, "producto": producto,
                                           "fondo": list(fondo_rgb), "dpi": dpi, "modelo_onnx": modelo_onnx,
                                           "modelo_cara": modelo_cara}) + "\n")
            self.p.stdin.flush()
            r = self._leer()
        if "error" in r:
            raise RuntimeError(r["error"])
        return r

    def cerrar(self):
        if self.p and self.p.poll() is None:
            self.p.stdin.close()
            try:
                self.p.wait(5)
            except subprocess.TimeoutExpired:
                self.p.kill()
        self.p = None


def medida_desde_fila(m) -> Medida:
    return Medida(m["nombre"], m["ancho_cm"], m["alto_cm"], m["dpi"], m["tipo"], bool(m["favorita"]))


def _fondo(rgb_txt: str) -> tuple:
    return tuple(int(v) / 255 for v in rgb_txt.split(","))


class EditorLocal:
    def __init__(self, base, modelo_onnx: str | None = None, modelo_cara: str | None = None,
                 ruta_pipeline: str | None = None):
        self.base = base
        self.modelo_onnx = modelo_onnx
        self.modelo_cara = modelo_cara or buscar_modelo_cara()
        self.ruta_pipeline = ruta_pipeline
        self._pf = None

    @property
    def pf(self):
        if self._pf is None:
            self._pf = cargar_pipeline(self.ruta_pipeline)
        return self._pf

    def procesador(self):
        """Con qué se edita en esta PC, de mejor a más simple:
        1) ISNet elegido a mano en Ajustes; 2) motor con tarjeta gráfica (venv del motor);
        3) torch dentro de este mismo Python (al correrlo desde el código); 4) ISNet en CPU, se descarga solo."""
        if self.modelo_onnx:
            return self.pf.procesar
        py = python_motor()
        if py:
            return MotorExterno.compartido(py, carpeta_pipeline(self.ruta_pipeline))
        if not getattr(sys, "frozen", False) and _tiene_torch():
            return self.pf.procesar
        self.modelo_onnx = modelos.isnet()
        return self.pf.procesar

    def pendientes(self, salon_id: int) -> list[int]:
        """Fotos elegidas del salón que aún no se editaron."""
        return [r[0] for r in self.base.q(
            "select id from fotos where salon_id=? and elegida=1 and estado in ('nueva','editando')", salon_id)]

    def editar(self, foto_id: int, medida_ids: list[int], procesar=None) -> dict:
        """Edita una foto en todas las medidas pedidas. `procesar` permite inyectar el motor en pruebas."""
        b = self.base
        f = b.q1("select * from fotos where id=?", foto_id)
        if not f:
            raise KeyError(f"foto {foto_id} no existe")
        if not medida_ids:
            raise ValueError("Elige al menos una medida.")
        info = b.info_salon(f["salon_id"])
        alumno = b.q1("select * from alumnos where id=?", f["alumno_id"]) if f["alumno_id"] else None
        medidas = [medida_desde_fila(b.q1("select * from medidas where id=?", i)) for i in medida_ids]
        from .ia.servicio import ruta_fuente_actual
        origen = ruta_fuente_actual(b, f)  # la versión de IA aceptada, o el original
        if not os.path.exists(origen):
            raise FileNotFoundError(origen)
        if procesar is None:
            procesar = self.procesador()
            if not self.modelo_cara:
                try:
                    self.modelo_cara = modelos.cara()
                except OSError:
                    log.warning("sin modelo de cara: encuadre por silueta")
        carpeta = os.path.join(b.raiz, org.carpeta_salon(info))
        b.cambiar_estado([foto_id], "editando")
        t0 = time.time()
        por_medida, alertas, peor = {}, [], "verde"
        try:
            for mid, med in zip(medida_ids, medidas):
                nombre = (org.nombre_archivo(alumno, med.etiqueta_archivo) if alumno
                          else org.nombre_seguro(f"SIN-ALUMNO_{os.path.splitext(f['nombre_camara'])[0]}_"
                                                 f"{med.etiqueta_archivo}", 120) + ".jpg")
                destino = os.path.join(carpeta, org.CARPETAS[2], org.nombre_seguro(med.nombre), nombre)
                os.makedirs(os.path.dirname(destino), exist_ok=True)
                tmp = destino + ".part.jpg"
                try:
                    qa = procesar(origen, tmp, med.clave_motor, fondo_rgb=_fondo(info["fondo_rgb"]), dpi=med.dpi,
                                  modelo_onnx=self.modelo_onnx, modelo_cara=self.modelo_cara)
                    os.replace(tmp, destino)
                finally:
                    if os.path.exists(tmp):
                        os.remove(tmp)
                por_medida[med.nombre] = {"semaforo": qa.get("semaforo"), "alertas": qa.get("alertas", []),
                                          "ruta": os.path.relpath(destino, b.raiz)}
                alertas += [a for a in qa.get("alertas", []) if a not in alertas]
                peor = _peor(peor, qa.get("semaforo", "amarillo"))
                with b.tx():
                    b.cx.execute("""insert into salidas(foto_id, medida_id, ruta, semaforo) values (?,?,?,?)
                                    on conflict(foto_id, medida_id) do update set ruta=excluded.ruta,
                                    semaforo=excluded.semaforo, creada_en=datetime('now','localtime')""",
                                 (foto_id, mid, os.path.relpath(destino, b.raiz), qa.get("semaforo", "amarillo")))
            # vista grande en '2 Editadas' a partir de la primera medida
            primera = os.path.join(b.raiz, por_medida[medidas[0].nombre]["ruta"])
            nombre_vista = org.nombre_archivo(alumno) if alumno else os.path.basename(primera)
            self._vista(primera, os.path.join(carpeta, org.CARPETAS[1], nombre_vista))
            estado = {"verde": "lista", "amarillo": "revisar"}.get(peor, "problema")
            qa_total = {"semaforo": peor, "alertas": alertas, "por_medida": por_medida,
                        "segundos": round(time.time() - t0, 1)}
        except Exception as e:
            log.exception("editar foto %s", foto_id)
            estado = "problema"
            qa_total = {"semaforo": "rojo", "alertas": [en_palabras(e)], "por_medida": por_medida,
                        "error": f"{e.__class__.__name__}: {e}"}
        with b.tx():
            b.cx.execute("update fotos set estado=?, qa=? where id=?",
                         (estado, json.dumps(qa_total, ensure_ascii=False, default=str), foto_id))
        b.anotar("editar", "foto", foto_id, {"semaforo": qa_total["semaforo"]})
        return qa_total

    @staticmethod
    def _vista(origen: str, destino: str):
        os.makedirs(os.path.dirname(destino), exist_ok=True)
        tmp = destino + ".part.jpg"
        try:
            with Image.open(origen) as im:
                im = im.convert("RGB")
                im.thumbnail((LADO_VISTA, LADO_VISTA), Image.LANCZOS)
                im.save(tmp, "JPEG", quality=90)
            os.replace(tmp, destino)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)


def _peor(a: str, b: str) -> str:
    orden = {"verde": 0, "amarillo": 1, "rojo": 2}
    return a if orden.get(a, 2) >= orden.get(b, 2) else b
