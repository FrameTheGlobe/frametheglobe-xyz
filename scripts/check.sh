#!/usr/bin/env bash
# ============================================================
# FrameTheGlobe — dev debug checklist
# Run:  bash scripts/check.sh
# ============================================================
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0
ok()   { echo "  ✅  $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌  $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️   $1"; }

echo ""
echo "════════════════════════════════════════"
echo "  FrameTheGlobe — Debug Checklist"
echo "════════════════════════════════════════"
echo ""

# ── 1. TypeScript ────────────────────────────────────────────
echo "▸ TypeScript"
TS_OUT=$(npx tsc --noEmit 2>&1 || true)
if echo "$TS_OUT" | grep -q "error TS"; then
  fail "TypeScript errors found:"
  echo "$TS_OUT" | grep "error TS" | head -20
else
  ok "No TypeScript errors"
fi
echo ""

# ── 2. React: mixed border shorthand + individual sides ──────
echo "▸ React style conflicts (border shorthand + individual sides)"
# Find .tsx files where a single style block contains both 'border:' and 'borderLeft/Right/Top/Bottom:'
CONFLICTS=""
while IFS= read -r file; do
  # Use awk to find JSX style blocks that mix border: with borderXxx:
  if awk '
    /style=\{\{/ { in_style=1; has_border=0; has_individual=0 }
    in_style && /border:/ && !/border(Left|Right|Top|Bottom|Radius|Color|Width|Style)/ { has_border=1 }
    in_style && /border(Left|Right|Top|Bottom):/ { has_individual=1 }
    /\}\}/ && in_style {
      if (has_border && has_individual) { found=1 }
      in_style=0
    }
    END { exit (found ? 0 : 1) }
  ' "$file" 2>/dev/null; then
    CONFLICTS="$CONFLICTS $file"
  fi
done < <(find app -name "*.tsx" 2>/dev/null)

if [ -n "$CONFLICTS" ]; then
  fail "Possible border shorthand conflicts in:$CONFLICTS"
else
  ok "No border shorthand conflicts detected"
fi
echo ""

# ── 3. Missing dynamic ssr:false for browser-only libs ──────
echo "▸ Browser-only imports"
LEAFLET_DIRECT=$(grep -rn "import.*from.*leaflet\|require.*leaflet" --include="*.tsx" --include="*.ts" app 2>/dev/null || true)
if [ -n "$LEAFLET_DIRECT" ]; then
  fail "Direct Leaflet import (should use CDN):"
  echo "$LEAFLET_DIRECT"
else
  ok "No direct Leaflet imports"
fi
echo ""

# ── 4. Missing 'use client' on client components ────────────
echo "▸ Client components missing 'use client'"
MISSING=""
for f in app/components/*.tsx; do
  [ -f "$f" ] || continue
  if grep -qE "useState|useEffect|useRef|useCallback|useMemo" "$f" 2>/dev/null; then
    if ! head -1 "$f" | grep -q "'use client'"; then
      MISSING="$MISSING\n  $f"
    fi
  fi
done
if [ -n "$MISSING" ]; then
  fail "Missing 'use client' directive:"
  printf "$MISSING\n"
else
  ok "All hook-using components have 'use client'"
fi
echo ""

# ── 5. Duplicate source IDs ──────────────────────────────────
echo "▸ Duplicate source IDs in lib/sources.ts"
DUPE_IDS=$(grep -o "id: '[^']*'" lib/sources.ts 2>/dev/null | sort | uniq -d || true)
if [ -n "$DUPE_IDS" ]; then
  fail "Duplicate source IDs: $DUPE_IDS"
else
  ok "All source IDs are unique ($(grep -c "id: '" lib/sources.ts) sources)"
fi
echo ""

# ── 6. Required env vars ─────────────────────────────────────
echo "▸ Environment"
if [ -f ".env.local" ]; then
  ok ".env.local exists"
  if grep -q "your_api_key_here\|your_registered_email" .env.local 2>/dev/null; then
    warn "ACLED credentials are still placeholders — ACLED feed will be skipped"
  fi
else
  warn ".env.local not found — ACLED feed disabled (this is fine if you haven't set it up)"
fi
echo ""

# ── 7. Key files present ─────────────────────────────────────
echo "▸ Key files"
FILES=(
  "app/page.tsx"
  "app/layout.tsx"
  "app/globals.css"
  "app/components/MapView.tsx"
  "app/components/BreakingTicker.tsx"
  "app/components/TrendingKeywords.tsx"
  "app/components/VolumeChart.tsx"
  "app/api/news/route.ts"
  "app/api/flights/route.ts"
  "app/api/rss/route.ts"
  "app/api/stream/route.ts"
  "lib/sources.ts"
  "lib/fetcher.ts"
  "lib/flights.ts"
  "lib/news-store.ts"
  "lib/acled.ts"
  "public/manifest.json"
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    ok "$f"
  else
    fail "MISSING: $f"
  fi
done
echo ""

# ── 8. Source count ──────────────────────────────────────────
echo "▸ Source counts"
TOTAL=$(grep -c "id: '" lib/sources.ts 2>/dev/null || echo 0)
ok "$TOTAL total sources defined"
echo ""

# ── Summary ──────────────────────────────────────────────────
echo "════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅  All ${PASS} checks passed"
else
  echo "  Results: ${PASS} passed · ${FAIL} FAILED"
fi
echo "════════════════════════════════════════"
echo ""

exit $FAIL
