"""
Pipeline de edición automática para fotografía escolar (Fotos Jeff).

Etapas: segmentación (IA, intercambiable) -> trimapa -> estimación de primer plano
(defringe) -> rescate de borla -> geometría (headroom / base-lock) -> sobreposición
de prenda -> color LAB -> exportación 300 DPI + reporte QA.

Todo salvo `segmentar_birefnet` es determinista. Uso:

    python pipeline_fotos.py foto.jpg salida.jpg --producto 15x21
    python pipeline_fotos.py foto.jpg salida.jpg --producto 18x24 --dpi 254
    python pipeline_fotos.py foto.jpg salida.jpg --producto 20x30,13x18,carnet
    python pipeline_fotos.py foto.jpg salida.jpg --alpha mascara.png --prenda toga.png --prenda-json toga.json

Dependencias base: numpy, opencv-python-headless, pillow, pymatting.
Opcionales: torch + transformers (BiRefNet), mediapipe (anclajes faciales/pose).
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict

import cv2
import numpy as np
from PIL import Image, ImageCms, ImageOps

DPI = 300  # valor por defecto; cada producto o la línea de comandos puede cambiarlo

# Plantillas de producto: tamaño de papel (cm), rebaje de moldura (mm), sangrado (mm),
# fracción de alto que ocupa "birrete + cara" (k_h) y headroom sobre el rebaje (h_r).
# Cuadros: encuadre a medio cuerpo. Carnets/documentos: encuadre de rostro.
_CUADRO = dict(sangrado_mm=3.0, k_h=0.30, h_r=0.05)
_CARNET = dict(rebaje_mm=0.0, sangrado_mm=2.0, k_h=0.62, h_r=0.06)
PRODUCTOS = {
    "10x15": dict(cm=(10.0, 15.0), rebaje_mm=4.0, **_CUADRO),
    "13x18": dict(cm=(13.0, 18.0), rebaje_mm=5.0, **_CUADRO),
    "15x21": dict(cm=(15.0, 21.0), rebaje_mm=5.0, **_CUADRO),
    "20x25": dict(cm=(20.0, 25.0), rebaje_mm=6.0, **_CUADRO),
    "20x30": dict(cm=(20.0, 30.0), rebaje_mm=6.0, **dict(_CUADRO, k_h=0.28)),
    "30x40": dict(cm=(30.0, 40.0), rebaje_mm=8.0, **dict(_CUADRO, k_h=0.26)),
    "carnet": dict(cm=(3.0, 4.0), **_CARNET),
    "carnet35x45": dict(cm=(3.5, 4.5), **_CARNET),
    "fotocheck": dict(cm=(5.4, 8.6), **dict(_CARNET, k_h=0.40)),  # tarjeta CR80
}


def producto(nombre: str) -> dict:
    """Plantilla por nombre, o medida libre 'ANCHOxALTO' en cm (p. ej. '18x24', '4.5x5.5')."""
    if nombre in PRODUCTOS:
        return PRODUCTOS[nombre]
    try:
        w, h = (float(v.replace(",", ".")) for v in nombre.lower().split("x"))
    except ValueError:
        raise SystemExit(f"medida no reconocida: {nombre!r}; usa una plantilla o ANCHOxALTO en cm")
    base = _CARNET if max(w, h) < 9 else dict(_CUADRO, rebaje_mm=5.0)
    return dict(cm=(w, h), **base)


def cm_a_px(cm: float, dpi: int = DPI) -> int:
    return int(round(cm / 2.54 * dpi))


def mm_a_px(mm: float, dpi: int = DPI) -> int:
    return int(round(mm / 25.4 * dpi))


# --------------------------------------------------------------------------- IA
_BIREFNET = {}


def segmentar_birefnet(rgb: np.ndarray, repo: str = "ZhengPeng7/BiRefNet_HR", lado: int = 2048) -> np.ndarray:
    """Máscara alfa0 en [0,1] con BiRefNet (MIT). BiRefNet_HR trabaja a 2048 px: más fino en el pelo.
    El modelo se carga una sola vez por proceso."""
    import torch
    from transformers import AutoModelForImageSegmentation

    disp = "cuda" if torch.cuda.is_available() else "cpu"
    if repo not in _BIREFNET:
        m = AutoModelForImageSegmentation.from_pretrained(repo, trust_remote_code=True).eval().to(disp)
        _BIREFNET[repo] = m.half() if disp == "cuda" else m
    modelo = _BIREFNET[repo]
    x = cv2.resize(rgb, (lado, lado), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    t = torch.from_numpy(x.transpose(2, 0, 1)[None].astype(np.float32)).to(disp)
    if disp == "cuda":
        t = t.half()
    with torch.no_grad():
        pred = modelo(t)[-1].sigmoid()[0, 0].float().cpu().numpy()
    return cv2.resize(pred, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)


def segmentar_isnet(rgb: np.ndarray, modelo_onnx: str) -> np.ndarray:
    """Alternativa ligera para PCs sin GPU: ISNet (DIS, Apache 2.0) en ONNX Runtime/CPU."""
    import onnxruntime as ort

    ses = ort.InferenceSession(modelo_onnx, providers=["CPUExecutionProvider"])
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 - 0.5
    pred = ses.run(None, {ses.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / (pred.max() - pred.min() + 1e-8)
    return cv2.resize(pred, (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)


# ------------------------------------------------------------------- anclajes
@dataclass
class Anclajes:
    y_top: float
    y_chin: float
    y_bot: float
    x_c: float
    theta_deg: float
    cara: tuple  # x, y, w, h
    hombros: tuple | None  # (xL, yL, xR, yR)
    fuente: str


def anclajes_desde_alpha(alpha: np.ndarray) -> Anclajes:
    """Respaldo sin MediaPipe: perfil de ancho de la silueta.
    La cara es el primer mínimo local de ancho bajo la cabeza (el cuello)."""
    filas = np.where((alpha > 0.5).any(axis=1))[0]
    y_top, y_bot = float(filas[0]), float(filas[-1])
    anchos = (alpha > 0.5).sum(axis=1).astype(np.float32)
    ancho_max = anchos.max()
    # hombros: primera fila (bajo la cabeza) donde el ancho salta a más del 55% del máximo
    y_hombro = int(np.argmax(anchos > 0.55 * ancho_max))
    # cuello: fila más estrecha entre la mitad de la cabeza y los hombros
    y_ini = int(y_top + 0.35 * (y_hombro - y_top))
    y_cuello = y_ini + int(np.argmin(anchos[y_ini:y_hombro])) if y_hombro > y_ini else y_hombro
    cols = np.where(alpha[y_hombro] > 0.5)[0]
    x_c = float(cols.mean())
    y_chin = y_cuello - 0.15 * (y_cuello - y_top)
    w_cara = float(anchos[int((y_top + y_chin) / 2)])
    cara = (x_c - w_cara / 2, y_top, w_cara, y_chin - y_top)
    return Anclajes(y_top, y_chin, y_bot, x_c, 0.0, cara,
                    (float(cols[0]), float(y_hombro), float(cols[-1]), float(y_hombro)), "alpha")


def anclajes_mediapipe(rgb: np.ndarray, alpha: np.ndarray, modelo_cara: str) -> Anclajes:
    """Ancla con la malla facial de MediaPipe Tasks (mentón = 152, ojos 33/263).
    Los hombros salen del perfil de la silueta. Devuelve también la apertura de ojos."""
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions

    h, w = alpha.shape
    base = anclajes_desde_alpha(alpha)
    f = min(1.0, 1600 / max(h, w))  # la malla no necesita 24 MP
    peq = cv2.resize(rgb, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=modelo_cara),
                                        num_faces=2, output_face_blendshapes=True)
    with vision.FaceLandmarker.create_from_options(opts) as fl:
        res = fl.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(peq)))
    if len(res.face_landmarks) != 1:
        raise RuntimeError(f"se esperaba exactamente un rostro, hay {len(res.face_landmarks)}")
    pts = np.array([(p.x * w, p.y * h) for p in res.face_landmarks[0]])
    ojo_i, ojo_d = pts[33], pts[263]
    theta = float(np.degrees(np.arctan2(ojo_d[1] - ojo_i[1], ojo_d[0] - ojo_i[0])))
    x0, y0 = pts.min(axis=0)
    x1, y1 = pts.max(axis=0)
    bs = {c.category_name: c.score for c in res.face_blendshapes[0]} if res.face_blendshapes else {}
    # hombros: primera fila bajo el mentón donde la silueta supera 1.8 anchos de cara
    # (buscar desde arriba confundiría el ala del birrete con los hombros)
    y_chin = float(pts[152][1])
    anchos = (alpha > 0.5).sum(axis=1)
    bajo = np.where(anchos[int(y_chin):] > 1.8 * (x1 - x0))[0]
    hombros = base.hombros
    if len(bajo):
        yh = int(y_chin) + int(bajo[0])
        cols = np.where(alpha[yh] > 0.5)[0]
        hombros = (float(cols[0]), float(yh), float(cols[-1]), float(yh))
    anc = Anclajes(base.y_top, y_chin, base.y_bot, float((x0 + x1) / 2), theta,
                   (float(x0), float(y0), float(x1 - x0), float(y1 - y0)), hombros, "mediapipe")
    anc.parpadeo = max(bs.get("eyeBlinkLeft", 0), bs.get("eyeBlinkRight", 0))
    return anc


# --------------------------------------------------------- matting y defringe
def trimapa(alpha0: np.ndarray, h_cara: float) -> np.ndarray:
    r = max(6, int(0.035 * h_cara))
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    fg = cv2.erode((alpha0 > 0.95).astype(np.uint8), k)
    bg_lim = cv2.dilate((alpha0 > 0.05).astype(np.uint8), k)
    t = np.full(alpha0.shape, 0.5, np.float32)
    t[fg == 1] = 1.0
    t[bg_lim == 0] = 0.0
    return t


def refinar_alpha(rgb01: np.ndarray, alpha0: np.ndarray, tri: np.ndarray,
                  max_px: int = 3_000_000) -> np.ndarray:
    """Matting en la banda gris. ViTMatte en producción; aquí forma cerrada (Levin et al.).
    Solo se resuelve el rectángulo que contiene la banda (sobre todo cabello), a la mayor
    resolución que quepa en max_px, para no perder hebras finas."""
    from pymatting import estimate_alpha_cf

    h, w = alpha0.shape
    ys, xs = np.where(tri == 0.5)
    if len(ys) == 0:
        return tri.copy()
    m = 16
    y0, y1 = max(0, ys.min() - m), min(h, ys.max() + m + 1)
    x0, x1 = max(0, xs.min() - m), min(w, xs.max() + m + 1)
    img_c, tri_c = rgb01[y0:y1, x0:x1], tri[y0:y1, x0:x1]
    hc, wc = tri_c.shape
    f = min(1.0, (max_px / (hc * wc)) ** 0.5)
    if f < 1:
        small = cv2.resize(img_c, None, fx=f, fy=f, interpolation=cv2.INTER_AREA).astype(np.float64)
        ts = cv2.resize(tri_c, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST).astype(np.float64)
        a_c = cv2.resize(estimate_alpha_cf(small, ts).astype(np.float32), (wc, hc), interpolation=cv2.INTER_CUBIC)
    else:
        a_c = estimate_alpha_cf(img_c.astype(np.float64), tri_c.astype(np.float64)).astype(np.float32)
    a = tri.copy()
    a[y0:y1, x0:x1] = np.where(tri_c == 0.5, a_c, tri_c)  # solo se toca la banda
    return a.clip(0, 1)


def estimar_primer_plano(rgb01: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Resuelve I = aF + (1-a)B para F (Germer et al., multinivel)."""
    from pymatting import estimate_foreground_ml

    return estimate_foreground_ml(rgb01.astype(np.float64), alpha.astype(np.float64)).astype(np.float32).clip(0, 1)


