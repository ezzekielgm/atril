"""Genera los iconos, el banner y la imagen de vista previa a partir de las imágenes de scripts/arte/nuevo/
(bocetos de Ezequiel hechos con ChatGPT, noviembre de 2026).
Uso (desde la carpeta del proyecto): python3 scripts/iconos.py   — necesita Pillow, numpy y fontTools.
Después, para Atril del ordenador: npx tauri icon src-tauri/icons/fuente.png -o src-tauri/icons

- Icono: el atril blanco del boceto, recortado y centrado sobre azul liso a sangre (el iPad redondea las
  esquinas él solo; el boceto traía el cuadrado ya redondeado con blanco alrededor). Más margen en la versión
  «maskable» de Android, que se recorta en círculo.
- Banner: cabecera del inicio (JPEG ligero) y versión estrecha para el móvil. A la izquierda es azul liso
  (AZUL_BANNER), que la cabecera alarga hasta el borde.
- og.jpg: imagen que sale al mandar el enlace (la foto del banner fundida con el azul, el icono y el nombre).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARTE = RAIZ / "scripts" / "arte" / "nuevo"
ICONOS = RAIZ / "src" / "icons"
FUENTES = Path("/tmp/fuentes")
AZUL = (9, 41, 125)         # el azul del icono del boceto
AZUL_BANNER = (1, 46, 108)  # el azul liso de la izquierda del banner (también en styles.css: .home-hero)


def atril():
    """El atril blanco con su transparencia (alfa según lo claro que es cada píxel sobre el azul)."""
    im = Image.open(ARTE / "icono.webp").convert("RGB")
    a = np.asarray(im).astype(float)
    x0, y0, x1, y1 = 240, 210, 1012, 1075  # zona del dibujo, dentro del cuadrado azul
    zona = a[y0:y1, x0:x1]
    t = ((zona - np.array(AZUL, float)) / (255 - np.array(AZUL, float))).mean(axis=2)
    alfa = np.clip((t - 0.08) / 0.84, 0, 1)
    ys, xs = np.where(alfa > 0.5)
    caja = (xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5)
    rgba = np.zeros(zona.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alfa * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA").crop(caja)


def icono(fig, alto_rel, n=1024):
    base = Image.new("RGBA", (n, n), AZUL + (255,))
    esc = alto_rel * n / fig.size[1]
    f = fig.resize((round(fig.size[0] * esc), round(fig.size[1] * esc)), Image.LANCZOS)
    base.alpha_composite(f, ((n - f.size[0]) // 2, (n - f.size[1]) // 2))
    return base.convert("RGB")


def iconos():
    fig = atril()
    grande = icono(fig, 0.66)
    for tam, nombre in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
        grande.resize((tam, tam), Image.LANCZOS).save(ICONOS / nombre, optimize=True)
    icono(fig, 0.5).resize((512, 512), Image.LANCZOS).save(ICONOS / "icon-maskable-512.png", optimize=True)
    return grande


def banner_y_vista_previa(grande):
    b = Image.open(ARTE / "banner.webp").convert("RGB")
    b.save(ICONOS / "banner.jpg", quality=82, optimize=True, progressive=True)
    b.resize((1080, round(b.size[1] * 1080 / b.size[0])), Image.LANCZOS).save(ICONOS / "banner-movil.jpg", quality=80, optimize=True, progressive=True)

    # Vista previa del enlace (1200 × 630): la foto a la derecha, fundida con el azul; el icono y el nombre a la izquierda
    W, H = 1200, 630
    bb = b.resize((round(b.size[0] * H / b.size[1]), H), Image.LANCZOS)
    og = Image.new("RGB", (W, H), AZUL_BANNER)
    foto = bb.crop((bb.size[0] - 760, 0, bb.size[0], H))
    rampa = np.clip(np.arange(760) / 260, 0, 1)
    og.paste(foto, (W - 760, 0), Image.fromarray((np.tile(rampa, (H, 1)) * 255).astype(np.uint8)))
    d = ImageDraw.Draw(og)
    negrita = ImageFont.truetype(str(FUENTES / "carlito-700-normal.ttf"), 132)
    normal = ImageFont.truetype(str(FUENTES / "carlito-400-normal.ttf"), 40)
    peq = ImageFont.truetype(str(FUENTES / "carlito-400-normal.ttf"), 31)
    ic = grande.resize((140, 140), Image.LANCZOS)
    m = Image.new("L", ic.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 139, 139), radius=32, fill=255)
    og.paste(ic, (62, 70), m)
    d.text((60, 235), "Atril", font=negrita, fill="white")
    y = 392
    for linea in ["Tus discursos de Word en el iPad,", "con letra grande y cronómetro."]:
        d.text((62, y), linea, font=normal, fill="white")
        y += 50
    d.text((62, y + 22), "Gratis · Funciona sin internet", font=peq, fill=(214, 228, 248))
    # JPEG: WhatsApp no muestra vistas previas de imágenes muy pesadas
    og.save(ICONOS / "og.jpg", quality=84, optimize=True, progressive=True)


def escritorio(grande):
    """Icono de Atril para el ordenador (Windows y Mac): cuadrado redondeado con margen y sombra suave,
    sobre transparente, en src-tauri/icons/fuente.png. Después: npx tauri icon src-tauri/icons/fuente.png -o src-tauri/icons"""
    n, lado, radio = 1024, 860, 190
    x0 = (n - lado) // 2
    lienzo = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    sombra = Image.new("L", (n, n), 0)
    ImageDraw.Draw(sombra).rounded_rectangle((x0, x0 + 14, x0 + lado, x0 + lado + 14), radio, fill=90)
    sombra = sombra.filter(ImageFilter.GaussianBlur(18))
    lienzo.paste(Image.new("RGBA", (n, n), (8, 20, 50, 255)), (0, 0), sombra)
    mascara = Image.new("L", (lado, lado), 0)
    ImageDraw.Draw(mascara).rounded_rectangle((0, 0, lado - 1, lado - 1), radio, fill=255)
    lienzo.paste(grande.resize((lado, lado), Image.LANCZOS).convert("RGBA"), (x0, x0), mascara)
    destino = RAIZ / "src-tauri" / "icons"
    destino.mkdir(parents=True, exist_ok=True)
    lienzo.save(destino / "fuente.png", optimize=True)


if __name__ == "__main__":
    from fontTools.ttLib import TTFont
    FUENTES.mkdir(exist_ok=True)
    for n in ["700-normal", "400-normal"]:
        f = TTFont(RAIZ / "src" / "fonts" / f"carlito-latin-{n}.woff2")
        f.flavor = None
        f.save(FUENTES / f"carlito-{n}.ttf")
    ic = iconos()
    banner_y_vista_previa(ic)
    escritorio(ic)
    print("iconos, banner y vista previa generados en src/icons/; el del ordenador, en src-tauri/icons/fuente.png")
