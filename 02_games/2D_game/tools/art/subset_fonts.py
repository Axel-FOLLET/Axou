#!/usr/bin/env python3
import os
import re
import sys
import tempfile
from pathlib import Path

ASCII = set(range(32, 127))
FIELDS = "id x y width height xoffset yoffset xadvance".split()
TOKENS = re.compile(
    r"""//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|["']""",
    re.S,
)
ESCAPE = re.compile(r"\\([0-3][0-7]{0,2}|[4-7][0-7]?|.)")
SIMPLE = dict(zip("btnfrs\"'\\", "\b\t\n\f\r \"'\\"))


def unicode_escapes(source):
    # Java traduit Unicode avant de reconnaître les commentaires et les littéraux.
    result = []
    i = slashes = 0
    translated = False
    while i < len(source):
        c = source[i]
        i += 1
        eligible = translated or slashes % 2 == 0
        translated = False
        if c == "\\" and eligible and source.startswith("u", i):
            while source.startswith("u", i):
                i += 1
            digits = source[i:i + 4]
            if not re.fullmatch("[0-9a-fA-F]{4}", digits):
                raise ValueError("échappement Unicode incomplet")
            c = chr(int(digits, 16))
            i += 4
            translated = True
        result.append(c)
        slashes = slashes + 1 if c == "\\" else 0
    return "".join(result).replace("\r\n", "\n").replace("\r", "\n")


def unescape(match):
    value = match[1]
    if value in SIMPLE:
        return SIMPLE[value]
    if value[0] in "01234567":
        return chr(int(value, 8))
    raise ValueError(f"échappement Java inconnu {value!r}")


def literal_origins(java):
    files = sorted(java.rglob("*.java"))
    if not files:
        raise ValueError(f"aucun fichier Java dans {java}")
    origins = {}
    for path in files:
        source = unicode_escapes(path.read_text(encoding="utf-8"))
        for match in TOKENS.finditer(source):
            token = match[0]
            if token.startswith("/"):
                continue
            if len(token) == 1 or source.startswith('"""', match.start()):
                raise ValueError(f"{path}: littéral non reconnu")
            value = ESCAPE.sub(unescape, token[1:-1])
            for char in value:
                origins.setdefault(ord(char), path.relative_to(java))
    return origins


def positional_values(line):
    # StringTokenizer de libGDX utilise espace et '=' comme séparateurs.
    return re.split("[ =]+", line.strip())[2::2]


def load(data):
    lines = iter(data.decode("utf-8").splitlines())
    info, common, page = (next(lines, "") for _ in range(3))
    pad = re.search(r"padding=(-?\d+,-?\d+,-?\d+,-?\d+) ", info)
    header = re.match(r"common lineHeight=(-?\d+) base=(-?\d+)(?: |$)", common)
    name = re.search(r'.*file="?([^"]+)"?', page)
    page_id = re.search(r".*id=(\d+)", page)
    tokens = common.split(" ", 8)
    if (not pad or not header or not name or (page_id and int(page_id[1]) != 0)
            or (len(tokens) >= 6 and tokens[5].startswith("pages=")
                and tokens[5] != "pages=1")):
        raise ValueError("en-tête de police monopage invalide")

    glyphs = {}
    pairs = {}
    metrics = None
    in_pairs = False
    for line in lines:
        if line.startswith("char ") and not in_pairs:
            values = positional_values(line)
            ident, x, y, w, h, dx, dy, advance = map(int, values[:8])
            page_no = int(values[8]) if len(values) > 8 else 0
            if ident in glyphs or ident > 65535 or page_no != 0:
                raise ValueError(f"glyphe incompatible {ident}")
            # GdxCanvas ouvre BitmapFont sans retournement vertical.
            glyphs[ident] = (x, y, w, h, dx, -(h + dy), advance, page_no)
        elif line.startswith("chars ") and not in_pairs:
            continue
        elif line.startswith("kernings ") and not in_pairs:
            in_pairs = True
        elif in_pairs and line.startswith("kerning "):
            first, second, amount = map(int, positional_values(line))
            if first <= 0 or first not in glyphs or (first, second) in pairs:
                raise ValueError(f"paire incompatible {first}/{second}")
            pairs[first, second] = amount
        elif in_pairs and line.startswith("metrics "):
            if len(tuple(map(float, positional_values(line)))) != 7:
                raise ValueError("bloc metrics incomplet")
            if any(tail.strip() for tail in lines):
                raise ValueError("données inattendues après metrics")
            metrics = line
            break
        else:
            raise ValueError(f"ligne de police inattendue {line!r}")
    if metrics is None or not glyphs:
        raise ValueError("bloc metrics ou glyphes manquants dans la police du jeu")
    return (pad[1], int(header[1]), int(header[2]), name[1], metrics), glyphs, pairs


