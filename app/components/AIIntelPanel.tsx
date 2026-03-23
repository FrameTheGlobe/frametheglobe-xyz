'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { AIIntelPayload, Theater, CountryInstability, Forecast, ThreatLevel } from '@/app/api/ai-intel/route';

// ── Types ──────────────────────────────────────────────────────────────────

type FeedItem = {
  title: string; link: string; pubDate: string; summary: string;
  sourceId: string; sourceName: string; region: string; sourceColor: string;
  relevanceScore?: number;
};

interface Props { items: FeedItem[]; }

// ── Colour palette ─────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  CRIT: '#ef4444', ELEV: '#f97316', HIGH: '#eab308', NORM: '#22c55e', UNKN: '#6b7280',
};
const LEVEL_BG: Record<ThreatLevel, string> = {
  CRIT: 'rgba(239,68,68,0.08)', ELEV: 'rgba(249,115,22,0.08)',
  HIGH: 'rgba(234,179,8,0.07)', NORM: 'rgba(34,197,94,0.07)', UNKN: 'rgba(107,114,128,0.06)',
};
const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', ELEVATED: '#f97316', MODERATE: '#eab308', LOW: '#22c55e',
};
const CAT_COLOR: Record<string, string> = {
  Conflict:'#ef4444', Military:'#dc2626', Market:'#f59e0b',
  'Supply Chain':'#f97316', Political:'#a855f7', Cyber:'#3b82f6', Infra:'#14b8a6',
};

// ── Typewriter hook ────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const raf = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        setDisplayed(text.slice(0, ++i));
        raf.current = setTimeout(tick, speed);
      }
    };
    raf.current = setTimeout(tick, 80);
    return () => { if (raf.current) clearTimeout(raf.current); };
  }, [text, speed]);
  return displayed;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AnimatedGauge({ score, label, trend, delta, analystNote, glowing }:
  { score: number; label: string; trend: string; delta: number; analystNote: string; glowing: boolean }) {
  const R = 48;
  const circ = 2 * Math.PI * R;
  const filled = circ * (score / 100);
  const color = RISK_COLOR[label] ?? '#f97316';

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10,
      padding:'16px 20px', background:'var(--bg)', border:`1px solid ${color}30`,
      borderRadius:4, minWidth:160 }}>
      <style>{`
        @keyframes ring-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .ring-glow { animation: ring-pulse 2s ease-in-out infinite; }
      `}</style>
      <div style={{ position:'relative', width:120, height:120 }}>
        <svg width="120" height="120" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" strokeWidth="9" />
          <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="9"
            strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
            className={glowing ? 'ring-glow' : ''}
            style={{ filter:`drop-shadow(0 0 ${glowing ? '8' : '4'}px ${color}80)`, transition:'stroke-dasharray 1s ease' }} />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:30, fontWeight:900, color, lineHeight:1 }}>{score}</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)', letterSpacing:'0.08em', marginTop:2 }}>/100</span>
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:14, fontWeight:800, color, letterSpacing:'0.14em' }}>{label}</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)', marginTop:3 }}>
          Trend: {trend} {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→ flat'}
        </div>
      </div>
      {analystNote && (
        <p style={{ fontFamily:'var(--font-body)', fontSize:11, color:'var(--text-muted)',
          lineHeight:1.5, margin:0, textAlign:'center', maxWidth:200, opacity:0.85 }}>
          {analystNote}
        </p>
      )}
    </div>
  );
}

function TheaterCard({ theater }: { theater: Theater }) {
  const color = LEVEL_COLOR[theater.level];
  return (
    <div style={{ background:LEVEL_BG[theater.level], border:`1px solid ${color}35`,
      borderLeft:`3px solid ${color}`, borderRadius:3, padding:'10px 12px',
      display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
          color:'var(--text-primary)', letterSpacing:'0.06em', textTransform:'uppercase' }}>
          {theater.name}
        </span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700, color,
          background:`${color}18`, border:`1px solid ${color}45`,
          padding:'2px 7px', borderRadius:2, letterSpacing:'0.1em' }}>
          {theater.level}
        </span>
      </div>
      <p style={{ fontFamily:'var(--font-body)', fontSize:11, color:'var(--text-muted)', lineHeight:1.4, margin:0 }}>
        {theater.summary}
      </p>
      <div style={{ display:'flex', gap:12, marginTop:2 }}>
        {[['AIR',theater.airOps],['GND',theater.groundAssets],['NAVAL',theater.navalAssets],['EVENTS',theater.recentEvents]].map(([l,v]) => (
          <div key={l as string} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:15, fontWeight:800, color }}>{v}</span>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:7, color:'var(--text-muted)', letterSpacing:'0.08em' }}>{l}</span>
          </div>
        ))}
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:9,
          color: theater.trend==='escalating' ? '#ef4444' : theater.trend==='de-escalating' ? '#22c55e' : 'var(--text-muted)',
          alignSelf:'flex-end' }}>
          {theater.trend==='escalating' ? '▲ ESC' : theater.trend==='de-escalating' ? '▼ DE-ESC' : '→ STABLE'}
        </span>
      </div>
    </div>
  );
}

