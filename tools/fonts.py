"""Subset the supplied regular and bold Swei fonts to the game's actual text."""
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

source, dest = map(Path, sys.argv[1:])
strings = set(chr(n) for n in range(32, 127))
for file in [*source.joinpath("src").glob("*.js"), *source.joinpath("public/data").rglob("*.json"),
             *source.joinpath("public/assets").glob("??-*.js"), *source.joinpath("public/assets").glob("zht-*.js")]:
    strings.update(file.read_text(encoding="utf-8"))
dest.mkdir(exist_ok=True, parents=True)
for weight in ("Regular", "Bold"):
    font = TTFont(source / ("public/fonts/swei/SweiGothicCJKsc-" + weight + ".ttf"))
    sub = subset.Subsetter()
    sub.populate(text="".join(strings))
    sub.subset(font)
    font.save(dest / (weight.lower() + ".ttf"))
