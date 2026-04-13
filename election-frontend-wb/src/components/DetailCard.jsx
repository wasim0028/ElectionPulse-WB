// src/components/DetailCard.jsx
function getColor(p) {
  if (!p) return "#6B7280";
  const m = { AITC:"#20C997",TMC:"#20C997",BJP:"#FF6B35",INC:"#2563EB","CPI(M)":"#E63946",CPIM:"#E63946",IND:"#ADB5BD",ISF:"#06D6A0",AIFB:"#F59E0B" };
  for (const [k,v] of Object.entries(m)) if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

// Exact DB values
const isFemale = g => (g ?? "").trim().toUpperCase() === "FEMALE";
const isMale   = g => (g ?? "").trim().toUpperCase() === "MALE";
const isNota   = g => (g ?? "").trim().toUpperCase() === "NOTA";

const CAT = { GEN:"General", SC:"Scheduled Caste", ST:"Scheduled Tribe" };

function StatBox({ label, value, accent, mono }) {
  return (
    <div style={{ background:"var(--bg-secondary)", border:"1px solid var(--border)" }}
         className="rounded-xl px-3 py-3">
      <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color:"var(--text-muted)" }}>
        {label}
      </p>
      <p className={`text-sm font-bold mt-1.5 truncate ${mono ? "font-mono" : ""}`}
         style={{ color: accent ?? "var(--text-primary)" }}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function GenderBadge({ gender, isWinner }) {
  if (isFemale(gender)) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-pink-400/15 text-pink-500 border border-pink-400/30">
      ♀ Female {isWinner && "★"}
    </span>
  );
  if (isMale(gender)) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-blue-400/15 text-blue-500 border border-blue-400/30">
      ♂ Male {isWinner && "★"}
    </span>
  );
  if (isNota(gender)) return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full
                     bg-gray-400/15 text-gray-500 border border-gray-400/30">NOTA</span>
  );
  return null;
}

function CandidateRow({ c, totalVotes }) {
  const color    = getColor(c.partyName);
  const pct      = totalVotes > 0 ? (c.votesTotal / totalVotes * 100) : 0;
  const isWinner = c.rank === 1;

  return (
    <div style={{
           background: isWinner ? "rgba(16,185,129,0.06)" : "var(--bg-secondary)",
           border: `1px solid ${isWinner ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
         }}
         className="rounded-xl px-3 py-2.5 mb-2 transition-all">
      <div className="flex items-start gap-2 mb-1.5">
        <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center
                         text-[10px] font-bold shrink-0`}
              style={{
                background: isWinner ? "#10b981" : "var(--border-hover)",
                color:      isWinner ? "#fff"    : "var(--text-muted)",
              }}>
          {c.rank}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs font-semibold" style={{ color:"var(--text-primary)" }}>
              {c.candidateName}
              {isWinner && <span className="ml-1 text-amber-400">★ Winner</span>}
            </p>
            <GenderBadge gender={c.gender} isWinner={isWinner} />
          </div>
          {c.candidateNameBengali && (
            <p className="text-[10px]" style={{ color:"var(--text-muted)" }}>{c.candidateNameBengali}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ color, background:`${color}20` }}>{c.partyName}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background:"var(--border)" }}>
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width:`${pct.toFixed(1)}%`, background: color }} />
        </div>
        <span className="text-[10px] font-mono shrink-0 w-16 text-right"
              style={{ color:"var(--text-muted)" }}>
          {c.votesTotal.toLocaleString("en-IN")}
        </span>
        <span className="text-[10px] font-mono font-bold shrink-0 w-9 text-right"
              style={{ color }}>{pct.toFixed(1)}%</span>
      </div>

      <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]" style={{ color:"var(--text-muted)" }}>
        {c.age      && <span>Age {c.age}</span>}
        {c.category && <span>{CAT[c.category] ?? c.category}</span>}
        <span className="ml-auto font-mono">
          Gen {c.votesGeneral.toLocaleString("en-IN")} + Post {c.votesPostal.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}

