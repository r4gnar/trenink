"""Vytáhne nákresy, svalové mapy a popisy techniky z ../technika-cviku.html
do js/content.js, aby appka používala stejný obsah jako tištěná příručka.

Spuštění (ze složky trenink):  python tools/build_content.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT.parent / "technika-cviku.html"
TARGET = ROOT / "js" / "content.js"

# id cviku v appce -> značka začátku bloku v příručce
ARTICLES = {"row": '<span class="ex-num">01</span>', "pullapart": '<span class="ex-num">02</span>'}
TECH_ITEMS = {
    "squat": '<span class="idx">03</span>',
    "pushup": '<span class="idx">04</span>',
    "bridge": '<span class="idx">05</span>',
    "deadbug": '<span class="idx">06</span>',
    "superman": '<span class="idx">07</span>',
}


def find(html, needle, start=0):
    i = html.find(needle, start)
    if i < 0:
        raise SystemExit(f"V příručce chybí: {needle!r}")
    return i


def compact(fragment):
    fragment = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    lines = [line.strip() for line in fragment.splitlines()]
    return "\n".join(line for line in lines if line)


def main():
    html = SOURCE.read_text(encoding="utf-8")

    start = find(html, '<svg width="0" height="0"')
    bodymap = html[start : find(html, "</svg>", start) + len("</svg>")]

    content = {}
    for ex_id, marker in ARTICLES.items():
        head = find(html, marker)
        body = find(html, '<div class="fig">', head)
        content[ex_id] = compact(html[body : find(html, "</article>", body)])

    for ex_id, marker in TECH_ITEMS.items():
        head = find(html, marker)
        body = find(html, '<div class="fig">', head)
        flag = find(html, '<div class="flag">', body)
        content[ex_id] = compact(html[body : find(html, "</div>", flag) + len("</div>")])

    TARGET.write_text(
        "// Vygenerováno z technika-cviku.html skriptem tools/build_content.py — needitovat ručně.\n"
        f"export const BODYMAP = {json.dumps(compact(bodymap), ensure_ascii=False)};\n\n"
        f"export const TECHNIQUE = {json.dumps(content, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )
    print(f"{TARGET.relative_to(ROOT)}: {len(content)} exercises, {TARGET.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
