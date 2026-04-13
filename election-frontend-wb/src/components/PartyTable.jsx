// src/components/PartyTable.jsx
function getColor(p) {
  const m = { AITC:"#20C997",TMC:"#20C997",BJP:"#FF6B35",INC:"#2563EB","CPI(M)":"#E63946",CPIM:"#E63946",IND:"#ADB5BD",ISF:"#06D6A0",AIFB:"#F59E0B" };
  if (!p) return "#6B7280";
  for (const [k,v] of Object.entries(m)) if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

export default function PartyTable({ parties = [] }) {
  if (!parties.length) return null;
  const maxSeats = Math.max(...parties.map(p => p.seatsWon));
  const totalVt  = parties.reduce((s,x) => s + x.totalVotes, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom:"1px solid var(--border)" }}>
            {["Party","Seats Won","Total Votes","Vote Share"].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest font-bold"
                  style={{ color:"var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parties.map(p => {
            const color    = getColor(p.partyName);
            const sharePct = totalVt > 0 ? (p.totalVotes/totalVt*100).toFixed(1) : "0.0";
            const barPct   = maxSeats > 0 ? (p.seatsWon/maxSeats*100) : 0;
            return (
              <tr key={p.partyName} style={{ borderBottom:"1px solid var(--border)" }}
                  className="transition-colors hover:opacity-75">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background:color }} />
                    <span className="font-semibold" style={{ color:"var(--text-primary)" }}>{p.partyName}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 rounded-full h-1.5 overflow-hidden" style={{ background:"var(--border)" }}>
                      <div className="h-full rounded-full" style={{ width:`${barPct}%`, background:color }} />
                    </div>
                    <span className="font-black tabular-nums" style={{ color:"var(--text-primary)" }}>
                      {p.seatsWon}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color:"var(--text-secondary)" }}>
                  {p.totalVotes.toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color }}>
                  {sharePct}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
