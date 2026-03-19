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
echo "🟢  Using Node.js version: $(node -v)"

# ── Install dependencies (skipping devDeps for speed/space) ───
echo "📦  Installing production dependencies..."
npm install --omit=dev

# ── Build the Next.js app ─────────────────────────────────────
echo "🔨  Building Next.js application..."
# Memory limit set to 1GB to prevent OOM on Hostinger shared servers
NODE_OPTIONS='--max-old-space-size=1024' npm run build

# ── Restart the server ────────────────────────────────────────
echo "🔄  Restarting application..."
if command -v pm2 &> /dev/null; then
  # If PM2 is already running, restart; else start
  pm2 restart all || pm2 start npm --name "frametheglobe" -- start
else
  # Fallback for some non-PM2 setups: touch restart file
  mkdir -p tmp
  touch tmp/restart.txt
  echo "⚠️  PM2 not found. Triggered restart via tmp/restart.txt."
fi

echo ""
echo "════════════════════════════════════════"
echo "  🚀  Deployment finished successfully!"
echo "  🌐  https://frametheglobe.xyz"
echo "════════════════════════════════════════"
