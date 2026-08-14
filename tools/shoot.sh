#!/bin/bash
set -u
UUID=tripmeter@thesalaty.github.io
HERE=$(cd "$(dirname "$0")" && pwd)
SANDBOX=${AIU_SANDBOX:-/tmp/aiu-home}

rm -rf "$SANDBOX"
mkdir -p "$SANDBOX/config" "$SANDBOX/data/gnome-shell/extensions" "$SANDBOX/cache" "$SANDBOX/state"
cp -r "$HOME/.local/share/gnome-shell/extensions/$UUID" "$SANDBOX/data/gnome-shell/extensions/" || {
  echo "run 'make install' first"
  exit 1
}
export XDG_CONFIG_HOME="$SANDBOX/config"
export XDG_DATA_HOME="$SANDBOX/data"
export XDG_CACHE_HOME="$SANDBOX/cache"
export XDG_STATE_HOME="$SANDBOX/state"

gsettings set org.gnome.shell welcome-dialog-last-shown-version '99.0' 2>/dev/null || true

gnome-shell --headless --virtual-monitor "${AIU_MONITOR:-1400x1000}" >/tmp/aiu-shell.log 2>&1 &
SHELL_PID=$!
trap 'kill $SHELL_PID 2>/dev/null; wait $SHELL_PID 2>/dev/null' EXIT
sleep 12

gnome-extensions enable "$UUID" || echo "could not enable $UUID"
sleep 12

gjs -m "$HERE/screenshot.js" "$@"

echo "--- shell log (extension-relevant lines) ---"
grep -iE "JS ERROR|St-WARNING|$UUID" /tmp/aiu-shell.log | head -15
