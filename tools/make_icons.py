"""Vygeneruje ikony appky do icons/ (činka na zelené ploše).

Spuštění (ze složky trenink):  python tools/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"
GREEN = (14, 107, 86)
WHITE = (251, 252, 250)
SCALE = 4  # kreslí se ve větším rozlišení a zmenšuje kvůli hladkým hranám


def dumbbell(draw, size, glyph):
    """Činka vycentrovaná v ploše, `glyph` = šířka činky jako podíl velikosti."""
    c = size / 2
    w = size * glyph
    bar_h = w * 0.09
    draw.rounded_rectangle((c - w * 0.32, c - bar_h / 2, c + w * 0.32, c + bar_h / 2), radius=bar_h / 2, fill=WHITE)
    for sign in (-1, 1):
        for offset, plate_w, plate_h in ((0.22, 0.11, 0.56), (0.36, 0.08, 0.38)):
            x = c + sign * w * offset
            draw.rounded_rectangle(
                (x - w * plate_w / 2, c - w * plate_h / 2, x + w * plate_w / 2, c + w * plate_h / 2),
                radius=w * 0.03,
                fill=WHITE,
            )


def icon(size, *, glyph, rounded):
    big = size * SCALE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if rounded:
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=big * 0.22, fill=GREEN)
    else:
        draw.rectangle((0, 0, big, big), fill=GREEN)
    dumbbell(draw, big, glyph)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    icon(192, glyph=0.78, rounded=True).save(OUT / "icon-192.png")
    icon(512, glyph=0.78, rounded=True).save(OUT / "icon-512.png")
    # maskable: Android si ikonu ořízne do kruhu/čtverce, obsah musí být v bezpečné zóně (80 %)
    icon(512, glyph=0.62, rounded=False).save(OUT / "icon-maskable-512.png")
    icon(180, glyph=0.7, rounded=False).convert("RGB").save(OUT / "apple-touch-icon.png")
    print("icons ok")


if __name__ == "__main__":
    main()
