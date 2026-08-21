/* AgendaShareView — public read-only kalenderweergave via gedeelde link */

/* Inject print styles once when the module loads */
(function() {
  if (document.getElementById('agenda-print-styles')) return;
  const s = document.createElement('style');
  s.id = 'agenda-print-styles';
  s.textContent = `
    @media print {
      @page { size: A4 landscape; margin: 12mm 14mm; }

      body { background: #fff !important; }

      /* Hide everything except the agenda view */
      body > * { display: none !important; }
      #root { display: block !important; }

      /* Hide non-calendar UI: nav buttons, PDF button, update timestamp, legend toggle */
      .agenda-nav-bar,
      .agenda-legend-toggle,
      .agenda-footer { display: none !important; }

      /* Show legend expanded in print */
      .agenda-legend-body { display: flex !important; }

      /* Reset overflow so full grid prints */
      .agenda-cal-scroll { overflow: visible !important; }
      .agenda-cal-inner  { min-width: 0 !important; width: 100% !important; }

      /* Scale entire content to fit on one page */
      .agenda-page-root { zoom: 0.68; }

      /* Calendar grid fills the page width */
      .agenda-cal-grid  { display: grid !important; grid-template-columns: repeat(7, 1fr) !important; gap: 2px !important; }
      .agenda-cal-cell  { min-height: 44px !important; page-break-inside: avoid; break-inside: avoid; }

      /* Event chips: keep colors, allow text to wrap slightly */
      .agenda-ev-chip   { font-size: 7pt !important; white-space: normal !important; overflow: visible !important; padding: 1px 3px !important; }

      /* No page breaks inside the whole calendar */
      .agenda-cal-scroll { page-break-inside: avoid; break-inside: avoid; }

      /* Links look normal */
      a { color: inherit !important; text-decoration: none !important; }
    }
  `;
  document.head.appendChild(s);
})();

const CAL_MONTH_NAMES_SV = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
];
const CAL_DAY_NAMES_SV = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
const CAL_LOC_COLORS_SV = [
  '#9e3b2e','#2c5f8a','#3d6b4f','#a07020',
  '#7b4d9e','#c87040','#2a7a8a','#6b3d7a',
  '#5a6b2a','#6b3b3b',
];

function parseCalDateSV(str) {
  if (!str || !/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return null;
  const [dd, mm, yyyy] = str.split('/').map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}
function calDateKeySV(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function AgendaShareView({ agendaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    LB_SYNC.loadAgendaShare(agendaId).then(d => { setData(d); setLoading(false); });
  }, [agendaId]);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
      Laden…
    </div>
  );
  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>
      Agenda niet gevonden.
    </div>
  );

  const visibleLocs = (data.locations || []).filter(l => !(data.removed || []).includes(l.id));
  const locColor = {};
  visibleLocs.forEach((l, i) => { locColor[l.id] = CAL_LOC_COLORS_SV[i % CAL_LOC_COLORS_SV.length]; });

  const events = {};
  const add = (key, ev) => { (events[key] = events[key] || []).push(ev); };
  for (const loc of visibleLocs) {
    const edit = (data.edits || {})[loc.id] || {};
    const name = edit.name || loc.name;
    const color = locColor[loc.id];
    const removedDays = new Set((edit.removedShootDays || []).map(String));
    for (const d of loc.shootDates || []) {
      if (removedDays.has(String(d.dayNumber))) continue;
      const ov = (edit.dayOverrides || {})[String(d.dayNumber)] || {};
      const date = parseCalDateSV(ov.date || d.date);
      if (date) add(calDateKeySV(date), { type: 'shoot', name, locId: loc.id, color, dayNum: ov.dayNumber ?? d.dayNumber });
    }
    for (const d of edit.extraShootDays || []) {
      const date = parseCalDateSV(d.date);
      if (date) add(calDateKeySV(date), { type: 'shoot', name, locId: loc.id, color, dayNum: null });
    }
    (edit.prepDates || []).forEach((ds, i) => {
      const date = parseCalDateSV(ds);
      if (date) add(calDateKeySV(date), { type: 'prep', name, locId: loc.id, color, idx: i+1, total: edit.prepDays, timing: edit.prepTiming || null });
    });
    (edit.wrapDates || []).forEach((ds, i) => {
      const date = parseCalDateSV(ds);
      if (date) add(calDateKeySV(date), { type: 'wrap', name, locId: loc.id, color, idx: i+1, total: edit.wrapDays, timing: edit.wrapTiming || null });
    });
  }

  const allKeys = Object.keys(events).sort();
  const defaultMonth = allKeys.length ? (() => { const p = allKeys[0].split('-').map(Number); return new Date(p[0], p[1]-1, 1); })() : new Date();

  return <AgendaShareViewInner data={data} events={events} visibleLocs={visibleLocs} locColor={locColor} defaultMonth={defaultMonth} />;
}

