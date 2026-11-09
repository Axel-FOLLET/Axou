#!/usr/bin/env bash
# Installs what tools/render_music.py needs for the boss music, in tools/.audio-env (not tracked):
# a Python environment with tinysoundfont and the Fluid R3 GM instrument bank (MIT licence, 148 MB).
# Requires python3 with venv, curl and dpkg-deb (Debian or Ubuntu). Run from anywhere; safe to run twice.
set -euo pipefail

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$TOOLS_DIR/.audio-env"
BANK="$ENV_DIR/FluidR3_GM.sf2"
BANK_URL="https://deb.debian.org/debian/pool/main/f/fluid-soundfont/fluid-soundfont-gm_3.1-5.3_all.deb"

python3 -m venv "$ENV_DIR"
# --no-deps: the module's audio playback dependency is not used, only offline rendering.
"$ENV_DIR/bin/pip" install --quiet --no-deps tinysoundfont==0.3.7

if [ ! -f "$BANK" ]; then
  WORK="$(mktemp -d)"
  trap 'rm -rf "$WORK"' EXIT
  curl --fail --location --silent --show-error --output "$WORK/bank.deb" "$BANK_URL"
  dpkg-deb -x "$WORK/bank.deb" "$WORK/extracted"
  cp "$WORK/extracted/usr/share/sounds/sf2/FluidR3_GM.sf2" "$BANK"
fi

"$ENV_DIR/bin/python3" -c "import tinysoundfont; print('tinysoundfont ready')"
echo "Instrument bank: $BANK"
