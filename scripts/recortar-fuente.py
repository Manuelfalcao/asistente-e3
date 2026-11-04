"""Recorta las fuentes del Asistente a los caracteres que usa y las deja en src/ui/fuentes/.

Uso: npm run fuente (necesita Python con fontTools y brotli: pip install fonttools brotli).

- Latin Modern Math, para las fórmulas (spec §5.4): la tabla MATH queda, y con ella las variantes que
  estiran raíces, paréntesis y fracciones. Los caracteres están en scripts/fuentes/rangos.txt.
- Source Serif 4, para los títulos (spec §4.6): queda un solo peso, a tamaño de título. Los caracteres
  están en scripts/fuentes/rangos-titulos.txt. "Source" es un nombre reservado de su licencia OFL y un
  recorte es una versión modificada: por eso se llama como NOMBRE_TITULOS.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

RAIZ = Path(__file__).resolve().parent.parent
FUENTES = RAIZ / "scripts" / "fuentes"
SALIDA = RAIZ / "src" / "ui" / "fuentes"

NOMBRE_TITULOS = "Titulos E3"
EJES_TITULOS = {"wght": 600, "opsz": 20}
RASGOS_TITULOS = ["calt", "ccmp", "kern", "liga", "locl", "mark", "mkmk", "rlig"]
# Los créditos y la licencia quedan en la fuente, además de los nombres nuevos.
NOMBRES_QUE_QUEDAN = {0, 1, 2, 3, 4, 5, 6, 13, 14}


def leer_rangos(ruta: Path) -> list[str]:
    rangos = []
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.split("#", 1)[0].strip()
        if linea:
            rangos.append(linea)
    return rangos


def recortar_formulas() -> Path:
    destino = SALIDA / "latinmodern-math-recorte.woff2"
    rangos = leer_rangos(FUENTES / "rangos.txt")
    subset.main(
        [
            str(FUENTES / "latinmodern-math.woff2"),
            f"--unicodes={','.join(rangos)}",
            "--layout-features=*",
            "--name-IDs=*",
            "--flavor=woff2",
            f"--output-file={destino}",
        ]
    )
    return destino


def renombrar_titulos(fuente: TTFont) -> None:
    nombres = fuente["name"]
    nombres.names = [n for n in nombres.names if n.nameID in NOMBRES_QUE_QUEDAN]
    pegado = NOMBRE_TITULOS.replace(" ", "")
    for id_nombre, texto in {
        1: NOMBRE_TITULOS,
        2: "Regular",
        3: f"{pegado}-Semibold",
        4: NOMBRE_TITULOS,
        6: f"{pegado}-Semibold",
    }.items():
        nombres.setName(texto, id_nombre, 3, 1, 0x409)
    # El nombre de cada estilo apunta a los nombres que ya no están.
    if "STAT" in fuente:
        del fuente["STAT"]


def recortar_titulos() -> Path:
    destino = SALIDA / "titulos-recorte.woff2"
    fuente = TTFont(FUENTES / "source-serif-4.woff2")
    instancer.instantiateVariableFont(fuente, EJES_TITULOS, inplace=True)
    renombrar_titulos(fuente)

    opciones = subset.Options()
    opciones.layout_features = RASGOS_TITULOS
    opciones.name_IDs = ["*"]
    opciones.hinting = False
    recorte = subset.Subsetter(opciones)
    rangos = ",".join(leer_rangos(FUENTES / "rangos-titulos.txt"))
    recorte.populate(unicodes=subset.parse_unicodes(rangos))
    recorte.subset(fuente)

    fuente.flavor = "woff2"
    fuente.save(destino)
    return destino


def main() -> None:
    for destino in (recortar_formulas(), recortar_titulos()):
        print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
