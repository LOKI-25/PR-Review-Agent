#!/usr/bin/env bash
# Package Lambdas for AWS deployment.
#
# Creates:
#   dist/layer/pr-review-gemini-layer.zip  — attach to AI Lambdas (Gemini deps)
#   dist/lambdas/<name>.zip                — slim handler + shared code only
#
# Usage: ./scripts/package_lambdas.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
DIST="$ROOT/dist/lambdas"
LAYER_DIST="$ROOT/dist/layer"
SHARED="$BACKEND/shared"
# Must match your Lambda runtime (e.g. 3.12, 3.13, 3.14)
PYTHON_VERSION="${PYTHON_VERSION:-3.14}"

LAMBDAS=(
  trigger
  fetch_pr
  security_agent
  quality_agent
  logic_agent
  summarizer
  post_comment
  approval
  callback
)

# Lambdas that need the Gemini layer attached in AWS Console
GEMINI_LAMBDAS=(
  security_agent
  quality_agent
  logic_agent
  summarizer
)

strip_bloat() {
  local dir="$1"
  find "$dir" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
  find "$dir" -type d -name tests -exec rm -rf {} + 2>/dev/null || true
  find "$dir" -type d -name test -exec rm -rf {} + 2>/dev/null || true
  find "$dir" -name "*.pyc" -delete 2>/dev/null || true
}

echo "=== Building Gemini dependency layer ==="
rm -rf "$LAYER_DIST" "$DIST"
mkdir -p "$LAYER_DIST" "$DIST"

LAYER_BUILD=$(mktemp -d)
# Install to both paths so Lambda finds packages regardless of runtime minor version
LAYER_SITE="$LAYER_BUILD/python/lib/python${PYTHON_VERSION}/site-packages"
mkdir -p "$LAYER_SITE"

pip install -q google-generativeai>=0.8.0 \
  -t "$LAYER_SITE" \
  --platform manylinux2014_x86_64 \
  --python-version "$PYTHON_VERSION" \
  --implementation cp \
  --only-binary=:all: \
  --upgrade \
  --no-cache-dir

# No duplicate copy — keeps layer under 50 MB for console upload

strip_bloat "$LAYER_BUILD"
(cd "$LAYER_BUILD" && zip -qr "$LAYER_DIST/pr-review-gemini-layer.zip" python)
rm -rf "$LAYER_BUILD"
echo "  -> $LAYER_DIST/pr-review-gemini-layer.zip ($(du -h "$LAYER_DIST/pr-review-gemini-layer.zip" | cut -f1))"

echo ""
echo "=== Building slim Lambda zips (handler + shared only) ==="
for name in "${LAMBDAS[@]}"; do
  BUILD_DIR=$(mktemp -d)
  cp -r "$SHARED" "$BUILD_DIR/shared"
  cp "$BACKEND/lambdas/$name/handler.py" "$BUILD_DIR/"
  (cd "$BUILD_DIR" && zip -qr "$DIST/$name.zip" .)
  rm -rf "$BUILD_DIR"

  size=$(du -h "$DIST/$name.zip" | cut -f1)
  layer_note=""
  for g in "${GEMINI_LAMBDAS[@]}"; do
    if [ "$g" = "$name" ]; then
      layer_note=" (attach Gemini layer in AWS)"
      break
    fi
  done
  echo "  -> $DIST/$name.zip ($size)$layer_note"
done

echo ""
echo "Done."
echo ""
echo "Next steps in AWS Console:"
echo "  1. Lambda → Layers → Create version → upload dist/layer/pr-review-gemini-layer.zip"
echo "     Compatible runtimes: Python ${PYTHON_VERSION} | Architecture: x86_64"
echo "  2. Attach that layer to: security-agent, quality-agent, logic-agent, summarizer"
echo "  3. Upload slim zips from dist/lambdas/ to each Lambda (all under 1 MB)"
