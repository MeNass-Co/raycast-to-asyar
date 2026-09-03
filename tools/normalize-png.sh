#!/bin/bash
# normalize-png.sh <dir>: rewrite every PNG under <dir> through sips with an sRGB profile. WKWebView in the
# Asyar launcher renders <img> from asyar-extension:// only when the PNG carries colour metadata
# (gamma/sRGB/ICC); bare RGBA PNGs (most Raycast store icons) render as an empty box.
find "$1" -type f -iname "*.png" -print0 | while IFS= read -r -d '' f; do
  /usr/bin/sips -s format png --matchTo '/System/Library/ColorSync/Profiles/sRGB Profile.icc' "$f" --out "$f.tmp" >/dev/null 2>&1 && mv -f "$f.tmp" "$f" || rm -f "$f.tmp"
done
