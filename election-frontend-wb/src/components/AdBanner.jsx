// src/components/AdBanner.jsx
// Three ad zones:
//  1. Top leaderboard — rotating election news ticker
//  2. Side rectangle — sponsor/brand cards
//  3. Bottom banner — call to action

import { useState, useEffect } from "react";

// ── Election news ticker items ────────────────────────────────────────────────
const NEWS_ITEMS = [
  "🗳️  West Bengal 2021 Assembly Elections — Complete Results Dashboard",
  "📊  AITC/TMC wins 215 seats, BJP secures 77 — See full breakdown",
  "♀   40 Women MLAs elected across West Bengal constituencies",
  "📍  294 constituencies covered with real-time data from Test_Wasim DB",
  "🔍  Search any constituency by name or ID — Try searching 'Kolkata' or '174'",
  "📈  Average voter turnout across WB: Click on Stats for full analytics",
  "🗺️  Click any dot on the constituency map to view detailed results",
];

// ── Sponsor cards ─────────────────────────────────────────────────────────────
const SPONSORS = [
  {
    name:    "Republic TV",
    tagline: "Breaking Election News 24/7",
    color:   "#FF6B35",
    icon:    "📺",
    url:     "#",
  },
  {
    name:    "ElectionPulse Pro",
    tagline: "Advanced Analytics Platform",
    color:   "#10b981",
    icon:    "📊",
    url:     "#",
  },
  {
    name:    "Intellipaat",
    tagline: "Learn Data Science & Analytics",
    color:   "#2563EB",
    icon:    "🎓",
    url:     "#",
  },
  {
    name:    "HGS Digital",
    tagline: "Enterprise Data Solutions",
    color:   "#A78BFA",
    icon:    "💼",
    url:     "#",
  },
];