// ── Gender Analysis for one constituency ──────────────────────────────────────
function GenderAnalysis({ candidates, winner }) {
  if (!candidates?.length) return null;

  const realCandidates = candidates.filter(c => !isNota(c.gender));
  const females = realCandidates.filter(c => isFemale(c.gender));
  const males   = realCandidates.filter(c => isMale(c.gender));
  const total   = realCandidates.length;

  const femPct = total > 0 ? (females.length / total * 100).toFixed(0) : 0;
  const malPct = total > 0 ? (males.length   / total * 100).toFixed(0) : 0;

  const winnerIsFemale = isFemale(winner?.gender);
  const winnerIsMale   = isMale(winner?.gender);

  return (
    <div style={{ border:"1px solid var(--border)", background:"var(--bg-secondary)" }}
         className="rounded-xl p-3.5 space-y-3">
      <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color:"var(--text-muted)" }}>
        Gender Analysis
      </p>

      {/* Winner gender highlight box */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border
        ${winnerIsFemale
          ? "bg-pink-400/8 border-pink-400/25"
          : winnerIsMale
          ? "bg-blue-400/8 border-blue-400/25"
          : "border-transparent"}`}>
        <span className="text-2xl">{winnerIsFemale ? "♀" : winnerIsMale ? "♂" : "—"}</span>
        <div>
          <p className="text-sm font-black"
             style={{ color: winnerIsFemale ? "#ec4899" : winnerIsMale ? "#3b82f6" : "var(--text-primary)" }}>
            {winnerIsFemale ? "Women Winner 🏆" : winnerIsMale ? "Men Winner 🏆" : "Unknown"}
          </p>
          <p className="text-[11px]" style={{ color:"var(--text-muted)" }}>
            {winner?.candidateName} · {winner?.partyName}
          </p>
        </div>
      </div>

      {/* Male / Female bars */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="font-bold text-pink-500">♀ Female ({females.length})</span>
            <span className="font-mono" style={{ color:"var(--text-muted)" }}>{femPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
            <div className="h-full rounded-full bg-pink-400 transition-all duration-700"
                 style={{ width:`${femPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="font-bold text-blue-500">♂ Male ({males.length})</span>
            <span className="font-mono" style={{ color:"var(--text-muted)" }}>{malPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background:"var(--border)" }}>
            <div className="h-full rounded-full bg-blue-400 transition-all duration-700"
                 style={{ width:`${malPct}%` }} />
          </div>
        </div>
      </div>

      {/* Female candidate list */}
      {females.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {females.map((f, i) => (
            <span key={i}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                    ${f.rank === 1
                      ? "bg-pink-400/25 text-pink-500 border border-pink-400/50"
                      : "bg-pink-400/8 text-pink-400/70 border border-pink-400/15"}`}>
              {f.candidateName} {f.rank === 1 ? "★" : `#${f.rank}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DetailCard({ data }) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 select-none"
           style={{ color:"var(--text-muted)" }}>
        <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"/>
        </svg>
        <p className="text-sm font-medium">Click a constituency to view results</p>
      </div>
    );
  }

  const winner = data.candidates?.[0];
  const color  = getColor(winner?.partyName);

  return (
    <div className="space-y-4 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black tracking-tight" style={{ color:"var(--text-primary)" }}>
            {data.constituencyName}
          </h2>
          {data.constituencyBengali && (
            <p className="text-sm mt-0.5" style={{ color:"var(--text-muted)" }}>
              {data.constituencyBengali}
            </p>
          )}
          <p className="text-[10px] mt-0.5 uppercase tracking-widest" style={{ color:"var(--text-muted)" }}>
            #{data.constituencyId} · West Bengal 2026
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border mt-0.5"
              style={{ color, borderColor:`${color}40`, background:`${color}15` }}>
          {winner?.partyName}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Winner"         value={winner?.candidateName} />
        <StatBox label="Winning Margin" value={`+${data.margin?.toLocaleString("en-IN")}`} accent="#10b981" mono />
        <StatBox label="Total Electors" value={data.totalElectors?.toLocaleString("en-IN")} mono />
        <StatBox label="Voter Turnout"  value={`${data.turnout?.toFixed(2)}%`} accent="#FBBF24" />
        <StatBox label="Votes Cast"     value={data.totalVotesCast?.toLocaleString("en-IN")} mono />
        <StatBox label="Candidates"     value={data.candidates?.length} />
      </div>

      {/* Gender Analysis */}
      <GenderAnalysis candidates={data.candidates} winner={winner} />

      {/* All candidates */}
      <div>
        <p className="text-[9px] uppercase tracking-widest font-bold mb-2"
           style={{ color:"var(--text-muted)" }}>All Candidates</p>
        <div className="max-h-64 overflow-y-auto pr-1">
          {data.candidates?.map(c => (
            <CandidateRow key={`${c.rank}-${c.candidateName}`}
                          c={c} totalVotes={data.totalVotesCast} />
          ))}
        </div>
      </div>
    </div>
  );
}
