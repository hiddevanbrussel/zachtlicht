#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"

NODE=$(node_bin || true)
if [ -z "$NODE" ]; then
  echo "[-] Node ontbreekt op deze tv." >&2
  exit 1
fi

exec "$NODE" "$DIR/save-settings.js" "$@"
