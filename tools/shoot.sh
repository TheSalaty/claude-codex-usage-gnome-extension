#!/bin/bash
# Starts a headless GNOME Shell on its own virtual monitor with a throwaway XDG home, enables
# only this extension, and hands the session to tools/screenshot.js.
#
#   dbus-run-session -- ./tools/shoot.sh --click 1300,12:menu
#
# The private XDG home matters twice over: the shell loads no other extension, so the indicator is
# easy to find, and `gnome-extensions enable` cannot touch the real desktop's dconf. $HOME is left
# alone so the collector still reads the real ~/.claude and ~/.codex.
#
# Screenshots land in /tmp/aiu-shots/.
set -u
UUID=ai-usage-monitor@thesalaty.github.io
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

# A fresh XDG home makes the shell think this is a first login, and its welcome dialog is modal —
# it would swallow the click meant for the panel.
gsettings set org.gnome.shell welcome-dialog-last-shown-version '99.0' 2>/dev/null || true

gnome-shell --headless --virtual-monitor "${AIU_MONITOR:-1400x1000}" >/tmp/aiu-shell.log 2>&1 &
SHELL_PID=$!
trap 'kill $SHELL_PID 2>/dev/null; wait $SHELL_PID 2>/dev/null' EXIT
sleep 12

gnome-extensions enable "$UUID" || echo "could not enable $UUID"
# The first collector run reads the whole transcript window; give it room to finish.
sleep 12

gjs -m "$HERE/screenshot.js" "$@"

echo "--- shell log (extension-relevant lines) ---"
grep -iE "JS ERROR|St-WARNING|$UUID" /tmp/aiu-shell.log | head -15
