"""Los 4 pasos del salón y el inicio por colegios (lo que muestran las pantallas simples)."""
import pytest

from fj_estudio import alumnos as al
from fj_estudio import flujo
from fj_estudio import importar as imp
from fj_estudio.db import Base
from test_nucleo import foto


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


def test_salon_vacio_empieza_por_traer_fotos(base, salon):
    s = flujo.salon(base, salon)
    assert [p.clave for p in s.pasos] == ["traer", "ordenar", "editar", "imprimir"]
    assert s.avance == 0 and s.siguiente == 0
    assert s.pasos[0].boton == "Traer fotos"
    assert not s.pasos[2].habilitado and not s.pasos[3].habilitado


def test_avance_por_pasos(base, salon, tmp_path):
    for k in range(4):
        foto(str(tmp_path / "c" / f"IMG_{k}.JPG"), fecha=f"2026:10:01 09:0{k * 2}:00", semilla=k)
    imp.importar(base, salon, str(tmp_path / "c"))
    s = flujo.salon(base, salon)
    assert s.pasos[0].avance == 1 and s.siguiente == 1
    assert s.pasos[1].boton == "Cargar lista de alumnos"

    al.cargar_lista(base, salon, [al.FilaAlumno(f"A{i}", "X") for i in range(4)])
    s = flujo.salon(base, salon)
    assert s.pasos[1].boton == "Repartir fotos" and s.pasos[1].avance < 1

    al.aplicar_reparto(base, al.proponer_reparto(base, salon)["pares"])
    s = flujo.salon(base, salon)
    assert s.pasos[1].avance == 1 and s.siguiente == 2
    assert s.pasos[2].boton == "Editar las 4 que faltan"

    ids = [f["id"] for f in base.fotos(salon) if f["elegida"]]
    base.cambiar_estado(ids, "lista")
    base.cambiar_estado(ids[:1], "aprobada")
    s = flujo.salon(base, salon)
    assert s.pasos[2].boton == "Revisar y aprobar" and 0.5 < s.pasos[2].avance < 1
    assert s.pasos[3].habilitado

    fichas = flujo.alumnos_galeria(base, salon)
    assert len(fichas) == 4 and all(f["foto"] for f in fichas)
    assert {flujo.grupo_filtro(f["estado"]) for f in fichas} == {"Listas"}


def test_inicio_agrupa_por_colegio(base, salon):
    otro = base.salon(base.campana(2026, "Graduación", "Graduación 2026"),
                      base.colegio("Nuestra Señora de Loreto", "nauta"), "6.º", "a")
    cols = flujo.colegios(base)
    assert len(cols) == 1
    assert {s["id"] for s in cols[0]["salones"]} == {salon, otro}
    assert cols[0]["avance"] == 0
