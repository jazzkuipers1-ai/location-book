/* Per-location export deck — 1280×800 (16:10). Cover (opt) + dense overview +
   image appendix. Accepts MANY locations so you can batch-export a selection.
   Always rendered in the light "document" palette, independent of app theme.   */

const DECK_CSS = `
.deckroot{position:fixed;inset:0;z-index:60;background:#2a2620;display:flex;flex-direction:column;}
.deck-chrome{flex:0 0 auto;display:flex;align-items:center;gap:14px;padding:11px 18px;background:#1c1813;color:#e9e2d2;border-bottom:1px solid #000;}
.deck-chrome .t{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:#b6ad99;}
.deck-scroll{flex:1;overflow:auto;padding:30px;display:flex;flex-direction:column;align-items:center;gap:26px;}
.deck-page{width:1280px;height:800px;background:#f7f3ea;color:#221d15;position:relative;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.45);
  --dk-line:#d9d0bd;--dk-line2:#c3b7a0;--dk-ink2:#6d6657;--dk-ink3:#a59c89;--dk-card:#fffdf8;--dk-accent:#9e3b2e;--dk-acc-soft:#f0ddd6;}
.dk-pad{position:absolute;inset:0;padding:52px 56px;display:flex;flex-direction:column;}
.dk-mono{font-family:var(--mono);}
.dk-serif{font-family:var(--serif);}
.dk-kick{font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dk-ink2);}
.dk-foot{position:absolute;left:56px;right:56px;bottom:26px;display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:11px;color:var(--dk-ink3);border-top:1px solid var(--dk-line);padding-top:12px;}
.dk-cat{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:10px;letter-spacing:.07em;text-transform:uppercase;font-weight:600;}
.dk-tick{width:9px;height:9px;border-radius:2px;flex:0 0 auto;}
@media print{
  @page{size:1280px 800px;margin:0;}
  html,body{background:#fff !important;}
  .deck-chrome{display:none !important;}
  .deckroot{position:static;background:#fff;}
  .deck-scroll{overflow:visible !important;padding:0 !important;gap:0 !important;background:#fff !important;}
  .deck-page-wrap{transform:none !important;width:1280px !important;height:800px !important;}
  .deck-page-wrap > .dk-scaler{transform:none !important;}
  .deck-page{box-shadow:none !important;break-after:page;}
  .deck-page:last-child{break-after:auto;}
}`;

