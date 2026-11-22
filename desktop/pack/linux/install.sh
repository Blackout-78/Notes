#!/bin/sh
# Installs Notes for this user only. Needs the package libxcb-cursor0 (Ubuntu/Debian/Mint).
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/notes-app"
rm -rf "$DEST"; mkdir -p "$DEST" "$HOME/.local/share/applications" "$HOME/.local/share/icons"
cp -r "$SRC"/. "$DEST"/
cp "$SRC/notes.png" "$HOME/.local/share/icons/notes-app.png"
cat > "$HOME/.local/share/applications/notes-app.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Notes
Comment=Private offline notes
Exec=$DEST/Notes
Icon=$HOME/.local/share/icons/notes-app.png
Terminal=false
Categories=Utility;
DESK
echo "Notes installed. Find it in your app menu."
