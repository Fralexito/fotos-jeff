"""
Verificación de rasgos: ¿la foto que devolvió la IA sigue siendo la misma persona, sin cambios
en la cara ni en el cuerpo?

Compara el original con el resultado usando los puntos de la cara (MediaPipe, 478 puntos):
1. Forma de la cara: se alinean ambos juegos de puntos (giro, escala y posición) y se mide cuánto
   difieren. Enderezar la cabeza se permite (es solo giro); cambiar la forma, no.
2. Proporciones clave: ojos, nariz, boca, mandíbula y largo de cara, en relación con la distancia
   entre los ojos. Cada una debe quedar dentro de la tolerancia.
3. Tono de piel: color medio de las mejillas (Delta E en LAB). Corregir el color se permite un poco;
   aclarar u oscurecer la piel, no.

Sin cara detectable en alguna de las dos: no se aprueba sola; queda para que una persona la revise.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

# puntos estables del FaceMesh (no se mueven con la expresión leve)
P = dict(ojo_d_ext=33, ojo_d_int=133, ojo_i_int=362, ojo_i_ext=263, nariz_punta=1, ala_d=129, ala_i=358,
         boca_d=61, boca_i=291, menton=152, frente=10, mandibula_d=234, mandibula_i=454, ceja_d=70, ceja_i=300,
         mejilla_d=50, mejilla_i=280)
FORMA = [33, 133, 362, 263, 1, 129, 358, 61, 291, 152, 10, 234, 454, 70, 300, 168, 6, 197, 4, 98, 327]

PROPORCIONES = {
    "ancho de ojos": (("ojo_d_ext", "ojo_d_int"), ("ojo_i_int", "ojo_i_ext")),
    "ancho de nariz": (("ala_d", "ala_i"),),
    "ancho de boca": (("boca_d", "boca_i"),),
    "ancho de mandíbula": (("mandibula_d", "mandibula_i"),),
    "largo de cara": (("frente", "menton"),),
    "nariz a mentón": (("nariz_punta", "menton"),),
}

TOL_FORMA = 0.045      # error medio de forma tras alinear, en unidades de distancia entre ojos
TOL_PROPORCION = 0.06  # 6 % por proporción
TOL_PIEL_DE = 7.0      # Delta E máximo del tono de mejillas


@dataclass
class Veredicto:
    aprobado: bool
    motivos: list[str] = field(default_factory=list)
    medidas: dict = field(default_factory=dict)

    @property
    def semaforo(self) -> str:
        return "verde" if self.aprobado else "rojo"


def _d(pts, a, b):
    return float(np.linalg.norm(pts[P[a]] - pts[P[b]]))


def _alinear(orig: np.ndarray, nuevo: np.ndarray) -> float:
    """Error medio de los puntos FORMA tras la mejor similitud (Procrustes), en unidades de distancia entre ojos."""
    A, B = orig[FORMA], nuevo[FORMA]
    a, b = A - A.mean(0), B - B.mean(0)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    a, b = a / na, b / nb
    U, _, Vt = np.linalg.svd(b.T @ a)
    R = U @ Vt
    b2 = b @ R
    escala_ojos = np.linalg.norm(orig[P["ojo_d_ext"]] - orig[P["ojo_i_ext"]]) / na
    return float(np.linalg.norm(a - b2, axis=1).mean() / escala_ojos)


def comparar_puntos(orig: np.ndarray, nuevo: np.ndarray) -> Veredicto:
    """orig/nuevo: (478, 2) en píxeles. Puro cálculo, sin modelos (se prueba aparte)."""
    motivos, med = [], {}
    err = _alinear(orig, nuevo)
    med["forma"] = round(err, 4)
    if err > TOL_FORMA:
        motivos.append("cambió la forma de la cara")
    io, inu = _d(orig, "ojo_d_ext", "ojo_i_ext"), _d(nuevo, "ojo_d_ext", "ojo_i_ext")
    for nombre, pares in PROPORCIONES.items():
        ro = sum(_d(orig, a, b) for a, b in pares) / io
        rn = sum(_d(nuevo, a, b) for a, b in pares) / inu
        cambio = abs(rn - ro) / max(ro, 1e-6)
        med[nombre] = round(cambio, 4)
        if cambio > TOL_PROPORCION:
            motivos.append(f"cambió el {nombre}")
    return Veredicto(not motivos, motivos, med)


def tono_mejillas(rgb: np.ndarray, pts: np.ndarray) -> np.ndarray:
    import cv2
    io = _d(pts, "ojo_d_ext", "ojo_i_ext")
    r = max(3, int(io * 0.12))
    lab = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    lab[..., 0] *= 100 / 255
    lab[..., 1:] -= 128
    muestras = []
    for k in ("mejilla_d", "mejilla_i"):
        x, y = pts[P[k]].astype(int)
        parche = lab[max(0, y - r):y + r, max(0, x - r):x + r].reshape(-1, 3)
        if len(parche):
            muestras.append(np.median(parche, 0))
    return np.mean(muestras, 0)


def verificar(rgb_orig: np.ndarray, rgb_nuevo: np.ndarray, detector) -> Veredicto:
    """`detector(rgb) -> (478,2) | None`."""
    po, pn = detector(rgb_orig), detector(rgb_nuevo)
    if po is None:
        return Veredicto(False, ["no se ve bien la cara en el original: revísala tú"])
    if pn is None:
        return Veredicto(False, ["la IA tapó o borró la cara"])
    v = comparar_puntos(po, pn)
    de = float(np.linalg.norm(tono_mejillas(rgb_orig, po) - tono_mejillas(rgb_nuevo, pn)))
    v.medidas["piel_delta_e"] = round(de, 2)
    if de > TOL_PIEL_DE:
        v.motivos.append("cambió el tono de la piel")
        v.aprobado = False
    return v


def detector_mediapipe(modelo_cara: str):
    """Devuelve una función rgb -> puntos (478, 2) en píxeles, o None si no hay cara."""
    import mediapipe as mp
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core.base_options import BaseOptions
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=modelo_cara), num_faces=1))

    def detectar(rgb: np.ndarray):
        h, w = rgb.shape[:2]
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb.astype(np.uint8))))
        if not r.face_landmarks:
            return None
        return np.array([[p.x * w, p.y * h] for p in r.face_landmarks[0]], np.float64)
    return detectar
