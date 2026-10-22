"""
Medidas de impresión: presets que más se usan y medidas libres.

Una medida es ancho x alto en cm + DPI. El tipo decide el encuadre:
- 'cuadro': medio cuerpo (promociones, graduaciones).
- 'carnet': rostro (carnets, documentos). Se elige solo si la medida es pequeña (< 9 cm).
"""
from __future__ import annotations

import re
from dataclasses import dataclass

DPI_MIN, DPI_MAX = 72, 1200
CM_MIN, CM_MAX = 1.0, 200.0
PX_MAX = 30000  # un lado de más de 30 000 px no entra en memoria de forma segura


@dataclass
class Medida:
    nombre: str
    ancho_cm: float
    alto_cm: float
    dpi: int = 300
    tipo: str = ""
    favorita: bool = False

    def __post_init__(self):
        if not self.tipo:
            self.tipo = "carnet" if max(self.ancho_cm, self.alto_cm) < 9 else "cuadro"

    def validar(self):
        if not self.nombre:
            raise ValueError("La medida necesita un nombre.")
        for v in (self.ancho_cm, self.alto_cm):
            if not (CM_MIN <= v <= CM_MAX):
                raise ValueError(f"Cada lado debe medir entre {CM_MIN:g} y {CM_MAX:g} cm.")
        if not (DPI_MIN <= self.dpi <= DPI_MAX):
            raise ValueError(f"El DPI debe estar entre {DPI_MIN} y {DPI_MAX}.")
        if self.tipo not in ("cuadro", "carnet"):
            raise ValueError("Tipo de medida no válido.")
        if max(self.px) > PX_MAX:
            raise ValueError("Esa medida con ese DPI es demasiado grande. Baja el DPI.")

    @property
    def px(self) -> tuple[int, int]:
        return cm_a_px(self.ancho_cm, self.dpi), cm_a_px(self.alto_cm, self.dpi)

    @property
    def clave_motor(self) -> str:
        """Lo que entiende pipeline_fotos.procesar como 'producto'."""
        return f"{self.ancho_cm:g}x{self.alto_cm:g}"

    @property
    def etiqueta_archivo(self) -> str:
        return ("carnet-" if self.tipo == "carnet" else "") + self.clave_motor


# Presets: los de uso constante van marcados como favoritos (salen primero y en grande).
PRESETS: list[Medida] = [
    Medida("15x21", 15, 21, favorita=True),
    Medida("20x30", 20, 30, favorita=True),
    Medida("30x40", 30, 40, favorita=True),
    Medida("Carnet 3x4", 3, 4, favorita=True),
    Medida("10x15", 10, 15),
    Medida("13x18", 13, 18),
    Medida("20x25", 20, 25),
    Medida("30x45", 30, 45),
    Medida("40x50", 40, 50),
    Medida("40x60", 40, 60),
    Medida("50x70", 50, 70),
    Medida("Carnet 2.5x3", 2.5, 3),
    Medida("Pasaporte 3.5x4.5", 3.5, 4.5),
    Medida("Fotocheck", 5.4, 8.6, tipo="carnet"),
]


def cm_a_px(cm: float, dpi: int) -> int:
    return int(round(cm / 2.54 * dpi))


def interpretar(texto: str, dpi: int = 300) -> Medida:
    """'20x30', '20 x 30', '18,5x24', '8x10 pulg' -> Medida. Errores en palabras simples."""
    t = (texto or "").strip().lower().replace(",", ".").replace("×", "x").replace("*", "x")
    pulgadas = bool(re.search(r'(pulg|\bin\b|")', t))
    m = re.match(r"^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)", t)
    if not m:
        raise ValueError("Escribe la medida como ANCHO x ALTO, por ejemplo 20x30.")
    w, h = float(m.group(1)), float(m.group(2))
    if pulgadas:
        w, h = round(w * 2.54, 2), round(h * 2.54, 2)
    med = Medida(f"{w:g}x{h:g}", w, h, dpi)
    med.validar()
    return med


def resolucion_suficiente(ancho_px: int, alto_px: int, med: Medida, fraccion_util: float = 0.85) -> bool:
    """¿La foto original alcanza para esa medida sin ampliar de más? (aprox., antes de recortar)."""
    W, H = med.px
    return alto_px * fraccion_util >= H * 0.87 and ancho_px >= W * 0.5