def encode(header, glyphs, pairs):
    padding, height, base, filename, metrics = header
    # L'espace après padding termine la valeur pour BitmapFontData.load.
    lines = [f"info padding={padding} ", f"common lineHeight={height} base={base}",
             f'page file="{filename}"']
    for ident, (x, y, w, h, dx, loaded_dy, advance, page) in glyphs.items():
        values = (ident, x, y, w, h, dx, -loaded_dy - h, advance)
        line = "char " + " ".join(f"{k}={v}" for k, v in zip(FIELDS, values))
        lines.append(line + (f" page={page}" if page else ""))
    # Ce marqueur ouvre la boucle de kerning, même si elle est vide.
    lines.append(f"kernings count={len(pairs)}")
    for (first, second), amount in pairs.items():
        lines.append(f"kerning first={first} second={second} amount={amount}")
    lines.append(metrics)
    return ("\n".join(lines) + "\n").encode("utf-8")


def prepare(path, origins):
    before = path.read_bytes()
    header, glyphs, pairs = load(before)
    missing = origins.keys() - glyphs.keys()
    if missing:
        details = ", ".join(f"U+{i:04X} ({origins[i]})" for i in sorted(missing))
        raise ValueError(f"{path.name}: glyphes absents des littéraux Java : {details}")

    kept = {i: g for i, g in glyphs.items() if i <= 0 or i in ASCII or i in origins}
    selected = {k: v for k, v in pairs.items() if k[0] in kept and k[1] in kept}
    after = encode(header, kept, selected)
    if load(after) != (header, kept, selected):
        raise ValueError(f"{path.name}: écart après relecture")

    accents = " ".join(f"{chr(i)} (U+{i:04X})" for i in sorted(kept) if i > 127)
    report = (f"{path.name}: {len(kept)} glyphes, {len(selected)} paires, "
              f"{len(before)} → {len(after)} octets\nNon ASCII : {accents}")
    return after, report


def main(fonts, java, output):
    fonts = fonts.resolve(strict=True)
    output = output.resolve()
    if (output == fonts or fonts in output.parents
            or (output.exists() and output.samefile(fonts))):
        raise ValueError("le dossier de sortie doit être distinct et extérieur aux polices sources")

    origins = literal_origins(java)
    results = {}
    for size in (8, 15):
        name = f"pixel-{size}.fnt"
        results[name] = prepare(fonts / name, origins)

    # Les deux polices ont passé les contrôles avant la première écriture.
    output.mkdir(parents=True, exist_ok=True)
    staged = {}
    try:
        for name, (data, _) in results.items():
            destination = output / name
            with tempfile.NamedTemporaryFile(dir=output, delete=False) as tmp:
                staged[destination] = Path(tmp.name)
                tmp.write(data)
            os.chmod(staged[destination], (fonts / name).stat().st_mode)
        for destination, tmp in staged.items():
            os.replace(tmp, destination)
    finally:
        for tmp in staged.values():
            if tmp.exists():
                tmp.unlink()

    for _, report in results.values():
        print(report)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("Usage : python3 subset_fonts.py <dossier des .fnt sources> "
                 "<dossier java> <dossier de sortie>")
    try:
        main(*map(Path, sys.argv[1:]))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
