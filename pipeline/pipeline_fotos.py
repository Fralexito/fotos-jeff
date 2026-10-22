"""
Pipeline de edición automática para fotografía escolar (Fotos Jeff).

Etapas: segmentación (IA, intercambiable) -> trimapa -> estimación de primer plano
(defringe) -> rescate de borla -> geometría (headroom / base-lock) -> sobreposición
de prenda -> color LAB -> exportación 300 DPI + reporte QA.

Todo salvo `segmentar_birefnet` es determinista. Uso:

    python pipeline_fotos.py foto.jpg salida.jpg --producto 15x21
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
from PIL import Image, ImageCms

DPI = 300

# Plantillas de producto: tamaño de papel (cm), rebaje de moldura (mm), sangrado (mm),
# fracción de alto que ocupa "birrete + cara" (k_h) y headroom sobre el rebaje (h_r).
PRODUCTOS = {
    "15x21": dict(cm=(15.0, 21.0), rebaje_mm=5.0, sangrado_mm=3.0, k_h=0.30, h_r=0.05),
    "20x30": dict(cm=(20.0, 30.0), rebaje_mm=6.0, sangrado_mm=3.0, k_h=0.28, h_r=0.05),
    "carnet": dict(cm=(3.5, 4.5), rebaje_mm=0.0, sangrado_mm=2.0, k_h=0.62, h_r=0.06),
}


def cm_a_px(cm: float) -> int:
    return int(round(cm / 2.54 * DPI))


def mm_a_px(mm: float) -> int:
    return int(round(mm / 25.4 * DPI))


# --------------------------------------------------------------------------- IA
def segmentar_birefnet(rgb: np.ndarray) -> np.ndarray:
    """Máscara gruesa alfa0 en [0,1] con BiRefNet (MIT). Único paso con IA."""
    import torch
    from transformers import AutoModelForImageSegmentation

    modelo = AutoModelForImageSegmentation.from_pretrained(
        "ZhengPeng7/BiRefNet", trust_remote_code=True).eval()
    disp = "cuda" if torch.cuda.is_available() else "cpu"
    modelo.to(disp)
    if disp == "cuda":
        modelo.half()
    x = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    t = torch.from_numpy(x.transpose(2, 0, 1)[None].astype(np.float32)).to(disp)
    if disp == "cuda":
        t = t.half()
    with torch.no_grad():
        pred = modelo(t)[-1].sigmoid()[0, 0].float().cpu().numpy()
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


def anclajes_mediapipe(rgb: np.ndarray, alpha: np.ndarray) -> Anclajes:
    """Ancla con la malla facial (mentón = punto 152, ojos 33/263) y la pose (11/12)."""
    import mediapipe as mp

    h, w = alpha.shape
    base = anclajes_desde_alpha(alpha)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=2) as fm:
        res = fm.process(rgb)
    if not res.multi_face_landmarks or len(res.multi_face_landmarks) != 1:
        raise RuntimeError("se esperaba exactamente un rostro")
    lm = res.multi_face_landmarks[0].landmark
    pts = np.array([(p.x * w, p.y * h) for p in lm])
    ojo_i, ojo_d = pts[33], pts[263]
    theta = float(np.degrees(np.arctan2(ojo_d[1] - ojo_i[1], ojo_d[0] - ojo_i[0])))
    x0, y0 = pts.min(axis=0)
    x1, y1 = pts.max(axis=0)
    hombros = base.hombros
    with mp.solutions.pose.Pose(static_image_mode=True) as pose:
        rp = pose.process(rgb)
    if rp.pose_landmarks:
        l, r = rp.pose_landmarks.landmark[11], rp.pose_landmarks.landmark[12]
        hombros = (r.x * w, r.y * h, l.x * w, l.y * h)
    x_c = (hombros[0] + hombros[2]) / 2 if hombros else (x0 + x1) / 2
    return Anclajes(base.y_top, float(pts[152][1]), base.y_bot, float(x_c), theta,
                    (float(x0), float(y0), float(x1 - x0), float(y1 - y0)), hombros, "mediapipe")


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


def refinar_alpha(rgb01: np.ndarray, alpha0: np.ndarray, tri: np.ndarray) -> np.ndarray:
    """Matting en la banda gris. ViTMatte en producción; aquí forma cerrada
    (Levin et al.) en una versión reducida, solo válida para imágenes pequeñas."""
    from pymatting import estimate_alpha_cf

    h, w = alpha0.shape
    if h * w > 1_500_000:
        f = (1_500_000 / (h * w)) ** 0.5
        small = cv2.resize(rgb01, None, fx=f, fy=f, interpolation=cv2.INTER_AREA).astype(np.float64)
        ts = cv2.resize(tri, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST).astype(np.float64)
        a = cv2.resize(estimate_alpha_cf(small, ts).astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    else:
        a = estimate_alpha_cf(rgb01.astype(np.float64), tri.astype(np.float64)).astype(np.float32)
    a = np.where(tri == 0.5, a, tri)  # solo se toca la banda
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


def rescatar_borla(rgb01: np.ndarray, alpha: np.ndarray, anc: Anclajes) -> tuple[np.ndarray, np.ndarray]:
    """Eleva alfa en los hilos dorados conectados al birrete. Devuelve (alpha, máscara)."""
    h, w = alpha.shape
    x, y, wc, hc = anc.cara
    roi = np.zeros_like(alpha, bool)
    x0, x1 = int(max(0, x + wc / 2 - 1.1 * wc)), int(min(w, x + wc / 2 + 1.1 * wc))
    y0, y1 = int(max(0, y - 1.6 * hc)), int(min(h, anc.y_chin))
    roi[y0:y1, x0:x1] = True
    g = mascara_dorada(a_lab(rgb01)) & roi
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


def calcular_encuadre(anc: Anclajes, producto: str, alto_original: int) -> Encuadre:
    p = PRODUCTOS[producto]
    W, H = cm_a_px(p["cm"][0]), cm_a_px(p["cm"][1])
    m, b = mm_a_px(p["rebaje_mm"]), mm_a_px(p["sangrado_mm"])
    flags = []
    s0 = p["k_h"] * H / (anc.y_chin - anc.y_top)
    y_top_dest = m + p["h_r"] * H
    s_min = (H + b - y_top_dest) / (anc.y_bot - anc.y_top)
    s = max(s0, s_min)
    if s > s0 * 1.001:
        flags.append("base-lock forzó escala mayor que la de cabeza")
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
                             borderMode=cv2.BORDER_CONSTANT, borderValue=0)
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


# ----------------------------------------------------------------------- QA
def nitidez_cara(rgb01: np.ndarray, anc: Anclajes) -> float:
    x, y, w, h = [int(v) for v in anc.cara]
    g = cv2.cvtColor((rgb01 * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)[max(0, y):y + h, max(0, x):x + w]
    return float(cv2.Laplacian(g, cv2.CV_64F).var()) if g.size else 0.0


def exportar(rgb01: np.ndarray, ruta: str, metadatos: dict) -> None:
    img = Image.fromarray((rgb01 * 255 + 0.5).clip(0, 255).astype(np.uint8))
    srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    exif = Image.Exif()
    exif[0x011A] = DPI  # XResolution
    exif[0x011B] = DPI  # YResolution
    exif[0x0128] = 2    # ResolutionUnit = pulgadas
    exif[0x010E] = json.dumps(metadatos, ensure_ascii=False)  # ImageDescription
    img.save(ruta, "JPEG", quality=95, subsampling=0, dpi=(DPI, DPI), icc_profile=srgb, exif=exif)


# ------------------------------------------------------------------ orquesta
def procesar(ruta_in: str, ruta_out: str, producto: str = "15x21", ruta_alpha: str | None = None,
             fondo_rgb=(0.92, 0.92, 0.92), prenda: str | None = None, prenda_json: str | None = None,
             refinar: bool = True) -> dict:
    rgb01 = np.asarray(Image.open(ruta_in).convert("RGB"), np.float32) / 255
    if ruta_alpha:
        alpha0 = np.asarray(Image.open(ruta_alpha).convert("L"), np.float32) / 255
    else:
        alpha0 = segmentar_birefnet((rgb01 * 255).astype(np.uint8))
    try:
        anc = anclajes_mediapipe((rgb01 * 255).astype(np.uint8), alpha0)
    except Exception:
        anc = anclajes_desde_alpha(alpha0)

    alpha = alpha0
    if refinar:
        alpha = refinar_alpha(rgb01, alpha0, trimapa(alpha0, anc.cara[3]))
    alpha, borla = rescatar_borla(rgb01, alpha, anc)
    F = estimar_primer_plano(rgb01, alpha)
    F[borla] = rgb01[borla]  # el dorado ya es el color real

    F = corregir_color(F, alpha, anc)
    enc = calcular_encuadre(anc, producto, rgb01.shape[0])
    cx, cy = anc.cara[0] + anc.cara[2] / 2, anc.cara[1] + anc.cara[3] / 2
    lienzo = renderizar(np.dstack([F, alpha]), enc, (cx, cy))
    a = lienzo[..., 3:4]
    comp = a * lienzo[..., :3] + (1 - a) * np.array(fondo_rgb, np.float32)

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
    qa = dict(producto=producto, lienzo_px=[enc.W, enc.H], escala=round(enc.s, 4),
              anclajes=asdict(anc), nitidez_cara=round(nitidez_cara(rgb01, anc), 1),
              pct_borde_semitransparente=round(100 * float(banda), 2),
              px_borla=int(borla.sum()), residuo_prenda=residuo, alertas=enc.flags,
              semaforo="rojo" if any("cortado" in f or "> 8" in f or "insuficiente" in f for f in enc.flags)
              else ("amarillo" if enc.flags else "verde"))
    exportar(comp, ruta_out, dict(producto=producto, semaforo=qa["semaforo"]))
    return qa


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("entrada")
    ap.add_argument("salida")
    ap.add_argument("--producto", default="15x21", choices=PRODUCTOS)
    ap.add_argument("--alpha", help="máscara precalculada (omite BiRefNet)")
    ap.add_argument("--prenda")
    ap.add_argument("--prenda-json")
    ap.add_argument("--sin-refinar", action="store_true")
    args = ap.parse_args()
    print(json.dumps(procesar(args.entrada, args.salida, args.producto, args.alpha,
                              prenda=args.prenda, prenda_json=args.prenda_json,
                              refinar=not args.sin_refinar), ensure_ascii=False, indent=2))
