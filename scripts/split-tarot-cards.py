#!/usr/bin/env python3
"""Split the imported Persona 5 Royal tarot sheet into individual card PNGs.

Requires Pillow for this one-off asset build:
    python -m pip install Pillow
"""

from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "assets/PlayStation 4 - Persona 5 Royal - Miscellaneous - Tarot Cards.png"
DEFAULT_OUTPUT = ROOT / "app/public/tarot-cards"
SHEET_WIDTH = 5131
SHEET_HEIGHT = 3076
COLUMNS = 10
ROWS = 3
SHEET_BACKGROUND = (255, 0, 220)

# Row-major source cells. The first entry is the unnumbered card back.
CARD_SPECS = [
    ("back", "back.png", "Card back", 0, 0),
    ("fool", "00-le-mat.png", "Le Mat", 0, 1),
    ("magician", "01-le-bateleur.png", "Le Bateleur", 0, 2),
    ("priestess", "02-la-papesse.png", "La Papesse", 0, 3),
    ("empress", "03-limperatrice.png", "L'Impératrice", 0, 4),
    ("emperor", "04-lempereur.png", "L'Empereur", 0, 5),
    ("hierophant", "05-le-pape.png", "Le Pape", 0, 6),
    ("lovers", "06-lamoureux.png", "L'Amoureux", 0, 7),
    ("chariot", "07-le-chariot.png", "Le Chariot", 0, 8),
    ("justice", "08-la-justice.png", "La Justice", 0, 9),
    ("hermit", "09-lermite.png", "L'Ermite", 1, 0),
    ("wheel-of-fortune", "10-roue-de-fortune.png", "La Roue de Fortune", 1, 1),
    ("strength", "11-la-force.png", "La Force", 1, 2),
    ("hanged-man", "12-le-pendu.png", "Le Pendu", 1, 3),
    ("death", "13-arcane-sans-nom.png", "L'Arcane sans nom", 1, 4),
    ("temperance", "14-temperance.png", "Tempérance", 1, 5),
    ("devil", "15-le-diable.png", "Le Diable", 1, 6),
    ("tower", "16-la-maison-dieu.png", "La Maison Dieu", 1, 7),
    ("star", "17-letoile.png", "L'Étoile", 1, 8),
    ("moon", "18-la-lune.png", "La Lune", 1, 9),
    ("sun", "19-le-soleil.png", "Le Soleil", 2, 0),
    ("judgement", "20-le-jugement.png", "Le Jugement", 2, 1),
    ("world", "21-le-monde.png", "Le Monde", 2, 2),
    ("royal-faith-a", "royal-faith-a.png", "La Foi (variant A)", 2, 3),
    ("royal-conqueror", "royal-conqueror.png", "Le Conquérant", 2, 4),
    ("royal-faith-b", "royal-faith-b.png", "La Foi (variant B)", 2, 5),
]


def is_sheet_background(pixel: tuple[int, int, int, int]) -> bool:
    return max(abs(pixel[index] - SHEET_BACKGROUND[index]) for index in range(3)) <= 12


def remove_connected_sheet_background(image: Image.Image) -> Image.Image:
    """Make sheet-level magenta transparent without removing card interiors."""
    pixels = image.load()
    width, height = image.size
    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    for x in range(width):
        for y in (0, height - 1):
            if is_sheet_background(pixels[x, y]):
                queue.append((x, y))
    for y in range(height):
        for x in (0, width - 1):
            if is_sheet_background(pixels[x, y]):
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        if not is_sheet_background(pixels[x, y]):
            continue
        seen.add((x, y))
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    for x, y in seen:
        pixels[x, y] = (0, 0, 0, 0)

    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError("Card cell contained no artwork")
    return image.crop(bbox)


def cell_box(width: int, height: int, row: int, column: int) -> tuple[int, int, int, int]:
    left = round(column * width / COLUMNS)
    right = round((column + 1) * width / COLUMNS)
    top = round(row * height / ROWS)
    bottom = round((row + 1) * height / ROWS)
    return left, top, right, bottom


def create_preview(cards: list[tuple[str, Image.Image]], path: Path) -> None:
    thumbnail_width = 150
    thumbnail_height = 220
    label_height = 30
    columns = 5
    rows = (len(cards) + columns - 1) // columns
    preview = Image.new("RGBA", (columns * 220, rows * (thumbnail_height + label_height)), (40, 40, 40, 255))
    draw = ImageDraw.Draw(preview)

    for index, (filename, card) in enumerate(cards):
        x = (index % columns) * 220
        y = (index // columns) * (thumbnail_height + label_height)
        thumbnail = card.copy()
        thumbnail.thumbnail((thumbnail_width, thumbnail_height), Image.Resampling.LANCZOS)
        preview.alpha_composite(thumbnail, (x + (thumbnail_width - thumbnail.width) // 2, y + label_height))
        draw.text((x + 4, y + 6), filename, fill="white")

    path.parent.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(path, quality=92)


def split_cards(source: Path, output: Path, preview: Path | None) -> None:
    sheet = Image.open(source).convert("RGBA")
    if sheet.size != (SHEET_WIDTH, SHEET_HEIGHT):
        raise ValueError(f"Expected {SHEET_WIDTH}x{SHEET_HEIGHT}, got {sheet.size[0]}x{sheet.size[1]}")

    output.mkdir(parents=True, exist_ok=True)
    generated: list[tuple[str, Image.Image]] = []
    seen_filenames: set[str] = set()

    for card_id, filename, _label, row, column in CARD_SPECS:
        if filename in seen_filenames:
            raise ValueError(f"Duplicate output filename: {filename}")
        seen_filenames.add(filename)
        cell = sheet.crop(cell_box(*sheet.size, row, column))
        card = remove_connected_sheet_background(cell)
        card.save(output / filename, format="PNG", optimize=True)
        generated.append((filename, card))
        print(f"{card_id:18} {filename:28} {card.width}x{card.height}")

    if preview:
        create_preview(generated, preview)
        print(f"Preview: {preview}")
    print(f"Generated {len(generated)} cards in {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    split_cards(args.source, args.output, args.preview)


if __name__ == "__main__":
    main()
