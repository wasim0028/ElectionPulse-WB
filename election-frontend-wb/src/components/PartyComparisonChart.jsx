// src/components/PartyComparisonChart.jsx
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";

const METRICS = [
  { key:"seatsWon",    label:"Seats Won",    color: (fill) => fill, format: v => v },
  { key:"totalVotes",  label:"Total Votes",  color: (fill) => fill, format: v => (v/100000).toFixed(1)+"L" },
  { key:"voteSharePct",label:"Vote Share %", color: (fill) => fill, format: v => v.toFixed(1)+"%" },
];

function getColor(p) {
  const m = { AITC:"#20C997",TMC:"#20C997",BJP:"#FF6B35",INC:"#2563EB","CPI(M)":"#E63946",
              CPIM:"#E63946",IND:"#ADB5BD",ISF:"#06D6A0",AIFB:"#F59E0B" };
  if (!p) return "#6B7280";
  for (const [k,v] of Object.entries(m)) if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label, metric }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background:"var(--bg-card)", border:"1px solid var(--border)",
      boxShadow:"var(--shadow-lg)", borderRadius:"12px", padding:"10px 14px",
    }}>
      <p style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:4 }}>{label}</p>
      <p style={{ fontSize:12, fontWeight:700, color:d.fill ?? d.color, fontFamily:"monospace" }}>
        {METRICS.find(m => m.key === metric)?.format(d.value) ?? d.value}
      </p>
    </div>
  );
};

export default function PartyComparisonChart({ parties = [] }) {
  const [metric, setMetric] = useState("seatsWon");

  if (!parties.length) return (
    <div className="flex items-center justify-center h-full text-sm"
         style={{ color:"var(--text-muted)" }}>No data</div>
  );

  // Enrich with voteSharePct + color
  const totalVt = parties.reduce((s,p) => s + p.totalVotes, 0);
  const data = parties
    .map(p => ({
      ...p,
      voteSharePct: totalVt > 0 ? +(p.totalVotes / totalVt * 100).toFixed(2) : 0,
      fill: getColor(p.partyName),
    }))
    .sort((a,b) => b[metric] - a[metric])
    .slice(0, 15); // top 15 parties

  const currentMetric = METRICS.find(m => m.key === metric);

  return (
    <div className="flex flex-col h-full">
      {/* Header + toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 shrink-0">
        <h3 className="text-sm font-bold uppercase tracking-widest"
            style={{ color:"var(--text-muted)" }}>Party Comparison</h3>
        <div className="flex gap-1 rounded-xl p-1" style={{ background:"var(--bg-secondary)" }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: metric === m.key ? "#10b981" : "transparent",
                color:      metric === m.key ? "#fff"    : "var(--text-secondary)",
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top:0, right:60, left:90, bottom:0 }}
            barSize={18}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fontSize:10, fill:"var(--text-muted)", fontFamily:"monospace" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={currentMetric.format}
            />
            <YAxis
              type="category"
              dataKey="partyName"
              tick={{ fontSize:11, fill:"var(--text-secondary)", fontWeight:600 }}
              tickLine={false}
              axisLine={false}
              width={85}
            />
            <Tooltip
              content={<CustomTooltip metric={metric} />}
              cursor={{ fill:"var(--border)", opacity:0.5 }}
            />
            <Bar dataKey={metric} radius={[0, 6, 6, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
              <LabelList
                dataKey={metric}
                position="right"
                formatter={currentMetric.format}
                style={{ fontSize:10, fontFamily:"monospace", fill:"var(--text-muted)", fontWeight:600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top 3 podium summary */}
      <div className="mt-4 grid grid-cols-3 gap-2 shrink-0">
        {data.slice(0,3).map((p,i) => (
          <div key={p.partyName}
               className="rounded-xl px-3 py-2 text-center"
               style={{ background:`${p.fill}12`, border:`1px solid ${p.fill}30` }}>
            <p className="text-[10px] font-bold mb-0.5" style={{ color:p.fill }}>
              {["🥇","🥈","🥉"][i]} {p.partyName}
            </p>
            <p className="text-sm font-black" style={{ color:p.fill }}>
              {currentMetric.format(p[metric])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
