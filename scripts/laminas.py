"""Junta las capturas de capturas/ (hechas con scripts/capturas-diseno.mjs) en 3 láminas numeradas
y un ZIP, para subirlas a otra IA. Uso: python3 scripts/laminas.py  (necesita Pillow)."""
import json
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parent.parent / "capturas"
lista = json.loads((RAIZ / "lista.json").read_text(encoding="utf-8"))
por_n = {c["n"]: c for c in lista}


def fuente(peso, tam):
    for ruta in (f"/usr/share/fonts/opentype/inter/Inter-{peso}.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(ruta, tam)
        except OSError:
            pass
    return ImageFont.load_default()


TIT = fuente("Bold", 44)
SUB = fuente("Regular", 26)
NUM = fuente("Bold", 26)
ETI = fuente("Medium", 22)
FONDO = (243, 242, 241)
AZUL = (24, 90, 189)


def lamina(nombre, titulo, subtitulo, filas, alto_tile):
    """filas: lista de filas, cada una lista de números de captura."""
    hueco, margen, cab, eti = 28, 48, 150, 64
    tiles = []
    for fila in filas:
        fila_t = []
        for num in fila:
            im = Image.open(RAIZ / por_n[num]["archivo"]).convert("RGB")
            ancho = round(im.width * alto_tile / im.height)
            fila_t.append((num, im.resize((ancho, alto_tile), Image.LANCZOS)))
        tiles.append(fila_t)
    ancho = max(sum(t.width for _, t in f) + hueco * (len(f) - 1) for f in tiles) + 2 * margen
    alto = cab + len(tiles) * (alto_tile + eti + hueco) + margen
    lam = Image.new("RGB", (ancho, alto), FONDO)
    d = ImageDraw.Draw(lam)
    d.rectangle([0, 0, ancho, cab - 30], fill=AZUL)
    d.text((margen, 22), titulo, font=TIT, fill="white")
    d.text((margen, 76), subtitulo, font=SUB, fill=(222, 236, 249))
    y = cab
    for f in tiles:
        x = margen + (ancho - 2 * margen - (sum(t.width for _, t in f) + hueco * (len(f) - 1))) // 2
        for num, t in f:
            texto = por_n[num]["titulo"]
            d.ellipse([x, y + 8, x + 40, y + 48], fill=AZUL)
            d.text((x + 20, y + 28), str(num), font=NUM, fill="white", anchor="mm")
            # El título, recortado al ancho de la miniatura
            while d.textlength(texto, font=ETI) > t.width - 56 and len(texto) > 4:
                texto = texto[:-2].rstrip() + "…" if not texto.endswith("…") else texto[:-2].rstrip() + "…"
            d.text((x + 52, y + 28), texto, font=ETI, fill=(32, 31, 30), anchor="lm")
            lam.paste(t, (x, y + eti))
            d.rectangle([x - 1, y + eti - 1, x + t.width, y + eti + t.height], outline=(200, 198, 196), width=2)
            x += t.width + hueco
        y += alto_tile + eti + hueco
    lam.save(RAIZ / nombre, optimize=True)
    print("✔", nombre, lam.size)


lamina("Atril-lamina-1-ipad.png", "Atril · capturas 1 de 3", "iPad 10,2\" en horizontal (1080 × 810): inicio, lector y presentar", [[1, 2, 3], [4, 5, 6], [7, 8, 9]], 540)
lamina("Atril-lamina-2-ipad.png", "Atril · capturas 2 de 3", "iPad 10,2\" en horizontal: editor, dibujo, compartir, ajustes, guía y temas", [[10, 11, 12], [13, 14, 15], [16, 17, 18]], 540)
lamina("Atril-lamina-3-vertical-movil.png", "Atril · capturas 3 de 3", "iPad en vertical (810 × 1080) y móvil (390 × 844)", [[19, 20, 21, 22, 23, 24]], 760)

with zipfile.ZipFile(RAIZ / "Atril-capturas.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for c in lista:
        z.write(RAIZ / c["archivo"], c["archivo"])
    z.writestr("LEEME.txt", "Capturas de Atril (iPad 10,2\" y móvil).\n\n" + "\n".join(f'{c["archivo"]}: {c["titulo"]}' for c in lista) + "\n")
print("✔ Atril-capturas.zip")