function InstabilityRow({ c, maxScore }: { c: CountryInstability; maxScore: number }) {
  const pct = Math.round((c.score / Math.max(1, maxScore)) * 100);
  const color = c.score >= 75 ? '#ef4444' : c.score >= 50 ? '#f97316' : c.score >= 30 ? '#eab308' : '#22c55e';
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4,
      padding:'7px 0', borderBottom:'1px solid var(--border-light)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:15 }}>{c.flag}</span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600,
          color:'var(--text-primary)', minWidth:95 }}>{c.country}</span>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {[['U',c.unrest,'Unrest'],['C',c.conflict,'Conflict'],['S',c.sanctions,'Sanctions'],['I',c.infoWarfare,'Info Warfare']].map(([k,v,t]) => (
            <span key={k as string} title={`${t}: ${v}`} style={{
              fontFamily:'var(--font-mono)', fontSize:9,
              color: (v as number)>=60?'#ef4444':(v as number)>=35?'#f97316':'var(--text-muted)',
              background:(v as number)>=60?'rgba(239,68,68,0.08)':'var(--bg)',
              border:`1px solid ${(v as number)>=60?'rgba(239,68,68,0.25)':'var(--border-light)'}`,
              borderRadius:2, padding:'1px 5px', cursor:'default' }}>
              {k}:{v}
            </span>
          ))}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:15, fontWeight:800, color }}>{c.score}</span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:9,
            color: c.trend==='up'?'#ef4444':c.trend==='down'?'#22c55e':'var(--text-muted)' }}>
            {c.trend==='up'?`▲+${Math.abs(c.delta)}`:c.trend==='down'?`▼${c.delta}`:'→'}
          </span>
        </div>
      </div>
      <div style={{ height:4, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2,
          boxShadow: c.score>=75?`0 0 6px ${color}70`:'none', transition:'width 0.8s ease' }} />
      </div>
    </div>
  );
}

