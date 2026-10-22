"""Dibuja el ícono del programa (icono.ico y icono.png): monograma FJ dorado sobre fondo oscuro.
También las imágenes del asistente de instalación (asistente_*.bmp), en varios tamaños para pantallas con zoom."""
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


JAKARTA = os.path.join(os.path.dirname(AQUI), "fj_estudio", "ui", "fuentes", "PlusJakartaSans.ttf")
ORO, TINTA, CREMA = (232, 196, 106), (28, 26, 23), (251, 248, 242)


def jakarta(tam, peso=800):
    if not os.path.exists(JAKARTA):
        return fuente(tam)
    f = ImageFont.truetype(JAKARTA, tam)
    try:
        f.set_variation_by_axes([peso])
    except Exception:
        pass
    return f


def lateral(esc: float) -> Image.Image:
    """Imagen grande del asistente (bienvenida y final): oscura y cálida, con fotos de colores y el nombre."""
    w, h = int(164 * esc), int(314 * esc)
    k = 4  # se dibuja grande y se achica: bordes suaves
    W, H = w * k, h * k
    im = Image.new("RGB", (W, H), TINTA)
    d = ImageDraw.Draw(im)
    for y in range(H):  # degradé de arriba (cálido) hacia abajo (oscuro)
        t = y / H
        c = tuple(int(a + (b - a) * t) for a, b in zip((58, 44, 22), TINTA))
        d.line((0, y, W, y), fill=c)
    brillo = Image.new("L", (W, H), 0)
    ImageDraw.Draw(brillo).ellipse((-W * 0.6, -H * 0.25, W * 1.2, H * 0.45), fill=70)
    from PIL import ImageFilter
    brillo = brillo.filter(ImageFilter.GaussianBlur(W / 6))
    im.paste(Image.new("RGB", (W, H), ORO), (0, 0), brillo)
    d = ImageDraw.Draw(im)
    # tres "fotos" inclinadas, como recién impresas
    colores = [(107, 160, 210), (190, 150, 205), (120, 190, 160)]
    for i, (ang, cx, cy) in enumerate(((-9, 0.34, 0.22), (7, 0.66, 0.20), (-2, 0.5, 0.33))):
        fw, fh = W * 0.38, W * 0.47
        foto = Image.new("RGBA", (int(fw), int(fh)), (0, 0, 0, 0))
        fd = ImageDraw.Draw(foto)
        m = fw * 0.07
        fd.rounded_rectangle((0, 0, fw - 1, fh - 1), radius=fw * 0.06, fill=(250, 246, 238, 255))
        fd.rounded_rectangle((m, m, fw - m, fh - m * 3.2), radius=fw * 0.03, fill=colores[i] + (255,))
        cab = fw * 0.13  # silueta de alumno
        ccx, ccy = fw / 2, (fh - m * 3.2) * 0.45
        claro = tuple(int(c + (250 - c) * 0.45) for c in colores[i]) + (255,)
        fd.rounded_rectangle((m, m, fw - m, fh - m * 3.2), radius=fw * 0.03, fill=colores[i] + (255,))
        fd.pieslice((ccx - cab * 2.3, ccy + cab * 1.4, ccx + cab * 2.3, ccy + cab * 6), 180, 360, fill=claro)
        fd.ellipse((ccx - cab, ccy - cab * 1.15, ccx + cab, ccy + cab * 1.1), fill=claro)
        foto = foto.rotate(ang, expand=True, resample=Image.BICUBIC)
        sombra = Image.new("RGBA", foto.size, (0, 0, 0, 0))
        sombra.putalpha(foto.getchannel("A").point(lambda a: a * 0.45))
        sombra = sombra.filter(ImageFilter.GaussianBlur(W / 40))
        x, y = int(W * cx - foto.width / 2), int(H * cy - foto.height / 2)
        im.paste(sombra, (x, y + int(W * 0.03)), sombra)
        im.paste(foto, (x, y), foto)
    d = ImageDraw.Draw(im)
    # logo y nombre abajo
    lado = W * 0.2
    x0, y0 = W * 0.12, H * 0.55
    d.rounded_rectangle((x0, y0, x0 + lado, y0 + lado), radius=lado * 0.26, fill=ORO)
    f = jakarta(int(lado * 0.42))
    cj = d.textbbox((0, 0), "FJ", font=f)
    d.text((x0 + (lado - (cj[2] - cj[0])) / 2 - cj[0], y0 + (lado - (cj[3] - cj[1])) / 2 - cj[1]), "FJ", font=f, fill=TINTA)
    yt = y0 + lado + W * 0.08
    for texto, tam, color, peso in (("Fotos", 0.15, CREMA, 800), ("Studio J", 0.15, ORO, 800),
                                     ("Fotos escolares, sin enredos.", 0.058, (207, 201, 189), 500)):
        f = jakarta(int(W * tam), peso)
        d.text((x0, yt), texto, font=f, fill=color)
        yt += f.getbbox(texto)[3] + W * (0.02 if tam > 0.1 else 0.0)
        if tam < 0.1:
            break
        if texto == "Studio J":
            yt += W * 0.03
    return im.resize((w, h), Image.LANCZOS)


def chica(esc: float) -> Image.Image:
    """Logo pequeño arriba a la derecha en los pasos del asistente."""
    s = int(55 * esc)
    k = 4
    im = Image.new("RGB", (s * k, s * k), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, s * k - 1, s * k - 1), radius=s * k * 0.26, fill=TINTA)
    f = jakarta(int(s * k * 0.42))
    cj = d.textbbox((0, 0), "FJ", font=f)
    d.text(((s * k - (cj[2] - cj[0])) / 2 - cj[0], (s * k - (cj[3] - cj[1])) / 2 - cj[1]), "FJ", font=f, fill=ORO)
    return im.resize((s, s), Image.LANCZOS)


ESCALAS = {100: 1.0, 125: 1.25, 150: 1.5, 200: 2.0}


if __name__ == "__main__":
    im = dibujar()
    im.save(os.path.join(AQUI, "icono.png"))
    im.save(os.path.join(AQUI, "icono.ico"), sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    for pct, esc in ESCALAS.items():
        lateral(esc).save(os.path.join(AQUI, f"asistente_{pct}.bmp"))
        chica(esc).save(os.path.join(AQUI, f"asistente_chica_{pct}.bmp"))
    print("icono listo", file=sys.stderr)
