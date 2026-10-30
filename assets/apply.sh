#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"
QML="$DIR/screensaver-main.qml"

if [ ! -f "$MOUNT_TARGET" ]; then
  echo "[-] Geen QML-screensaver op deze tv. Zachtlicht werkt op webOS 5 tot en met 23." >&2
  exit 1
fi

src=$(mount_source)
if [ -n "$src" ] && ! is_ours "$src"; then
  echo "[-] Er staat al een andere screensaver op dit bestand: $src" >&2
  echo "[-] Zet die eerst uit. Zachtlicht is niet toegepast." >&2
  exit 2
fi

mkdir -p "$DATA" || {
  echo "[-] Map voor instellingen aanmaken mislukt." >&2
  exit 1
}

if [ ! -s "$DATA/settings.json" ]; then
  printf '%s\n' '{"met":true,"artic":true,"rijks":false,"rijksKey":"","imageSize":640,"veil":0.45,"durationSec":90}' > "$DATA/settings.json" || {
    echo "[-] Instellingen wegschrijven mislukt." >&2
    exit 1
  }
fi

if [ -z "$src" ]; then
  mount --bind "$QML" "$MOUNT_TARGET" || {
    echo "[-] Mount mislukt." >&2
    exit 1
  }
  echo "[+] Zachtlicht is ingeschakeld." >&2
else
  echo "[~] Zachtlicht stond al aan." >&2
fi

NODE=$(node_bin || true)
if [ -z "$NODE" ]; then
  echo "[-] Node ontbreekt. De bestaande collectie blijft staan." >&2
  exit 0
fi

"$NODE" "$DIR/refresh-playlist.js" || echo "[-] Collectie niet ververst. De bestaande lijst blijft in gebruik." >&2
exit 0
