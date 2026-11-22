#!/bin/sh
# Removes Notes. Your notes stay in ~/.local/share/Notes unless you answer YES.
rm -rf "$HOME/.local/share/notes-app" "$HOME/.local/share/applications/notes-app.desktop" "$HOME/.local/share/icons/notes-app.png"
printf "Also delete all your notes and pictures? Type YES to delete, anything else keeps them: "
read ans
[ "$ans" = "YES" ] && rm -rf "$HOME/.local/share/Notes"
echo "Notes removed."
