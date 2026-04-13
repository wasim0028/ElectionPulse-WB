// src/components/VotesPieChart.jsx
import { useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Sector,
} from "recharts";

// ── Active sector: expands outward + shows value in center ───────────────────
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle,
          fill, payload, percent, value } = props;
  return (
    <g>
      {/* Glow ring */}
      <Sector cx={cx} cy={cy}
              innerRadius={outerRadius + 4} outerRadius={outerRadius + 10}
              startAngle={startAngle} endAngle={endAngle}
              fill={fill} opacity={0.2} />
      {/* Expanded sector */}
      <Sector cx={cx} cy={cy}
              innerRadius={innerRadius} outerRadius={outerRadius + 6}
              startAngle={startAngle} endAngle={endAngle}
              fill={fill} opacity={0.97} />
      {/* Center: party name */}
      <text x={cx} y={cy - 16} textAnchor="middle"
            fill={fill} fontSize={13} fontWeight={700}
            fontFamily="Sora, sans-serif">
        {payload.name.length > 10 ? payload.name.slice(0,10)+"…" : payload.name}
      </text>
      {/* Center: percentage */}
      <text x={cx} y={cy + 6} textAnchor="middle"
            fill={fill} fontSize={20} fontWeight={900}
            fontFamily="Sora, sans-serif">
        {(percent * 100).toFixed(1)}%
      </text>
      {/* Center: value */}
      <text x={cx} y={cy + 24} textAnchor="middle"
            fill="var(--text-muted)" fontSize={11} fontFamily="monospace">
        {value > 9999 ? value.toLocaleString("en-IN") : value}
      </text>
    </g>
  );
};

// ── Tooltip: works in both light and dark ────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: { fill } } = payload[0];
  const total = payload[0].payload?.total || 1;
  return (
    <div style={{
      background:"var(--bg-card)", border:`1px solid ${fill}50`,
      borderRadius:12, padding:"10px 14px", minWidth:150,
      boxShadow:"var(--shadow-lg)",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
        <span style={{ width:10, height:10, borderRadius:3, background:fill, flexShrink:0 }} />
        <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>{name}</span>
      </div>
      <p style={{ fontSize:12, fontFamily:"monospace", color:fill, fontWeight:700, paddingLeft:18 }}>
        {value > 9999 ? value.toLocaleString("en-IN") : value}
      </p>
    </div>
  );
};

export default function VotesPieChart({ data = [], title = "Votes by Party" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const onEnter = useCallback((_, i) => setActiveIndex(i), []);

  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-sm"
         style={{ color:"var(--text-muted)" }}>No data</div>
  );

  const total = data.reduce((s,d) => s + (d.value ?? 0), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", width:"100%" }}>

      {/* Title row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    marginBottom:8, padding:"0 4px", flexShrink:0 }}>
        <h3 style={{ fontSize:11, fontWeight:700, textTransform:"uppercase",
                     letterSpacing:"0.08em", color:"var(--text-muted)", margin:0 }}>
          {title}
        </h3>
        <span style={{ fontSize:10, fontFamily:"monospace", color:"var(--text-muted)" }}>
          Total: {total > 9999 ? total.toLocaleString("en-IN") : total}
        </span>
      </div>

      {/* Pie chart — takes most of height */}
      <div style={{ flex:1, minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top:10, right:10, bottom:10, left:10 }}>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius="32%" outerRadius="60%"
              paddingAngle={2}
              dataKey="value"
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              onMouseEnter={onEnter}
              animationBegin={0}
              animationDuration={600}
              animationEasing="ease-out"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — full party names always visible */}
      <div style={{
        flexShrink:0,
        display:"grid",
        gridTemplateColumns: data.length <= 4 ? "1fr 1fr" : "1fr 1fr 1fr",
        gap:"4px 12px",
        padding:"8px 4px 2px",
        borderTop:"1px solid var(--border)",
        marginTop:4,
      }}>
        {data.map((d, i) => {
          const pct   = total > 0 ? (d.value / total * 100).toFixed(1) : 0;
          const isAct = i === activeIndex;
          return (
            <div key={i}
                 onMouseEnter={() => setActiveIndex(i)}
                 style={{
                   display:"flex", alignItems:"center", gap:6,
                   cursor:"pointer", padding:"3px 6px", borderRadius:8,
                   background: isAct ? `${d.fill}18` : "transparent",
                   border: `1px solid ${isAct ? d.fill+"40" : "transparent"}`,
                   transition:"all 0.15s",
                 }}>
              <span style={{
                width:9, height:9, borderRadius:2,
                background:d.fill, flexShrink:0,
              }} />
              {/* Full party name */}
              <span style={{
                fontSize:11, fontWeight: isAct ? 700 : 500,
                color: isAct ? d.fill : "var(--text-secondary)",
                flex:1, whiteSpace:"nowrap", overflow:"hidden",
                textOverflow:"ellipsis",
              }}>
                {d.name}
              </span>
              {/* Percentage always visible */}
              <span style={{
                fontSize:10, fontFamily:"monospace", fontWeight:700,
                color: isAct ? d.fill : "var(--text-muted)",
                flexShrink:0,
              }}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
