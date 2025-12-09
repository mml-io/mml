#!/bin/bash

# Check if we're running from the project root
if [ ! -f "package.json" ] || [ ! -d "scripts" ]; then
  echo "Error: you must execute this script from the project's root directory:"
  echo "./scripts/$(basename "$0")"
  exit 1
fi

# Parse arguments
DRY_RUN=false
for arg in "$@"; do
  case $arg in
    --dry-run|-d)
      DRY_RUN=true
      ;;
    --help|-h)
      echo "Usage: ./scripts/$(basename "$0") [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dry-run, -d    Show what would be updated without making changes"
      echo "  --help, -h       Show this help message"
      exit 0
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo "=== DRY RUN MODE - No changes will be made ==="
  echo ""
fi

echo "Collecting workspace package names..."

# Collect all internal package names from workspace package.json files
INTERNAL_PACKAGES=()

# Scan packages/, examples/, and apps/ directories for package.json files
for dir in packages examples apps; do
  if [ -d "$dir" ]; then
    for pkg_json in "$dir"/*/package.json; do
      if [ -f "$pkg_json" ]; then
        # Extract the "name" field from package.json
        pkg_name=$(grep -m1 '"name"' "$pkg_json" | sed 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        if [ -n "$pkg_name" ]; then
          INTERNAL_PACKAGES+=("$pkg_name")
        fi
      fi
    done
  fi
done

# Build the reject pattern (comma-separated list)
REJECT_PATTERN=$(IFS=,; echo "${INTERNAL_PACKAGES[*]}")

echo "Found ${#INTERNAL_PACKAGES[@]} internal packages to exclude:"
for pkg in "${INTERNAL_PACKAGES[@]}"; do
  echo "  - $pkg"
done
echo ""

# Function to update dependencies in a directory
update_deps() {
  local dir=$1
  local pkg_json="$dir/package.json"

  if [ -f "$pkg_json" ]; then
    echo "Updating dependencies in: $dir"
    if [ "$DRY_RUN" = true ]; then
      (cd "$dir" && npx npm-check-updates --reject "$REJECT_PATTERN" 2>/dev/null) || true
    else
      (cd "$dir" && npx npm-check-updates -u --reject "$REJECT_PATTERN" 2>/dev/null) || true
    fi
    echo ""
  fi
}

# Update root package.json
echo "=== Updating root package.json ==="
if [ "$DRY_RUN" = true ]; then
  npx npm-check-updates --reject "$REJECT_PATTERN" 2>/dev/null || true
else
  npx npm-check-updates -u --reject "$REJECT_PATTERN" 2>/dev/null || true
fi
echo ""

# Update packages
echo "=== Updating packages ==="
if [ -d "packages" ]; then
  for dir in packages/*/; do
    update_deps "$dir"
  done
fi

# Update examples
echo "=== Updating examples ==="
if [ -d "examples" ]; then
  for dir in examples/*/; do
    update_deps "$dir"
  done
fi

# Update apps (for future use)
echo "=== Updating apps ==="
if [ -d "apps" ]; then
  for dir in apps/*/; do
    update_deps "$dir"
  done
fi

# Update other top-level directories that may have package.json
for dir in e2e-tests integration-tests github-pages-publisher; do
  if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
    echo "=== Updating $dir ==="
    update_deps "$dir"
  fi
done

echo "=== Done! ==="
echo ""
if [ "$DRY_RUN" = true ]; then
  echo "This was a dry run. To apply changes, run without --dry-run flag."
else
  echo "Next steps:"
  echo "  1. Run 'npm install' to update package-lock.json"
  echo "  2. Run 'npm run iterate' to verify everything builds"
  echo "  3. Test your application to catch any breaking changes"
fi
