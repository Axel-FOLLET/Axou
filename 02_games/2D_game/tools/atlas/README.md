# Sprite atlas

From the game directory run `python3 tools/atlas/build_atlas.py`.
Keep the source PNGs in assets. Frame zero is the catalogue path, followed by
sibling files named `stem-1.png`, `stem-2.png` and so on up to the first gap.
Add entries to your LOT_A, LOT_B, LOT_C or LOT_D list in SpriteCatalog.
Tile animations use `tile_<tsx basename>_<local id>`. Cinematics load separately.
The packer places tall sprites first and prefers shelves on pages that share
their colors. Each power-of-two page fits within 2048 x 2048 and uses at most
256 RGBA colors. A source with more colors stops the build. The packer copies the outer
rows, columns and corners of each region one pixel into the two-pixel gap,
stopping at the page boundary. Filtering near an edge samples its color.
Nine-patch splits stay inside the original region. After decoding each page,
the packer compares every region with its source and every extruded pixel
with its nearest region pixel, including alpha.

Identical RGBA arrays with equal dimensions share bounds, including their
extruded pixels. The packer tries power-of-two shelf widths and minimizes
page count, then allocated area. Atlas metadata retains animation indices
and nine-patch splits. Each line of loose.txt names a single-frame key and
its original asset path. Gradle stages that path for the canvas fallback.

The web build packs the atlas, stages the assets and optimizes the PNGs in
`teavm/build/webassets` before generating JavaScript. It skips cinematics.
The encoder tests adaptive row filters and, for palettes, an unfiltered stream
at zlib level 9. Only a smaller file with identical decoded pixels replaces
the staged copy. Tiled images remain available at their original paths.

For the size comparison, build the original revision and this revision from clean
web output directories with the same Gradle command and release settings. On each
build, run the following from the game directory and compare the total file bytes.

    python3 -c "from pathlib import Path; print(sum(f.stat().st_size for f in Path('teavm/build/dist/js').rglob('*') if f.is_file()))"

For the site limit, overlay each build onto a separate copy of the same site
without deleting old files. Compare the total bytes after each overlay.
