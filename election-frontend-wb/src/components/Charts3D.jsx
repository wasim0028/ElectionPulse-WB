// src/components/Charts3D.jsx
// Displays ALL 12 uploaded Python charts in categorized tabs

import { useState } from "react";

// ── All 12 charts organized by category ──────────────────────────────────────
const CATEGORIES = [
  {
    id: "seats",
    label: "🏆 Seats",
    charts: [
      {
        id:    "visible_seats_3d",
        title: "3D Seats Won by Party",
        desc:  "3D bar chart — AITC 215, BJP 77, IND 1, ISF 1 clearly labelled",
        file:  "/charts/visible_seats_3d.png",
        bg:    "#0d1526",
      },
      {
        id:    "election_results_white",
        title: "Seats Won — Bar Chart",
        desc:  "Election results with majority mark (148 seats) dashed line",
        file:  "/charts/election_results_white.png",
        bg:    "#ffffff",
      },
      {
        id:    "seats_won_line_chart",
        title: "Party-wise Seats (Bubble)",
        desc:  "Bubble chart — seats won per party, size = seat count",
        file:  "/charts/seats_won_line_chart.png",
        bg:    "#0d1526",
      },
    ],
  },
  {
    id: "votes",
    label: "🗳 Votes",
    charts: [
      {
        id:    "vote_share_donut_dark",
        title: "Vote Share Donut",
        desc:  "Dark donut — AITC 73.7%, BJP 25.8%, ISF 0.4%, IND 0.2% with total votes",
        file:  "/charts/vote_share_donut_dark_v2.png",
        bg:    "#0d1526",
      },
      {
        id:    "total_votes_bar",
        title: "Total Votes by Party",
        desc:  "Bar chart — AITC 22.1M, BJP 7.7M, ISF 109K, IND 58K",
        file:  "/charts/total_votes_bar_chart.png",
        bg:    "#0d1526",
      },
      {
        id:    "chart_scatter_3d",
        title: "3D Scatter: Votes·Seats·Share",
        desc:  "3D scatter — total votes vs seats won vs vote share per party",
        file:  "/charts/chart_scatter_3d.png",
        bg:    "#0d1526",
      },
      {
        id:    "chart_surface_3d",
        title: "3D Vote Share Surface",
        desc:  "3D cylindrical pie — AITC dominates with 73.7% vote share",
        file:  "/charts/chart_surface_3d.png",
        bg:    "#0d1526",
      },
    ],
  },
  {
    id: "comparison",
    label: "📊 Comparison",
    charts: [
      {
        id:    "seats_vs_vote_combined",
        title: "Seats Won vs Vote Share",
        desc:  "Combined chart — bars for seats won + dashed line for vote share %",
        file:  "/charts/seats_vs_vote_share_combined_chart.png",
        bg:    "#0d1526",
      },
      {
        id:    "seat_vs_vote_proportionality",
        title: "Seat Share vs Vote Share",
        desc:  "Side-by-side bars comparing seat share % and vote share % per party",
        file:  "/charts/seat_vs_vote_share_proportionality.png",
        bg:    "#0d1526",
      },
    ],
  },
  {
    id: "analysis",
    label: "🔍 Analysis",
    charts: [
      {
        id:    "winning_margins",
        title: "Winning Margins Distribution",
        desc:  "Histogram — distribution of winning margins with KDE curve across 294 constituencies",
        file:  "/charts/winning_margins_distribution.png",
        bg:    "#0d1526",
      },
      {
        id:    "close_contests",
        title: "Close Contests (< 5000 votes)",
        desc:  "Party involvement in close contests — BJP 36, AITC 35, IND 1",
        file:  "/charts/party_close_contests_involvement.png",
        bg:    "#0d1526",
      },
    ],
  },
  {
    id: "hemicycle",
    label: "🏛 Parliament",
    charts: [
      {
        id:    "election_hemicycle_final",
        title: "Parliament Hemicycle",
        desc:  "Assembly seating — 294 dots in semicircle, AITC 215 (green) + BJP 77 (orange)",
        file:  "/charts/election_hemicycle_final.png",
        bg:    "#0d1526",
      },
    ],
  },
];

