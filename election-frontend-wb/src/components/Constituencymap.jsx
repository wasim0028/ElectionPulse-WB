// src/components/ConstituencyMap.jsx
// Clickable static image map — 294 constituency hotspots on the uploaded WB map
// Image original size: 1665 × 2000 px

import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "../services/api";

// ── All 294 constituency pixel coordinates (x, y) in 1665×2000 image ─────────
// District groups for reference:
// 1-9: Cooch Behar | 10-14: Alipurduar | 15-20: Jalpaiguri | 21-26: Darjeeling
// 27-34: Uttar Dinajpur | 35-40: Dakshin Dinajpur | 41-51: Malda
// 52-73: Murshidabad | 74-90: Nadia | 91-126: North 24 Parganas
// 127-143: South 24 Parganas | 144-194: Kolkata (inset) | 195-211: Howrah/Hooghly
// 212-228: Paschim Medinipur | 229-245: South-West | 246-265: Birbhum/Bardhaman
// 266-279: Purulia | 280-286: Paschim Bardhaman | 287-294: Purba Medinipur
export const WB_COORDS = {
  // Cooch Behar
  1:[1286,313], 2:[1383,304], 3:[1427,286,21], 4:[1421,338,21], 5:[1379,351],
  6:[1422,394], 7:[1483,368], 8:[1495,306], 9:[1550,276],
  // Alipurduar
  10:[1523,234], 11:[1473,204], 12:[1416,232], 13:[1344,218], 14:[1377,169],
  // Jalpaiguri
  15:[1304,225], 16:[1264,262], 17:[1233,288], 18:[1157,231], 19:[1154,163], 20:[1210,182],
  // Darjeeling / Kalimpong
  21:[1254,138], 22:[1214,74], 23:[1023,74], 24:[1107,115], 25:[1117,185], 26:[1133,197],
  // Uttar Dinajpur
  27:[1063,240], 28:[1144,296], 29:[1066,366], 30:[1033,400],
  31:[998,465], 32:[1014,519], 33:[1048,531], 34:[1099,582],
  // Dakshin Dinajpur
  35:[1038,579], 36:[1061,607], 37:[1135,596], 38:[1213,621], 39:[1274,688], 40:[1220,679],
  // Malda
  41:[1183,684], 42:[1102,643], 43:[1144,726], 44:[1073,709], 45:[1038,641],
  46:[985,665], 47:[1042,690], 48:[989,703], 49:[1004,759], 50:[1080,774], 51:[1069,813],
  // Murshidabad
  52:[1022,803], 53:[1041,826], 54:[1035,869], 55:[1011,869], 56:[1011,900],
  57:[1048,918], 58:[1039,951], 59:[1067,943], 60:[1094,1018], 61:[1098,972],
  62:[1170,999], 63:[1197,1012], 64:[1117,1035], 65:[1060,1046], 66:[1029,1074],
  67:[1014,1125], 68:[1074,1093], 69:[1066,1151], 70:[1127,1147], 71:[1107,1119],
  72:[1124,1074], 73:[1151,1101],
  // Nadia
  74:[1149,1135], 75:[1213,1060], 76:[1255,1026], 77:[1255,1094], 78:[1217,1143],
  79:[1174,1182], 80:[1132,1185], 81:[1191,1244], 82:[1219,1243], 83:[1244,1294],
  84:[1170,1299], 85:[1197,1318], 86:[1170,1346], 87:[1208,1346], 88:[1272,1284],
  89:[1257,1332], 90:[1216,1387],
  // North 24 Parganas
  91:[1255,1413], 92:[1207,1425], 93:[1254,1435], 94:[1335,1374], 95:[1286,1397],
  96:[1316,1441], 97:[1285,1485], 98:[1322,1482], 99:[1324,1525], 100:[1270,1497],
  101:[1241,1476], 102:[620,347], 103:[521,241], 104:[596,266],
  105:[474,362], 106:[532,329], 107:[461,421], 108:[457,484], 109:[504,481],
  110:[529,591], 111:[502,546], 112:[461,606], 113:[463,628], 114:[516,653],
  115:[608,674], 116:[549,746], 117:[546,703], 118:[580,557], 119:[598,528],
  120:[1272,1537], 121:[1280,1571], 122:[1292,1610], 123:[1333,1651],
  124:[1342,1562], 125:[1302,1550], 126:[1361,1619],
  // South 24 Parganas
  127:[1344,1782], 128:[1289,1701], 129:[1254,1816], 130:[1192,1844],
  131:[1142,1837], 132:[1114,1874], 133:[1147,1753], 134:[1204,1757],
  135:[1179,1750], 136:[1227,1732], 137:[1227,1682], 138:[1258,1696],
  139:[1264,1649], 140:[1208,1672], 141:[1192,1697], 142:[1160,1684], 143:[1129,1712],
  // Kolkata inset (left panel: x=56-554, y=128-650)
  144:[1108,1676], 145:[327,1013], 146:[414,962], 147:[639,904],
  148:[1244,1585], 149:[514,785], 150:[501,857], 151:[524,899],
  152:[455,857], 153:[426,872], 154:[402,838], 155:[358,828],
  156:[257,879], 157:[332,763], 158:[393,799], 159:[427,787],
  160:[448,816], 161:[466,782], 162:[455,743], 163:[488,759],
  164:[492,735], 165:[467,721], 166:[458,693], 167:[491,704],
  168:[485,676], 169:[439,638], 170:[430,715], 171:[408,737],
  172:[380,687], 173:[367,740], 174:[271,781], 175:[168,766],
  176:[199,821], 177:[1069,1591], 178:[1089,1656], 179:[1064,1669],
  180:[1057,1640], 181:[1042,1609], 182:[1051,1549], 183:[163,640],
  184:[341,649], 185:[435,590], 186:[380,529], 187:[396,472],
  188:[330,443], 189:[414,357], 190:[446,278], 191:[1183,1391],
  192:[1119,1404], 193:[346,213], 194:[296,547],
  // Howrah / Hooghly
  195:[1070,1532], 196:[1113,1509], 197:[1113,1463], 198:[1063,1500],
  199:[1045,1518], 200:[1001,1510], 201:[966,1476], 202:[1014,1568],
  203:[1041,1684], 204:[1008,1649], 205:[971,1643], 206:[996,1716],
  207:[1038,1725], 208:[1072,1722], 209:[1122,1753], 210:[1061,1769], 211:[1036,1750],
  // Paschim Medinipur (south-west)
  212:[932,1799], 213:[1022,1851], 214:[979,1799], 215:[1020,1806],
  216:[988,1881], 217:[921,1899], 218:[927,1863], 219:[892,1809],
  220:[774,1769], 221:[780,1718], 222:[761,1635], 223:[832,1778],
  224:[873,1637], 225:[886,1726], 226:[960,1716], 227:[892,1676], 228:[821,1678],
  // South-West
  229:[936,1663], 230:[994,1584], 231:[955,1576], 232:[929,1560],
  233:[830,1504], 234:[802,1553], 235:[894,1575], 236:[836,1606],
  237:[701,1603], 238:[608,1519], 239:[510,1415], 240:[466,1396],
  241:[479,1346], 242:[558,1329], 243:[623,1391], 244:[652,1347], 245:[592,1299],
  // Birbhum / Purba Bardhaman
  246:[669,1281], 247:[752,1274], 248:[714,1338], 249:[688,1450],
  250:[735,1521], 251:[769,1488], 252:[754,1363], 253:[813,1347],
  254:[791,1390], 255:[849,1438], 256:[894,1438], 257:[942,1429],
  258:[901,1360], 259:[970,1365], 260:[1013,1366], 261:[1016,1413],
  262:[1066,1403], 263:[1094,1343], 264:[1148,1366], 265:[1095,1390],
  // Purulia
  266:[1058,1366], 267:[1027,1324], 268:[1133,1344], 269:[1122,1296],
  270:[1107,1269], 271:[1044,1196], 272:[1047,1251], 273:[911,1285],
  274:[929,1343], 275:[827,1234], 276:[864,1266], 277:[832,1284],
  278:[802,1257], 279:[776,1229],
  // Paschim Bardhaman
  280:[716,1237], 281:[730,1222], 282:[694,1226], 283:[702,1193],
  284:[805,1190], 285:[844,1138], 286:[914,1210],
  // Purba Medinipur
  287:[1007,1241], 288:[945,1181], 289:[917,1124], 290:[976,1128],
  291:[930,1081], 292:[998,1066], 293:[994,1024], 294:[1002,969],
};




