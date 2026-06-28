// src/App.jsx
import { useState, useEffect } from "react";
import SearchBar             from "./components/SearchBar";
import ConstituencyMap       from "./components/Constituencymap";
import VotesPieChart         from "./components/VotesPieChart";
import DetailCard            from "./components/DetailCard";
import PartyTable            from "./components/PartyTable";
import PartyComparisonChart  from "./components/PartyComparisonChart";
import Charts3D              from "./components/Charts3D";
import { NewsTicker, SponsorBanner, CtaBanner, SideAd } from "./components/AdBanner";
import { api }               from "./services/api";

const CHART_MODES = ["Seats Won", "Total Votes"];
const isFemale = g => (g ?? "").trim().toUpperCase() === "FEMALE";
const isMale   = g => (g ?? "").trim().toUpperCase() === "MALE";

function getColor(p) {
  const m = { AITC:"#20C997",TMC:"#20C997",BJP:"#FF6B35",INC:"#2563EB","CPI(M)":"#E63946",
              CPIM:"#E63946",IND:"#ADB5BD",ISF:"#06D6A0",AIFB:"#F59E0B" };
  if (!p) return "#6B7280";
  for (const [k,v] of Object.entries(m)) if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

function GenderCandidateCard({ c }) {
  const color = getColor(c.partyName);
  return (
    <div style={{ background:"var(--bg-card)", border:`1px solid ${c.isWinner?"rgba(16,185,129,0.3)":"var(--border)"}`,
                  borderRadius:"14px", padding:"10px 12px" }}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <p className="text-xs font-bold truncate" style={{ color:"var(--text-primary)" }}>
            {c.candidateName}{c.isWinner && <span className="ml-1.5 text-amber-400 text-[10px]">★</span>}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color:"var(--text-muted)" }}>
            {c.constituencyName} · <span className="font-mono">#{c.constituencyId}</span>
          </p>
        </div>
        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ color, background:`${color}20` }}>{c.partyName}</span>
      </div>
      <div className="flex justify-between text-[10px] font-mono" style={{ color:"var(--text-muted)" }}>
        <span>{c.votesTotal.toLocaleString("en-IN")} votes</span>
        <span style={{ color }}>{c.votePercentage.toFixed(2)}%</span>
        <span>#{c.rank}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => {
    const s = localStorage.getItem("wb-theme");
    return s ? s==="dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("wb-theme", dark?"dark":"light");
  }, [dark]);

  const [constituencies, setConstituencies] = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [stats,          setStats]          = useState(null);
  const [pieData,        setPieData]        = useState([]);
  const [parties,        setParties]        = useState([]);
  const [genderData,     setGenderData]     = useState(null);
  const [chartMode,      setChartMode]      = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [genderLoading,  setGenderLoading]  = useState(false);
  const [error,          setError]          = useState(null);
  const [activeTab,      setActiveTab]      = useState("map");
  const [genderSubTab,   setGenderSubTab]   = useState("winners");
  const [genderSearch,   setGenderSearch]   = useState("");

  useEffect(() => {
    Promise.all([api.searchConstituencies(), api.getStats(), api.getSeatsChart(), api.getParties()])
      .then(([list, statsData, seats, partiesData]) => {
        setConstituencies(list); setStats(statsData); setPieData(seats); setParties(partiesData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab!=="gender"||genderData) return;
    setGenderLoading(true);
    api.getGender().then(setGenderData).catch(console.error).finally(()=>setGenderLoading(false));
  }, [activeTab, genderData]);

  useEffect(() => {
    if (selected) return;
    const fn = chartMode===0 ? api.getSeatsChart : api.getVotesChart;
    fn().then(setPieData).catch(console.error);
  }, [chartMode, selected]);

  const handleSelect = async (item) => {
    let detail = item;
    if (!item.candidates) detail = await api.getConstituency(item.constituencyId);
    setSelected(detail);
    setPieData(await api.getConstituencyChart(detail.constituencyId));
  };

  const handleReset = async () => {
    setSelected(null);
    const fn = chartMode===0 ? api.getSeatsChart : api.getVotesChart;
    setPieData(await fn());
  };

  const femaleWinners = stats?.femaleWinners??0, maleWinners = stats?.maleWinners??0;
  const totalSeats    = stats?.totalConstituencies??0;
  const femWinPct     = totalSeats>0 ? (femaleWinners/totalSeats*100).toFixed(1):"0.0";
  const malWinPct     = totalSeats>0 ? (maleWinners/totalSeats*100).toFixed(1):"0.0";

  const filterGender = (list) => {
    if (!genderSearch.trim()) return list??[];
    const q = genderSearch.trim().toLowerCase();
    return (list??[]).filter(c =>
      c.candidateName.toLowerCase().includes(q) ||
      c.constituencyName.toLowerCase().includes(q) ||
      c.partyName.toLowerCase().includes(q) ||
      String(c.constituencyId).includes(q)
    );
  };

  const card      = "rounded-2xl overflow-hidden transition-all duration-300";
  const cardStyle = { background:"var(--bg-card)", border:"1px solid var(--border)", boxShadow:"var(--shadow)" };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-400 text-sm"
         style={{ background:"var(--bg-primary)" }}>⚠ {error}</div>
  );

  return (
    <div className="min-h-screen" style={{ background:"var(--bg-primary)", color:"var(--text-primary)" }}>

      {/* ── NEWS TICKER (top ad) ─────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-5 pt-3">
        <NewsTicker />
      </div>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 mt-2"
              style={{ background:dark?"rgba(9,16,31,0.93)":"rgba(255,255,255,0.93)",
                       borderBottom:"1px solid var(--border)", backdropFilter:"blur(16px)" }}>
        <div className="max-w-screen-2xl mx-auto px-5 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-sm">🗳</div>
            <div>
              <h1 className="text-sm font-black tracking-tight" style={{ color:"var(--text-primary)" }}>ElectionPulse WB</h1>
              <p className="text-[9px] tracking-widest uppercase" style={{ color:"var(--text-muted)" }}>West Bengal 2026</p>
            </div>
          </div>
          <div className="flex-1 max-w-md"><SearchBar onSelect={handleSelect} darkMode={dark} /></div>
          <nav className="hidden md:flex items-center gap-1 rounded-xl p-1" style={{ background:"var(--bg-secondary)" }}>
            {[["map","🗺 Map"],["parties","🏛 Parties"],["table","📋 Results"],["gender","♀♂ Gender"],["charts","📈 3D Charts"]].map(([id,label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                style={{ background:activeTab===id?"#10b981":"transparent", color:activeTab===id?"#fff":"var(--text-secondary)" }}>
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            {selected && (
              <button onClick={handleReset} className="text-xs px-3 py-1.5 rounded-lg"
                style={{ border:"1px solid var(--border)", color:"var(--text-secondary)" }}>← Overview</button>
            )}
            <button onClick={() => setDark(d=>!d)} title={dark?"Light":"Dark"}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                    style={{ background:"var(--bg-secondary)", border:"1px solid var(--border)" }}>
              {dark
                ? <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 001.06 1.061l1.592-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.592z"/></svg>
                : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color:"var(--text-secondary)" }}><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/></svg>
              }
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-[10px]" style={{ color:"var(--text-muted)" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-5 py-5 space-y-5">

        {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label:"Constituencies", value:loading?"…":stats?.totalConstituencies,                             color:"#10b981",icon:"🗺️" },
            { label:"Total Electors", value:loading?"…":stats?(stats.totalElectors/100000).toFixed(1)+"L":"—", color:"#FBBF24",icon:"📋" },
            { label:"Votes Cast",     value:loading?"…":stats?(stats.totalVotesCast/100000).toFixed(1)+"L":"—",color:"#34D399",icon:"🗳️" },
            { label:"Avg Turnout",    value:loading?"…":stats?stats.avgTurnout.toFixed(1)+"%":"—",             color:"#60A5FA",icon:"📊" },
            { label:"Candidates",     value:loading?"…":stats?.totalCandidates,                                color:"#F472B6",icon:"👤" },
            { label:"Parties",        value:loading?"…":stats?.totalParties,                                   color:"#A78BFA",icon:"🏛️" },
            { label:"Women ♀",        value:loading?"…":`${femaleWinners} (${femWinPct}%)`,                    color:"#ec4899",icon:"♀" },
            { label:"Men ♂",          value:loading?"…":`${maleWinners} (${malWinPct}%)`,                      color:"#3b82f6",icon:"♂" },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-4 py-3 hover:scale-[1.02] transition-transform"
                 style={{ background:"var(--bg-card)", border:"1px solid var(--border)", boxShadow:"var(--shadow)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{s.icon}</span>
                <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color:"var(--text-muted)" }}>{s.label}</span>
              </div>
              <p className="text-xl font-black" style={{ color:s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── MAP TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "map" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">

            {/* Image map */}
            <div className={`${card}`} style={{ ...cardStyle, maxHeight:"680px", overflowY:"auto" }}>
              {loading
                ? <div className="flex h-64 items-center justify-center text-sm" style={{ color:"var(--text-muted)" }}>Connecting…</div>
                : <ConstituencyMap constituencies={constituencies} onSelect={handleSelect} darkMode={dark} />
              }
            </div>

            {/* Right panel */}
            <div className="flex flex-col gap-4">
              <div className={`${card} p-4 flex-1 overflow-y-auto min-h-[280px]`} style={cardStyle}>
                <DetailCard data={selected} />
              </div>

              {/* Side ad */}
              <SideAd />

              <div className={`${card} p-4`} style={{ ...cardStyle, height:"280px" }}>
                {!selected && (
                  <div className="flex gap-1 mb-2">
                    {CHART_MODES.map((m,i) => (
                      <button key={m} onClick={() => setChartMode(i)}
                        className="text-[10px] px-2.5 py-1 rounded-lg font-semibold transition-all"
                        style={{ background:chartMode===i?"rgba(16,185,129,0.15)":"transparent", color:chartMode===i?"#10b981":"var(--text-muted)" }}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                <VotesPieChart data={pieData} title={selected?`${selected.constituencyName} — Votes`:CHART_MODES[chartMode]} />
              </div>
            </div>
          </div>
        )}

        {/* ── 3D CHARTS TAB ───────────────────────────────────────────────── */}
        {activeTab === "charts" && (
          <div className="space-y-5">
            <Charts3D />
          </div>
        )}

        {/* ── PARTIES TAB ─────────────────────────────────────────────────── */}
        {activeTab === "parties" && (
          <div className="space-y-5">

            {/* Comparison bar chart */}
            <div className={`${card} p-5`} style={{ ...cardStyle, height:"480px" }}>
              <PartyComparisonChart parties={parties} />
            </div>

            {/* PIE row — big pie + vote-share pie side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Seats Won pie — large */}
              <div className={card} style={{ ...cardStyle, height:"480px", padding:"20px" }}>
                <VotesPieChart
                  data={parties
                    .filter(p => p.seatsWon > 0)
                    .map(p => ({ name:p.partyName, value:p.seatsWon, fill:p.fill }))}
                  title="Seats Won by Party"
                />
              </div>
              {/* Total Votes pie — large */}
              <div className={card} style={{ ...cardStyle, height:"480px", padding:"20px" }}>
                <VotesPieChart
                  data={parties
                    .filter(p => p.totalVotes > 0)
                    .map(p => ({ name:p.partyName, value:p.totalVotes, fill:p.fill }))}
                  title="Total Votes by Party"
                />
              </div>
            </div>

            {/* Party results table */}
            <div className={card} style={cardStyle}>
              <div className="px-5 py-4" style={{ borderBottom:"1px solid var(--border)" }}>
                <h2 className="text-xs font-bold uppercase tracking-widest"
                    style={{ color:"var(--text-muted)" }}>Party-wise Results — Full Table</h2>
              </div>
              <PartyTable parties={parties} />
            </div>
          </div>
        )}

        {/* ── GENDER TAB ──────────────────────────────────────────────────── */}
        {activeTab === "gender" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={card} style={{ ...cardStyle, border:"1px solid rgba(236,72,153,0.3)" }}>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-pink-400/15 flex items-center justify-center text-3xl font-black text-pink-400">♀</div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-pink-500">Women Winners</p>
                      <p className="text-4xl font-black text-pink-500">{loading?"…":femaleWinners}</p>
                      <p className="text-sm" style={{ color:"var(--text-muted)" }}>{femWinPct}% of {totalSeats}</p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
                    <div className="h-full rounded-full bg-pink-400" style={{ width:`${femWinPct}%` }} />
                  </div>
                </div>
              </div>
              <div className={card} style={{ ...cardStyle, border:"1px solid rgba(59,130,246,0.3)" }}>
                <div className="p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-400/15 flex items-center justify-center text-3xl font-black text-blue-400">♂</div>
                    <div>
                      <p className="text-xs uppercase tracking-widest font-bold text-blue-500">Men Winners</p>
                      <p className="text-4xl font-black text-blue-500">{loading?"…":maleWinners}</p>
                      <p className="text-sm" style={{ color:"var(--text-muted)" }}>{malWinPct}% of {totalSeats}</p>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
                    <div className="h-full rounded-full bg-blue-400" style={{ width:`${malWinPct}%` }} />
                  </div>
                </div>
              </div>
              <div className={`${card} p-5`} style={cardStyle}>
                <p className="text-xs uppercase tracking-widest font-bold mb-4" style={{ color:"var(--text-muted)" }}>All Candidates</p>
                <div className="space-y-3">
                  {[
                    { label:"♀ Female",value:stats?.femaleCount,color:"#ec4899",pct:stats?(stats.femaleCount/stats.totalCandidates*100).toFixed(1):0 },
                    { label:"♂ Male",  value:stats?.maleCount,  color:"#3b82f6",pct:stats?(stats.maleCount/stats.totalCandidates*100).toFixed(1):0 },
                    { label:"NOTA",    value:stats?.notaCount,  color:"#6B7280",pct:stats?(stats.notaCount/stats.totalCandidates*100).toFixed(1):0 },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold" style={{ color:s.color }}>{s.label}</span>
                        <span className="font-mono" style={{ color:"var(--text-muted)" }}>{loading?"…":s.value} ({s.pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
                        <div className="h-full rounded-full" style={{ width:`${s.pct}%`, background:s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={card} style={cardStyle}>
              <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom:"1px solid var(--border)" }}>
                <div className="flex gap-1 rounded-xl p-1" style={{ background:"var(--bg-secondary)" }}>
                  {[["winners","🏆 Winners"],["female","♀ Female"],["male","♂ Male"]].map(([id,label])=>(
                    <button key={id} onClick={()=>setGenderSubTab(id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{ background:genderSubTab===id?"#10b981":"transparent", color:genderSubTab===id?"#fff":"var(--text-secondary)" }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[180px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                       style={{ color:"var(--text-muted)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input type="text" value={genderSearch} onChange={e=>setGenderSearch(e.target.value)}
                    placeholder="Filter…" style={{ background:"var(--input-bg)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
                    className="w-full pl-8 pr-3 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/40" />
                </div>
              </div>
              <div className="p-5">
                {genderLoading
                  ? <div className="flex items-center justify-center py-12 text-sm" style={{ color:"var(--text-muted)" }}>Loading…</div>
                  : genderData ? (
                    <>
                      {genderSubTab==="winners" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {filterGender(genderData.winnerGenderMap).map(w=>{
                            const color=getColor(w.partyName), femWin=w.isFemaleWinner, malWin=w.isMaleWinner;
                            return (
                              <div key={w.constituencyId}
                                   style={{ background:femWin?"rgba(236,72,153,0.05)":malWin?"rgba(59,130,246,0.05)":"var(--bg-secondary)",
                                            border:`1px solid ${femWin?"rgba(236,72,153,0.25)":malWin?"rgba(59,130,246,0.25)":"var(--border)"}`,
                                            borderRadius:"14px", padding:"12px" }}>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md" style={{ background:"var(--border)",color:"var(--text-muted)" }}>#{w.constituencyId}</span>
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${femWin?"bg-pink-400/20 text-pink-500":malWin?"bg-blue-400/20 text-blue-500":"bg-gray-400/15 text-gray-500"}`}>
                                        {femWin?"♀ F":malWin?"♂ M":"?"}
                                      </span>
                                    </div>
                                    <p className="text-xs font-bold truncate" style={{ color:"var(--text-primary)" }}>{w.constituencyName}</p>
                                    <p className="text-[11px] truncate" style={{ color:"var(--text-secondary)" }}>{w.candidateName}</p>
                                  </div>
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ color, background:`${color}20` }}>{w.partyName}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono" style={{ color:"var(--text-muted)" }}>
                                  <span>{w.votesTotal.toLocaleString("en-IN")}</span>
                                  <span style={{ color }}>{w.votePercentage.toFixed(2)}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {genderSubTab==="female" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {filterGender(genderData.femaleCandidates).map((c,i)=><GenderCandidateCard key={i} c={c}/>)}
                        </div>
                      )}
                      {genderSubTab==="male" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
                          {filterGender(genderData.maleCandidates).map((c,i)=><GenderCandidateCard key={i} c={c}/>)}
                        </div>
                      )}
                    </>
                  ) : <p className="text-center py-8 text-sm" style={{ color:"var(--text-muted)" }}>Failed to load</p>
                }
              </div>
            </div>
          </div>
        )}

        {/* ── ALL RESULTS TABLE ────────────────────────────────────────────── */}
        {activeTab === "table" && (
          <div className={card} style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:"1px solid var(--border)" }}>
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color:"var(--text-muted)" }}>All Constituencies — Winner Results</h2>
              <span className="text-xs" style={{ color:"var(--text-muted)" }}>{constituencies.length} seats</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--border)" }}>
                    {["#","Constituency","বাংলা","Winner","Gender","Party","Votes","Margin"].map(h=>(
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-bold whitespace-nowrap"
                          style={{ color:"var(--text-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {constituencies.map(c=>{
                    const color=getColor(c.partyName), isActive=selected?.constituencyId===c.constituencyId;
                    const female=isFemale(c.gender), male=isMale(c.gender);
                    return (
                      <tr key={c.constituencyId}
                          onClick={()=>{handleSelect(c);setActiveTab("map");}}
                          style={{ borderBottom:"1px solid var(--border)", background:isActive?"rgba(16,185,129,0.06)":"transparent", cursor:"pointer" }}
                          className="hover:opacity-80 transition-opacity">
                        <td className="px-4 py-3 font-mono text-xs" style={{ color:"var(--text-muted)" }}>{c.constituencyId}</td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color:"var(--text-primary)" }}>{c.constituencyName}</td>
                        <td className="px-4 py-3 text-xs" style={{ color:"var(--text-muted)" }}>{c.constituencyBengali??"—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color:"var(--text-secondary)" }}>{c.winnerName}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${female?"bg-pink-400/15 text-pink-500":male?"bg-blue-400/15 text-blue-500":"bg-gray-400/15 text-gray-500"}`}>
                            {female?"♀ F":male?"♂ M":"—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ color, background:`${color}20` }}>{c.partyName}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color:"var(--text-secondary)" }}>
                          {c.winnerVotes?.toLocaleString("en-IN")}
                          <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>{c.votePercentage?.toFixed(1)}%</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-emerald-500 font-bold">
                          +{c.margin?.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SPONSOR BANNER ──────────────────────────────────────────────── */}
        <SponsorBanner />

        {/* ── 3D CHARTS (shown on all tabs below fold) ────────────────────── */}
        {activeTab !== "charts" && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color:"var(--text-muted)" }}>
              📈 3D Analytics — Scroll to explore
            </p>
            <Charts3D />
          </div>
        )}

        {/* ── CTA BOTTOM BANNER ───────────────────────────────────────────── */}
        <CtaBanner />

      </main>

      <footer className="mt-6 px-5 py-4 text-center text-[10px] max-w-screen-2xl mx-auto"
              style={{ borderTop:"1px solid var(--border)", color:"var(--text-muted)" }}>
        ElectionPulse WB · Test_Wasim › Election_WB_2026 · ASP.NET Core 8 + React + Recharts + Leaflet
      </footer>
    </div>
  );
}
