"""Imágenes de la muestra del diseño nuevo (src/muestra/), a partir de scripts/arte/nuevo/ (bocetos de Ezequiel
hechos con ChatGPT, noviembre de 2026). No toca los iconos de la app: eso, cuando Ezequiel apruebe la muestra.
Uso: python3 scripts/muestra-imagenes.py  — necesita Pillow y numpy.

- Icono: el atril blanco del boceto, recortado y centrado sobre azul liso a sangre (el iPad redondea las
  esquinas él solo; el boceto traía el cuadrado ya redondeado con blanco alrededor). Maskable con más margen.
- Banner: la cabecera del inicio; og.jpg para la vista previa del enlace.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARTE = RAIZ / "scripts" / "arte" / "nuevo"
OUT = RAIZ / "src" / "muestra"
AZUL = (9, 41, 125)        # el azul del icono del boceto
AZUL_BANNER = (1, 46, 108) # el azul liso de la izquierda del banner


def atril():
    """El atril blanco con su transparencia (alfa según lo claro que es cada píxel sobre el azul)."""
    im = Image.open(ARTE / "icono.webp").convert("RGB")
    a = np.asarray(im).astype(float)
    x0, y0, x1, y1 = 240, 210, 1012, 1075  # zona del dibujo, dentro del cuadrado azul
    zona = a[y0:y1, x0:x1]
    # Luminosidad relativa entre el azul del fondo y el blanco
    fondo = np.array(AZUL, float)
    t = ((zona - fondo) / (255 - fondo)).mean(axis=2)
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


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    fig = atril()
    grande = icono(fig, 0.66)
    for tam, nombre in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
        grande.resize((tam, tam), Image.LANCZOS).save(OUT / nombre, optimize=True)
    icono(fig, 0.5).resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png", optimize=True)

    b = Image.open(ARTE / "banner.webp").convert("RGB")
    b.save(OUT / "banner.jpg", quality=82, optimize=True, progressive=True)

    # Vista previa del enlace (1200 × 630): el banner a la derecha, el icono y el nombre en la parte azul
    W, H = 1200, 630
    bb = b.resize((round(b.size[0] * H / b.size[1]), H), Image.LANCZOS)
    og = Image.new("RGB", (W, H), AZUL_BANNER)
    foto = bb.crop((bb.size[0] - 760, 0, bb.size[0], H))
    rampa = np.clip(np.arange(760) / 260, 0, 1)  # la foto entra fundiéndose con el azul
    mascara = Image.fromarray((np.tile(rampa, (H, 1)) * 255).astype(np.uint8))
    og.paste(foto, (W - 760, 0), mascara)
    d = ImageDraw.Draw(og)
    try:
        negrita = ImageFont.truetype("DejaVuSans-Bold.ttf", 112)
        normal = ImageFont.truetype("DejaVuSans.ttf", 36)
    except OSError:
        negrita = normal = ImageFont.load_default()
    ic = grande.resize((140, 140), Image.LANCZOS)
    m = Image.new("L", ic.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 139, 139), radius=32, fill=255)
    og.paste(ic, (64, 80), m)
    d.text((60, 250), "Atril", font=negrita, fill="white")
    y = 400
    for linea in ["Tus discursos de Word", "en el iPad, con letra", "grande y cronómetro."]:
        d.text((64, y), linea, font=normal, fill=(226, 234, 248))
        y += 48
    og.save(OUT / "og.jpg", quality=84, optimize=True, progressive=True)


if __name__ == "__main__":
    main()
