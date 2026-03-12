#!/bin/bash
# =============================================================================
# 3K Codestyle Extension — Release Script
#
# Usage:  npm run release
#
# This script:
#   1. Reads the version from package.json
#   2. Compiles TypeScript
#   3. Packages the .vsix
#   4. Installs the extension locally
#   5. Commits all staged + unstaged changes
#   6. Pushes to GitHub
#   7. Creates a GitHub Release with the .vsix attached
#
# Prerequisites:
#   - gh CLI installed and authenticated (gh auth login)
#   - Git configured with push access to the repo
# =============================================================================

set -e

# Ensure we're in the project root
cd "$(dirname "$0")/.."

# Add gh to PATH if needed (Windows default install location)
if ! command -v gh &> /dev/null; then
  export PATH="$PATH:/c/Program Files/GitHub CLI"
fi

# 1. Read version from package.json
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"
VSIX="3k-codestyle-${VERSION}.vsix"

echo ""
echo "========================================="
echo "  3K Codestyle Release — ${TAG}"
echo "========================================="
echo ""

# 2. Check if this tag already exists on the remote
if gh release view "$TAG" &> /dev/null; then
  echo "ERROR: Release ${TAG} already exists on GitHub."
  echo "Bump the version in package.json first."
  exit 1
fi

# 3. Compile TypeScript
echo "[1/7] Compiling TypeScript..."
npx tsc -p ./
echo "  ✓ Compiled"

# 4. Package .vsix
echo "[2/7] Packaging .vsix..."
npx @vscode/vsce package --allow-missing-repository > /dev/null 2>&1
if [ ! -f "$VSIX" ]; then
  echo "ERROR: Expected ${VSIX} not found after packaging."
  exit 1
fi
echo "  ✓ Packaged: ${VSIX}"

# 5. Install locally
echo "[3/7] Installing extension locally..."
code --install-extension "$VSIX" --force > /dev/null 2>&1
echo "  ✓ Installed in VS Code"

# 6. Stage and commit
echo "[4/7] Committing changes..."
git add -A
if git diff --cached --quiet; then
  echo "  ℹ No changes to commit (already up to date)"
else
  git commit -m "Release ${TAG}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
  echo "  ✓ Committed"
fi

# 7. Push to GitHub
echo "[5/7] Pushing to GitHub..."
git push origin main
echo "  ✓ Pushed"

# 8. Extract changelog for this version (between this version header and the next)
echo "[6/7] Extracting changelog..."
NOTES=$(awk "/^## ${VERSION//./\\.}/{found=1; next} /^## [0-9]/{if(found) exit} found{print}" CHANGELOG.md)
if [ -z "$NOTES" ]; then
  NOTES="Release ${TAG}"
fi

# Append install instructions
NOTES="${NOTES}

### Installation
1. Download \`${VSIX}\` below
2. In VS Code: Extensions sidebar → \`...\` menu → **Install from VSIX...**
3. Select the downloaded \`.vsix\` file
4. Reload VS Code"

# 9. Create GitHub Release
echo "[7/7] Creating GitHub Release..."
gh release create "$TAG" "./${VSIX}" --title "${TAG}" --notes "$NOTES"

echo ""
echo "========================================="
echo "  ✓ Release ${TAG} complete!"
echo "========================================="
echo ""

# Clean up old .vsix files (keep only current)
find . -maxdepth 1 -name "3k-codestyle-*.vsix" ! -name "$VSIX" -delete 2>/dev/null || true