# ------------------------------------------------------------------ color LAB
def a_lab(rgb01: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(rgb01.astype(np.float32), cv2.COLOR_RGB2Lab)  # L 0..100, a/b ~ -127..127


def desde_lab(lab: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(lab.astype(np.float32), cv2.COLOR_Lab2RGB).clip(0, 1)


def mascara_dorada(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    return ((L >= 45) & (L <= 92) & (b >= 25) & (a >= -5) & (a <= 22)
            & (b / np.maximum(a, 1) >= 1.6))


def solo_el_alumno(alpha: np.ndarray, anc: Anclajes) -> np.ndarray:
    """Conserva solo las regiones conectadas al rostro. Elimina la mano del ayudante,
    el cartel con el nombre u otra persona que entre por el borde del cuadro."""
    x, y, w, h = [int(v) for v in anc.cara]
    n, et = cv2.connectedComponents((alpha > 0.5).astype(np.uint8), connectivity=8)
    if n <= 2:
        return alpha
    ids = np.unique(et[max(0, y):y + h, max(0, x):x + w])
    ids = ids[ids > 0]
    if len(ids) == 0:
        return alpha
    keep = np.isin(et, ids).astype(np.uint8)
    keep = cv2.dilate(keep, np.ones((15, 15), np.uint8))  # conserva el borde suave del alfa
    return alpha * keep


def linea_hombros(anc: Anclajes) -> float:
    """Altura de los hombros; si la detección no es creíble (por encima del mentón, p. ej. el
    ala del birrete), se usa mentón + 0.8 alturas de cara."""
    if anc.hombros and anc.hombros[1] > anc.y_chin:
        return anc.hombros[1]
    return anc.y_chin + 0.8 * anc.cara[3]


def rellenar_huecos_toga(alpha: np.ndarray, anc: Anclajes) -> np.ndarray:
    """La toga no tiene agujeros: todo hueco cerrado bajo los hombros (que no toca el borde
    de la foto) es tela que la red confundió con el fondo, p. ej. estola dorada frente a un
    afiche amarillo. Sobre los hombros no se toca: allí los huecos son reales (entre mechones)."""
    y_h = int(linea_hombros(anc))
    fondo = (alpha < 0.5).astype(np.uint8)
    n, et = cv2.connectedComponents(fondo, connectivity=4)
    borde = np.unique(np.concatenate([et[0], et[-1], et[:, 0], et[:, -1]]))
    hueco = (et > 0) & ~np.isin(et, borde)
    hueco[:y_h] = False
    out = alpha.copy()
    out[hueco] = 1.0
    return out


def mascara_piel_protegida(forma: tuple, anc: Anclajes, f: float = 1.0) -> np.ndarray:
    """Cara, orejas y cuello hasta los hombros: la piel puede tener el color de la pared,
    así que estas zonas nunca se tratan como fondo."""
    x, y, w, h = [v * f for v in anc.cara]
    m = np.zeros(forma, np.uint8)
    cv2.ellipse(m, (int(x + w / 2), int(y + h / 2)), (int(w * 0.78), int(h * 0.68)), 0, 0, 360, 1, -1)
    y_hombro = anc.hombros[1] * f if anc.hombros else y + 1.6 * h
    y_cuello_fin = max(y_hombro, y + 1.45 * h)
    cv2.rectangle(m, (int(x + 0.12 * w), int(y + 0.8 * h)), (int(x + 0.88 * w), int(y_cuello_fin)), 1, -1)
    return m


def limpiar_huecos_fondo(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes,
                         d_lim: float = 3.0) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Quita el fondo atrapado entre borla, cabello y cuello (huecos que la red marca como sujeto).
    Modelo gaussiano del color del fondo en LAB (píxeles con alfa < 0.02) y distancia de
    Mahalanobis; el óvalo de la cara queda protegido porque la piel puede parecerse a la pared."""
    lab = a_lab(rgb01)
    f = 0.25
    lab_s = cv2.resize(lab, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    a_s = cv2.resize(alpha, (lab_s.shape[1], lab_s.shape[0]), interpolation=cv2.INTER_AREA)
    muestras = lab_s[a_s < 0.02].reshape(-1, 3)
    if len(muestras) < 500:
        return alpha, np.zeros_like(alpha), np.zeros_like(alpha)
    mu, cov = muestras.mean(0), np.cov(muestras.T) + np.eye(3) * 1e-3
    inv = np.linalg.inv(cov)
    dlt = lab_s - mu
    d = np.sqrt(np.einsum("...i,ij,...j->...", dlt, inv, dlt))
    parecido = np.clip((d_lim + 1.5 - d) / 1.5, 0, 1)  # 1 = igual al fondo
    # sin restricciones: lo usa el rescate de la borla para no confundir pared ocre con dorado
    color_fondo = cv2.resize(parecido, (alpha.shape[1], alpha.shape[0]), interpolation=cv2.INTER_LINEAR)
    # protección: óvalo de la cara agrandado
    prot = mascara_piel_protegida(parecido.shape, anc, f)
    parecido[prot == 1] = 0
    # solo en la zona de cabeza y cabello: bajo los hombros está la toga, y una pared o un
    # afiche amarillo se parecen a la estola dorada (la borrarían)
    y_hombro = linea_hombros(anc) * f
    parecido[int(y_hombro):] = 0
    crudo = cv2.resize(parecido, (alpha.shape[1], alpha.shape[0]), interpolation=cv2.INTER_LINEAR)
    parecido = cv2.morphologyEx(parecido, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    parecido = cv2.resize(cv2.GaussianBlur(parecido, (0, 0), 1), (alpha.shape[1], alpha.shape[0]),
                          interpolation=cv2.INTER_LINEAR)
    return (alpha * (1 - parecido)).astype(np.float32), crudo, color_fondo


def rescatar_borla(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes,
                   parecido_fondo: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Eleva alfa en los hilos dorados conectados al birrete. Devuelve (alpha, máscara).
    Excluye lo que se parece al fondo: una pared ocre o madera también cumple la regla del dorado."""
    h, w = alpha.shape
    x, y, wc, hc = anc.cara
    roi = np.zeros_like(alpha, bool)
    x0, x1 = int(max(0, x + wc / 2 - 1.1 * wc)), int(min(w, x + wc / 2 + 1.1 * wc))
    y0, y1 = int(max(0, y - 1.6 * hc)), int(min(h, anc.y_chin))
    roi[y0:y1, x0:x1] = True
    g = mascara_dorada(a_lab(rgb01)) & roi
    if parecido_fondo is not None:
        g &= parecido_fondo < 0.5
    g = cv2.morphologyEx(g.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    # conservar solo componentes que tocan la silueta opaca (birrete)
    n, etiquetas = cv2.connectedComponents(g, connectivity=8)
    opaco = cv2.dilate((alpha > 0.9).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    validas = np.zeros(n, bool)
    validas[np.unique(etiquetas[opaco & (g > 0)])] = True
    validas[0] = False
    g = validas[etiquetas].astype(np.float32)
    gs = cv2.GaussianBlur(g, (5, 5), 1.0)  # en producción: guided filter r=2, eps=1e-4
    return np.maximum(alpha, 0.98 * gs), g > 0


def _peso_tono(hue: np.ndarray, centro: float, ancho: float) -> np.ndarray:
    """1 en el tono `centro`, cae suave a 0 a `ancho` grados (círculo de tono)."""
    dh = np.abs((hue - centro + 180) % 360 - 180)
    return np.clip(1.5 - 1.5 * dh / ancho, 0, 1)


def _tono_rel(hue: np.ndarray) -> np.ndarray:
    """Tono en grados con el corte en 200° (así 0..199 queda continuo para piel/dorado)."""
    return np.where(hue > 200, hue - 360, hue)


def birrete_solido(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes) -> tuple[np.ndarray, np.ndarray]:
    """El birrete es tela opaca de bordes rectos. Con fondo recargado la red lo deshace;
    aquí se rehace desde el color real: azul oscuro de la toga conectado a la frente,
    envolvente convexa, alfa = 1 dentro. Por encima del ala solo queda el birrete.
    No inventa nada: los píxeles son los de la foto, solo cambia qué es sujeto."""
    h, w = alpha.shape
    x, y, wc, hc = anc.cara
    x0, x1 = int(max(0, x - 0.9 * wc)), int(min(w, x + wc + 0.9 * wc))
    y0, y1 = int(max(0, y - 1.6 * hc)), int(min(h, y + 0.25 * hc))
    if y1 - y0 < 10 or x1 - x0 < 10:
        return alpha, np.zeros_like(alpha, bool)
    lab = a_lab(rgb01[y0:y1, x0:x1])
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    hue, C = np.degrees(np.arctan2(b, a)) % 360, np.hypot(a, b)
    azul = (_peso_tono(hue, 298, 30) > 0.5) & (C > 25) & (L < 55)
    azul = cv2.morphologyEx(azul.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    cordon = mascara_dorada(lab) & (cv2.dilate(azul, np.ones((3, 3), np.uint8), iterations=int(0.02 * hc) + 1) > 0)
    azul = azul | cordon.astype(np.uint8)
    n, et = cv2.connectedComponents(azul, connectivity=8)
    # componente que toca la frente (franja justo sobre el borde superior de la cara)
    fy0, fy1 = int(y - 0.35 * hc) - y0, int(y + 0.1 * hc) - y0
    fx0, fx1 = int(x + 0.2 * wc) - x0, int(x + 0.8 * wc) - x0
    ids, cuenta = np.unique(et[max(0, fy0):max(1, fy1), max(0, fx0):fx1], return_counts=True)
    cuenta, ids = cuenta[ids > 0], ids[ids > 0]
    if len(ids) == 0:
        return alpha, np.zeros_like(alpha, bool)
    comp = (et == ids[np.argmax(cuenta)]).astype(np.uint8)
    if comp.sum() < 0.15 * wc * hc:  # muy poco azul: sin birrete o tapado
        return alpha, np.zeros_like(alpha, bool)
    # contorno del azul real, cerrado y sin agujeros, simplificado a polígono: el birrete es de
    # bordes rectos, así el borde dentado del umbral de color queda recto (respeta concavidades)
    comp = cv2.morphologyEx(comp, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cont, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cont = max(cont, key=cv2.contourArea)
    poli = cv2.approxPolyDP(cont, 0.006 * cv2.arcLength(cont, True), True)
    k = 4  # antialias: dibujo a 4x y reducción
    m4 = np.zeros((comp.shape[0] * k, comp.shape[1] * k), np.uint8)
    cv2.fillPoly(m4, [poli * k + k // 2], 255, lineType=cv2.LINE_AA)
    m = cv2.resize(m4, comp.shape[::-1], interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    # fila del ala: la última tan ancha como el tablero (el casquete es más angosto)
    anchos = (m > 0.5).sum(1)
    y_ala = int(np.where(anchos >= 0.7 * anchos.max())[0][-1])
    out = alpha.copy()
    sub = out[y0:y1, x0:x1]
    # halo que la red dejó alrededor del tablero (fondo recargado): fuera, salvo el dorado
    anillo = (cv2.dilate((m > 0.02).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=int(0.08 * hc)) > 0) & (m <= 0.02)
    anillo[y_ala:] = False
    oro = mascara_dorada(lab)
    sub[anillo & (sub < 0.95) & ~oro] = 0
    sub[:] = np.maximum(sub, m)
    mask = np.zeros_like(alpha, bool)
    mask[y0:y1, x0:x1] = m > 0.98
    return out, mask


def uniforme_limpio(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes,
                    azul_obj=(None, 78.0), dorado_obj=(78.0, 74.0), plancha: float = 0.85) -> np.ndarray:
    """Toga y estola como recién planchadas, sin tocar piel ni cabello.
    1) Color: lleva el croma del azul y la luminosidad/croma del dorado a un objetivo fijo
       (la cámara los apaga y el azul se ve morado). Ganancia medida en cada foto.
    2) Arrugas: por cada tela (azul, dorado) se separa la luz en base suave + pliegues +
       textura fina; se quita `plancha` de los pliegues y se conserva la textura del tejido.
       El promedio es por tela (convolución normalizada), así el borde azul/dorado no se mezcla."""
    lab = a_lab(rgb01)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    hue, C = np.degrees(np.arctan2(b, a)) % 360, np.hypot(a, b) + 1e-6
    # la zona protegida (cara + cuello) es un óvalo y un rectángulo: si se excluye entera, la
    # estola que cae dentro queda como un parche rectangular más apagado. Dentro de esa zona solo
    # se protege lo que tiene color de piel (tono < 70° o croma baja), no el dorado saturado.
    zona = cv2.GaussianBlur(mascara_piel_protegida(L.shape, anc).astype(np.float32), (0, 0), 3)
    parecido_piel = np.maximum(np.clip((72 - _tono_rel(hue)) / 6, 0, 1), np.clip((45 - C) / 8, 0, 1))
    libre = (1 - zona * parecido_piel) * (alpha > 0.5)
    # la piel nunca es azul: el azul no necesita protección (si no, queda un borde en el birrete)
    w_azul = _peso_tono(hue, 298, 28) * np.clip((C - 15) / 15, 0, 1) * (L < 60) * (alpha > 0.5)
    w_azul *= 1 - zona * np.clip((40 - C) / 10, 0, 1)  # sombra azulada del cuello: no es tela
    w_oro = _peso_tono(hue, 77, 16) * np.clip((C - 30) / 12, 0, 1) * (L > 40) * libre
    w_azul, w_oro = [cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5) for m in (w_azul, w_oro)]

    # 1) color
    for wm, (L_obj, C_obj) in ((w_azul, azul_obj), (w_oro, dorado_obj)):
        sel = wm > 0.8
        if sel.sum() < 2000:
            continue
        g = float(np.clip(C_obj / np.median(C[sel]), 1.0, 1.6))
        f = 1 + (g - 1) * wm
        a, b = a * f, b * f
        if L_obj is not None:
            L = L + wm * float(np.clip(L_obj - np.median(L[sel]), 0, 12))
    C = np.hypot(a, b) + 1e-6

    # 2) arrugas, a 1/4 de resolución para la base y los pliegues
    hc = anc.cara[3]
    s = 0.25
    Ls = cv2.resize(L, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    for wm in (w_azul, w_oro):
        ws = cv2.resize(wm, (Ls.shape[1], Ls.shape[0]), interpolation=cv2.INTER_AREA)
        if (ws > 0.8).sum() < 200:
            continue
        def media(sig):
            num = cv2.GaussianBlur(Ls * ws, (0, 0), sig)
            den = cv2.GaussianBlur(ws, (0, 0), sig) + 1e-4
            return num / den
        base = media(max(2.0, 0.6 * hc * s))   # caída general de luz de la tela
        medio = media(max(1.0, 0.012 * hc * s))  # pliegues sin la textura fina
        pliegue = cv2.resize(medio - base, (L.shape[1], L.shape[0]), interpolation=cv2.INTER_CUBIC)
        L = L - plancha * wm * pliegue
    return desde_lab(np.dstack([L, a, b]))


def corregir_color(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes,
                   k_sombras=0.25, L_p=40.0, ganancia_croma=1.05) -> np.ndarray:
    lab = a_lab(rgb01)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    h, w = L.shape
    # máscara de piel: elipse de la cara (en producción: FACE_OVAL de MediaPipe + elipse de croma)
    x, y, wc, hc = anc.cara
    piel = np.zeros((h, w), np.uint8)
    cv2.ellipse(piel, (int(x + wc / 2), int(y + hc * 0.55)), (int(wc / 2), int(hc * 0.5)), 0, 0, 360, 1, -1)
    piel = cv2.GaussianBlur(piel.astype(np.float32), (0, 0), max(1, hc * 0.03))
    yy = np.arange(h)[:, None]
    toga = ((alpha > 0.9) & (yy > anc.y_chin) & (L < 35)).astype(np.float32) * (1 - piel)
    toga = cv2.GaussianBlur(toga, (0, 0), 2)

    # 1. CLAHE solo sobre L*, mezclado por la máscara de toga
    L16 = (L / 100 * 65535).astype(np.uint16)
    Lc = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(L16).astype(np.float32) / 65535 * 100
    L = L + toga * (Lc - L)
    # 2. curva de sombras C1 con pivote L_p, fuera de la piel
    lift = np.where(L < L_p, k_sombras * (L_p - L) * (1 - L / L_p) ** 2, 0)
    L = L + lift * (1 - piel)
    # 3. NLM ponderado por sombra, nunca en piel
    L8 = (L / 100 * 255).clip(0, 255).astype(np.uint8)
    Ld = cv2.fastNlMeansDenoising(L8, None, h=5).astype(np.float32) / 255 * 100
    wgt = np.clip(1 - L / 40, 0, 1) * (1 - piel)
    L = L + wgt * (Ld - L)
    # 4. rodilla de altas luces
    L = np.where(L > 90, 90 + 10 * np.tanh((L - 90) / 10), L)
    # 5. croma con compresión tanh (C_max fijo aquí; por tono en producción), sin tocar piel
    C = np.sqrt(a ** 2 + b ** 2) + 1e-6
    C_max = 90.0
    Cn = C_max * np.tanh(ganancia_croma * C / C_max)
    f = 1 + (Cn / C - 1) * (1 - piel)
    lab = np.dstack([L, a * f, b * f])
    return desde_lab(lab)


# ----------------------------------------------------------------- geometría
@dataclass
class Encuadre:
    W: int
    H: int
    s: float
    tx: float
    ty: float
    theta: float
    flags: list


def calcular_encuadre(anc: Anclajes, nombre: str, alto_original: int, dpi: int = DPI) -> Encuadre:
    p = producto(nombre)
    W, H = cm_a_px(p["cm"][0], dpi), cm_a_px(p["cm"][1], dpi)
    m, b = mm_a_px(p["rebaje_mm"], dpi), mm_a_px(p["sangrado_mm"], dpi)
    flags = []
    s0 = p["k_h"] * H / (anc.y_chin - anc.y_top)
    y_top_dest = m + p["h_r"] * H
    s_min = (H + b - y_top_dest) / (anc.y_bot - anc.y_top)
    s = max(s0, s_min)
    if anc.y_bot < alto_original - 2:
        flags.append("sujeto flotando en la toma: requiere toga digital")
    if s > 1.15:
        flags.append(f"ampliación {s:.2f}x > 1.15: resolución insuficiente")
    if anc.y_top <= 1:
        flags.append("birrete cortado en la toma original")
    theta = anc.theta_deg if 1 < abs(anc.theta_deg) <= 8 else 0.0
    if abs(anc.theta_deg) > 8:
        flags.append(f"inclinación {anc.theta_deg:.1f}° > 8°")
    return Encuadre(W, H, s, W / 2 - s * anc.x_c, y_top_dest - s * anc.y_top, theta, flags)


def renderizar(rgba01: np.ndarray, enc: Encuadre, centro_rot: tuple) -> np.ndarray:
    """Rotación nativa -> recorte del rectángulo fuente -> Lanczos con antialias,
    todo en alfa premultiplicado. Devuelve RGBA en [0,1] del tamaño del lienzo."""
    img = rgba01.copy()
    img[..., :3] *= img[..., 3:4]  # premultiplicar
    if enc.theta:
        R = cv2.getRotationMatrix2D(centro_rot, enc.theta, 1.0)
        img = cv2.warpAffine(img, R, (img.shape[1], img.shape[0]), flags=cv2.INTER_CUBIC,
                             borderMode=cv2.BORDER_REPLICATE)  # sin esquinas vacías al enderezar
    # rectángulo fuente que cubre el lienzo: x_src = (x_dst - tx) / s
    x0, y0 = -enc.tx / enc.s, -enc.ty / enc.s
    x1, y1 = (enc.W - enc.tx) / enc.s, (enc.H - enc.ty) / enc.s
    pad = int(max(0, -x0, -y0, x1 - img.shape[1], y1 - img.shape[0])) + 2
    img = cv2.copyMakeBorder(img, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    if pad:
        # el cuerpo debe continuar hacia abajo: replicar la última fila bajo el sujeto (base-lock)
        img[-pad:, :, :] = img[-pad - 1:-pad, :, :]
    caja = (x0 + pad, y0 + pad, x1 + pad, y1 + pad)
    canales = [Image.fromarray(img[..., c].astype(np.float32), mode="F") for c in range(4)]
    out = [np.asarray(ch.resize((enc.W, enc.H), Image.LANCZOS, box=caja)) for ch in canales]
    out = np.dstack(out).clip(0, None)
    a = out[..., 3:4].clip(0, 1)
    out[..., :3] = np.where(a > 1e-4, out[..., :3] / np.maximum(a, 1e-4), 0)
    out[..., 3:4] = a
    return out.clip(0, 1)


# ------------------------------------------------------------ prenda (ropa)
def umeyama(P: np.ndarray, Q: np.ndarray) -> np.ndarray:
    """Similitud (s, R, t) que minimiza sum ||Q - (sRP + t)||^2. Devuelve matriz 2x3."""
    mp_, mq = P.mean(0), Q.mean(0)
    Pc, Qc = P - mp_, Q - mq
    U, S, Vt = np.linalg.svd(Qc.T @ Pc / len(P))
    D = np.eye(2)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        D[1, 1] = -1
    R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (Pc ** 2).sum(1).mean()
    t = mq - s * R @ mp_
    return np.hstack([s * R, t[:, None]])


def sobreponer_prenda(fondo_y_alumno: np.ndarray, alpha_alumno: np.ndarray, prenda_rgba: np.ndarray,
                      anc_prenda: dict, hombros: tuple, y_cuello: float, h_cara: float) -> tuple[np.ndarray, float]:
    """Compone: [fondo+alumno] <- prenda <- capa cabeza (todo lo que está sobre el escote).
    Devuelve (imagen RGB, residuo relativo al ancho de hombros)."""
    H, W = alpha_alumno.shape
    xL, yL, xR, yR = hombros
    P = np.array([anc_prenda["hombro_izq"], anc_prenda["hombro_der"], anc_prenda["escote"]], np.float64)
    Q = np.array([[xL, yL], [xR, yR], [(xL + xR) / 2, y_cuello]], np.float64)
    M = umeyama(P, Q)
    residuo = float(np.linalg.norm((P @ M[:, :2].T + M[:, 2]) - Q, axis=1).max() / abs(xR - xL))
    g = cv2.warpAffine(prenda_rgba, M, (W, H), flags=cv2.INTER_LANCZOS4, borderValue=0).clip(0, 1)
    ag = g[..., 3:4]
    # igualar L* de la prenda con la ropa original en el pecho (Reinhard solo luminancia, tope ±8)
    lab_g, lab_o = a_lab(g[..., :3]), a_lab(fondo_y_alumno)
    m = (ag[..., 0] > 0.9) & (alpha_alumno > 0.9)
    if m.sum() > 100:
        dL = np.clip(lab_o[..., 0][m].mean() - lab_g[..., 0][m].mean(), -8, 8)
        lab_g[..., 0] += dL
        g[..., :3] = desde_lab(lab_g)
    # sombra de contacto bajo el mentón
    sombra = np.zeros((H, W), np.float32)
    yy = np.arange(H)[:, None]
    sombra[int(max(0, y_cuello - 0.05 * h_cara)):int(y_cuello + 0.15 * h_cara)] = 1
    sombra = cv2.GaussianBlur(sombra, (0, 0), 0.02 * abs(xR - xL) + 1) * 0.15
    g[..., :3] *= (1 - sombra[..., None])
    comp = ag * g[..., :3] + (1 - ag) * fondo_y_alumno
    # capa cabeza: alumno por encima del escote, fundido 6 px
    rampa = np.clip((y_cuello - yy) / 6.0 + 0.5, 0, 1).astype(np.float32)
    ah = (alpha_alumno * rampa)[..., None]
    return ah * fondo_y_alumno + (1 - ah) * comp, residuo


def fondo(estilo: str, lienzo: np.ndarray, fondo_rgb) -> np.ndarray:
    """Fondo determinista. 'resplandor': negro con halo del color del propio sujeto
    (dorado junto a la borla, azul junto a la toga), calculado del alfa, sin generar nada."""
    H, W = lienzo.shape[:2]
    if estilo != "resplandor":
        return np.broadcast_to(np.array(fondo_rgb, np.float32), (H, W, 3))
    a = lienzo[..., 3]
    sig = 0.035 * W
    peso = cv2.GaussianBlur(a, (0, 0), sig) + 1e-4
    color = np.dstack([cv2.GaussianBlur(lienzo[..., c] * a, (0, 0), sig) for c in range(3)]) / peso[..., None]
    lab = a_lab(color.clip(0, 1))
    lab[..., 0] = 70  # mismo brillo para todo el halo; el tono lo pone el sujeto
    lab[..., 1:] *= 1.6
    color = desde_lab(lab)
    halo = (cv2.GaussianBlur(a, (0, 0), sig) * 1.3).clip(0, 1) ** 1.4
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vineta = np.exp(-(((xx - W / 2) / (0.6 * W)) ** 2 + ((yy - 0.45 * H) / (0.8 * H)) ** 2))
    base = np.array([0.01, 0.015, 0.05], np.float32) * vineta[..., None]
    return (base + 0.85 * halo[..., None] * color).clip(0, 1).astype(np.float32)


# ----------------------------------------------------------------------- QA
def nitidez_cara(rgb01: np.ndarray, anc: Anclajes) -> float:
    x, y, w, h = [int(v) for v in anc.cara]
    g = cv2.cvtColor((rgb01 * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)[max(0, y):y + h, max(0, x):x + w]
    return float(cv2.Laplacian(g, cv2.CV_64F).var()) if g.size else 0.0


def exportar(rgb01: np.ndarray, ruta: str, metadatos: dict, dpi: int = DPI) -> None:
    img = Image.fromarray((rgb01 * 255 + 0.5).clip(0, 255).astype(np.uint8))
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    exif = Image.Exif()
    exif[0x011A] = dpi  # XResolution
    exif[0x011B] = dpi  # YResolution
    exif[0x0128] = 2    # ResolutionUnit = pulgadas
    exif[0x010E] = json.dumps(metadatos, ensure_ascii=False)  # ImageDescription
    img.save(ruta, "JPEG", quality=95, subsampling=0, dpi=(dpi, dpi), icc_profile=srgb, exif=exif)


# ------------------------------------------------------------------ orquesta
def procesar(ruta_in: str, ruta_out: str, producto: str = "15x21", ruta_alpha: str | None = None,
             fondo_rgb=(0.92, 0.92, 0.92), prenda: str | None = None, prenda_json: str | None = None,
             refinar: bool = True, dpi: int = DPI, estilo: str = "plano",
             modelo_onnx: str | None = None, modelo_cara: str | None = None,
             modelo_birefnet: str = "ZhengPeng7/BiRefNet_HR", limpiar_uniforme: bool = True) -> dict:
    rgb01 = np.asarray(ImageOps.exif_transpose(Image.open(ruta_in)).convert("RGB"), np.float32) / 255
    if ruta_alpha:
        alpha0 = np.asarray(Image.open(ruta_alpha).convert("L"), np.float32) / 255
    elif modelo_onnx:
        alpha0 = segmentar_isnet((rgb01 * 255).astype(np.uint8), modelo_onnx)
    else:
        alpha0 = segmentar_birefnet((rgb01 * 255).astype(np.uint8), modelo_birefnet)
    try:
        anc = anclajes_mediapipe((rgb01 * 255).astype(np.uint8), alpha0, modelo_cara)
    except Exception as e:
        print(f"aviso: anclajes por silueta ({e})")
        anc = anclajes_desde_alpha(alpha0)

    # 1) fondo atrapado entre mechones: lo que se parece a la pared deja de ser "seguro sujeto"
    alpha0 = solo_el_alumno(alpha0, anc)  # fuera la mano y el cartel con el nombre
    alpha0 = rellenar_huecos_toga(alpha0, anc)
    alpha, parecido, color_fondo = limpiar_huecos_fondo(rgb01, alpha0, anc)
    if refinar:
        tri = trimapa(alpha0, anc.cara[3])
        libre = (mascara_piel_protegida(tri.shape, anc) == 0) & (alpha0 > 0.05)
        tri[libre & (parecido > 0.3)] = 0.5   # hebra o hueco: lo decide el matting
        tri[libre & (parecido > 0.85)] = 0.0  # pared clara entre mechones: fondo seguro
        # 2) matting de precisión en la banda
        alpha = refinar_alpha(rgb01, alpha0, tri)
    if limpiar_uniforme:
        alpha, birrete = birrete_solido(rgb01, alpha, anc)
    alpha, borla = rescatar_borla(rgb01, alpha, anc, color_fondo)
    F = estimar_primer_plano(rgb01, alpha)
    F[borla] = rgb01[borla]  # el dorado ya es el color real
    if limpiar_uniforme:
        F[birrete] = rgb01[birrete]  # el birrete es opaco: su color es el real

    F = corregir_color(F, alpha, anc)
    if limpiar_uniforme:
        F = uniforme_limpio(F, alpha, anc)
    enc = calcular_encuadre(anc, producto, rgb01.shape[0], dpi)
    cx, cy = anc.cara[0] + anc.cara[2] / 2, anc.cara[1] + anc.cara[3] / 2
    lienzo = renderizar(np.dstack([F, alpha]), enc, (cx, cy))
    a = lienzo[..., 3:4]
    comp = a * lienzo[..., :3] + (1 - a) * fondo(estilo, lienzo, fondo_rgb)

    residuo = None
    if prenda and prenda_json and anc.hombros:
        pr = np.asarray(Image.open(prenda).convert("RGBA"), np.float32) / 255
        aj = json.load(open(prenda_json))
        tr = lambda x, y: (enc.s * x + enc.tx, enc.s * y + enc.ty)
        xL, yL = tr(anc.hombros[0], anc.hombros[1])
        xR, yR = tr(anc.hombros[2], anc.hombros[3])
        y_cuello = (yL + yR) / 2 - 0.03 * abs(xR - xL)  # base del cuello, sobre la línea de hombros
        comp, residuo = sobreponer_prenda(comp, a[..., 0], pr, aj, (xL, yL, xR, yR), y_cuello,
                                          anc.cara[3] * enc.s)
        if residuo > 0.04:
            enc.flags.append(f"ajuste de prenda: residuo {residuo:.1%} > 4%")

    banda = ((alpha > 0.1) & (alpha < 0.9)).mean()
    # birrete borroso: el birrete es tela opaca de bordes rectos; si hay mucho alfa a medias
    # en su zona, la segmentación falló (fondo recargado detrás de la cabeza)
    x, y, w, h = [int(v) for v in anc.cara]
    zona = alpha[int(anc.y_top):max(int(anc.y_top) + 1, y), max(0, x - w // 2):x + w + w // 2]
    birrete_borroso = float(((zona > 0.1) & (zona < 0.9)).sum() / max(1, (zona > 0.1).sum()))
    if birrete_borroso > 0.15:
        enc.flags.append(f"birrete borroso ({birrete_borroso:.0%} del borde dudoso)")
    if limpiar_uniforme and birrete.any() and borla.sum() < 0.002 * anc.cara[2] * anc.cara[3] * 10:
        enc.flags.append("borla no encontrada")
    lab_f = a_lab(F)
    xs = np.abs(np.arange(alpha.shape[1])[None, :] - (x + w / 2)) > 0.9 * w
    blanco = (alpha > 0.9) & (lab_f[..., 0] > 82) & (np.hypot(lab_f[..., 1], lab_f[..., 2]) < 12) & xs
    blanco[:int(linea_hombros(anc))] = False
    if blanco.sum() > 0.03 * w * h:
        enc.flags.append("objeto blanco pegado al costado (¿cartel?)")
    if getattr(anc, "parpadeo", 0) > 0.6:
        enc.flags.append("ojos cerrados")
    qa = dict(producto=producto, dpi=dpi, lienzo_px=[enc.W, enc.H], escala=round(enc.s, 4),
              anclajes=asdict(anc), nitidez_cara=round(nitidez_cara(rgb01, anc), 1),
              pct_borde_semitransparente=round(100 * float(banda), 2),
              birrete_borroso=round(birrete_borroso, 3),
              px_borla=int(borla.sum()), residuo_prenda=residuo, alertas=enc.flags,
              semaforo="rojo" if any("cortado" in f or "> 8" in f or "insuficiente" in f or "ojos" in f for f in enc.flags)
              else ("amarillo" if enc.flags else "verde"))
    exportar(comp, ruta_out, dict(producto=producto, semaforo=qa["semaforo"]), dpi)
    return qa


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--producto", default="15x21",
                    help=f"plantilla ({', '.join(PRODUCTOS)}) o medida libre ANCHOxALTO en cm")
    ap.add_argument("--dpi", type=int, default=DPI, help="resolución de impresión (por defecto 300)")
    ap.add_argument("--alpha", help="máscara precalculada (omite BiRefNet)")
    ap.add_argument("--prenda")
    ap.add_argument("--prenda-json")
    ap.add_argument("--sin-refinar", action="store_true")
    ap.add_argument("--sin-limpiar-uniforme", action="store_true",
                    help="no rehacer el birrete ni planchar/avivar la toga")
    ap.add_argument("--estilo", default="plano", choices=["plano", "resplandor"])
    ap.add_argument("--fondo", default="235,235,235", help="color del fondo liso R,G,B (0-255)")
    ap.add_argument("--modelo-onnx", help="ISNet .onnx para PCs sin GPU (en lugar de BiRefNet)")
    ap.add_argument("--modelo-cara", help="face_landmarker.task de MediaPipe")
    args = ap.parse_args()
    # varias medidas de una sola foto: --producto 20x30,13x18,carnet -> salida_20x30.jpg, ...
    medidas = [m.strip() for m in args.producto.split(",") if m.strip()]
    base, ext = args.salida.rsplit(".", 1) if "." in args.salida else (args.salida, "jpg")
    for med in medidas:
        destino = args.salida if len(medidas) == 1 else f"{base}_{med}.{ext}"
        rgb_fondo = tuple(int(v) / 255 for v in args.fondo.split(","))
        print(json.dumps(procesar(args.entrada, destino, med, args.alpha, fondo_rgb=rgb_fondo,
                                  prenda=args.prenda, prenda_json=args.prenda_json,
                                  refinar=not args.sin_refinar, dpi=args.dpi, estilo=args.estilo,
                                  modelo_onnx=args.modelo_onnx, modelo_cara=args.modelo_cara,
                                  limpiar_uniforme=not args.sin_limpiar_uniforme),
                         ensure_ascii=False, indent=2, default=str))
