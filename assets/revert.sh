#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"

src=$(mount_source)
if [ -n "$src" ] && ! is_ours "$src"; then
  rm -f "$LINK"
  echo "[-] Een andere screensaver blijft staan: $src" >&2
  echo "[+] Het opstart-script van Zachtlicht is weggehaald." >&2
  exit 2
fi

if [ -n "$src" ]; then
  umount "$MOUNT_TARGET" || {
    echo "[-] Loskoppelen mislukt." >&2
    exit 1
  }
fi

rm -f "$LINK"
echo "[+] LG-screensaver teruggezet." >&2
exit 0
