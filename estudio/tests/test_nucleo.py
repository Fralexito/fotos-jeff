import os
import sqlite3
import sys

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fj_estudio import alumnos as al
from fj_estudio import importar as imp
from fj_estudio import medidas as md
from fj_estudio import organizar as org
from fj_estudio.db import Base, abreviar, codigo_grado


def foto(ruta, w=600, h=900, fecha="2026:10:01 09:00:00", color=(120, 90, 60), semilla=0):
    rng = np.random.default_rng(semilla)
    arr = (np.array(color, np.uint8) + rng.integers(0, 40, (h, w, 3), dtype=np.uint8))
    im = Image.fromarray(arr)
    ex = Image.Exif()
    ex.get_ifd(0x8769)[36867] = fecha
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    im.save(ruta, "JPEG", exif=ex)
    return ruta


@pytest.fixture
def base(tmp_path):
    b = Base(str(tmp_path / "biblioteca"))
    yield b
    b.cerrar()


@pytest.fixture
def salon(base):
    col = base.colegio("Nuestra Señora de Loreto", "nauta")
    cam = base.campana(2026, "Graduación", "Graduación 2026")
    return base.salon(cam, col, "5.º", "a")


# ------------------------------------------------------------------ base
def test_base_nueva_trae_sedes_y_medidas(base):
    assert [s["codigo"] for s in base.sedes()] == ["nauta", "iquitos", "iquitos2"]
    nombres = [m["nombre"] for m in base.medidas()]
    assert nombres[:4] == ["15x21", "20x30", "30x40", "Carnet 3x4"]  # favoritas primero
    assert base.version() == 2


def test_reabrir_no_duplica_y_hace_copia(tmp_path):
    r = str(tmp_path / "b")
    Base(r).cerrar()
    b = Base(r)
    assert len(b.sedes()) == 3
    assert any(f.startswith("estudio_20") for f in os.listdir(os.path.join(r, "_copias_base")))
    b.cerrar()


def test_transaccion_revierte_todo(base, salon):
    with pytest.raises(RuntimeError):
        with base.tx():
            base.agregar_alumno(salon, "Ríos", "Ana")
            raise RuntimeError("corte de luz simulado")
    assert base.alumnos(salon) == []


def test_salon_no_se_duplica(base, salon):
    info = base.info_salon(salon)
    assert base.salon(info["campana_id"], info["colegio_id"], "5.º", "A") == salon


def test_codigos_de_alumno(base, salon):
    a = base.agregar_alumno(salon, "Ríos Panduro", "Gabriela")
    b = base.agregar_alumno(salon, "Flores", "Ana")
    cods = [x["codigo"] for x in base.alumnos(salon)]
    assert cods == ["NSL-5A-001", "NSL-5A-002"]
    with pytest.raises(ValueError):
        base.agregar_alumno(salon, "Otro", "X", codigo="NSL-5A-001")
    assert a != b


def test_base_mas_nueva_se_rechaza(tmp_path):
    r = str(tmp_path / "b")
    Base(r).cerrar()
    cx = sqlite3.connect(os.path.join(r, "estudio.db"))
    cx.execute("pragma user_version = 99")
    cx.commit()
    cx.close()
    with pytest.raises(RuntimeError, match="más nueva"):
        Base(r)


def test_abreviar_y_grado():
    assert abreviar("Nuestra Señora de Loreto") == "NSL"
    assert abreviar("Saramurillo") == "SARA"
    assert abreviar("I.E. San Juan") == "SJ"
    assert codigo_grado("5.º") == "5"
    assert codigo_grado("Inicial 5 años") == "5A"


# ------------------------------------------------------------------ medidas
def test_medidas_libres_y_validacion(base):
    m = md.interpretar("18,5 x 24")
    assert (m.ancho_cm, m.alto_cm, m.tipo) == (18.5, 24.0, "cuadro")
    assert md.interpretar("8x10 pulg").alto_cm == 25.4
    assert md.interpretar("3x4").tipo == "carnet"
    for malo in ("", "veinte", "0x30", "300x300"):
        with pytest.raises(ValueError):
            md.interpretar(malo)
    with pytest.raises(ValueError, match="DPI"):
        md.Medida("x", 20, 30, dpi=5000).validar()
    mid = base.guardar_medida("Cuadro especial", 24, 36, favorita=True)
    assert base.q1("select favorita from medidas where id=?", mid)[0] == 1
    with pytest.raises(ValueError):
        base.guardar_medida("Cuadro especial", 10, 10)
    assert md.Medida("20x30", 20, 30).px == (2362, 3543)


