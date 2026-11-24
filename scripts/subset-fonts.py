"""生成页面使用的本地 WOFF2 子集；原始字体与授权见 assets/fonts/sources.json。"""
import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser()
parser.add_argument("--chinese", required=True, type=Path)
parser.add_argument("--numeric", required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = root / "assets" / "fonts"
output.mkdir(parents=True, exist_ok=True)
text = "".join((root / name).read_text(encoding="utf-8") for name in ["index.html", "events.js", "script.js"])
characters = set(text) | set(chr(code) for code in range(32, 127)) | set("\u00a0…→–—“”‘’·")

for source, filename, glyphs in [
    (args.chinese, "bw-sans.woff2", characters),
    (args.numeric, "bw-numbers.woff2", set(chr(code) for code in range(32, 127))),
]:
    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(glyphs)))
    subsetter.subset(font)
    font.flavor = "woff2"
    destination = output / filename
    font.save(destination)
    print(f"{filename}: {destination.stat().st_size:,} bytes")
