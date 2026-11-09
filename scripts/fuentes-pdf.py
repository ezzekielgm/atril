"""Letras para el PDF (src/fonts/pdf/): Carlito y Literata con latín, latín ampliado y griego, en WOFF
(pdf-lib + fontkit las incrusta y recorta; con WOFF2 no puede recortarlas). Literata es variable:
se sacan sus grosores 400 y 700 fijos. Uso: python3 scripts/fuentes-pdf.py  (necesita fontTools y brotli,
y las dependencias de desarrollo instaladas: @fontsource/carlito y @fontsource-variable/literata)."""
from pathlib import Path
import tempfile
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from fontTools.varLib.instancer import instantiateVariableFont

RAIZ = Path(__file__).resolve().parent.parent
NM = RAIZ / "node_modules"
SALIDA = RAIZ / "src" / "fonts" / "pdf"
SALIDA.mkdir(parents=True, exist_ok=True)
SUBCONJUNTOS = ["latin", "latin-ext", "greek"]
QUITAR = ["GSUB", "GPOS", "GDEF", "kern", "STAT", "fvar", "gvar", "avar", "HVAR", "MVAR", "cvar", "DSIG"]


def preparar(origen: Path, wght=None) -> str:
    f = TTFont(origen)
    if wght is not None and "fvar" in f:
        f = instantiateVariableFont(f, {"wght": wght, "opsz": None} if any(a.axisTag == "opsz" for a in f["fvar"].axes) else {"wght": wght})
    for t in QUITAR:
        if t in f:
            del f[t]
    f.flavor = None
    tmp = tempfile.NamedTemporaryFile(suffix=".ttf", delete=False)
    f.save(tmp.name)
    return tmp.name


def unir(archivos, destino: Path, familia: str, estilo: str):
    fuente = Merger().merge(archivos)
    # Nombre limpio para el PDF
    for rec in fuente["name"].names:
        if rec.nameID in (1, 16):
            rec.string = familia
        elif rec.nameID in (2, 17):
            rec.string = estilo
        elif rec.nameID == 4:
            rec.string = f"{familia} {estilo}"
        elif rec.nameID == 6:
            rec.string = f"{familia}-{estilo.replace(' ', '')}"
    fuente.flavor = "woff"
    fuente.save(destino)
    print("✔", destino.name, destino.stat().st_size // 1024, "KB")


ESTILOS = {(400, "normal"): "Regular", (700, "normal"): "Bold", (400, "italic"): "Italic", (700, "italic"): "Bold Italic"}
for (peso, forma), nombre in ESTILOS.items():
    carlito = [preparar(NM / "@fontsource/carlito/files" / f"carlito-{s}-{peso}-{forma}.woff") for s in SUBCONJUNTOS]
    unir(carlito, SALIDA / f"carlito-{peso}-{forma}.woff", "Carlito", nombre)
    literata = [preparar(NM / "@fontsource-variable/literata/files" / f"literata-{s}-wght-{forma}.woff2", wght=peso) for s in SUBCONJUNTOS]
    unir(literata, SALIDA / f"literata-{peso}-{forma}.woff", "Literata", nombre)