// ── Party colour helper ────────────────────────────────────────────────────
function getColor(p) {
  if (!p) return "#6B7280";
  const m = {
    AITC:"#20C997", TMC:"#20C997", BJP:"#FF6B35", INC:"#2563EB",
    "CPI(M)":"#E63946", CPIM:"#E63946", IND:"#ADB5BD",
    ISF:"#079faa", AIFB:"#F59E0B",
  };
  for (const [k,v] of Object.entries(m))
    if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

// ── Tooltip card ──────────────────────────────────────────────────────────
function TooltipCard({ c, pos, onClose }) {
  if (!c) return null;
  const color   = getColor(c.partyName);
  const TT_W    = 245;   // tooltip width
  const TT_H    = 220;   // approx tooltip height
  const MARGIN  = 12;    // gap between dot and tooltip edge

  // ── Smart 4-quadrant positioning ────────────────────────────────────────
  // Decide horizontal side: prefer RIGHT, but flip to LEFT when near right edge
  const showRight = pos.x + TT_W + MARGIN < pos.cw - 20;
  const rawLeft   = showRight
    ? pos.x + MARGIN                    // right of dot
    : pos.x - TT_W - MARGIN;            // left of dot

  // Decide vertical: prefer ABOVE click, but clamp so tooltip stays in view
  const rawTop = pos.y - TT_H / 2;     // vertically centered on click

  // Clamp both axes so tooltip never goes off-screen
  const left = Math.max(8, Math.min(rawLeft, pos.cw - TT_W - 8));
  const top  = Math.max(8, rawTop);

  return (
    <div style={{
      position:"absolute", left, top, zIndex:1000, width:TT_W,
      background:"var(--bg-card)",
      border:`1px solid ${color}60`,
      borderRadius:16, padding:"14px 16px",
      boxShadow:"0 12px 40px rgba(0,0,0,0.4)",
      pointerEvents:"auto",
      animation:"ttFadeIn 0.18s ease-out",
    }}>
      <style>{`@keyframes ttFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`}</style>
      <button onClick={onClose} style={{
        position:"absolute", top:8, right:10,
        background:"none", border:"none", cursor:"pointer",
        color:"var(--text-muted)", fontSize:16, lineHeight:1,
      }}>×</button>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <div style={{
          width:28, height:28, borderRadius:8, flexShrink:0,
          background:`${color}20`, border:`1px solid ${color}40`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:800, color,
        }}>{c.constituencyId}</div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontSize:13, fontWeight:800, color:"var(--text-primary)",
                       margin:0, lineHeight:1.2 }}>{c.constituencyName}</p>
          {c.constituencyBengali && (
            <p style={{ fontSize:11, color:"var(--text-muted)", margin:0 }}>
              {c.constituencyBengali}
            </p>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
        {[
          { l:"Winner",  v:c.winnerName,                          col:"var(--text-primary)" },
          { l:"Party",   v:c.partyName,                           col:color },
          { l:"Margin",  v:`+${c.margin?.toLocaleString("en-IN")}`, col:"#10b981", mono:true },
          { l:"Votes",   v:c.winnerVotes?.toLocaleString("en-IN"), col:"var(--text-secondary)", mono:true },
          { l:"Electors",v:c.totalElectors?.toLocaleString("en-IN"),col:"var(--text-muted)", mono:true },
          { l:"Share",   v:`${c.votePercentage?.toFixed(1)}%`,    col:color, mono:true },
        ].map(s => (
          <div key={s.l} style={{
            background:"var(--bg-secondary)", borderRadius:8, padding:"6px 8px",
          }}>
            <p style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em",
                         color:"var(--text-muted)", margin:0, fontWeight:700 }}>{s.l}</p>
            <p style={{ fontSize:11, color:s.col, fontWeight:700, margin:"2px 0 0",
                         fontFamily:s.mono?"monospace":"inherit",
                         overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {s.v ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ConstituencyMap({ constituencies = [], onSelect, darkMode }) {
  const [tooltip,    setTooltip]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [hovered,    setHovered]    = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [imgScale,   setImgScale]   = useState({ x:1, y:1 });
  const containerRef = useRef(null);
  const imgRef       = useRef(null);

  // Map constituency id → list data for quick lookup
  const lookup = Object.fromEntries(
    constituencies.map(c => [c.constituencyId, c])
  );

  // Update scale whenever image renders or window resizes
  const updateScale = useCallback(() => {
    if (!imgRef.current) return;
    const r = imgRef.current.getBoundingClientRect();
    setImgScale({ x: r.width / 1665, y: r.height / 2000 });
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  const handleDotClick = useCallback(async (cId, e) => {
    const c = lookup[cId];
    if (!c) return;
    const rect  = containerRef.current.getBoundingClientRect();
    const pos   = {
      x:  e.clientX - rect.left,
      y:  e.clientY - rect.top,
      cw: rect.width,
      ch: rect.height,
    };
    setSelectedId(cId);
    setTooltip({ c, pos });
    onSelect?.(c);

    // Fetch full detail
    setLoading(true);
    try {
      const detail = await api.getConstituency(cId);
      onSelect?.(detail);
      setTooltip(t => t ? { ...t, c: { ...t.c, ...c } } : null);
    } catch(err) { console.error(err); }
    finally     { setLoading(false); }
  }, [lookup, onSelect]);

  // Determine dot radius based on constituency size (scale-aware)
  const DOT_R       = 5;   // normal radius in image coords
  const DOT_R_HOV   = 8;
  const DOT_R_SEL   = 11;

  return (
    <div ref={containerRef}
         style={{ position:"relative", width:"100%", height:"100%",
                  background: darkMode ? "#050c18" : "#e8eef5",
                  overflow:"auto" }}>

      {/* Loading indicator */}
      {loading && (
        <div style={{ position:"absolute", top:10, right:10, zIndex:900,
                      background:"var(--bg-card)", border:"1px solid var(--border)",
                      borderRadius:10, padding:"6px 12px", fontSize:12,
                      color:"var(--text-secondary)", display:"flex", gap:6, alignItems:"center" }}>
          <svg style={{ width:13, height:13, animation:"spin 1s linear infinite" }}
               fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity:.25 }}/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" style={{ opacity:.75 }}/>
          </svg>
          Loading…
        </div>
      )}

      {/* Map image + SVG overlay */}
      <div style={{ position:"relative", display:"inline-block", minWidth:"100%", minHeight:"100%" }}>
        <img
          ref={imgRef}
          src="/wb_map.png"
          alt="West Bengal Constituency Map"
          style={{ width:"100%", height:"auto", display:"block",
                   filter: darkMode ? "brightness(1)" : "brightness(0.92) contrast(1.08)" }}
          onLoad={updateScale}
        />

        {/* SVG hotspot overlay */}
        <svg
          style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
                   overflow:"visible", pointerEvents:"none" }}
          viewBox="0 0 1665 2000"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.entries(WB_COORDS).map(([idStr, [cx, cy]]) => {
            const id    = parseInt(idStr);
            const c     = lookup[id];
            const color = c ? getColor(c.partyName) : "#6B7280";
            const isSel = selectedId === id;
            const isHov = hovered === id;
            const r     = isSel ? DOT_R_SEL : isHov ? DOT_R_HOV : DOT_R;

            return (
              <g key={id} style={{ pointerEvents:"all", cursor:"pointer" }}
                 onClick={(e) => handleDotClick(id, e)}
                 onMouseEnter={() => setHovered(id)}
                 onMouseLeave={() => setHovered(null)}>
                {/* Invisible large hit area */}
                <circle cx={cx} cy={cy} r={18} fill="transparent" />

                {/* Pulse ring for selected */}
                {isSel && (
                  <circle cx={cx} cy={cy} r={DOT_R_SEL + 6}
                          fill="none" stroke="#FBBF24" strokeWidth={1.5} opacity={0.5} />
                )}

                {/* Glow for hovered */}
                {isHov && !isSel && (
                  <circle cx={cx} cy={cy} r={DOT_R_HOV + 4}
                          fill={color} opacity={0.2} />
                )}

                {/* Main dot */}
                <circle cx={cx} cy={cy} r={r}
                        fill={color}
                        fillOpacity={isSel ? 1 : isHov ? 0.95 : 0.78}
                        stroke={isSel ? "#FBBF24" : isHov ? "white" : "rgba(255,255,255,0.35)"}
                        strokeWidth={isSel ? 2 : isHov ? 1.5 : 0.8}
                        style={{ transition:"all 0.15s ease" }} />

                {/* Constituency number on hover/selected */}
                {(isHov || isSel) && (
                  <text x={cx} y={cy - r - 3}
                        textAnchor="middle"
                        fill={isSel ? "#FBBF24" : "white"}
                        fontSize={8}
                        fontWeight={700}
                        fontFamily="monospace"
                        style={{ pointerEvents:"none", userSelect:"none" }}>
                    {id}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <TooltipCard
            c={tooltip.c}
            pos={tooltip.pos}
            onClose={() => { setTooltip(null); setSelectedId(null); }}
          />
        )}
      </div>

      {/* Legend bar */}
      <div style={{
        position:"sticky", bottom:0, left:0, right:0, zIndex:800,
        background:"var(--bg-card)", borderTop:"1px solid var(--border)",
        padding:"7px 16px", display:"flex", flexWrap:"wrap",
        alignItems:"center", gap:12,
      }}>
        <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em",
                       color:"var(--text-muted)", fontWeight:700 }}>Party</span>
        {[
          ["AITC/TMC","#20C997"],["BJP","#FF6B35"],["INC","#2563EB"],
          ["CPI(M)","#E63946"],["ISF","#06D6A0"],["IND","#ADB5BD"],["Others","#9D4EDD"],
        ].map(([p,c]) => (
          <div key={p} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:9, height:9, borderRadius:"50%", background:c, flexShrink:0 }} />
            <span style={{ fontSize:11, color:"var(--text-secondary)", fontWeight:600 }}>{p}</span>
          </div>
        ))}
        <span style={{ marginLeft:"auto", fontSize:10, color:"var(--text-muted)", fontFamily:"monospace" }}>
          294 constituencies · click any dot to view results
        </span>
      </div>

      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  );
}
