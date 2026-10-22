"""Dibuja el ícono del programa (icono.ico y icono.png): monograma FJ dorado sobre fondo oscuro."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
L = 1024


def fuente(tam):
    for f in ("C:/Windows/Fonts/georgiab.ttf", "C:/Windows/Fonts/timesbd.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, tam)
    return ImageFont.load_default(tam)


def dibujar() -> Image.Image:
    im = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((40, 40, L - 40, L - 40), radius=200, fill=(22, 22, 26, 255))
    d.rounded_rectangle((96, 96, L - 96, L - 96), radius=150, outline=(232, 196, 106, 255), width=28)
    f = fuente(520)
    caja = d.textbbox((0, 0), "FJ", font=f)
    x = (L - (caja[2] - caja[0])) / 2 - caja[0]
    y = (L - (caja[3] - caja[1])) / 2 - caja[1]
    d.text((x, y), "FJ", font=f, fill=(232, 196, 106, 255))
    return im


if __name__ == "__main__":
    im = dibujar()
    im.save(os.path.join(AQUI, "icono.png"))
    im.save(os.path.join(AQUI, "icono.ico"), sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    print("icono listo", file=sys.stderr)