export default function Charts3D() {
  const [activeCat,   setActiveCat]   = useState(0);
  const [activeChart, setActiveChart] = useState(0);
  const [zoom,        setZoom]        = useState(false);

  const cat   = CATEGORIES[activeCat];
  const chart = cat.charts[activeChart];

  // When switching category, reset chart index
  const handleCatChange = (i) => {
    setActiveCat(i);
    setActiveChart(0);
    setZoom(false);
  };

  return (
    <div style={{
      background:"var(--bg-card)", border:"1px solid var(--border)",
      borderRadius:"20px", overflow:"hidden", boxShadow:"var(--shadow)",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding:"14px 20px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:10,
      }}>
        <div>
          <h2 style={{ fontSize:13, fontWeight:800, color:"var(--text-primary)",
                       textTransform:"uppercase", letterSpacing:"0.08em", margin:0 }}>
            Python Analytics — {CATEGORIES.reduce((s,c)=>s+c.charts.length,0)} Charts
          </h2>
          <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:3, marginBottom:0 }}>
            Generated from live Election_WB_2026 SQL Server data · matplotlib + numpy
          </p>
        </div>
        {/* Total chart count badge */}
        <span style={{
          fontSize:11, fontWeight:700, padding:"4px 12px",
          background:"rgba(16,185,129,0.15)", color:"#10b981",
          border:"1px solid rgba(16,185,129,0.3)", borderRadius:99,
        }}>
          {CATEGORIES.reduce((s,c)=>s+c.charts.length,0)} charts total
        </span>
      </div>

      {/* ── Category tabs ────────────────────────────────────────────────── */}
      <div style={{
        display:"flex", gap:4, padding:"12px 16px",
        borderBottom:"1px solid var(--border)",
        background:"var(--bg-secondary)", flexWrap:"wrap",
      }}>
        {CATEGORIES.map((c, i) => (
          <button key={c.id} onClick={() => handleCatChange(i)}
            style={{
              padding:"7px 14px", borderRadius:"10px", border:"none",
              cursor:"pointer", fontSize:12, fontWeight:700,
              transition:"all 0.15s",
              background: activeCat===i ? "#10b981" : "var(--bg-card)",
              color:      activeCat===i ? "#fff"    : "var(--text-secondary)",
              boxShadow:  activeCat===i ? "0 2px 8px rgba(16,185,129,0.3)" : "none",
            }}>
            {c.label}
            <span style={{
              marginLeft:6, fontSize:10, fontFamily:"monospace",
              opacity: activeCat===i ? 0.8 : 0.5,
            }}>
              ({c.charts.length})
            </span>
          </button>
        ))}
      </div>

      {/* ── Chart selector within category ───────────────────────────────── */}
      {cat.charts.length > 1 && (
        <div style={{
          display:"flex", gap:4, padding:"10px 16px",
          borderBottom:"1px solid var(--border)", flexWrap:"wrap",
        }}>
          {cat.charts.map((c, i) => (
            <button key={c.id} onClick={() => { setActiveChart(i); setZoom(false); }}
              style={{
                padding:"5px 12px", borderRadius:"8px",
                border:`1px solid ${activeChart===i ? "#10b981" : "var(--border)"}`,
                cursor:"pointer", fontSize:11, fontWeight:600,
                transition:"all 0.15s",
                background: activeChart===i ? "rgba(16,185,129,0.12)" : "transparent",
                color:      activeChart===i ? "#10b981"                : "var(--text-secondary)",
              }}>
              {c.title}
            </button>
          ))}
        </div>
      )}

      {/* ── Main chart image ─────────────────────────────────────────────── */}
      <div style={{ background:chart.bg, position:"relative", overflow:"hidden",
                    transition:"background 0.3s", minHeight:300 }}>
        <img
          src={chart.file}
          alt={chart.title}
          style={{
            width:"100%", height:"auto", display:"block",
            cursor: zoom ? "zoom-out" : "zoom-in",
            transition:"transform 0.35s ease",
            transform: zoom ? "scale(1.55) translateY(8%)" : "scale(1)",
            transformOrigin:"center top",
          }}
          onClick={() => setZoom(z => !z)}
          onError={e => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
        {/* Error fallback */}
        <div style={{
          display:"none", alignItems:"center", justifyContent:"center",
          height:200, color:"var(--text-muted)", fontSize:13,
        }}>
          Chart not found: {chart.file}
        </div>

        {/* Gradient overlay + description */}
        <div style={{
          position:"absolute", bottom:0, left:0, right:0,
          background:`linear-gradient(to top, ${chart.bg}f0, transparent)`,
          padding:"36px 20px 14px",
          display:"flex", alignItems:"flex-end", justifyContent:"space-between",
          pointerEvents:"none",
        }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, margin:0,
                        color: chart.bg==="#ffffff" ? "#1e293b" : "white" }}>
              {chart.title}
            </p>
            <p style={{ fontSize:11, margin:"3px 0 0",
                        color: chart.bg==="#ffffff" ? "#64748b" : "rgba(255,255,255,0.5)" }}>
              {chart.desc}
            </p>
          </div>
          <span style={{ fontSize:10, fontFamily:"monospace",
                          color: chart.bg==="#ffffff" ? "#94a3b8" : "rgba(255,255,255,0.3)" }}>
            {zoom ? "Click to zoom out ↙" : "Click to zoom in ↗"}
          </span>
        </div>
      </div>

      {/* ── Footer navigation ────────────────────────────────────────────── */}
      <div style={{
        padding:"12px 20px", borderTop:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexWrap:"wrap", gap:8,
      }}>
        {/* Prev / Next within category */}
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button
            onClick={() => { setActiveChart(a=>Math.max(0,a-1)); setZoom(false); }}
            disabled={activeChart===0}
            style={{
              padding:"5px 12px", borderRadius:8,
              border:"1px solid var(--border)", background:"transparent",
              cursor: activeChart===0 ? "not-allowed" : "pointer",
              color:"var(--text-secondary)", opacity:activeChart===0?0.35:1,
              fontSize:12,
            }}>
            ← Prev
          </button>
          <button
            onClick={() => { setActiveChart(a=>Math.min(cat.charts.length-1,a+1)); setZoom(false); }}
            disabled={activeChart===cat.charts.length-1}
            style={{
              padding:"5px 12px", borderRadius:8,
              border:"1px solid var(--border)", background:"transparent",
              cursor: activeChart===cat.charts.length-1 ? "not-allowed" : "pointer",
              color:"var(--text-secondary)", opacity:activeChart===cat.charts.length-1?0.35:1,
              fontSize:12,
            }}>
            Next →
          </button>
          <span style={{ fontSize:10, color:"var(--text-muted)", fontFamily:"monospace" }}>
            Chart {activeChart+1}/{cat.charts.length} in {cat.label}
          </span>
        </div>

        {/* Dot indicators */}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {cat.charts.map((c, i) => (
            <button key={i} onClick={() => { setActiveChart(i); setZoom(false); }}
              title={c.title}
              style={{
                width: activeChart===i ? 24 : 8, height:8,
                borderRadius:99, border:"none", cursor:"pointer",
                background: activeChart===i ? "#10b981" : "var(--border-hover)",
                transition:"all 0.25s", padding:0,
              }} />
          ))}
        </div>

        <span style={{ fontSize:10, color:"var(--text-muted)" }}>
          Python · matplotlib · numpy · pandas
        </span>
      </div>
    </div>
  );
}
