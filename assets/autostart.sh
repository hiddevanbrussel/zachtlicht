#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"

if [ "$1" = "on" ]; then
  sh "$DIR/apply.sh" || exit $?
  mkdir -p /var/lib/webosbrew/init.d || {
    echo "[-] Opstartmap aanmaken mislukt." >&2
    exit 1
  }
  cat > "$LINK" <<EOF
#!/bin/sh
APP="$DIR/apply.sh"
if [ ! -f "\$APP" ]; then
  exit 0
fi
exec sh "\$APP"
EOF
  chmod +x "$LINK" || {
    echo "[-] Opstart-script kon niet uitvoerbaar worden gemaakt." >&2
    exit 1
  }
  echo "[+] Autostart aan." >&2
  exit 0
fi

if [ "$1" = "off" ]; then
  rm -f "$LINK"
  echo "[+] Autostart uit. Zachtlicht blijft aan tot Ongedaan maken of een herstart." >&2
  exit 0
fi

echo "[-] Ongeldige autostart-actie." >&2
exit 1
