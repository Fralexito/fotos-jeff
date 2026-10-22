import io
import json
import os
import sys

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from test_nucleo import base, foto, salon  # noqa: F401  (fixtures)

from fj_estudio import importar as imp
from fj_estudio.ia import proveedores as pv
from fj_estudio.ia import recetas as rc
from fj_estudio.ia import servicio as sv
from fj_estudio.ia import verificar as vf
from fj_estudio.motor_local import EditorLocal


# ------------------------------------------------------------------ recetas
def test_componer_ordena_y_siempre_lleva_reglas():
    t = rc.componer(["color", "limpiar", "toga", "color"], variables={"color_toga": "negra"})
    assert t.index("Quita lo que no") < t.index("toga de graduación color negra") < t.index("balance de blancos")
    assert t.count("balance de blancos") == 1
    assert rc.REGLAS_FIJAS in t and "SALIDA:" in t and "{" not in t
    libre = rc.componer([], "quita la pelusa del hombro")
    assert rc.REGLAS_FIJAS in libre


@pytest.mark.parametrize("pedido", ["hazla más delgada", "ponle ojos azules", "aclara la piel un poco",
                                    "cambia la nariz", "rejuvenécela", "nariz fina"])
def test_pedidos_que_cambian_rasgos_se_bloquean(pedido):
    with pytest.raises(ValueError, match="cambiaría cómo es la persona"):
        rc.componer([], pedido)


def test_sin_recetas_ni_texto_falla():
    with pytest.raises(ValueError):
        rc.componer([], "   ")
    with pytest.raises(ValueError, match="desconocida"):
        rc.componer(["inventada"])


def test_combos_validos():
    for ids in rc.COMBOS.values():
        rc.componer(ids)
    assert rc.requiere_referencia(["ojos"]) and not rc.requiere_referencia(["color"])


# ------------------------------------------------------------------ verificación
def _cara(seed=0, escala=100.0, giro=0.0, deforma=None):
    rng = np.random.default_rng(seed)
    pts = rng.uniform(-1, 1, (478, 2))
    pts[33], pts[263] = [-0.6, -0.2], [0.6, -0.2]
    pts[133], pts[362] = [-0.25, -0.2], [0.25, -0.2]
    pts[129], pts[358] = [-0.18, 0.25], [0.18, 0.25]
    pts[61], pts[291] = [-0.35, 0.55], [0.35, 0.55]
    pts[234], pts[454] = [-0.9, 0.1], [0.9, 0.1]
    pts[10], pts[152], pts[1] = [0, -0.95], [0, 1.0], [0, 0.2]
    if deforma:
        deforma(pts)
    c, s = np.cos(giro), np.sin(giro)
    return (pts @ np.array([[c, -s], [s, c]]).T) * escala + 500


def test_misma_cara_girada_y_escalada_pasa():
    v = vf.comparar_puntos(_cara(), _cara(escala=37, giro=np.radians(8)))
    assert v.aprobado, v.motivos


def test_nariz_mas_fina_se_detecta():
    def fina(p):
        p[129], p[358] = [-0.12, 0.25], [0.12, 0.25]
    v = vf.comparar_puntos(_cara(), _cara(deforma=fina))
    assert not v.aprobado and "cambió el ancho de nariz" in v.motivos


def test_cara_adelgazada_se_detecta():
    def flaca(p):
        p[234], p[454] = [-0.78, 0.1], [0.78, 0.1]
    assert not vf.comparar_puntos(_cara(), _cara(deforma=flaca)).aprobado


def test_verificar_sin_cara_no_aprueba():
    rgb = np.zeros((50, 50, 3), np.uint8)
    assert not vf.verificar(rgb, rgb, lambda im: None).aprobado


def test_piel_aclarada_se_detecta():
    pts = _cara(escala=60) - 200
    a = np.full((800, 800, 3), (170, 120, 90), np.uint8)
    b = np.full((800, 800, 3), (215, 180, 160), np.uint8)
    v = vf.verificar(a, b, lambda im: pts)
    assert not v.aprobado and "cambió el tono de la piel" in v.motivos
    assert vf.verificar(a, a, lambda im: pts).aprobado


# ------------------------------------------------------------------ proveedores
class Resp:
    def __init__(self, code, js):
        self.status_code, self._js = code, js
        self.ok = code < 400

    def json(self):
        return self._js


