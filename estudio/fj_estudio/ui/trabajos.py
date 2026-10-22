"""
Trabajos en segundo plano: importar, editar, pedir a la IA, copiar a Drive.

La pantalla nunca se congela. Cada trabajo avisa su avance y termina con resultado o con un
error en palabras simples. Los trabajos pesados (motor y GPU) van de a uno en su propia cola.
"""
from __future__ import annotations

import traceback

from PySide6.QtCore import QObject, QRunnable, QThreadPool, Signal

from ..registro import en_palabras, log


class Senales(QObject):
    avance = Signal(int, int, str)     # hecho, total, texto
    listo = Signal(object)
    error = Signal(str)


class Trabajo(QRunnable):
    def __init__(self, fn, *args, **kwargs):
        super().__init__()
        self.fn, self.args, self.kwargs = fn, args, kwargs
        self.s = Senales()
        self.cancelado = False
        self.setAutoDelete(True)

    def run(self):
        try:
            r = self.fn(self, *self.args, **self.kwargs)
        except Exception as e:  # el trabajo nunca tumba el programa
            log.error("trabajo %s: %s", getattr(self.fn, "__name__", self.fn), traceback.format_exc())
            self.s.error.emit(en_palabras(e))
        else:
            self.s.listo.emit(r)

    def avanzar(self, hecho: int, total: int, texto: str = ""):
        self.s.avance.emit(hecho, total, texto)


class Colas:
    def __init__(self):
        self.general = QThreadPool()
        self.general.setMaxThreadCount(4)
        self.pesada = QThreadPool()        # motor de edición / IA: de a uno
        self.pesada.setMaxThreadCount(1)
        self.activos: set[Trabajo] = set()

    def lanzar(self, fn, *args, pesado=False, al_listo=None, al_error=None, al_avance=None, **kwargs) -> Trabajo:
        t = Trabajo(fn, *args, **kwargs)
        self.activos.add(t)
        if al_listo:
            t.s.listo.connect(al_listo)
        if al_error:
            t.s.error.connect(al_error)
        if al_avance:
            t.s.avance.connect(al_avance)
        t.s.listo.connect(lambda _=None: self.activos.discard(t))
        t.s.error.connect(lambda _=None: self.activos.discard(t))
        (self.pesada if pesado else self.general).start(t)
        return t

    def ocupado(self) -> bool:
        return bool(self.activos)

    def cancelar_todo(self):
        for t in list(self.activos):
            t.cancelado = True
        self.general.clear()
        self.pesada.clear()

    def esperar(self, ms: int = 15000):
        self.general.waitForDone(ms)
        self.pesada.waitForDone(ms)