function AgendaShareViewInner({ data, events, visibleLocs, locColor, defaultMonth }) {
  const [viewDate, setViewDate] = useState(defaultMonth);
  const [legendOpen, setLegendOpen] = useState(false);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const todayKey = calDateKeySV(new Date());

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const n = i - firstDow + 1;
    if (n < 1 || n > daysInMonth) return null;
    const d = new Date(year, month, n);
    const key = calDateKeySV(d);
    return { n, key, evs: events[key] || [] };
  });

  const TIMING_SHORT = { before_shooting: 'BS', after_wrap: 'AW' };
  const eventLabel = ev => {
    const t = ev.timing ? ` ${TIMING_SHORT[ev.timing] || ''}` : '';
    if (ev.type === 'shoot') return ev.dayNum ? `Dag ${ev.dayNum}` : 'Shoot';
    if (ev.type === 'prep') return (ev.total > 1 ? `Prep ${ev.idx}/${ev.total}` : 'Prep') + t;
    return (ev.total > 1 ? `Wrap ${ev.idx}/${ev.total}` : 'Wrap') + t;
  };

  const numRows = totalCells / 7;
  const updatedStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="agenda-page-root" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', overflow: 'hidden', padding: '14px 20px', boxSizing: 'border-box' }}>

      {/* Header row: title + nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {data.scheduleName && <span className="kicker" style={{ fontSize: 10 }}>{data.scheduleName} · agenda</span>}
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1 }}>{CAL_MONTH_NAMES_SV[month]} {year}</h1>
          {updatedStr && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)' }}>Bijgewerkt {updatedStr}</span>}
        </div>
        <div className="agenda-nav-bar" style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <button className="btn" onClick={() => setViewDate(new Date(year, month-1, 1))}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}><path d="M4 9h10M10 5l4 4-4 4"/></svg>
          </button>
          <button className="btn" onClick={() => { const n = new Date(); setViewDate(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Vandaag</button>
          <button className="btn" onClick={() => setViewDate(new Date(year, month+1, 1))}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h10M10 5l4 4-4 4"/></svg>
          </button>
          <button className="btn" onClick={() => window.print()}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v9M5.5 8.5 9 12l3.5-3.5M3.5 14.5h11"/></svg>
            PDF
          </button>
        </div>
      </div>

      {/* Legend + type legend row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginBottom: 8, flexWrap: 'wrap' }}>
        {visibleLocs.length > 0 && (
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <button className="agenda-legend-toggle" onClick={() => setLegendOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)', width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {visibleLocs.slice(0, 7).map(loc => (
                  <div key={loc.id} style={{ width: 7, height: 7, borderRadius: 2, background: locColor[loc.id] }} />
                ))}
                {visibleLocs.length > 7 && <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>+{visibleLocs.length - 7}</span>}
              </div>
              <span style={{ flex: 1 }}>{visibleLocs.length} locaties</span>
              <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: legendOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}><path d="M4 6l5 5 5-5"/></svg>
            </button>
            {legendOpen && (
              <div className="agenda-legend-body" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, border: '1px solid var(--line)', borderTop: 'none', borderRadius: '0 0 7px 7px', padding: '8px 10px', background: 'var(--card)', display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                {visibleLocs.map(loc => (
                  <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, border: '1px solid var(--line)', background: 'var(--card-2)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: locColor[loc.id], flexShrink: 0 }} />
                    <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>
                      {((data.edits || {})[loc.id] || {}).name || loc.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          {[['Shoot dag', 'solid'], ['Prep dag', 'dashed'], ['Wrap dag', 'dotted']].map(([label, style]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 10, borderRadius: 2, ...(style === 'solid' ? { background: 'var(--accent)' } : { border: `1.5px ${style} var(--accent)` }) }} />
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="agenda-cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2, flexShrink: 0 }}>
        {CAL_DAY_NAMES_SV.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', padding: '2px 0', fontWeight: 600, letterSpacing: '.06em' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid — fills remaining height */}
      <div className="agenda-cal-scroll agenda-cal-inner" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: `repeat(${numRows}, 1fr)`, gap: 2 }}>
        {cells.map((cell, i) => (
          <div key={i} className="agenda-cal-cell" style={{
            minHeight: 0, borderRadius: 6, padding: '3px 4px', overflow: 'hidden',
            background: cell ? (cell.key === todayKey ? 'color-mix(in srgb, var(--accent) 7%, var(--card))' : 'var(--card)') : 'transparent',
            border: cell ? (cell.key === todayKey ? '1.5px solid var(--accent)' : '1px solid var(--line)') : 'none',
          }}>
            {cell && (<>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: cell.evs.length ? 700 : 400, color: cell.key === todayKey ? 'var(--accent)' : (cell.evs.length ? 'var(--ink)' : 'var(--ink-3)'), marginBottom: 2 }}>
                {cell.n}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5, overflow: 'hidden' }}>
                {cell.evs.map((ev, j) => {
                  const shareId = (data.edits && data.edits[ev.locId] && data.edits[ev.locId].shareId) || null;
                  const href = shareId ? (window.location.origin + window.location.pathname + '?share=' + shareId) : null;
                  const chip = (
                    <div className="agenda-ev-chip" title={`${ev.name} · ${ev.type}`} style={{
                      fontSize: 8, fontFamily: 'var(--mono)', padding: '1.5px 4px', borderRadius: 3,
                      lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      cursor: href ? 'pointer' : 'default',
                      textDecoration: href ? 'underline' : 'none',
                      textUnderlineOffset: 2,
                      ...(ev.type === 'shoot' ? { background: ev.color, color: '#fff' }
                        : ev.type === 'prep' ? { background: 'transparent', color: ev.color, border: `1.5px dashed ${ev.color}` }
                        : { background: 'transparent', color: ev.color, border: `1.5px dotted ${ev.color}` }),
                    }}>
                      {eventLabel(ev)} · {ev.name}{href ? ' ↗' : ''}
                    </div>
                  );
                  return href
                    ? <a key={j} href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{chip}</a>
                    : <div key={j}>{chip}</div>;
                })}
              </div>
            </>)}
          </div>
        ))}
      </div>

      <div className="agenda-footer" style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        {data.scheduleName} · Location Book
      </div>
    </div>
  );
}

window.AgendaShareView = AgendaShareView;