class Sesion:
    def __init__(self, respuestas):
        self.respuestas, self.llamadas = list(respuestas), []

    def post(self, url, **kw):
        self.llamadas.append((url, kw))
        return self.respuestas.pop(0)


def _b64_png(color=(10, 20, 30), tam=(1024, 1536)):
    import base64
    b = io.BytesIO()
    Image.new("RGB", tam, color).save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


def test_openai_ok_y_reintento(monkeypatch):
    monkeypatch.setattr(pv.time, "sleep", lambda s: None)
    s = Sesion([Resp(429, {}), Resp(200, {"data": [{"b64_json": _b64_png()}]})])
    im = pv.PROVEEDORES["openai"].editar(Image.new("RGB", (400, 600)), "x", "sk-test", s)
    assert im.size == (1024, 1536) and len(s.llamadas) == 2
    url, kw = s.llamadas[0]
    assert url.endswith("/images/edits") and kw["data"]["input_fidelity"] == "high"
    assert kw["headers"]["Authorization"] == "Bearer sk-test"


@pytest.mark.parametrize("code,js,msg", [
    (401, {"error": {"message": "bad key"}}, "no es válida"),
    (400, {"error": {"message": "Your request was rejected by the safety system"}}, "rechazó"),
    (429, {"error": {"message": "You exceeded your current quota"}}, "saldo"),
])
def test_errores_en_palabras(code, js, msg):
    with pytest.raises(pv.ErrorIA, match=msg):
        pv.PROVEEDORES["openai"].editar(Image.new("RGB", (10, 10)), "x", "k", Sesion([Resp(code, js)]))


def test_sin_clave():
    with pytest.raises(pv.ErrorIA, match="Falta la clave"):
        pv.PROVEEDORES["gemini"].editar(Image.new("RGB", (10, 10)), "x", "")


def test_gemini_lee_imagen():
    s = Sesion([Resp(200, {"candidates": [{"content": {"parts": [{"text": "ok"},
                                                                  {"inlineData": {"data": _b64_png()}}]}}]})])
    assert pv.PROVEEDORES["gemini"].editar(Image.new("RGB", (40, 60)), "x", "k", s).size == (1024, 1536)
    assert s.llamadas[0][1]["headers"] == {"x-goog-api-key": "k"}


# ------------------------------------------------------------------ servicio y motor
def _foto_importada(base, salon, tmp_path):
    foto(str(tmp_path / "c" / "IMG_1.JPG"), w=400, h=600)
    imp.importar(base, salon, str(tmp_path / "c"))
    fid = base.fotos(salon)[0]["id"]
    a = base.agregar_alumno(salon, "Ríos Panduro", "Gabriela")
    base.asignar([fid], a)
    return fid


class ProveedorFalso(pv.Proveedor):
    def editar(self, imagen, pedido, clave, sesion=None, referencia=None):
        assert rc.REGLAS_FIJAS in pedido
        return Image.new("RGB", (1024, 1536), (90, 90, 90))


def test_pedido_ia_guarda_version_y_respeta_original(base, salon, tmp_path):
    fid = _foto_importada(base, salon, tmp_path)
    orig = os.path.join(base.raiz, base.fotos(salon)[0]["ruta_original"])
    h0 = open(orig, "rb").read()
    p = ProveedorFalso("openai", "Falsa", "m", costo_por_imagen_usd=0.25)
    r = sv.pedir(base, fid, ["color"], proveedor=p, detector=None)
    assert open(orig, "rb").read() == h0
    assert Image.open(r["ruta"]).size == (400, 600)  # vuelve al tamaño del original
    assert not r["veredicto"].aprobado  # sin detector: no se aprueba sola
    with pytest.raises(ValueError, match="no pasó"):
        sv.aceptar(base, r["version_id"])
    sv.aceptar(base, r["version_id"], forzar=True)
    f = base.q1("select * from fotos where id=?", fid)
    assert sv.ruta_fuente_actual(base, f) == r["ruta"]
    assert sv.gasto_hoy_usd(base) == pytest.approx(0.25)
    sv.volver_al_original(base, fid)
    assert sv.ruta_fuente_actual(base, base.q1("select * from fotos where id=?", fid)) == orig


def test_limite_de_gasto(base, salon, tmp_path):
    fid = _foto_importada(base, salon, tmp_path)
    base.guardar_ajuste("ia_limite_diario_usd", 0.1)
    p = ProveedorFalso("openai", "Falsa", "m", costo_por_imagen_usd=0.25)
    with pytest.raises(pv.ErrorIA, match="límite"):
        sv.pedir(base, fid, ["color"], proveedor=p, confirmar_gasto=lambda m: False)