function ForecastCard({ f }: { f: Forecast }) {
  const color = CAT_COLOR[f.category] ?? 'var(--accent)';
  const confColor = f.confidence==='High'?'#22c55e':f.confidence==='Medium'?'#f59e0b':'#6b7280';
  return (
    <div style={{ background:'var(--bg)', border:'1px solid var(--border-light)',
      borderLeft:`3px solid ${color}`, borderRadius:3, padding:'10px 12px',
      display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700, color,
          background:`${color}15`, border:`1px solid ${color}35`,
          padding:'2px 6px', borderRadius:2, letterSpacing:'0.08em', textTransform:'uppercase' }}>
          {f.category}
        </span>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)',
          background:'var(--surface)', border:'1px solid var(--border-light)',
          padding:'2px 6px', borderRadius:2, letterSpacing:'0.06em' }}>{f.horizon}</span>
        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:9,
          color:confColor, letterSpacing:'0.06em' }}>{f.confidence} confidence</span>
      </div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-primary)',
        fontWeight:600, lineHeight:1.4 }}>{f.title}</div>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:5, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${f.probability}%`, background:color,
            borderRadius:2, transition:'width 0.8s ease' }} />
        </div>
        <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:800,
          color, minWidth:38, textAlign:'right' }}>{f.probability}%</span>
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)', lineHeight:1.4 }}>
        {f.basis}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type ForecastCat = Forecast['category'] | 'All';
const ALL_CATS: ForecastCat[] = ['All','Conflict','Military','Market','Supply Chain','Political','Cyber','Infra'];

export default function AIIntelPanel({ items }: Props) {
  const [data,       setData]       = useState<AIIntelPayload | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [collapsed,  setCollapsed]  = useState(false);
  const [activeCat,  setActiveCat]  = useState<ForecastCat>('All');
  const [activeTab,  setActiveTab]  = useState<'posture'|'instability'|'forecasts'|'sigint'|'econ'>('posture');
  const [lastRefresh,setLastRefresh]= useState<Date | null>(null);

  const brief = useTypewriter(data?.insights.worldBrief ?? '', 14);
  const focal = useTypewriter(data?.insights.focalPoints ?? '', 14);

  const load = useCallback(async (force = false) => {
    if (!items.length) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/ai-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.slice(0, 50), forceRefresh: force }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => { if (items.length > 0) load(); }, [load, items.length]);
  useEffect(() => { const id = setInterval(() => load(), 15 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const forecasts = data?.forecasts ?? [];
  const filtered  = activeCat === 'All' ? forecasts : forecasts.filter(f => f.category === activeCat);
  const availCats = new Set(forecasts.map(f => f.category));
  const riskColor = data ? (RISK_COLOR[data.strategicRisk.label] ?? '#f97316') : '#6b7280';
  const glowing   = data?.strategicRisk.label === 'CRITICAL' || data?.strategicRisk.label === 'ELEVATED';
  const docNum    = `FTG-${Date.now().toString(36).toUpperCase().slice(-6)}`;

  return (
    <section style={{ background:'var(--surface)', border:'1px solid var(--border-light)',
      borderTop:`3px solid ${riskColor}`, borderRadius:'0 0 4px 4px',
      overflow:'hidden', marginBottom:14 }}>

      {/* ── Classification header ────────────────────────────── */}
      <div style={{ background:'var(--bg)', borderBottom:'1px solid var(--border-light)',
        padding:'6px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
        flexWrap:'wrap', gap:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:8, fontWeight:900,
            letterSpacing:'0.2em', color:riskColor, background:`${riskColor}15`,
            border:`1px solid ${riskColor}40`, padding:'2px 8px', borderRadius:2 }}>
            RESTRICTED // EYES ONLY
          </span>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
            DOC: {docNum}
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {data && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8,
              color: data.generatedBy === 'claude-ai' ? '#22c55e' : '#f59e0b',
              background: data.generatedBy === 'claude-ai' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
              border: `1px solid ${data.generatedBy === 'claude-ai' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
              padding:'2px 7px', borderRadius:2, letterSpacing:'0.06em' }}>
              {data.generatedBy === 'claude-ai' ? '🤖 AI ANALYSIS' : '🔢 ALGORITHMIC'}
            </span>
          )}
          {lastRefresh && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
              {lastRefresh.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ── Main header ──────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'10px 14px', borderBottom:'1px solid var(--border-light)',
        background:'var(--surface)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
            background: loading ? '#f97316' : data ? '#22c55e' : '#6b7280',
            boxShadow:`0 0 8px ${loading ? '#f97316' : data ? '#22c55e' : '#6b7280'}`,
            transition:'background 0.3s' }} />
          <span style={{ fontFamily:'var(--font-mono)', fontSize:11, letterSpacing:'0.14em',
            textTransform:'uppercase', color:'var(--accent)', fontWeight:800 }}>
            AI Intelligence Assessment
          </span>
          {data && (
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--text-muted)' }}>
              // {data.totalStoriesAnalysed} stories analysed
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => load(true)} disabled={loading || !items.length}
            style={{ fontFamily:'var(--font-mono)', fontSize:10, padding:'3px 9px',
              background:'var(--bg)', color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
              border:'1px solid var(--border-light)', borderRadius:3, cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing:'0.06em' }}>
            {loading ? '⟳ Analysing…' : '⟳ Refresh'}
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ fontFamily:'var(--font-mono)', fontSize:11, padding:'3px 8px',
              background:'var(--bg)', color:'var(--text-muted)',
              border:'1px solid var(--border-light)', borderRadius:3, cursor:'pointer' }}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding:14, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Loading skeleton */}
          {loading && !data && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10,
              padding:'28px 0', fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)',
              letterSpacing:'0.1em', textAlign:'center' }}>
              <div style={{ display:'flex', gap:4 }}>
                {['█','█','█','▒','░'].map((c,i) => (
                  <span key={i} style={{ color:'var(--accent)', opacity: 0.3 + i * 0.15,
                    animation:`pulse-op 1.2s ${i * 0.15}s ease-in-out infinite` }}>{c}</span>
                ))}
              </div>
              <style>{`@keyframes pulse-op{0%,100%{opacity:0.3}50%{opacity:1}}`}</style>
              PROCESSING INTELLIGENCE FEED — SYNTHESISING ASSESSMENT…
            </div>
          )}

          {error && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'#ef4444',
              background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)',
              borderRadius:3, padding:'10px 14px' }}>
              INTEL ERROR: {error}
            </div>
          )}

          {!items.length && !loading && (
            <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)',
              textAlign:'center', padding:'24px 0' }}>
              Waiting for feed data… Refresh the page to load stories.
            </div>
          )}

          {data && (
            <>
              {/* ── Row 1: Gauge + Insights ─────────────────────── */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <AnimatedGauge
                  score={data.strategicRisk.score}
                  label={data.strategicRisk.label}
                  trend={data.strategicRisk.trend}
                  delta={data.strategicRisk.deltaPoints}
                  analystNote={data.strategicRisk.analystNote}
                  glowing={glowing}
                />
                <div style={{ flex:1, minWidth:260, display:'flex', flexDirection:'column', gap:10 }}>
                  {/* World Brief */}
                  <div style={{ background:'var(--bg)', border:'1px solid var(--border-light)',
                    borderLeft:'3px solid var(--accent)', borderRadius:3, padding:'12px 14px',
                    display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800,
                        color:'var(--accent)', letterSpacing:'0.14em' }}>WORLD BRIEF</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)' }}>
                        {data.totalStoriesAnalysed} src
                      </span>
                    </div>
                    <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-secondary)',
                      lineHeight:1.6, margin:0, minHeight:60 }}>
                      {brief || <span style={{ color:'var(--text-muted)', opacity:0.5 }}>▋</span>}
                    </p>
                  </div>
                  {/* Focal Points */}
                  <div style={{ background:'var(--bg)', border:'1px solid var(--border-light)',
                    borderLeft:'3px solid #3b82f6', borderRadius:3, padding:'12px 14px',
                    display:'flex', flexDirection:'column', gap:6, flex:1 }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:800,
                      color:'#3b82f6', letterSpacing:'0.14em' }}>FOCAL POINTS</span>
                    <p style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-secondary)',
                      lineHeight:1.6, margin:0, minHeight:60 }}>
                      {focal || <span style={{ color:'var(--text-muted)', opacity:0.5 }}>▋</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Risk driver pills ────────────────────────────── */}
              {data.strategicRisk.primaryDrivers.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)',
                    letterSpacing:'0.08em', textTransform:'uppercase' }}>Primary Drivers:</span>
                  {data.strategicRisk.primaryDrivers.map(d => (
                    <span key={d} style={{ fontFamily:'var(--font-mono)', fontSize:10, fontWeight:600,
                      color:riskColor, background:`${riskColor}12`,
                      border:`1px solid ${riskColor}35`, padding:'2px 8px', borderRadius:999 }}>
                      {d}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Tab bar ─────────────────────────────────────── */}
              <div style={{ display:'flex', gap:1, background:'var(--bg)',
                border:'1px solid var(--border-light)', borderRadius:4, padding:2, overflow:'hidden' }}>
                {([
                  ['posture',    'Strategic Posture'],
                  ['instability','Instability Index'],
                  ['forecasts',  'AI Forecasts'],
                  ['sigint',     'SIGINT Intercepts'],
                  ['econ',       'Econ Warfare'],
                ] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    style={{ flex:1, fontFamily:'var(--font-mono)', fontSize:10,
                      padding:'6px 4px', border:'none',
                      background: activeTab===id ? 'var(--accent)' : 'transparent',
                      color: activeTab===id ? '#fff' : 'var(--text-muted)',
                      cursor:'pointer', borderRadius:3, letterSpacing:'0.04em',
                      textTransform:'uppercase', transition:'background 0.15s, color 0.15s',
                      whiteSpace:'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Tab: Strategic Posture ───────────────────────── */}
              {activeTab === 'posture' && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:10 }}>
                  {data.theaters.map(t => <TheaterCard key={t.id} theater={t} />)}
                </div>
              )}

              {/* ── Tab: Instability Index ───────────────────────── */}
              {activeTab === 'instability' && (
                <div>
                  {data.instability.map(c => (
                    <InstabilityRow key={c.country} c={c} maxScore={data.instability[0]?.score ?? 100} />
                  ))}
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:8, color:'var(--text-muted)',
                    marginTop:6, letterSpacing:'0.06em' }}>
                    U=Unrest · C=Conflict · S=Sanctions · I=Info Warfare · Score synthesised from live feed
                  </div>
                </div>
              )}

              {/* ── Tab: AI Forecasts ────────────────────────────── */}
              {activeTab === 'forecasts' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Category filter */}
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                    {ALL_CATS.map(cat => {
                      const active = activeCat === cat;
                      const has = cat === 'All' || availCats.has(cat as Forecast['category']);
                      return (
                        <button key={cat} onClick={() => setActiveCat(cat)} disabled={!has}
                          style={{ fontFamily:'var(--font-mono)', fontSize:9, padding:'3px 8px',
                            background: active ? (CAT_COLOR[cat] ?? 'var(--accent)') : 'var(--bg)',
                            color: active ? '#fff' : has ? 'var(--text-muted)' : 'var(--border)',
                            border:`1px solid ${active ? (CAT_COLOR[cat] ?? 'var(--accent)') : 'var(--border-light)'}`,
                            borderRadius:3, cursor: has ? 'pointer' : 'default',
                            opacity: has ? 1 : 0.35, letterSpacing:'0.06em', textTransform:'uppercase' }}>
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  {filtered.map(f => <ForecastCard key={f.id} f={f} />)}
                  {filtered.length === 0 && (
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', padding:'12px 0' }}>
                      No forecasts in this category for the current cycle.
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: SIGINT Intercepts ───────────────────────── */}
              {activeTab === 'sigint' && (
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)',
                    letterSpacing:'0.08em', paddingBottom:8, borderBottom:'1px solid var(--border-light)',
                    marginBottom:6 }}>
                    SOURCE INTERCEPTS // Top stories used to generate this assessment
                  </div>
                  {data.sigint.map((s, i) => (
                    <a key={i} href={s.link} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', flexDirection:'column', gap:3,
                        padding:'9px 0', borderBottom:'1px solid var(--border-light)',
                        textDecoration:'none',
                        transition:'background 0.1s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700,
                          color:'var(--accent)', background:'var(--accent-light)',
                          border:'1px solid var(--border-light)',
                          padding:'1px 5px', borderRadius:2, letterSpacing:'0.06em',
                          textTransform:'uppercase', flexShrink:0 }}>{s.region}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)' }}>
                          {s.sourceName}
                        </span>
                        <span style={{ marginLeft:'auto', fontFamily:'var(--font-mono)', fontSize:8,
                          color:'var(--text-muted)' }}>
                          {new Date(s.pubDate).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'var(--text-primary)',
                        lineHeight:1.4, fontWeight:500 }}>{s.title}</div>
                    </a>
                  ))}
                  {data.sigint.length === 0 && (
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--text-muted)', padding:'16px 0' }}>
                      No SIGINT items available in current cycle.
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Economic Warfare ────────────────────────── */}
              {activeTab === 'econ' && (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* Sanctions / Economic Warfare rows */}
                  {(data.economicWarfare ?? []).map((e, i) => (
                    <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border-light)',
                      borderLeft:`3px solid ${e.trend==='rising'?'#ef4444':e.trend==='easing'?'#22c55e':'#6b7280'}`,
                      borderRadius:3, padding:'10px 12px', display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
                          color:'var(--text-primary)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{e.label}</span>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:13, fontWeight:800,
                            color: e.trend==='rising'?'#ef4444':e.trend==='easing'?'#22c55e':'var(--text-primary)' }}>
                            {e.value}
                          </span>
                          <span style={{ fontFamily:'var(--font-mono)', fontSize:9,
                            color: e.trend==='rising'?'#ef4444':e.trend==='easing'?'#22c55e':'var(--text-muted)' }}>
                            {e.trend==='rising'?'▲ RISING':e.trend==='easing'?'▼ EASING':'→ STABLE'}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)',
                        lineHeight:1.4, margin:0 }}>{e.detail}</p>
                    </div>
                  ))}

                  {/* Diplomatic Status */}
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--text-muted)',
                    letterSpacing:'0.1em', textTransform:'uppercase', marginTop:4 }}>
                    Diplomatic Status
                  </div>
                  {(data.diplomaticStatus ?? []).map((d, i) => (
                    <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border-light)',
                      borderLeft:`3px solid ${d.color}`, borderRadius:3, padding:'10px 12px',
                      display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:11, fontWeight:700,
                          color:'var(--text-primary)', letterSpacing:'0.04em' }}>{d.actor}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:9, fontWeight:700,
                          color:d.color, background:`${d.color}18`,
                          border:`1px solid ${d.color}40`, padding:'2px 6px', borderRadius:2,
                          letterSpacing:'0.1em' }}>{d.status}</span>
                      </div>
                      <p style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--text-muted)',
                        lineHeight:1.4, margin:0 }}>{d.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
