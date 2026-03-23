'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

type OHLCPoint = { t: string; o: number; h: number; l: number; c: number };
type Series    = { symbol: string; name: string; color: string; points: OHLCPoint[] };
type HistoryPayload = { range: string; series: Series[]; cached?: boolean };
type RangeKey  = '1d' | '7d';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt2(n: number) { return n.toFixed(2); }
function pctDiff(first: number, last: number) {
  if (!first) return 0;
  return ((last - first) / first) * 100;
}
function timeLabel(iso: string, range: RangeKey) {
  const d = new Date(iso);
  if (range === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── SVG line chart ─────────────────────────────────────────────────────────

const PAD = { top: 14, right: 16, bottom: 30, left: 54 };

function LineChart({ series, range, width, height }: {
  series: Series[]; range: RangeKey; width: number; height: number;
}) {
  const [hover, setHover] = useState<{ x: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = width  - PAD.left - PAD.right;
  const H = height - PAD.top  - PAD.bottom;

  // Collect all closes across all series
  const allPts = series.flatMap(s => s.points.map(p => p.c)).filter(Boolean);
  if (!allPts.length) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)' }}>
      No price data available for this range
    </div>
  );

  const minVal = Math.min(...allPts);
  const maxVal = Math.max(...allPts);
  const range_ = maxVal - minVal || 1;
  const pad    = range_ * 0.08;

  const yMin = minVal - pad;
  const yMax = maxVal + pad;

  // Use the longest series for X axis
  const primary = [...series].sort((a, b) => b.points.length - a.points.length)[0];
  const nPts    = primary?.points.length ?? 0;
  if (!nPts) return null;

  const xScale = (i: number) => PAD.left + (W / Math.max(1, nPts - 1)) * i;
  const yScale = (v: number) => PAD.top + H - ((v - yMin) / (yMax - yMin)) * H;

  // Y grid lines
  const yTicks = 4;
  const yGridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) / yTicks) * i;
    return { v, y: yScale(v) };
  });

  // X axis ticks (max 7 labels)
  const xTickStep = Math.max(1, Math.floor(nPts / 6));
  const xTicks = Array.from({ length: nPts }, (_, i) => i).filter(i => i % xTickStep === 0 || i === nPts - 1);

  // Build SVG path for each series
  const buildPath = (pts: OHLCPoint[], nBase: number) =>
    pts.map((p, i) => {
      const xi = Math.round((i / Math.max(1, pts.length - 1)) * (nBase - 1));
      return `${i === 0 ? 'M' : 'L'}${xScale(xi).toFixed(1)},${yScale(p.c).toFixed(1)}`;
    }).join(' ');

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - PAD.left;
    const idx = Math.round((mx / W) * (nPts - 1));
    if (idx >= 0 && idx < nPts) setHover({ x: xScale(idx), idx });
  };

  const hoverPt = hover !== null ? primary?.points[hover.idx] : null;

  return (
    <svg ref={svgRef} width={width} height={height}
      onMouseMove={handleMouseMove} onMouseLeave={() => setHover(null)}
      style={{ cursor:'crosshair', overflow:'visible' }}>

      {/* Y grid lines */}
      {yGridLines.map(({ v, y }) => (
        <g key={v}>
          <line x1={PAD.left} y1={y} x2={PAD.left + W} y2={y}
            stroke="var(--border-light)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={PAD.left - 6} y={y + 4} textAnchor="end"
            fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-muted)">
            ${fmt2(v)}
          </text>
        </g>
      ))}

      {/* X axis ticks */}
      {xTicks.map(i => (
        <text key={i} x={xScale(i)} y={PAD.top + H + 18} textAnchor="middle"
          fontFamily="var(--font-mono)" fontSize="9" fill="var(--text-muted)">
          {primary?.points[i] ? timeLabel(primary.points[i].t, range) : ''}
        </text>
      ))}

      {/* Area fills */}
      {series.map(s => {
        if (!s.points.length) return null;
        const pathD = buildPath(s.points, nPts);
        const areaD = `${pathD} L${xScale(s.points.length - 1).toFixed(1)},${(PAD.top + H).toFixed(1)} L${xScale(0).toFixed(1)},${(PAD.top + H).toFixed(1)} Z`;
        return (
          <path key={`${s.symbol}-area`} d={areaD}
            fill={s.color} fillOpacity="0.06" strokeWidth="0" />
        );
      })}

      {/* Lines */}
      {series.map(s => {
        if (!s.points.length) return null;
        return (
          <path key={s.symbol} d={buildPath(s.points, nPts)}
            stroke={s.color} strokeWidth="2" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ filter:`drop-shadow(0 0 3px ${s.color}50)` }} />
        );
      })}

      {/* Hover crosshair */}
      {hover && hoverPt && (
        <>
          <line x1={hover.x} y1={PAD.top} x2={hover.x} y2={PAD.top + H}
            stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" />
          {series.map(s => {
            const pt = s.points[hover.idx];
            if (!pt) return null;
            return (
              <circle key={s.symbol} cx={hover.x} cy={yScale(pt.c)} r={4}
                fill={s.color} stroke="var(--bg)" strokeWidth="2" />
            );
          })}
        </>
      )}
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OilPriceChart() {
  const [range,     setRange]     = useState<RangeKey>('7d');
  const [data,      setData]      = useState<HistoryPayload | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [width,     setWidth]     = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  // Responsive width
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 800;
      setWidth(Math.max(320, w));
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(async (r: RangeKey) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/oil-history?range=${r}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  // Summary stats per series
  const summaries = (data?.series ?? []).map(s => {
    const pts = s.points;
    if (!pts.length) return null;
    const first = pts[0].c;
    const last  = pts[pts.length - 1].c;
    const hi    = Math.max(...pts.map(p => p.c));
    const lo    = Math.min(...pts.map(p => p.c));
    const pct   = pctDiff(first, last);
    const isUp  = pct >= 0;
    return { symbol: s.symbol, name: s.name, color: s.color, last, pct, hi, lo, isUp };
  }).filter(Boolean);

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border-light)',
      borderRadius:4, overflow:'hidden', marginBottom:14 }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        background:'var(--surface)', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#e74c3c',
            boxShadow:'0 0 8px rgba(231,76,60,0.5)', display:'inline-block' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
            letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--text-primary)' }}>
            Oil Price History
          </span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>
            // WTI · Brent · Nat Gas · Stooq
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* Range toggle */}
          {(['1d','7d'] as RangeKey[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ fontFamily:'var(--font-mono)', fontSize:10,
                padding:'3px 10px', border:'1px solid var(--border-light)',
                background: range===r ? 'var(--accent)' : 'var(--bg)',
                color: range===r ? '#fff' : 'var(--text-muted)',
                borderRadius:3, cursor:'pointer', letterSpacing:'0.08em',
                textTransform:'uppercase', fontWeight: range===r ? 700 : 400 }}>
              {r === '1d' ? '1 DAY' : '7 DAYS'}
            </button>
          ))}
          <button onClick={() => setCollapsed(c => !c)}
            style={{ fontFamily:'var(--font-mono)', fontSize:11, padding:'3px 8px',
              background:'var(--bg)', color:'var(--text-muted)',
              border:'1px solid var(--border-light)', borderRadius:3, cursor:'pointer' }}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div>
          {/* ── Price summary strip ─────────────────────────────── */}
          {summaries.length > 0 && (
            <div style={{ display:'flex', borderBottom:'1px solid var(--border-light)',
              background:'var(--bg)', flexWrap:'wrap' }}>
              {summaries.map(s => s && (
                <div key={s.symbol} style={{ flex:'1 1 160px', padding:'10px 14px',
                  borderRight:'1px solid var(--border-light)',
                  display:'flex', flexDirection:'column', gap:3 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ display:'inline-block', width:8, height:8, borderRadius:2,
                      background:s.color, flexShrink:0 }} />
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700,
                      color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                      {s.name}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:900,
                      color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
                      ${fmt2(s.last)}
                    </span>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
                      color: s.isUp ? '#27ae60' : '#c93a20' }}>
                      {s.isUp ? '▲' : '▼'} {Math.abs(s.pct).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
                    H: ${fmt2(s.hi)} · L: ${fmt2(s.lo)} ({range === '1d' ? '24h' : '7d'})
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Chart area ──────────────────────────────────────── */}
          <div ref={containerRef} style={{ padding:'12px 0 0', position:'relative' }}>
            {loading && (
              <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)',
                letterSpacing:'0.08em' }}>
                ⟳ Loading {range === '1d' ? 'intraday' : '7-day'} history…
              </div>
            )}
            {error && !loading && (
              <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--font-mono)', fontSize:11, color:'#e74c3c',
                letterSpacing:'0.06em' }}>
                {error} — Stooq data unavailable
              </div>
            )}
            {!loading && !error && data && (
              <LineChart
                series={data.series.filter(s => s.points.length > 0)}
                range={range}
                width={width}
                height={220}
              />
            )}
          </div>

          {/* ── Legend + footnote ───────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'8px 14px 10px', flexWrap:'wrap', gap:6 }}>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              {(data?.series ?? []).filter(s => s.points.length > 0).map(s => (
                <div key={s.symbol} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:20, height:2, background:s.color, borderRadius:1 }} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', opacity:0.7 }}>
              {range === '1d' ? 'Hourly bars · last 24h' : 'Daily OHLC · last 7 sessions'} · via Stooq · 15m delay
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