# ------------------------------------------------------------------ organizar
def test_nombres_seguros_en_windows():
    assert org.nombre_seguro('5.º "A": nuevo?') == "5.º -A-- nuevo-"
    assert org.nombre_seguro("CON") == "_CON"
    assert org.nombre_seguro("  ...  ") == "sin-nombre"
    assert org.nombre_seguro("fin.") == "fin"
    al_ = {"codigo": "NSL-5A-014", "apellidos": "Ríos Panduro", "nombres": "gabriela sofía"}
    assert org.nombre_archivo(al_, "20x30") == "NSL-5A-014_RIOS-PANDURO_Gabriela_20x30.jpg"


def test_copia_segura_no_deja_restos(tmp_path):
    o = tmp_path / "o.bin"
    o.write_bytes(b"x" * 1000)
    d = tmp_path / "sub" / "d.bin"
    h = org.copiar_seguro(str(o), str(d))
    assert d.read_bytes() == o.read_bytes() and h == org.sha256(str(o))
    with pytest.raises(IOError):
        org.copiar_seguro(str(o), str(tmp_path / "e.bin"), hash_esperado="0" * 64)
    assert not (tmp_path / "e.bin").exists() and not (tmp_path / "e.bin.part").exists()


def test_espejar_solo_lo_nuevo(tmp_path):
    src = tmp_path / "lib" / "2026" / "Grad" / "5A" / "2 Editadas"
    src.mkdir(parents=True)
    (src / "a.jpg").write_bytes(b"1")
    (tmp_path / "lib" / "2026" / "Grad" / "5A" / "1 Originales").mkdir()
    (tmp_path / "lib" / "2026" / "Grad" / "5A" / "1 Originales" / "raw.jpg").write_bytes(b"0")
    r1 = org.espejar(str(tmp_path / "lib"), str(tmp_path / "drive"))
    r2 = org.espejar(str(tmp_path / "lib"), str(tmp_path / "drive"))
    assert r1["copiadas"] == 1 and r2["copiadas"] == 0
    assert not (tmp_path / "drive" / "2026" / "Grad" / "5A" / "1 Originales").exists()


# ------------------------------------------------------------------ importar
def test_importar_copia_verifica_y_no_toca_origen(base, salon, tmp_path):
    tarjeta = tmp_path / "DCIM"
    for i in range(3):
        foto(str(tarjeta / f"IMG_{i:04d}.JPG"), fecha=f"2026:10:01 09:00:{i * 5:02d}", semilla=i)
    (tarjeta / "IMG_0009.CR2").write_bytes(b"raw")
    (tarjeta / "roto.jpg").write_bytes(b"no soy una foto")
    antes = {p: p.stat().st_mtime for p in tarjeta.iterdir()}
    r = imp.importar(base, salon, str(tarjeta))
    assert len(r.importadas) == 3 and len(r.saltadas) == 1 and r.raw == ["IMG_0009.CR2"]
    assert {p: p.stat().st_mtime for p in tarjeta.iterdir()} == antes  # origen intacto
    f = base.fotos(salon)[0]
    assert os.path.exists(os.path.join(base.raiz, f["ruta_original"]))
    assert "1 Originales" in f["ruta_original"] and f["tomada_en"] == "2026-10-01 09:00:00"
    # segunda vez: nada nuevo
    r2 = imp.importar(base, salon, str(tarjeta))
    assert r2.importadas == [] and len(r2.repetidas) == 3


def test_no_importar_desde_la_biblioteca(base, salon):
    with pytest.raises(ValueError, match="biblioteca"):
        imp.importar(base, salon, base.raiz)


