"""Read and write non-interlaced PNGs as (width, height, row-major RGBA tuples)."""
import struct
import zlib
from pathlib import Path

SIGNATURE = b"\x89PNG\r\n\x1a\n"


def paeth(a, b, c):
    p = a + b - c
    distances = (abs(p - a), abs(p - b), abs(p - c))
    return (a, b, c)[distances.index(min(distances))]


def read(path):
    data = Path(path).read_bytes()
    if not data.startswith(SIGNATURE):
        raise ValueError(f"{path}: invalid PNG signature")
    pos = 8
    compressed = bytearray()
    palette = transparency = b""
    while pos < len(data):
        size, kind = struct.unpack_from(">I4s", data, pos)
        chunk = data[pos + 8:pos + 8 + size]
        pos += 12 + size
        if kind == b"IHDR":
            w, h, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", chunk)
        elif kind == b"IDAT":
            compressed.extend(chunk)
        elif kind == b"PLTE":
            palette = chunk
        elif kind == b"tRNS":
            transparency = chunk
        elif kind == b"IEND":
            break
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color)
    if not channels or compression or filtering or interlace or not (
            depth == 8 or color == 3 and depth in (1, 2, 4)):
        raise ValueError(f"{path}: unsupported PNG format (type {color}, depth {depth}, interlace {interlace})")
    stride = (w * channels * depth + 7) // 8
    step = max(1, channels * depth // 8)
    raw = zlib.decompress(compressed)
    if len(raw) != (stride + 1) * h:
        raise ValueError(f"{path}: invalid scanline length")
    transparent = (struct.unpack(">H" if color == 0 else ">HHH", transparency)
                   if transparency and color in (0, 2) else ())
    if color == 3:
        entries = [(*palette[i:i + 3], transparency[i // 3] if i // 3 < len(transparency) else 255)
                   for i in range(0, len(palette), 3)]
    previous = bytearray(stride)
    pixels = []
    for y in range(h):
        start = y * (stride + 1)
        mode = raw[start]
        if mode > 4:
            raise ValueError(f"{path}: invalid row filter {mode}")
        row = bytearray(raw[start + 1:start + 1 + stride])
        for i in range(stride):
            left = row[i - step] if i >= step else 0
            up = previous[i]
            if mode == 1:
                row[i] = (row[i] + left) & 255
            elif mode == 2:
                row[i] = (row[i] + up) & 255
            elif mode == 3:
                row[i] = (row[i] + (left + up) // 2) & 255
            elif mode == 4:
                corner = previous[i - step] if i >= step else 0
                row[i] = (row[i] + paeth(left, up, corner)) & 255
        if color == 3 and depth == 8:
            pixels.extend(map(entries.__getitem__, row))
            previous = row
            continue
        for x in range(w):
            if color == 3:
                bit = x * depth
                index = (row[bit // 8] >> (8 - depth - bit % 8)) & ((1 << depth) - 1)
                pixels.append(entries[index])
            else:
                samples = tuple(row[x * channels:(x + 1) * channels])
                rgb = (samples[0],) * 3 if color in (0, 4) else samples[:3]
                alpha = samples[-1] if color in (4, 6) else (0 if samples == transparent else 255)
                pixels.append(rgb + (alpha,))
        previous = row
    return w, h, pixels


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


# PNG scores each filter byte as a signed residual.
COST = bytes(min(i, 256 - i) for i in range(256))


def filtered_row(row, previous, step):
    left = bytes(step) + row[:-step]
    corner = bytes(step) + previous[:-step]
    candidates = (
        row,
        bytes((v - a) & 255 for v, a in zip(row, left)),
        bytes((v - b) & 255 for v, b in zip(row, previous)),
        bytes((v - ((a + b) // 2)) & 255 for v, a, b in zip(row, left, previous)),
        bytes((v - paeth(a, b, c)) & 255 for v, a, b, c in zip(row, left, previous, corner)),
    )
    mode = min(range(5), key=lambda i: sum(candidates[i].translate(COST)))
    return bytes([mode]) + candidates[mode]


def write(path, w, h, px):
    if len(px) != w * h or min(w, h) < 1:
        raise ValueError("Pixel count does not match PNG dimensions")
    colors = {}
    for pixel in px:
        rgba = tuple(pixel) if len(pixel) == 4 else (*pixel, 255)
        colors.setdefault(rgba, len(colors))
        if len(colors) > 256:
            break
    indexed = len(colors) <= 256
    extra = b""
    if indexed:
        extra = chunk(b"PLTE", bytes(c for rgba in colors for c in rgba[:3]))
        alpha = bytes(rgba[3] for rgba in colors).rstrip(b"\xff")
        if alpha:
            extra += chunk(b"tRNS", alpha)
    step = 1 if indexed else 4
    previous = bytes(w * step)
    adaptive = bytearray()
    plain = bytearray()
    for y in range(h):
        row = bytearray()
        for pixel in px[y * w:(y + 1) * w]:
            rgba = tuple(pixel) if len(pixel) == 4 else (*pixel, 255)
            if indexed:
                row.append(colors[rgba])
            else:
                row.extend(rgba)
        adaptive.extend(filtered_row(row, previous, step))
        if indexed:
            plain.append(0)
            plain.extend(row)
        previous = row
    compressed = zlib.compress(adaptive, 9)
    if indexed:
        compressed = min(compressed, zlib.compress(plain, 9), key=len)
    header = struct.pack(">IIBBBBB", w, h, 8, 3 if indexed else 6, 0, 0, 0)
    Path(path).write_bytes(SIGNATURE + chunk(b"IHDR", header) + extra +
                           chunk(b"IDAT", compressed) + chunk(b"IEND", b""))