def test_editor_local_por_medidas(base, salon, tmp_path):
    fid = _foto_importada(base, salon, tmp_path)
    ids = [m["id"] for m in base.medidas() if m["nombre"] in ("20x30", "Carnet 3x4")]
    llamadas = []

    def falso(ruta_in, ruta_out, producto, **kw):
        llamadas.append((producto, kw["dpi"], kw["fondo_rgb"]))
        Image.new("RGB", (300, 450), (107, 201, 237)).save(ruta_out, "JPEG")
        return {"semaforo": "amarillo" if producto == "3x4" else "verde", "alertas": ["x"] if producto == "3x4" else []}

    qa = EditorLocal(base).editar(fid, ids, procesar=falso)
    assert {c[0] for c in llamadas} == {"20x30", "3x4"}
    assert qa["semaforo"] == "amarillo"
    f = base.q1("select * from fotos where id=?", fid)
    assert f["estado"] == "revisar"
    salidas = base.q("select ruta from salidas where foto_id=?", fid)
    assert len(salidas) == 2 and all(os.path.exists(os.path.join(base.raiz, s[0])) for s in salidas)
    assert any("3 Para imprimir" in s[0] and s[0].endswith("NSL-5A-001_RIOS-PANDURO_Gabriela_20x30.jpg")
               for s in salidas)
    assert not [n for n in os.listdir(os.path.dirname(os.path.join(base.raiz, salidas[0][0]))) if ".part" in n]


def test_editor_local_error_no_rompe(base, salon, tmp_path):
    fid = _foto_importada(base, salon, tmp_path)
    mid = base.medidas()[0]["id"]

    def roto(*a, **k):
        raise MemoryError()

    qa = EditorLocal(base).editar(fid, [mid], procesar=roto)
    assert qa["semaforo"] == "rojo" and "memoria" in qa["alertas"][0]
    assert base.q1("select estado from fotos where id=?", fid)[0] == "problema"


def test_migracion_v1_a_v2(tmp_path):
    import sqlite3
    from fj_estudio import db as dbm
    r = tmp_path / "vieja"
    r.mkdir()
    cx = sqlite3.connect(str(r / "estudio.db"))
    for s in dbm._sentencias(dbm.MIGRACIONES[0]):
        cx.execute(s)
    cx.execute("pragma user_version = 1")
    cx.commit()
    cx.close()
    b = dbm.Base(str(r))
    assert b.version() == 2
    assert os.path.exists(r / "_copias_base" / "estudio_antes_de_migrar_v1.db")
    b.cerrar()


# ------------------------------------------------------------------ producción
def test_hojas_de_carnets(tmp_path):
    from fj_estudio import produccion as pr
    d = pr.distribuir(pr.HOJAS["A4"], (3, 4))
    assert (d.columnas, d.filas) == (6, 6)
    fotos = []
    for i in range(40):
        r = str(tmp_path / f"c{i}.jpg")
        Image.new("RGB", (354, 472), (i * 5, 100, 200)).save(r)
        fotos.append(r)
    hojas = pr.armar_hojas(fotos, "A4", (3, 4), str(tmp_path / "out"), "NSL-5A_carnet")
    assert len(hojas) == 2
    im = Image.open(hojas[0])
    assert im.size == (2480, 3508) and round(im.info["dpi"][0]) == 300
    with pytest.raises(ValueError, match="no entra"):
        pr.distribuir(pr.HOJAS["10x15"], (20, 30))


def test_por_imprimir(base, salon, tmp_path):
    from fj_estudio import produccion as pr
    fid = _foto_importada(base, salon, tmp_path)
    a = base.q1("select alumno_id from fotos where id=?", fid)[0]
    m = base.medidas()[1]["id"]
    base.pedir(a, m, copias=2, pagado=True)
    assert pr.por_imprimir(base) == []  # sin aprobar aún
    base.cambiar_estado([fid], "aprobada")
    r = pr.por_imprimir(base)
    assert r[0]["copias"] == 2 and r[0]["pagadas"] == 2


