/* CalendarView — agenda overzicht van alle shoot/prep/wrap-dagen */

const CAL_LOC_COLORS = [
  '#9e3b2e', '#2c5f8a', '#3d6b4f', '#a07020',
  '#7b4d9e', '#c87040', '#2a7a8a', '#6b3d7a',
  '#5a6b2a', '#6b3b3b',
];

const CAL_MONTH_NAMES = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
];
const CAL_DAY_NAMES = ['Ma','Di','Wo','Do','Vr','Za','Zo'];

function parseCalDate(str) {
  if (!str || !/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return null;
  const [dd, mm, yyyy] = str.split('/').map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd);
}

function calDateKey(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function CalendarView({ model, edits, removed, onOpenLoc, agendaShareId, onCreateAgendaShare }) {
  const [sharePopup, setSharePopup] = useState(false);
  const [copiedAgenda, setCopiedAgenda] = useState(false);
  const visibleLocs = useMemo(
    () => model.locations.filter(l => !removed.includes(l.id)),
    [model.locations, removed]
  );

  const locColor = useMemo(() => {
    const m = {};
    visibleLocs.forEach((l, i) => { m[l.id] = CAL_LOC_COLORS[i % CAL_LOC_COLORS.length]; });
    return m;
  }, [visibleLocs]);

  const events = useMemo(() => {
    const result = {};
    const add = (key, ev) => { (result[key] = result[key] || []).push(ev); };

    for (const loc of visibleLocs) {
      const edit = edits[loc.id] || {};
      const name = edit.name || loc.name;
      const color = locColor[loc.id];
      const removedDays = new Set((edit.removedShootDays || []).map(String));

      // Shoot days from schedule
      for (const d of loc.shootDates || []) {
        if (removedDays.has(String(d.dayNumber))) continue;
        const ov = (edit.dayOverrides || {})[String(d.dayNumber)] || {};
        const date = parseCalDate(ov.date || d.date);
        if (date) add(calDateKey(date), { type: 'shoot', name, locId: loc.id, color, dayNum: ov.dayNumber ?? d.dayNumber });
      }
      // Extra shoot days
      for (const d of edit.extraShootDays || []) {
        const date = parseCalDate(d.date);
        if (date) add(calDateKey(date), { type: 'shoot', name, locId: loc.id, color, dayNum: null });
      }
      // Prep dates
      (edit.prepDates || []).forEach((dateStr, i) => {
        const date = parseCalDate(dateStr);
        if (date) add(calDateKey(date), { type: 'prep', name, locId: loc.id, color, idx: i + 1, total: edit.prepDays, timing: edit.prepTiming || null });
      });
      // Wrap dates
      (edit.wrapDates || []).forEach((dateStr, i) => {
        const date = parseCalDate(dateStr);
        if (date) add(calDateKey(date), { type: 'wrap', name, locId: loc.id, color, idx: i + 1, total: edit.wrapDays, timing: edit.wrapTiming || null });
      });
    }
    return result;
  }, [visibleLocs, edits, locColor]);

  // Start on the first month that has events, or current month
  const defaultMonth = useMemo(() => {
    const keys = Object.keys(events).sort();
    if (!keys.length) return new Date();
    const parts = keys[0].split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, 1);
  }, []);

  const [viewDate, setViewDate] = useState(defaultMonth);
  const [legendOpen, setLegendOpen] = useState(false);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => { const n = new Date(); setViewDate(new Date(n.getFullYear(), n.getMonth(), 1)); };

  // Build grid: Monday-first weeks
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells  = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const todayKey    = calDateKey(new Date());

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const n = i - firstDow + 1;
    if (n < 1 || n > daysInMonth) return null;
    const d   = new Date(year, month, n);
    const key = calDateKey(d);
    return { n, key, evs: events[key] || [] };
  });

  // Count events in month for "no data" hint
  const monthHasEvents = cells.some(c => c && c.evs.length > 0);

  const TIMING_SHORT = { before_shooting: 'BS', after_wrap: 'AW' };
  const eventLabel = ev => {
    const t = ev.timing ? ` ${TIMING_SHORT[ev.timing] || ''}` : '';
    if (ev.type === 'shoot') return ev.dayNum ? `Dag ${ev.dayNum}` : 'Shoot';
    if (ev.type === 'prep')  return (ev.total > 1 ? `Prep ${ev.idx}/${ev.total}` : 'Prep') + t;
    return (ev.total > 1 ? `Wrap ${ev.idx}/${ev.total}` : 'Wrap') + t;
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1080, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="kicker">{model.scheduleName} · agenda</div>
          <h1 style={{ margin: 0 }}>{CAL_MONTH_NAMES[month]} {year}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
          <button className="btn" onClick={prevMonth}>
            <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="btn" onClick={goToday}>Vandaag</button>
          <button className="btn" onClick={nextMonth}>
            <Icon name="arrow" size={14} />
          </button>
          <button className="btn" onClick={() => window.print()} title="Print / save as PDF">
            <Icon name="download" size={14} />PDF
          </button>
          <div style={{ position: 'relative' }}>
            <button className="btn primary" onClick={() => {
              if (!agendaShareId && onCreateAgendaShare) onCreateAgendaShare();
              setSharePopup(v => !v);
            }}>
              <Icon name="arrow" size={14} />Deel agenda
            </button>
            {sharePopup && agendaShareId && (
              <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 200, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, minWidth: 320, boxShadow: '0 4px 24px rgba(0,0,0,.12)' }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 8 }}>Live agenda link — altijd up to date</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={LB_SYNC.getAgendaShareUrl(agendaShareId)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-2)', color: 'var(--ink)', fontFamily: 'var(--mono)' }}
                    onClick={e => e.target.select()} />
                  <button className="btn sm primary" onClick={() => {
                    navigator.clipboard.writeText(LB_SYNC.getAgendaShareUrl(agendaShareId)).catch(() => {});
                    setCopiedAgenda(true); setTimeout(() => setCopiedAgenda(false), 2000);
                  }}>{copiedAgenda ? '✓' : 'Copy'}</button>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.5 }}>
                  Elke wijziging wordt automatisch bijgewerkt in de link.
                </div>
                <button style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 16 }} onClick={() => setSharePopup(false)}>×</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Location legend ── */}
      {visibleLocs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => setLegendOpen(o => !o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)' }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {visibleLocs.slice(0, 7).map(loc => (
                <div key={loc.id} style={{ width: 7, height: 7, borderRadius: 2, background: locColor[loc.id] }} />
              ))}
              {visibleLocs.length > 7 && <span style={{ fontSize: 9, color: 'var(--ink-3)' }}>+{visibleLocs.length - 7}</span>}
            </div>
            <span>{visibleLocs.length} locaties</span>
            <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ transform: legendOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><path d="M4 6l5 5 5-5"/></svg>
          </button>
          {legendOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {visibleLocs.map(loc => (
                <div key={loc.id}
                  onClick={() => onOpenLoc && onOpenLoc(loc.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 8px', borderRadius: 99, border: '1px solid var(--line)', background: 'var(--card)' }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: locColor[loc.id], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-2)' }}>
                    {(edits[loc.id] || {}).name || loc.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Event type legend ── */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 26, height: 12, borderRadius: 3, background: 'var(--accent)' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>Shoot dag</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 26, height: 12, borderRadius: 3, border: '1.5px dashed var(--accent)' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>Prep dag</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 26, height: 12, borderRadius: 3, border: '1.5px dotted var(--accent)' }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>Wrap dag</span>
        </div>
      </div>

      {/* ── Day headers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {CAL_DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', padding: '3px 0', fontWeight: 600, letterSpacing: '.06em' }}>{d}</div>
        ))}
      </div>

      {/* ── Calendar grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((cell, i) => (
          <div key={i} style={{
            minHeight: 88,
            background: cell ? (cell.key === todayKey ? 'color-mix(in srgb, var(--accent) 7%, var(--card))' : 'var(--card)') : 'transparent',
            border: cell ? (cell.key === todayKey ? '1.5px solid var(--accent)' : '1px solid var(--line)') : 'none',
            borderRadius: 8,
            padding: '5px 7px',
          }}>
            {cell && (
              <>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: cell.evs.length ? 700 : 400,
                  color: cell.key === todayKey ? 'var(--accent)' : (cell.evs.length ? 'var(--ink)' : 'var(--ink-3)'),
                  marginBottom: 3,
                }}>
                  {cell.n}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {cell.evs.map((ev, j) => (
                    <div key={j}
                      onClick={() => onOpenLoc && onOpenLoc(ev.locId)}
                      title={`${ev.name} · ${ev.type}`}
                      style={{
                        fontSize: 9.5,
                        fontFamily: 'var(--mono)',
                        padding: '2px 5px',
                        borderRadius: 4,
                        lineHeight: 1.35,
                        cursor: 'pointer',
                        ...(ev.type === 'shoot' ? {
                          background: ev.color,
                          color: '#fff',
                          border: 'none',
                        } : ev.type === 'prep' ? {
                          background: 'transparent',
                          color: ev.color,
                          border: `1.5px dashed ${ev.color}`,
                        } : {
                          background: 'transparent',
                          color: ev.color,
                          border: `1.5px dotted ${ev.color}`,
                        }),
                      }}>
                      {eventLabel(ev)} · {ev.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {!monthHasEvents && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          Geen data ingevuld voor {CAL_MONTH_NAMES[month].toLowerCase()} {year}.
          Voeg shoot-, prep- of wrap-data toe in de locatiedocumenten.
        </div>
      )}
    </div>
  );
}

window.CalendarView = CalendarView;
