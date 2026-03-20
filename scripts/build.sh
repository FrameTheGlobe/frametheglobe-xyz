#!/bin/bash
# FrameTheGlobe — Hostinger build script
# Called by: npm run build
# =====================================================
# Hostinger App Hosting starts new next-server processes
# on deploy but NEVER kills old ones. Old processes keep
# their stale in-memory manifests, serve HTML referencing
# deleted chunk hashes, and cause /_next/static/ 404s.
#
# This script:
#   1. Builds Next.js (exits non-zero on failure — safe)
#   2. Touches tmp/restart.txt (Passenger signal)
#   3. Force-kills ALL next-server processes so the next
#      request always boots a fresh one with current .next/
# =====================================================

set -e  # abort on any error before the kill step

echo "🔨 Building Next.js..."
NEXT_CPU_COUNT=1 NODE_OPTIONS='--max-old-space-size=2048' npx next build --webpack

echo "🔄 Signalling Passenger restart..."
mkdir -p tmp
touch tmp/restart.txt

echo "🔪 Killing stale next-server processes..."
# pkill returns 1 if no matching process — that's fine, use || true
pkill -f next-server 2>/dev/null || true

echo "✅ Build done. Stale processes killed. Next request boots fresh."
