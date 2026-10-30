#!/bin/sh
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
. "$DIR/common.sh"

NODE=$(node_bin || true)
if [ -z "$NODE" ]; then
  echo '{"ok":false,"error":"Node ontbreekt op deze tv."}'
  exit 1
fi

exec "$NODE" "$DIR/status.js"