function CoverPage({ loc, edit, name, scheduleName }) {
  const adj = edit.adjustments || [];
  const stats = [['Scenes', loc.sceneCount], ['Shoot days', loc.dayNums.length], ['Prep', (edit.prepDays || 0) + ' d'], ['Wrap', (edit.wrapDays || 0) + ' d'], ['Adjustments', adj.length]];
  const sz = name.length > 18 ? 60 : name.length > 12 ? 80 : 104;
  if (edit.cover) {
    return (
      <div className="deck-page" style={{ background: '#1c1813' }}>
        <Img imgId={edit.cover} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,16,8,.28) 0%, rgba(20,16,8,.05) 38%, rgba(20,16,8,.82) 100%)' }} />
        <div className="dk-pad" style={{ justifyContent: 'space-between', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="dk-kick" style={{ color: 'rgba(255,255,255,.8)' }}>{scheduleName}</div>
            <div className="dk-kick" style={{ color: 'rgba(255,255,255,.8)' }}>{loc.regions[0] || ''}</div>
          </div>
          <div>
            <div className="dk-kick" style={{ color: '#f0b8ad', marginBottom: 12 }}>Location adjustment file</div>
            <div className="dk-serif" style={{ fontSize: sz, fontWeight: 600, lineHeight: .94, letterSpacing: '-.025em' }}>{name}</div>
            {edit.address && <div style={{ fontSize: 18, color: 'rgba(255,255,255,.85)', marginTop: 16 }}>{edit.address}</div>}
            {edit.mapsUrl && <a href={edit.mapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: '#f0b8ad', textDecoration: 'underline', fontFamily: 'var(--mono)', fontWeight: 600 }}>View on Google Maps ↗</a>}
            <div style={{ display: 'flex', gap: 34, marginTop: 26 }}>
              {stats.map(([k, v]) => (
                <div key={k}><div className="dk-serif" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{v}</div>
                  <div className="dk-mono" style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.75)', marginTop: 6 }}>{k}</div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="deck-page">
      <div className="dk-pad" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="dk-kick">{scheduleName}</div><div className="dk-kick">{loc.regions[0] || ''}</div>
        </div>
        <div>
          <div className="dk-kick" style={{ color: 'var(--dk-accent)', marginBottom: 14 }}>Location adjustment file</div>
          <div className="dk-serif" style={{ fontSize: sz, fontWeight: 600, lineHeight: .94, letterSpacing: '-.025em' }}>{name}</div>
          {edit.address && <div style={{ fontSize: 18, color: 'var(--dk-ink2)', marginTop: 18 }}>{edit.address}</div>}
          {edit.mapsUrl && <a href={edit.mapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 13, color: 'var(--dk-accent)', textDecoration: 'underline', fontFamily: 'var(--mono)', fontWeight: 600 }}>View on Google Maps ↗</a>}
        </div>
        <div style={{ display: 'flex', gap: 40, borderTop: '2px solid #221d15', paddingTop: 18 }}>
          {stats.map(([k, v]) => (
            <div key={k}><div className="dk-serif" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{v}</div>
              <div className="dk-mono" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dk-ink2)', marginTop: 7 }}>{k}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewPage({ loc, edit, name, scheduleName }) {
  const adj = edit.adjustments || [];
  const groups = {};
  adj.forEach(a => { const k = a.area || 'General'; (groups[k] = groups[k] || []).push(a); });
  const groupList = Object.entries(groups);
  const usedCats = CATS.filter(c => adj.some(a => a.cat === c.id));
  const gal = edit.galleries || {};
  const galCats = edit.galCategories && edit.galCategories.length
    ? edit.galCategories
    : [{ id: 'photos', label: 'Photos', colorId: 'slate' }];
  const visualCount = galCats.reduce((n, c) => n + (gal[c.id] || []).length, 0);
  const sz = name.length > 20 ? 34 : name.length > 14 ? 44 : 58;
  const scenesByDay = (() => {
    const removedKeys = new Set((edit.removedSceneKeys) || []);
    const sceneKey = s => s.manual ? ('m|' + s.id) : (s.number + '|' + (s.idx ?? ''));
    const extraScenes = edit.extraScenes || [];
    const g = {};
    loc.scenes.filter(s => !removedKeys.has(sceneKey(s))).forEach(s => { const k = s.dayNumber || '—'; (g[k] = g[k] || []).push(s); });
    extraScenes.forEach(s => { const k = s.dayNumber || '—'; (g[k] = g[k] || []).push(s); });
    return Object.entries(g).sort((a, b) => (a[0] === '—' ? 999 : +a[0]) - (b[0] === '—' ? 999 : +b[0]));
  })();

  return (
    <div className="deck-page">
      <div className="dk-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #221d15', paddingBottom: 18 }}>
          <div style={{ minWidth: 0, display: 'flex', gap: 18, alignItems: 'center' }}>
            {edit.cover && <div style={{ width: 92, height: 92, borderRadius: 12, overflow: 'hidden', flex: '0 0 auto', border: '1px solid var(--dk-line)' }}><Img imgId={edit.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>}
            <div style={{ minWidth: 0 }}>
              <div className="dk-kick">{scheduleName}{loc.regions[0] ? '  ·  ' + loc.regions[0] : ''}</div>
              <div className="dk-serif" style={{ fontSize: sz, fontWeight: 600, lineHeight: .98, letterSpacing: '-.02em', marginTop: 8 }}>{name}</div>
              {edit.address && <div style={{ fontSize: 15, color: 'var(--dk-ink2)', marginTop: 8 }}>{edit.address}</div>}
              {edit.mapsUrl && <a href={edit.mapsUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 4, fontSize: 12, color: 'var(--dk-accent)', textDecoration: 'underline', fontFamily: 'var(--mono)', fontWeight: 600 }}>View on Google Maps ↗</a>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 1, background: 'var(--dk-line)', border: '1px solid var(--dk-line)', borderRadius: 10, overflow: 'hidden', flex: '0 0 auto' }}>
            {[
              ['Scenes', loc.sceneCount, null],
              ['Shoot', loc.dayNums.length, null],
              ['Prep', edit.prepDays || 0, edit.prepTiming === 'before_shooting' ? 'before shooting' : edit.prepTiming === 'after_wrap' ? 'after wrap' : null],
              ['Wrap', edit.wrapDays || 0, edit.wrapTiming === 'after_wrap' ? 'after wrap' : edit.wrapTiming === 'before_shooting' ? 'before shooting' : null],
            ].map(([k, v, sub]) => (
              <div key={k} style={{ background: 'var(--dk-card)', padding: '12px 18px', textAlign: 'center', minWidth: 78 }}>
                <div className="dk-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: k === 'Prep' || k === 'Wrap' ? 'var(--dk-accent)' : '#221d15' }}>{v}</div>
                <div className="dk-mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dk-ink2)', marginTop: 6 }}>{k}</div>
                {sub && <div style={{ fontSize: 8.5, color: 'var(--dk-ink2)', marginTop: 3, lineHeight: 1.2 }}>{sub}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.06fr 1fr 232px', gap: 26, flex: 1, minHeight: 0, marginTop: 20 }}>
          {/* Adjustments */}
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="dk-serif" style={{ fontSize: 22, fontWeight: 600 }}>Adjustments</span>
              <span className="dk-mono" style={{ fontSize: 10.5, color: 'var(--dk-ink2)' }}>{adj.length} · {groupList.length} area{groupList.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 9 }}>{usedCats.map(c => <span key={c.id} className="dk-cat"><span className="dk-tick" style={{ background: c.color }} />{c.label}</span>)}</div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {adj.length === 0 && <div className="dk-mono" style={{ color: 'var(--dk-ink3)', fontSize: 12 }}>No adjustments recorded.</div>}
              {groupList.map(([area, list]) => (
                <div key={area} style={{ breakInside: 'avoid', marginBottom: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--dk-line)', paddingBottom: 5, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{area}</span>
                    <span className="dk-mono" style={{ fontSize: 10, color: 'var(--dk-ink3)' }}>{list.length}</span>
                  </div>
                  {list.map(a => {
                    const c = CAT[a.cat] || CAT.other;
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '3px 0' }}>
                        <span className="dk-tick" style={{ background: c.color, marginTop: 6 }} />
                        <span style={{ fontSize: 12.5, lineHeight: 1.3, flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--dk-ink3)' : '#221d15' }}>
                          {a.text}{a.measure && <span className="dk-mono" style={{ fontSize: 10.5, color: 'var(--dk-accent)', marginLeft: 6 }}>{a.measure}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Scenes with descriptions */}
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--dk-line)', paddingLeft: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 9 }}>
              <span className="dk-serif" style={{ fontSize: 22, fontWeight: 600 }}>Scenes</span>
              <span className="dk-mono" style={{ fontSize: 10.5, color: 'var(--dk-ink2)' }}>{loc.sceneCount}</span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {scenesByDay.map(([day, scs]) => (
                <div key={day} style={{ breakInside: 'avoid', marginBottom: 9 }}>
                  <div className="dk-mono" style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--dk-accent)', marginBottom: 3 }}>
                    {day === '—' ? 'Unscheduled' : 'Day ' + day}{scs[0].date ? ' · ' + fmtDate(scs[0].date) : ''}
                  </div>
                  {scs.map(s => (
                    <div key={s.number + s.idx} style={{ display: 'flex', gap: 8, padding: '2px 0', alignItems: 'baseline' }}>
                      <span className="dk-mono" style={{ fontSize: 10, fontWeight: 600, flex: '0 0 auto', width: 36 }}>{s.number}</span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.3, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.synopsis || <span style={{ color: 'var(--dk-ink3)' }}>—</span>}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div style={{ borderLeft: '1px solid var(--dk-line)', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
            <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 7 }}>Areas / sets</div>
              {loc.sets.length > 0
                ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {loc.sets.map(s => <span key={s} style={{ fontFamily: 'var(--mono)', fontSize: 10, border: '1px solid var(--dk-line2)', borderRadius: 14, padding: '2px 8px', background: 'var(--dk-card)', color: 'var(--dk-ink2)' }}>{s}</span>)}
                  </div>
                : <div className="dk-mono" style={{ fontSize: 11, color: 'var(--dk-ink3)' }}>—</div>}
            </div>
            {edit.access && <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Access</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--dk-ink2)' }}>{edit.access}</div></div>}
            <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Visual references</div>
              <div style={{ fontSize: 11.5, color: 'var(--dk-ink2)' }}>{visualCount} image{visualCount !== 1 ? 's' : ''} — see appendix</div></div>
          </div>
        </div>
        <div className="dk-foot"><span>{scheduleName} — Location adjustments</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function NotesPage({ name, scheduleName, notes }) {
  return (
    <div className="deck-page">
      <div className="dk-pad">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--dk-line)', paddingBottom: 12, marginBottom: 28 }}>
          <span className="dk-kick">{name} · notes</span>
        </div>
        <div style={{ fontSize: 15, lineHeight: 2, color: '#221d15', whiteSpace: 'pre-wrap' }}>{notes}</div>
        <div className="dk-foot"><span>{scheduleName} — Notes</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function ScenesPage({ loc, name, scheduleName, scenes, part, parts }) {
  return (
    <div className="deck-page">
      <div className="dk-pad">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--dk-line)', paddingBottom: 12 }}>
          <span className="dk-kick">{name} · scene breakdown</span>
          <span style={{ flex: 1 }} />
          {parts > 1 && <span className="dk-mono" style={{ fontSize: 11, color: 'var(--dk-ink3)' }}>{part} / {parts}</span>}
          <span className="dk-serif" style={{ fontSize: 24, fontWeight: 600 }}>{loc.sceneCount} scenes</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', columnCount: 2, columnGap: 30, marginTop: 16 }}>
          {scenes.map(s => (
            <div key={s.number + s.idx} style={{ breakInside: 'avoid', display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--dk-line)' }}>
              <span className="dk-mono" style={{ fontSize: 11, fontWeight: 600, width: 38, flex: '0 0 auto' }}>{s.number}</span>
              <span className="dk-mono" style={{ fontSize: 9, color: 'var(--dk-ink2)', width: 52, flex: '0 0 auto', paddingTop: 1 }}>{s.type}/{s.tod}</span>
              <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.3 }}>
                {s.synopsis || '—'}
                {s.segments.length > 1 && <span className="dk-mono" style={{ color: 'var(--dk-ink3)', fontSize: 9.5 }}>{'  '}· {s.segments.slice(1).join(' / ')}</span>}
              </span>
              <span className="dk-mono" style={{ fontSize: 9.5, color: 'var(--dk-ink3)', width: 56, flex: '0 0 auto', textAlign: 'right' }}>{s.dayNumber ? 'D' + s.dayNumber : ''}{s.year ? ' ·' + s.year.slice(2) : ''}</span>
            </div>
          ))}
        </div>
        <div className="dk-foot"><span>{scheduleName} — Scene breakdown</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function AppendixPage({ name, scheduleName, label, color, items, part, parts }) {
  const cols = items.length === 1 ? 1 : 2;
  const accent = color || '#6b7a8d';
  return (
    <div className="deck-page">
      <div className="dk-pad">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '3px solid ' + accent, paddingBottom: 12 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <span className="dk-kick">{name} · appendix</span>
          <span style={{ flex: 1 }} />
          {parts > 1 && <span className="dk-mono" style={{ fontSize: 11, color: 'var(--dk-ink3)' }}>{part} / {parts}</span>}
          <span className="dk-serif" style={{ fontSize: 24, fontWeight: 600, color: accent }}>{label}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(' + cols + ',1fr)', gridAutoRows: '1fr', gap: 16 }}>
          {items.map(it => (
            <div key={it.id} style={{ border: '2px solid ' + accent, borderRadius: 12, overflow: 'hidden', background: 'var(--dk-card)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, background: '#ece4d2' }}>
                <Img imgId={shownId(it)} style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: 4 }} />
              </div>
              {(it.cap || it.note) && (
                <div style={{ flex: '0 0 auto', padding: '9px 13px', borderTop: '2px solid ' + accent }}>
                  {it.cap && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: '#221d15' }}>{it.cap}</div>}
                  {it.note && <div style={{ fontSize: 11.5, lineHeight: 1.35, color: 'var(--dk-ink2)', marginTop: it.cap ? 2 : 0 }}>{it.note}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="dk-foot"><span>{scheduleName} — {label}</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function Deck({ entries, scheduleName, opts, onClose }) {
  const o = opts || {};
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 80) / 1280));
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const PER_SCENE_PAGE = 40;
  const PER_APPENDIX = 4;
  const pages = [];
  entries.forEach(({ loc, edit, name }) => {
    if (o.cover) pages.push(<CoverPage key={loc.id + '-cv'} loc={loc} edit={edit} name={name} scheduleName={scheduleName} />);
    if (o.overview !== false) pages.push(<OverviewPage key={loc.id + '-ov'} loc={loc} edit={edit} name={name} scheduleName={scheduleName} />);
    if (edit.notes && edit.notes.trim()) pages.push(<NotesPage key={loc.id + '-nt'} name={name} scheduleName={scheduleName} notes={edit.notes} />);
    if (o.scenes) {
      const list = [...loc.scenes].sort((a, b) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx);
      const parts = Math.ceil(list.length / PER_SCENE_PAGE) || 1;
      for (let p = 0; p < parts; p++) {
        pages.push(<ScenesPage key={loc.id + '-sc' + p} loc={loc} name={name} scheduleName={scheduleName}
          scenes={list.slice(p * PER_SCENE_PAGE, (p + 1) * PER_SCENE_PAGE)} part={p + 1} parts={parts} />);
      }
    }
    const gal = edit.galleries || {};
    const galCats = edit.galCategories && edit.galCategories.length
      ? edit.galCategories
      : [{ id: 'photos', label: 'Photos', colorId: 'slate' }];
    const CAT_COLORS_MAP = { slate:'#6b7a8d', rust:'#9e3b2e', forest:'#3d6b4f', gold:'#a07020', ocean:'#2c5f8a', plum:'#6b3d7a', terra:'#8a5a35', steel:'#3d5a6b' };
    // Custom photo categories
    galCats
      .filter(cat => o[cat.id] !== false && (gal[cat.id] || []).length > 0)
      .forEach(cat => {
        const imgs = gal[cat.id];
        const color = CAT_COLORS_MAP[cat.colorId] || '#6b7a8d';
        const aParts = Math.ceil(imgs.length / PER_APPENDIX) || 1;
        for (let p = 0; p < aParts; p++) {
          pages.push(<AppendixPage key={loc.id + '-' + cat.id + p} name={name} scheduleName={scheduleName}
            label={cat.label} color={color}
            items={imgs.slice(p * PER_APPENDIX, (p + 1) * PER_APPENDIX)} part={p + 1} parts={aParts} />);
        }
      });
    // Fixed sections — only shown when non-empty and not turned off in export opts
    [['sketches', 'Sketches'], ['measurements', 'Measurements'], ['designs', 'Designs'], ['moodboard', 'Moodboard']]
      .filter(([k]) => o[k] !== false && (gal[k] || []).length > 0)
      .forEach(([k, label]) => {
        const imgs = gal[k];
        const aParts = Math.ceil(imgs.length / PER_APPENDIX) || 1;
        for (let p = 0; p < aParts; p++) {
          pages.push(<AppendixPage key={loc.id + '-' + k + p} name={name} scheduleName={scheduleName}
            label={label} color={null}
            items={imgs.slice(p * PER_APPENDIX, (p + 1) * PER_APPENDIX)} part={p + 1} parts={aParts} />);
        }
      });
  });

  const multi = entries.length > 1;
  return (
    <div className="deckroot">
      <style>{DECK_CSS}</style>
      <div className="deck-chrome">
        <button className="btn sm" onClick={onClose} style={{ background: '#2a2620', color: '#e9e2d2', borderColor: '#000' }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} />Back</button>
        <span className="t">{multi ? entries.length + ' locations · ' : entries[0].name + ' · '}{pages.length} page{pages.length !== 1 ? 's' : ''} · 1280×800</span>
        <span style={{ flex: 1 }} />
        <span className="t" style={{ opacity: .7 }}>Save as PDF → landscape, margins “None”</span>
        <button className="btn sm primary" onClick={() => window.print()}><Icon name="download" size={14} />Save PDF</button>
      </div>
      <div className="deck-scroll">
        {pages.map((p, i) => (
          <div className="deck-page-wrap" key={i} style={{ width: 1280 * scale, height: 800 * scale }}>
            <div className="dk-scaler" style={{ transform: 'scale(' + scale + ')', transformOrigin: 'top left', width: 1280, height: 800 }}>{p}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Deck = Deck;
