#!/usr/bin/env bash
set -euo pipefail

# General linker: creates symbolic links in public/models for every folder
# inside the source Live directory (default points to your Nextcloud Live).
# Usage:
#   ./scripts/link-models.sh                # uses default Nextcloud Live path
#   ./scripts/link-models.sh "/path/to/source"

SRC_BASE="${1:-/Users/victorhanert/Nextcloud/Kunder/Muuto/Production/2025-12-18 FROM LIVE}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$REPO_ROOT/public/models"

mkdir -p "$DEST_DIR"

shopt -s nullglob
dirs=("$SRC_BASE"/*)
found=false

for entry in "${dirs[@]}"; do
  if [ -d "$entry" ]; then
    found=true
    name="$(basename "$entry")"
    src="$entry"
    dest="$DEST_DIR/$name"

    # Remove existing file/symlink/dir at destination
    if [ -L "$dest" ] || [ -e "$dest" ]; then
      rm -rf "$dest"
    fi

    ln -s "$src" "$dest"
    echo "Linked: $dest -> $src"
  fi
done

if [ "$found" = false ]; then
  echo "No directories found in source: $SRC_BASE"
  echo "Make sure the path is correct or supply a different path as first argument."
else
  echo "Done. Verify with: ls -la \"$DEST_DIR\""
fi

exit 0
