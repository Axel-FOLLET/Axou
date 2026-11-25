"""Recompress the PNGs in the prepared web asset directory."""
import sys
from pathlib import Path
from shutil import copymode
from tempfile import NamedTemporaryFile

import pngio


def optimize(path):
    original = pngio.read(path)
    with NamedTemporaryFile(dir=path.parent, suffix=".tmp", delete=False) as temp:
        candidate = Path(temp.name)
    try:
        pngio.write(candidate, *original)
        if pngio.read(candidate) != original:
            raise ValueError(f"{path}: PNG dimensions or RGBA pixels changed")
        saved = path.stat().st_size - candidate.stat().st_size
        if saved > 0:
            copymode(path, candidate)
            candidate.replace(path)
            return saved
        return 0
    finally:
        candidate.unlink(missing_ok=True)


def main(directory):
    directory = directory.resolve()
    assets = Path(__file__).resolve().parents[2] / "assets"
    if directory == assets or assets in directory.parents or directory in assets.parents:
        raise ValueError(f"Expected a staging directory outside the source assets: {directory}")
    if not directory.is_dir():
        raise ValueError(f"Missing staged assets: {directory}")
    saved = sum(optimize(path) for path in sorted(directory.rglob("*.png"))
                if path.relative_to(directory).parts[0] != "cinematics")
    print(f"Staged PNGs: saved {saved} bytes")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
