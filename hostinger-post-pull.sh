#!/bin/bash
# FrameTheGlobe — Hostinger Post-Pull Deployment Script (Automated via Git)
# =============================================================
# Usage:
# 1. Push this file to GitHub.
# 2. In Hostinger hPanel > Advanced > Git:
#    - Add your GitHub repo URL.
#    - Set your main branch.
#    - Webhook: Enabled (copy the URL to GitHub).
#    - Deployment Script: "bash ./hostinger-post-pull.sh"
# =============================================================

set -e

# ── Force Node.js 20 on Hostinger ────────────────────────────
export PATH=/opt/alt/alt-nodejs20/root/usr/bin:$PATH
export NEXT_CPU_COUNT=1
echo "🟢  Using Node.js version: $(node -v)"

# ── Install dependencies (skipping devDeps for speed/space) ───
echo "📦  Installing production dependencies..."
npm install --omit=dev

# ── Clear cache and build ──────────────────────────────────────
echo "🔨  Cleaning and Building Next.js application..."
# Remove old build and cache to prevent stale asset issues
rm -rf .next
# Build with memory limit 
NODE_OPTIONS='--max-old-space-size=1024' npm run build

# ── Restart the server ────────────────────────────────────────
echo "🔄  Restarting application..."

# Create /tmp directory if it doesn't exist (used for Passenger restart)
mkdir -p tmp
touch tmp/restart.txt

if command -v pm2 &> /dev/null; then
  # If PM2 is already running, restart; else start
  pm2 restart all || pm2 start npm --name "frametheglobe" -- start
fi

echo "✅  Restart signal sent (tmp/restart.txt updated)."

echo ""
echo "════════════════════════════════════════"
echo "  🚀  Deployment finished successfully!"
echo "  🌐  https://frametheglobe.xyz"
echo "════════════════════════════════════════"