// ── News ticker component ─────────────────────────────────────────────────────
export function NewsTicker() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % NEWS_ITEMS.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      border:"1px solid rgba(16,185,129,0.3)",
      borderRadius:"12px",
      padding:"10px 16px",
      display:"flex",
      alignItems:"center",
      gap:12,
      overflow:"hidden",
    }}>
      {/* LIVE badge */}
      <div style={{
        background:"#ef4444",
        color:"white",
        fontSize:9,
        fontWeight:800,
        padding:"3px 8px",
        borderRadius:6,
        letterSpacing:"0.12em",
        textTransform:"uppercase",
        flexShrink:0,
        display:"flex",
        alignItems:"center",
        gap:4,
      }}>
        <span style={{ width:6, height:6, borderRadius:"50%", background:"white",
                        animation:"pulse 1.5s infinite" }} />
        LIVE
      </div>

      {/* Scrolling text */}
      <div style={{ flex:1, overflow:"hidden", position:"relative", height:20 }}>
        <p key={idx}
           style={{
             fontSize:12,
             fontWeight:600,
             color:"#e2e8f0",
             margin:0,
             whiteSpace:"nowrap",
             animation:"slideIn 0.4s ease-out",
           }}>
          {NEWS_ITEMS[idx]}
        </p>
      </div>

      {/* Dots */}
      <div style={{ display:"flex", gap:4, flexShrink:0 }}>
        {NEWS_ITEMS.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{
              width:6, height:6, borderRadius:"50%", border:"none", cursor:"pointer", padding:0,
              background: idx === i ? "#10b981" : "rgba(255,255,255,0.2)",
              transition:"background 0.3s",
            }} />
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// ── Sponsor card row ──────────────────────────────────────────────────────────
export function SponsorBanner() {
  return (
    <div style={{
      background:"var(--bg-card)",
      border:"1px solid var(--border)",
      borderRadius:"16px",
      overflow:"hidden",
      boxShadow:"var(--shadow)",
    }}>
      {/* Ad label */}
      <div style={{
        padding:"6px 16px",
        borderBottom:"1px solid var(--border)",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
      }}>
        <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.12em",
                       color:"var(--text-muted)", fontWeight:700 }}>Sponsored</span>
        <span style={{ fontSize:9, color:"var(--text-muted)" }}>Advertisement</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:0 }}>
        {SPONSORS.map((s, i) => (
          <a key={s.name} href={s.url}
             style={{
               display:"flex",
               flexDirection:"column",
               alignItems:"center",
               padding:"16px 12px",
               textDecoration:"none",
               borderRight: i < SPONSORS.length-1 ? "1px solid var(--border)" : "none",
               transition:"background 0.15s",
               cursor:"pointer",
             }}
             onMouseEnter={e => e.currentTarget.style.background="var(--bg-secondary)"}
             onMouseLeave={e => e.currentTarget.style.background="transparent"}>
            <div style={{
              width:42, height:42, borderRadius:12,
              background:`${s.color}18`,
              border:`1px solid ${s.color}35`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, marginBottom:8,
            }}>
              {s.icon}
            </div>
            <span style={{ fontSize:12, fontWeight:700, color:"var(--text-primary)", textAlign:"center" }}>
              {s.name}
            </span>
            <span style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:3 }}>
              {s.tagline}
            </span>
            <span style={{
              marginTop:8, fontSize:10, fontWeight:700,
              color:s.color, padding:"3px 10px",
              background:`${s.color}15`, borderRadius:99,
              border:`1px solid ${s.color}30`,
            }}>
              Visit →
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Bottom CTA banner ─────────────────────────────────────────────────────────
export function CtaBanner() {
  return (
    <div style={{
      background:"linear-gradient(135deg, #064e3b 0%, #065f46 50%, #0f172a 100%)",
      border:"1px solid rgba(16,185,129,0.3)",
      borderRadius:"16px",
      padding:"20px 28px",
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      flexWrap:"wrap",
      gap:16,
    }}>
      <div>
        <h3 style={{ fontSize:16, fontWeight:800, color:"white", margin:0 }}>
          🗳 ElectionPulse WB 2026
        </h3>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:4 }}>
          Real-time election analytics powered by ASP.NET Core 8 + React + SQL Server
        </p>
        <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
          {["294 Constituencies","Live DB","3D Charts","Gender Analytics"].map(tag => (
            <span key={tag} style={{
              fontSize:10, fontWeight:700, padding:"3px 10px",
              background:"rgba(16,185,129,0.2)", color:"#34d399",
              border:"1px solid rgba(16,185,129,0.3)", borderRadius:99,
            }}>{tag}</span>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:10, flexShrink:0 }}>
        <button style={{
          padding:"10px 22px", borderRadius:10, border:"none", cursor:"pointer",
          background:"#10b981", color:"white", fontWeight:700, fontSize:13,
          transition:"all 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background="#059669"}
        onMouseLeave={e => e.currentTarget.style.background="#10b981"}>
          Explore Results →
        </button>
        <button style={{
          padding:"10px 22px", borderRadius:10, cursor:"pointer",
          background:"transparent", color:"white", fontWeight:700, fontSize:13,
          border:"1px solid rgba(255,255,255,0.3)",
          transition:"all 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
        onMouseLeave={e => e.currentTarget.style.background="transparent"}>
          Download Data
        </button>
      </div>
    </div>
  );
}

// ── Side ad (for sidebar placement) ──────────────────────────────────────────
export function SideAd() {
  const [adIdx, setAdIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAdIdx(i => (i+1) % SPONSORS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const s = SPONSORS[adIdx];
  return (
    <div style={{
      background:`linear-gradient(135deg, ${s.color}12, var(--bg-card))`,
      border:`1px solid ${s.color}30`,
      borderRadius:"14px",
      padding:"16px",
      textAlign:"center",
    }}>
      <span style={{ fontSize:9, color:"var(--text-muted)", textTransform:"uppercase",
                     letterSpacing:"0.1em", display:"block", marginBottom:10 }}>Advertisement</span>
      <div style={{ fontSize:32, marginBottom:8 }}>{s.icon}</div>
      <p style={{ fontSize:13, fontWeight:800, color:"var(--text-primary)", margin:0 }}>{s.name}</p>
      <p style={{ fontSize:11, color:"var(--text-muted)", margin:"4px 0 12px" }}>{s.tagline}</p>
      <a href={s.url} style={{
        display:"block", padding:"8px", borderRadius:8,
        background:s.color, color:"white", fontSize:12, fontWeight:700,
        textDecoration:"none", transition:"opacity 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity="1"}>
        Learn More →
      </a>
    </div>
  );
}
