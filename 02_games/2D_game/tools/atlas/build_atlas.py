"""Pack the sprite catalogue into libGDX atlas pages."""
from collections import Counter
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/art"))
import pngio

ASSETS = ROOT / "assets"
OUTPUT = ASSETS / "atlas"
LIMIT = 2048
GAP = 2


def sources():
    catalog = (ROOT / "core/src/main/java/com/cropa/view/SpriteCatalog.java").read_text(encoding="utf-8")
    catalog = re.sub(r"/\*.*?\*/|//[^\n]*", "", catalog, flags=re.S)
    constants = dict(re.findall(r'public\s+static\s+final\s+String\s+(\w+)\s*=\s*"([^"]+)"', catalog))
    entries = re.findall(r'\bentry\s*\(\s*("[^"]+"|\w+)\s*,\s*"([^"]+)"\s*\)', catalog)
    images = {}
    keys = set()
    for token, relative in entries:
        key = token.strip('"') if token.startswith('"') else constants[token]
        if key in keys:
            raise ValueError(f"Duplicate catalogue key: {key}")
        keys.add(key)
        if relative.startswith("cinematics/"):
            continue
        base = ASSETS / relative
        if not base.is_file():
            raise ValueError(f"{key}: missing {base}")
        path = base
        index = 0
        while path.is_file():
            images.setdefault(path, []).append((key, index))
            index += 1
            path = base.with_name(f"{base.stem}-{index}.png")
    if not images:
        raise ValueError("No catalogue sprites to pack")
    return images


def extrusion_pixels(x, y, w, h, width, height):
    """Yield (outer pixel, nearest region pixel) offsets within the page."""
    right = x + w - 1
    bottom = y + h - 1
    for row in range(y, bottom + 1):
        start = row * width
        if x > 0:
            yield start + x - 1, start + x
        if right + 1 < width:
            yield start + right + 1, start + right

    # Include the four corners in the top and bottom margins.
    for outer_y, edge_y in ((y - 1, y), (bottom + 1, bottom)):
        if 0 <= outer_y < height:
            for col in range(max(0, x - 1), min(width, right + 2)):
                edge_x = min(max(col, x), right)
                yield outer_y * width + col, edge_y * width + edge_x


class Page:
    def __init__(self, shelf_width):
        self.shelf_width = shelf_width
        self.shelves = []
        self.images = []
        self.colors = set()
        self.width = self.height = 0

    def place(self, image):
        w, h, _, _, colors = image
        if len(self.colors | colors) > 256:
            return False
        for shelf in self.shelves:
            y, height, x = shelf
            if h <= height and x + w <= self.shelf_width:
                break
        else:
            y = self.height + GAP if self.shelves else 0
            if y + h > LIMIT:
                return False
            x = 0
            shelf = [y, h, x]
            self.shelves.append(shelf)
        shelf[2] = x + w + GAP
        self.width = max(self.width, x + w)
        self.height = max(self.height, y + h)
        self.colors.update(colors)
        self.images.append((x, y, image))
        return True

    def write(self, filename, counts, loose):
        width = 1 << (self.width - 1).bit_length()
        height = 1 << (self.height - 1).bit_length()
        padding = (0, 0, 0, 0)
        if len(self.colors) == 256 and padding not in self.colors:
            padding = min(self.colors, key=lambda rgba: (rgba[3], rgba))
        pixels = [padding] * (width * height)
        lines = [filename]
        for x, y, (w, h, source, names, _) in self.images:
            for row in range(h):
                start = (y + row) * width + x
                pixels[start:start + w] = source[row * w:(row + 1) * w]
            for outer, edge in extrusion_pixels(x, y, w, h, width, height):
                pixels[outer] = pixels[edge]
            for key, index in names:
                if key in loose:
                    continue
                lines.extend([key, f"bounds:{x},{y},{w},{h}"])
                if counts[key] > 1:
                    lines.append(f"index:{index}")
                if key.endswith("_frame"):
                    lines.append("split:8,8,8,8")
        path = OUTPUT / filename
        pngio.write(path, width, height, pixels)
        page_w, page_h, decoded = pngio.read(path)
        if (page_w, page_h) != (width, height):
            raise ValueError(f"{filename}: incorrect page dimensions")
        for x, y, (w, h, source, names, _) in self.images:
            for row in range(h):
                start = (y + row) * width + x
                if decoded[start:start + w] != source[row * w:(row + 1) * w]:
                    raise ValueError(f"{filename}: {names[0]} differs from source on row {row}")
            for outer, edge in extrusion_pixels(x, y, w, h, width, height):
                if decoded[outer] != decoded[edge]:
                    raise ValueError(f"{filename}: {names[0]} incorrect extrusion at "
                                     f"({outer % width}, {outer // width})")
        print(f"{filename}: {width} x {height}, {len(set(decoded))} colors, {path.stat().st_size} bytes")
        return "\n".join(lines)


def main():
    images = []
    unique = {}
    counts = Counter()
    paths = {}
    for path, names in sources().items():
        w, h, pixels = pngio.read(path)
        if max(w, h) > LIMIT:
            raise ValueError(f"{path}: {w} x {h} exceeds {LIMIT}")
        colors = set(pixels)
        if len(colors) > 256:
            raise ValueError(f"{path}: {len(colors)} distinct RGBA colors (maximum 256)")
        for key, index in names:
            counts[key] += 1
            if index == 0:
                paths[key] = path.relative_to(ASSETS).as_posix()
        signature = (w, h, tuple(pixels))
        if signature in unique:
            unique[signature][3].extend(names)
        else:
            image = (w, h, pixels, list(names), colors)
            unique[signature] = image
            images.append(image)
    loose = {}
    manifest = ROOT / "tools/atlas/loose.txt"
    for line in manifest.read_text(encoding="utf-8").splitlines():
        key, relative = line.split()
        if paths.get(key) != relative or counts[key] != 1 or key.endswith("_frame"):
            raise ValueError(f"Invalid loose sprite: {line}")
        loose[key] = relative
    images = [image for image in images if any(key not in loose for key, _ in image[3])]
    images.sort(key=lambda image: (-image[1], -image[0], image[3][0]))
    def layout(shelf_width):
        pages = []
        for image in images:
            candidates = sorted(pages, key=lambda page: len(image[4] - page.colors))
            if not any(page.place(image) for page in candidates):
                page = Page(shelf_width)
                if not page.place(image):
                    raise ValueError(f"Cannot place {image[3]}")
                pages.append(page)
        return pages

    def cost(pages):
        area = sum(1 << ((p.width - 1).bit_length() + (p.height - 1).bit_length())
                   for p in pages)
        return len(pages), area

    widths = (1 << n for n in range(LIMIT.bit_length() - 1, -1, -1))
    widest = max(image[0] for image in images)
    pages = min((layout(width) for width in widths if width >= widest), key=cost)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    names = ["sprites.png" if i == 0 else f"sprites{i + 1}.png" for i in range(len(pages))]
    sections = [page.write(name, counts, loose) for page, name in zip(pages, names)]
    (OUTPUT / "sprites.atlas").write_bytes(("\n\n".join(sections) + "\n").encode("utf-8"))
    for old in OUTPUT.glob("sprites*.png"):
        if re.fullmatch(r"sprites\d*\.png", old.name) and old.name not in names:
            old.unlink()
    print(f"{sum(counts.values()) - len(loose)} regions on {len(pages)} pages")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(str(error))
