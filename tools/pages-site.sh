#!/usr/bin/env bash
# Builds the GitHub Pages site into the given directory: the checked-out commit
# (main) at the root, and every open pull request labelled "spielgefuehl" as a
# preview under pr/<number>/. Each copy gets its own service worker block from
# the generator of *this* checkout, so no code from a pull request runs here.
#
# Needs: git with access to origin, node, and gh with GH_TOKEN (for the list
# of pull requests). Without gh, or outside a repository with pull requests,
# only the root copy is built.
#
# Usage: tools/pages-site.sh <output directory>

set -euo pipefail

out=${1:?usage: tools/pages-site.sh <output directory>}
label=${PREVIEW_LABEL:-spielgefuehl}
here=$(cd "$(dirname "$0")/.." && pwd)
generator="$here/tests/tools/make-precache.mjs"

rm -rf "$out"
mkdir -p "$out"

# The root: what is checked out, byte for byte as git knows it.
git -C "$here" archive --format=tar HEAD | tar -x -C "$out"
node "$generator" --root "$out"
echo "root: $(git -C "$here" rev-parse --short HEAD)"

# Previews: only pull requests from branches of this repository. A fork could
# carry anything, and its code is not what the preview is for.
previews=""
if command -v gh > /dev/null && [ -n "${GH_TOKEN:-}" ]; then
  previews=$(gh pr list --state open --label "$label" --json number,isCrossRepository \
    --jq '.[] | select(.isCrossRepository | not) | .number')
fi

for number in $previews; do
  git -C "$here" fetch --quiet origin "pull/$number/head"
  sha=$(git -C "$here" rev-parse --short FETCH_HEAD)
  mkdir -p "$out/pr/$number"
  git -C "$here" archive --format=tar FETCH_HEAD | tar -x -C "$out/pr/$number"
  node "$generator" --root "$out/pr/$number"
  echo "pr/$number: $sha"
done

# Not needed for a deployment from an artifact, but harmless, and it keeps the
# site identical to what the branch deployment served.
touch "$out/.nojekyll"