# ------------------------------------------------------------------ alumnos
def test_leer_lista_excel_desordenado(tmp_path):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["I.E. NUESTRA SEÑORA DE LORETO"])
    ws.append([])
    ws.append(["N°", "APELLIDOS Y NOMBRES", "DNI"])
    ws.append([1, "RIOS PANDURO, Gabriela Sofía", "71234567"])
    ws.append([2, "FLORES TUESTA ANA LUCIA", None])
    ws.append([None, None, None])
    ruta = str(tmp_path / "lista.xlsx")
    wb.save(ruta)
    filas = al.leer_lista(ruta)
    assert [(f.apellidos, f.nombres, f.codigo) for f in filas] == [
        ("Rios Panduro", "Gabriela Sofía", "71234567"), ("Flores Tuesta", "Ana Lucia", None)]


def test_leer_lista_csv_punto_y_coma_latin1(tmp_path):
    ruta = tmp_path / "l.csv"
    ruta.write_bytes("Apellido paterno;Apellido materno;Nombres\nGómez;Ríos;Dan\n".encode("cp1252"))
    f = al.leer_lista(str(ruta))[0]
    assert (f.apellidos, f.nombres) == ("Gómez Ríos", "Dan")


def test_cargar_lista_no_duplica(base, salon):
    filas = [al.FilaAlumno("Rios", "Ana"), al.FilaAlumno("Vela", "Luis")]
    assert al.cargar_lista(base, salon, filas) == {"nuevos": 2, "repetidos": 0}
    assert al.cargar_lista(base, salon, filas) == {"nuevos": 0, "repetidos": 2}


def test_reparto_por_tiempo(base, salon, tmp_path):
    # 3 alumnos, 3 tomas cada uno: 3 s entre tomas, 40 s entre alumnos
    seg, k = 0, 0
    for a in range(3):
        for t in range(3):
            m, s = divmod(seg, 60)
            foto(str(tmp_path / "c" / f"IMG_{k:04d}.JPG"), fecha=f"2026:10:01 09:{m:02d}:{s:02d}", semilla=k)
            k += 1
            seg += 3
        seg += 40
    imp.importar(base, salon, str(tmp_path / "c"))
    al.cargar_lista(base, salon, [al.FilaAlumno("A", "Uno"), al.FilaAlumno("B", "Dos"), al.FilaAlumno("C", "Tres")])
    prop = al.proponer_reparto(base, salon)
    assert prop["aviso"] is None
    assert [len(p["fotos"]) for p in prop["pares"]] == [3, 3, 3]
    al.aplicar_reparto(base, prop["pares"])
    assert base.fotos(salon, sin_alumno=True) == []
    # cada alumno con exactamente una toma elegida
    for a in base.alumnos(salon):
        assert sum(f["elegida"] for f in base.fotos(salon, alumno_id=a["id"])) == 1


def test_reparto_avisa_si_no_cuadra(base, salon, tmp_path):
    for k in range(2):
        foto(str(tmp_path / "c" / f"IMG_{k}.JPG"), fecha=f"2026:10:01 09:0{k * 2}:00", semilla=k)
    imp.importar(base, salon, str(tmp_path / "c"))
    al.cargar_lista(base, salon, [al.FilaAlumno("A", "Uno"), al.FilaAlumno("B", "Dos"), al.FilaAlumno("C", "Tres")])
    prop = al.proponer_reparto(base, salon)
    assert prop["aviso"] and len(prop["alumnos_sin_fotos"]) == 1


def test_asignar_a_otro_salon_falla(base, salon):
    info = base.info_salon(salon)
    otro = base.salon(info["campana_id"], info["colegio_id"], "5.º", "B")
    a = base.agregar_alumno(otro, "X", "Y")
    with base.tx() as cx:
        fid = cx.execute("insert into fotos(salon_id, ruta_original, nombre_camara, hash, bytes, ancho, alto)"
                         " values (?,?,?,?,?,?,?)", (salon, "r", "n", "h", 1, 1, 1)).lastrowid
    with pytest.raises(ValueError, match="otro salón"):
        base.asignar([fid], a)
