DATA=/var/lib/webosbrew/zachtlicht
MOUNT_TARGET=/usr/palm/applications/com.webos.app.screensaver/qml/main.qml
LINK=/var/lib/webosbrew/init.d/50-zachtlicht

node_bin() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  if [ -x /usr/bin/node ]; then
    echo /usr/bin/node
    return 0
  fi
  return 1
}

# Exact bind on MOUNT_TARGET only. findmnt --target would report the parent
# filesystem (often "overlay") even when nothing is bound over the QML file.
mount_source() {
  _src=""
  if [ -r /proc/self/mountinfo ]; then
    _src=$(awk -v t="$MOUNT_TARGET" '
      {
        root = $4
        mp = $5
        gsub(/\\040/, " ", root)
        gsub(/\\040/, " ", mp)
        if (mp == t) last = root
      }
      END {
        if (last != "") print last
      }
    ' /proc/self/mountinfo 2>/dev/null || true)
  fi
  if [ -z "$_src" ] && [ -r /proc/mounts ]; then
    _src=$(awk -v t="$MOUNT_TARGET" '
      $2 == t {
        src = $1
        gsub(/\\040/, " ", src)
        print src
        exit
      }
    ' /proc/mounts 2>/dev/null || true)
  fi
  printf '%s' "$_src"
}

is_ours() {
  case "$1" in
    */org.local.zachtlicht/assets/screensaver-main.qml) return 0 ;;
    *) return 1 ;;
  esac
}