def _cara_ojos(abiertos: bool, **kw):
    pts = _cara(**kw)
    alto = 0.08 if abiertos else 0.01
    c = (pts[33] + pts[133]) / 2
    pts[159], pts[145] = c + [0, -alto * 100], c + [0, alto * 100]
    c = (pts[263] + pts[362]) / 2
    pts[386], pts[374] = c + [0, -alto * 100], c + [0, alto * 100]
    return pts


def test_apertura_de_ojos():
    assert vf.apertura_ojos(_cara_ojos(True)) > vf.OJO_ABIERTO > vf.apertura_ojos(_cara_ojos(False))
    rgb = np.full((900, 900, 3), 150, np.uint8)
    v = vf.verificar(rgb, rgb, lambda im: _cara_ojos(False), ojos_deben_abrirse=True)
    assert not v.aprobado and "los ojos siguen cerrados" in v.motivos


def test_abrir_ojos_sin_otra_toma_no_inventa(base, salon, tmp_path):
    fid = _foto_importada(base, salon, tmp_path)
    p = ProveedorFalso("openai", "Falsa", "m")
    with pytest.raises(pv.ErrorIA, match="No hay otra toma"):
        sv.pedir(base, fid, ["ojos"], proveedor=p, detector=lambda im: _cara_ojos(False, escala=1) + 100)
    with pytest.raises(pv.ErrorIA, match="revisión de rasgos"):
        sv.pedir(base, fid, ["ojos"], proveedor=p, detector=None)


def test_abrir_ojos_usa_la_toma_con_ojos_abiertos(base, salon, tmp_path):
    foto(str(tmp_path / "c" / "IMG_1.JPG"), w=400, h=600, semilla=1)
    foto(str(tmp_path / "c" / "IMG_2.JPG"), w=400, h=600, fecha="2026:10:01 09:00:03", semilla=2)
    imp.importar(base, salon, str(tmp_path / "c"))
    f1, f2 = [f["id"] for f in base.fotos(salon)]
    a = base.agregar_alumno(salon, "Ríos", "Ana")
    base.asignar([f1, f2], a)
    marcas = {}
    orig1 = np.asarray(Image.open(os.path.join(base.raiz, base.fotos(salon)[0]["ruta_original"])))
    def detector(im):
        # la toma 1 tiene ojos cerrados; la 2 y el resultado, abiertos
        cerrados = im.shape == orig1.shape and abs(float(im.mean()) - float(orig1.mean())) < 0.5
        return _cara_ojos(not cerrados, escala=1) + 100
    class P(ProveedorFalso):
        def editar(self, imagen, pedido, clave, sesion=None, referencia=None):
            marcas["ref"] = referencia is not None
            return Image.new("RGB", (400, 600), (10, 10, 10))
    r = sv.pedir(base, f1, ["ojos"], proveedor=P("openai", "F", "m"), detector=detector)
    assert marcas["ref"] and r["veredicto"].aprobado, r["veredicto"].motivos


def test_motor_externo_un_proceso_para_varias_fotos(tmp_path):
    """El .exe usa el Python del motor por un proceso aparte que queda abierto entre fotos."""
    import sys as _sys
    from fj_estudio.motor_local import MotorExterno
    (tmp_path / "pipeline_fotos.py").write_text(
        "import os, shutil\n"
        "print('ruido que no debe romper nada')\n"
        "def procesar(a, b, producto, fondo_rgb=None, dpi=300, modelo_onnx=None, modelo_cara=None):\n"
        "    if producto == 'malo':\n"
        "        raise ValueError('medida rara')\n"
        "    shutil.copy(a, b)\n"
        "    return {'semaforo': 'verde', 'alertas': [], 'pid': os.getpid(), 'producto': producto}\n",
        encoding="utf-8")
    src = tmp_path / "a.jpg"
    src.write_bytes(b"x")
    m = MotorExterno(_sys.executable, str(tmp_path))
    try:
        r1 = m(str(src), str(tmp_path / "b.jpg"), "20x30", (1, 1, 1), 300)
        r2 = m(str(src), str(tmp_path / "c.jpg"), "13x18", (1, 1, 1), 300)
        assert r1["semaforo"] == "verde" and r1["pid"] == r2["pid"]
        assert (tmp_path / "c.jpg").exists()
        with pytest.raises(RuntimeError, match="medida rara"):
            m(str(src), str(tmp_path / "d.jpg"), "malo", (1, 1, 1), 300)
        assert m(str(src), str(tmp_path / "e.jpg"), "20x30", (1, 1, 1), 300)["pid"] == r1["pid"]
    finally:
        m.cerrar()
