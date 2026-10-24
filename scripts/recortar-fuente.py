"""Recorta Latin Modern Math a los caracteres de scripts/fuentes/rangos.txt (spec §5.4).

Uso: npm run fuente (necesita Python con fontTools y brotli: pip install fonttools brotli).
La tabla MATH queda, y con ella las variantes que estiran raíces, paréntesis y fracciones.
"""

from pathlib import Path

from fontTools import subset

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = RAIZ / "scripts" / "fuentes" / "latinmodern-math.woff2"
RANGOS = RAIZ / "scripts" / "fuentes" / "rangos.txt"
DESTINO = RAIZ / "src" / "ui" / "fuentes" / "latinmodern-math-recorte.woff2"


def leer_rangos(texto: str) -> list[str]:
    rangos = []
    for linea in texto.splitlines():
        linea = linea.split("#", 1)[0].strip()
        if linea:
            rangos.append(linea)
    return rangos


def main() -> None:
    rangos = leer_rangos(RANGOS.read_text(encoding="utf-8"))
    subset.main(
        [
            str(ORIGEN),
            f"--unicodes={','.join(rangos)}",
            "--layout-features=*",
            "--name-IDs=*",
            "--flavor=woff2",
            f"--output-file={DESTINO}",
        ]
    )
    print(f"{DESTINO.relative_to(RAIZ)}: {DESTINO.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
