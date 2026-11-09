"""Genera los iconos, el banner y la imagen de vista previa a partir de las imágenes de scripts/arte/.
Uso (desde la carpeta del proyecto): python3 scripts/iconos.py   — necesita Pillow y numpy.

- Icono: se quita el marco blanco del original, se recorta el atril y se coloca centrado sobre
  el mismo degradado azul (recalculado), con más margen en la versión «maskable» de Android.
- Banner: cabecera del inicio (se guarda en JPEG ligero) y versión estrecha para el móvil.
- og.jpg: imagen que sale al mandar el enlace (banner + nombre y lema).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARTE = RAIZ / "scripts" / "arte"
ICONOS = RAIZ / "src" / "icons"


def degradado_de_fondo(a, mascara_fondo):
    """Ajusta color = c0 + c1·x + c2·y + c3·x·y por canal sobre los píxeles de fondo."""
    ys, xs = np.where(mascara_fondo)
    sel = np.random.default_rng(0).choice(len(xs), size=min(40000, len(xs)), replace=False)
    xs, ys = xs[sel] / 1024, ys[sel] / 1024
    A = np.stack([np.ones_like(xs), xs, ys, xs * ys], axis=1)
    return [np.linalg.lstsq(A, a[(ys * 1024).astype(int), (xs * 1024).astype(int), c], rcond=None)[0] for c in range(3)]


def pinta_degradado(coefs, n):
    y, x = np.mgrid[0:n, 0:n] / n
    canales = [c[0] + c[1] * x + c[2] * y + c[3] * x * y for c in coefs]
    return Image.fromarray(np.clip(np.stack(canales, axis=2), 0, 255).astype(np.uint8))


def iconos():
    im = Image.open(ARTE / "icono-original.jpg").convert("RGB")
    a = np.asarray(im).astype(float)
    n = im.size[0]
    blanco = a.min(axis=2) > 200
    # Fondo = dentro del marco y lejos del atril
    dentro = np.zeros(a.shape[:2], bool)
    dentro[95:925, 95:925] = True
    es_azul = a[:, :, 2] > a[:, :, 0] + 45
    fondo = dentro & es_azul & ~blanco
    fondo[170:910, 245:780] = False
    coefs = degradado_de_fondo(a, fondo)
    pred = np.stack([coefs[c][0] + coefs[c][1] * np.mgrid[0:n, 0:n][1] / n + coefs[c][2] * np.mgrid[0:n, 0:n][0] / n
                     + coefs[c][3] * (np.mgrid[0:n, 0:n][1] / n) * (np.mgrid[0:n, 0:n][0] / n) for c in range(3)], axis=2)
    dist = np.sqrt(((a - pred) ** 2).sum(axis=2))
    # Máscara del atril (y su sombra suave): distancia al fondo, dentro de la zona del dibujo
    zona = np.zeros_like(dentro)
    zona[175:915, 240:785] = True
    alfa = np.clip((dist - 10) / 30, 0, 1) * zona
    mask = Image.fromarray((alfa * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    caja = (240, 175, 785, 915)
    figura = im.crop(caja)
    mfig = mask.crop(caja)
    fw, fh = figura.size

    def compone(tam, alto_rel, nombre):
        fondo_img = pinta_degradado(coefs, 1024)
        esc = alto_rel * 1024 / fh
        w, h = round(fw * esc), round(fh * esc)
        f = figura.resize((w, h), Image.LANCZOS)
        m = mfig.resize((w, h), Image.LANCZOS)
        x, y = (1024 - w) // 2, (1024 - h) // 2 + round(0.01 * 1024)
        fondo_img.paste(f, (x, y), m)
        fondo_img.resize((tam, tam), Image.LANCZOS).save(ICONOS / nombre, optimize=True)
        return fondo_img

    grande = compone(1024, 0.78, "icon-1024.png")
    for tam, nombre in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
        grande.resize((tam, tam), Image.LANCZOS).save(ICONOS / nombre, optimize=True)
    compone(512, 0.58, "icon-maskable-512.png")  # Android recorta en círculo: más margen
    (ICONOS / "icon-1024.png").unlink()
    return grande


def banner_y_vista_previa(icono):
    b = Image.open(ARTE / "banner-original.jpg").convert("RGB")
    # Cabecera del inicio: ancho completo y una versión más ligera para el móvil
    b.save(ICONOS / "banner.jpg", quality=82, optimize=True, progressive=True)
    b.resize((1080, round(b.size[1] * 1080 / b.size[0])), Image.LANCZOS).save(ICONOS / "banner-movil.jpg", quality=80, optimize=True, progressive=True)

    # Vista previa del enlace (1200 × 630): el banner a la derecha y el texto en la parte azul
    W, H = 1200, 630
    esc = H / b.size[1]
    bb = b.resize((round(b.size[0] * esc), H), Image.LANCZOS)
    og = bb.crop((bb.size[0] - W, 0, bb.size[0], H))
    d = ImageDraw.Draw(og)
    negrita = ImageFont.truetype(str(FUENTES / "carlito-700-normal.ttf"), 132)
    normal = ImageFont.truetype(str(FUENTES / "carlito-400-normal.ttf"), 40)
    peq = ImageFont.truetype(str(FUENTES / "carlito-400-normal.ttf"), 31)
    ic = icono.resize((150, 150), Image.LANCZOS)
    m = Image.new("L", ic.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 149, 149), radius=34, fill=255)
    og.paste(ic, (60, 70), m)
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


FUENTES = Path("/tmp/fuentes")
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
