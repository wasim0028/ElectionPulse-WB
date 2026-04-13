// src/components/SearchBar.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../services/api";

function useDebounce(v, d) {
  const [deb, setDeb] = useState(v);
  useEffect(() => { const t = setTimeout(() => setDeb(v), d); return () => clearTimeout(t); }, [v, d]);
  return deb;
}

function getColor(p) {
  if (!p) return "#6B7280";
  const m = { AITC:"#20C997",TMC:"#20C997",BJP:"#FF6B35",INC:"#2563EB","CPI(M)":"#E63946",CPIM:"#E63946",IND:"#ADB5BD",ISF:"#06D6A0",AIFB:"#F59E0B" };
  for (const [k,v] of Object.entries(m)) if (p.toUpperCase().includes(k)) return v;
  return "#9D4EDD";
}

function Highlight({ text, query }) {
  if (!text || !query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-emerald-400/30 text-emerald-600 dark:text-emerald-300 rounded-sm px-0.5 not-italic font-bold">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// Gender icon for winner badge
function GenderIcon({ gender }) {
  if (!gender) return null;
  const isFemale = gender.toUpperCase() === "FEMALE";
  const isMale   = gender.toUpperCase() === "MALE";
  if (!isFemale && !isMale) return null;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
      ${isFemale ? "bg-pink-400/20 text-pink-500" : "bg-blue-400/20 text-blue-500"}`}>
      {isFemale ? "♀" : "♂"}
    </span>
  );
}

export default function SearchBar({ onSelect, darkMode }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [active,  setActive]  = useState(-1);
  const inputRef              = useRef(null);
  const debouncedQuery        = useDebounce(query, 280);
  const isId                  = /^\d+$/.test(query.trim());

  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    api.searchConstituencies(debouncedQuery)
      .then(data => { setResults(data); setOpen(true); setActive(-1); })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const select = useCallback((item) => {
    setQuery(item.constituencyName);
    setOpen(false);
    onSelect?.(item);
  }, [onSelect]);

  const handleKey = useCallback((e) => {
    if (!open) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setActive(p => Math.min(p+1, results.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(p => Math.max(p-1, 0)); }
    else if (e.key === "Enter" && active >= 0) select(results[active]);
    else if (e.key === "Escape") setOpen(false);
  }, [open, active, results, select]);

  return (
    <div className="relative w-full" role="combobox" aria-expanded={open}>
      <div className="relative">
        <span className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none"
              style={{ color:"var(--text-muted)" }}>
          {loading
            ? <svg className="w-4 h-4 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder="Search by constituency name or ID…"
          style={{ background:"var(--input-bg)", border:"1px solid var(--border)", color:"var(--text-primary)" }}
          className="w-full pl-10 pr-20 py-3 rounded-xl text-sm font-medium
                     focus:outline-none focus:ring-2 focus:ring-emerald-400/50
                     transition-all duration-200 placeholder:opacity-50"
        />

        {/* Mode badge */}
        {query && (
          <span className={`absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-bold
                           px-1.5 py-0.5 rounded-full uppercase tracking-widest
                           ${isId ? "bg-blue-400/20 text-blue-500" : "bg-emerald-400/20 text-emerald-600 dark:text-emerald-400"}`}>
            {isId ? "ID" : "Name"}
          </span>
        )}
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); inputRef.current?.focus(); }}
                  className="absolute inset-y-0 right-2.5 flex items-center"
                  style={{ color:"var(--text-muted)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul style={{ background:"var(--bg-card)", border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)" }}
            className="absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden divide-y max-h-72 overflow-y-auto">
          {results.map((item, i) => {
            const color = getColor(item.partyName);
            return (
              <li key={item.constituencyId}
                  onMouseDown={() => select(item)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    background: i === active ? "var(--bg-secondary)" : "transparent",
                    borderColor: "var(--border)",
                  }}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors">

                {/* ID circle */}
                <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                                text-xs font-black"
                     style={{ background:`${color}18`, color }}>
                  {item.constituencyId}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color:"var(--text-primary)" }}>
                      {/* Highlight name match */}
                      {isId
                        ? item.constituencyName
                        : <Highlight text={item.constituencyName} query={query} />
                      }
                    </p>
                    <GenderIcon gender={item.gender} />
                  </div>
                  {item.constituencyBengali && (
                    <p className="text-[11px] truncate" style={{ color:"var(--text-muted)" }}>
                      {item.constituencyBengali}
                    </p>
                  )}
                  <p className="text-[11px] mt-0.5 flex items-center gap-1.5">
                    <span style={{ color:"var(--text-secondary)" }}>{item.winnerName}</span>
                    <span style={{ color:"var(--border-hover)" }}>·</span>
                    <span style={{ color }} className="font-semibold">{item.partyName}</span>
                    {item.margin > 0 && (
                      <><span style={{ color:"var(--border-hover)" }}>·</span>
                      <span className="text-emerald-500 font-mono">+{item.margin.toLocaleString("en-IN")}</span></>
                    )}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold" style={{ color }}>{item.votePercentage?.toFixed(1)}%</div>
                  <div className="text-[10px]" style={{ color:"var(--text-muted)" }}>vote share</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && !results.length && !loading && query.trim() && (
        <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", color:"var(--text-muted)" }}
             className="absolute z-50 mt-1.5 w-full rounded-xl px-4 py-5 text-center text-sm">
          No results for <em>"{query}"</em>
        </div>
      )}
    </div>
  );
}
