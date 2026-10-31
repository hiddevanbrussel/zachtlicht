#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"

src=$(mount_source)
if [ -n "$src" ]; then
  clear_mount || {
    echo "[-] Loskoppelen mislukt: $src" >&2
    exit 1
  }
fi

rm -f "$LINK"
echo "[+] LG-screensaver teruggezet." >&2
exit 0
