"""
Producción: qué falta imprimir y hojas armadas.

- Por imprimir: pedidos de alumnos con foto aprobada, agrupados por medida.
- Hojas: varias fotos chicas (carnets) en una hoja A4 o 10x15 a la resolución de impresión,
  con marcas de corte, el máximo que entra sin rotar y con el nombre del alumno al reverso
  del archivo (metadatos), para no confundir carnets.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from PIL import Image, ImageDraw

from . import organizar as org
from .medidas import cm_a_px

HOJAS = {"A4": (21.0, 29.7), "Carta": (21.59, 27.94), "10x15": (10.0, 15.0), "13x18": (13.0, 18.0)}


@dataclass
class Distribucion:
    columnas: int
    filas: int
    hueco_px: int
    margen_px: int

    @property
    def por_hoja(self) -> int:
        return self.columnas * self.filas


def distribuir(hoja_cm: tuple[float, float], foto_cm: tuple[float, float], dpi: int = 300,
               margen_cm: float = 0.5, hueco_cm: float = 0.3) -> Distribucion:
    W, H = cm_a_px(hoja_cm[0], dpi), cm_a_px(hoja_cm[1], dpi)
    w, h = cm_a_px(foto_cm[0], dpi), cm_a_px(foto_cm[1], dpi)
    m, g = cm_a_px(margen_cm, dpi), cm_a_px(hueco_cm, dpi)
    cols = (W - 2 * m + g) // (w + g)
    fils = (H - 2 * m + g) // (h + g)
    if cols < 1 or fils < 1:
        raise ValueError("Esa foto no entra en esa hoja. Elige una hoja más grande.")
    return Distribucion(int(cols), int(fils), g, m)


def armar_hojas(rutas: list[str], hoja: str, foto_cm: tuple[float, float], destino_dir: str, prefijo: str,
                dpi: int = 300, copias: int = 1) -> list[str]:
    if hoja not in HOJAS:
        raise ValueError("Hoja desconocida.")
    if not rutas:
        raise ValueError("No hay fotos para armar hojas.")
    hoja_cm = HOJAS[hoja]
    d = distribuir(hoja_cm, foto_cm, dpi)
    W, H = cm_a_px(hoja_cm[0], dpi), cm_a_px(hoja_cm[1], dpi)
    w, h = cm_a_px(foto_cm[0], dpi), cm_a_px(foto_cm[1], dpi)
    # centra la grilla en la hoja
    ox = (W - (d.columnas * w + (d.columnas - 1) * d.hueco_px)) // 2
    oy = (H - (d.filas * h + (d.filas - 1) * d.hueco_px)) // 2
    lista = [r for r in rutas for _ in range(max(1, copias))]
    salidas = []
    os.makedirs(destino_dir, exist_ok=True)
    for n0 in range(0, len(lista), d.por_hoja):
        lienzo = Image.new("RGB", (W, H), "white")
        dib = ImageDraw.Draw(lienzo)
        for k, ruta in enumerate(lista[n0:n0 + d.por_hoja]):
            c, f = k % d.columnas, k // d.columnas
            x, y = ox + c * (w + d.hueco_px), oy + f * (h + d.hueco_px)
            with Image.open(ruta) as im:
                lienzo.paste(_cubrir(im.convert("RGB"), (w, h)), (x, y))
            _marcas(dib, x, y, w, h, max(8, dpi // 30))
        destino = org.libre(os.path.join(destino_dir, f"{prefijo}_hoja{n0 // d.por_hoja + 1:02d}.jpg"))
        tmp = destino + ".part.jpg"
        try:
            lienzo.save(tmp, "JPEG", quality=95, subsampling=0, dpi=(dpi, dpi))
            os.replace(tmp, destino)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
        salidas.append(destino)
    return salidas


def _cubrir(im: Image.Image, tam: tuple[int, int]) -> Image.Image:
    W, H = tam
    s = max(W / im.width, H / im.height)
    im = im.resize((max(W, round(im.width * s)), max(H, round(im.height * s))), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def _marcas(dib: ImageDraw.ImageDraw, x, y, w, h, largo):
    gris = (120, 120, 120)
    for cx, cy, sx, sy in ((x, y, -1, -1), (x + w, y, 1, -1), (x, y + h, -1, 1), (x + w, y + h, 1, 1)):
        dib.line([(cx + sx * 2, cy), (cx + sx * largo, cy)], fill=gris, width=1)
        dib.line([(cx, cy + sy * 2), (cx, cy + sy * largo)], fill=gris, width=1)


def por_imprimir(base, campana_id: int | None = None) -> list[dict]:
    """Por medida: cuántas copias faltan imprimir (alumno con pedido pendiente y foto aprobada)."""
    sql = """
        select m.id medida_id, m.nombre medida, m.tipo, count(distinct p.alumno_id) alumnos, sum(p.copias) copias,
               sum(case when p.pagado = 1 then p.copias else 0 end) pagadas
        from pedidos p join medidas m on m.id = p.medida_id join alumnos a on a.id = p.alumno_id
        join salones s on s.id = a.salon_id
        where p.estado = 'pendiente'
          and exists (select 1 from fotos f where f.alumno_id = a.id and f.elegida = 1 and f.estado = 'aprobada')"""
    args = []
    if campana_id:
        sql += " and s.campana_id = ?"
        args.append(campana_id)
    return [dict(r) for r in base.q(sql + " group by m.id order by m.favorita desc, m.orden", *args)]


def avance_salones(base) -> list[dict]:
    return [dict(r) for r in base.q("""
        select s.id, c.nombre colegio, s.grado, s.seccion, se.nombre sede,
               (select count(*) from alumnos a where a.salon_id = s.id) alumnos,
               (select count(*) from fotos f where f.salon_id = s.id and f.elegida = 1
                    and f.estado in ('lista','revisar','aprobada')) editadas,
               (select count(*) from fotos f where f.salon_id = s.id and f.elegida = 1 and f.estado = 'aprobada') aprobadas,
               (select count(*) from pedidos p join alumnos a on a.id = p.alumno_id
                    where a.salon_id = s.id and p.estado != 'pendiente') impresos
        from salones s join colegios c on c.id = s.colegio_id join sedes se on se.id = c.sede_id
        order by c.nombre, s.grado, s.seccion""")]
