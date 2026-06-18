import { useState, useEffect, useRef } from 'react';
import { Icon, Img, fmtDate, CATS, CAT } from './components';
import { shownId } from './Annotator';

function visibleShootDays(loc: any, edit: any) {
  const removedScenes: string[] = edit.removedScenes || [];
  const removedDays: string[] = edit.removedDays || [];
  const dayOverrides: Record<string, any> = edit.dayOverrides || {};
  const activeDayNums = new Set<number>();
  loc.scenes.forEach((s: any) => {
    if (s.dayNumber != null && !removedScenes.includes(s.number + '_' + s.idx)) activeDayNums.add(s.dayNumber);
  });
  (edit.addedScenes || []).forEach((s: any) => { if (s.dayNumber != null) activeDayNums.add(s.dayNumber); });
  return loc.shootDates
    .filter((d: any) => activeDayNums.has(d.dayNumber) && !removedDays.includes(String(d.dayNumber)))
    .map((d: any) => { const ov = dayOverrides[String(d.dayNumber)] || {}; return { ...d, dayNumber: ov.dayNumber ?? d.dayNumber, date: ov.date ?? d.date }; });
}

const DECK_CSS = `
.deckroot{position:fixed;inset:0;z-index:60;background:#2a2620;display:flex;flex-direction:column;}
.deck-chrome{flex:0 0 auto;display:flex;align-items:center;gap:14px;padding:11px 18px;background:#1c1813;color:#e9e2d2;border-bottom:1px solid #000;}
.deck-chrome .t{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:#b6ad99;}
.deck-body{flex:1;min-height:0;display:flex;}
.deck-sidenav{width:220px;flex:0 0 220px;background:#1c1813;border-right:1px solid #000;display:flex;flex-direction:column;overflow:hidden;transition:width .18s ease,flex-basis .18s ease;}
.deck-sidenav.closed{width:0;flex-basis:0;}
.deck-sidenav-inner{width:220px;overflow-y:auto;padding:10px 0;}
.deck-sidenav-item{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;border-radius:0;transition:background .12s;border:none;background:none;color:#e9e2d2;width:100%;text-align:left;}
.deck-sidenav-item:hover{background:rgba(255,255,255,.07);}
.deck-sidenav-item.active{background:rgba(255,255,255,.12);}
.deck-sidenav-thumb{width:40px;height:30px;border-radius:5px;overflow:hidden;flex:0 0 40px;background:#2a2620;}
.deck-sidenav-name{font-family:var(--mono);font-size:11px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
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
  .deck-sidenav{display:none !important;}
  .deckroot{position:static;background:#fff;}
  .deck-body{display:block;}
  .deck-scroll{overflow:visible !important;padding:0 !important;gap:0 !important;background:#fff !important;}
  .deck-page-wrap{transform:none !important;width:1280px !important;height:800px !important;}
  .deck-page-wrap > .dk-scaler{transform:none !important;}
  .deck-page{box-shadow:none !important;break-after:page;}
  .deck-page:last-child{break-after:auto;}
}`;

function CoverPage({ loc, edit, name, scheduleName }: any) {
  const adj = edit.adjustments || [];
  const shootDays = visibleShootDays(loc, edit);
  const visibleSceneCount = loc.sceneCount - (edit.removedScenes || []).length + (edit.addedScenes || []).length;
  const stats = [['Scenes', visibleSceneCount], ['Shoot days', shootDays.length], ['Prep', (edit.prepDays || 0) + ' d'], ['Wrap', (edit.wrapDays || 0) + ' d'], ['Adjustments', adj.length]];
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
            <div style={{ display: 'flex', gap: 34, marginTop: 26 }}>
              {stats.map(([k, v]) => (
                <div key={k as string}><div className="dk-serif" style={{ fontSize: 32, fontWeight: 600, lineHeight: 1 }}>{v}</div>
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
        </div>
        <div style={{ display: 'flex', gap: 40, borderTop: '2px solid #221d15', paddingTop: 18 }}>
          {stats.map(([k, v]) => (
            <div key={k as string}><div className="dk-serif" style={{ fontSize: 38, fontWeight: 600, lineHeight: 1 }}>{v}</div>
              <div className="dk-mono" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dk-ink2)', marginTop: 7 }}>{k}</div></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableOfContentsPage({ entries, scheduleName, pageMap }: { entries: any[]; scheduleName: string; pageMap: Record<string, number> }) {
  return (
    <div className="deck-page">
      <div className="dk-pad" style={{ paddingTop: 44, paddingBottom: 44 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #221d15', paddingBottom: 16, marginBottom: 24, flex: '0 0 auto' }}>
          <div>
            <div className="dk-kick" style={{ marginBottom: 6 }}>Contents</div>
            <div className="dk-serif" style={{ fontSize: 48, fontWeight: 600, lineHeight: .92, letterSpacing: '-.025em' }}>Location overview</div>
          </div>
          <div className="dk-mono" style={{ fontSize: 13, color: 'var(--dk-ink2)', paddingBottom: 4 }}>{scheduleName}</div>
        </div>
        {/* Location list */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {entries.map(({ loc, edit, name }: any, i: number) => {
            const adj = (edit.adjustments || []).length;
            const shootDays = visibleShootDays(loc, edit);
            const sceneCount = loc.sceneCount - (edit.removedScenes || []).length + (edit.addedScenes || []).length;
            const pageNum = pageMap[loc.id];
            return (
              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 0', borderBottom: '1px solid var(--dk-line)' }}>
                {/* Index number */}
                <div className="dk-mono" style={{ fontSize: 13, color: 'var(--dk-ink3)', width: 28, flex: '0 0 28px', textAlign: 'right' }}>{String(i + 1).padStart(2, '0')}</div>
                {/* Thumbnail */}
                <div style={{ width: 80, height: 52, borderRadius: 8, overflow: 'hidden', flex: '0 0 80px', background: 'var(--dk-acc-soft)' }}>
                  {edit.cover && <Img imgId={edit.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                {/* Name + address */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="dk-serif" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                  {edit.address && <div className="dk-mono" style={{ fontSize: 10.5, color: 'var(--dk-ink2)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{edit.address}</div>}
                </div>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 18, flex: '0 0 auto' }}>
                  {[['Scenes', sceneCount], ['Days', shootDays.length], ['Prep', edit.prepDays || 0], ['Wrap', edit.wrapDays || 0], ['Adj.', adj]].map(([k, v]) => (
                    <div key={k as string} style={{ textAlign: 'center', minWidth: 36 }}>
                      <div className="dk-serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1 }}>{v}</div>
                      <div className="dk-mono" style={{ fontSize: 9, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dk-ink3)', marginTop: 3 }}>{k}</div>
                    </div>
                  ))}
                </div>
                {/* Dotted line + page number */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                  <div style={{ width: 60, borderBottom: '1px dotted var(--dk-line2)' }} />
                  <div className="dk-mono" style={{ fontSize: 12, color: 'var(--dk-ink2)', minWidth: 28, textAlign: 'right' }}>p.{pageNum}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="dk-foot"><span>{scheduleName} — Contents</span><span>{entries.length} location{entries.length !== 1 ? 's' : ''}</span></div>
      </div>
    </div>
  );
}

function OverviewPage({ loc, edit, name, scheduleName }: any) {
  const adj = edit.adjustments || [];
  const shootDays = visibleShootDays(loc, edit);
  const visibleSceneCount = loc.sceneCount - (edit.removedScenes || []).length + (edit.addedScenes || []).length;
  const groups: Record<string, any[]> = {};
  adj.forEach((a: any) => { const k = a.area || 'General'; (groups[k] = groups[k] || []).push(a); });
  const groupList = Object.entries(groups);
  const usedCats = CATS.filter(c => adj.some((a: any) => a.cat === c.id));
  const gal = edit.galleries || {};
  const visualCount = ['photos', 'sketches', 'measurements', 'designs', 'moodboard'].reduce((n, k) => n + (gal[k] || []).length, 0);
  const sz = name.length > 20 ? 34 : name.length > 14 ? 44 : 58;
  const scenesByDay = (() => {
    const g: Record<string, any[]> = {};
    const removedScenes: string[] = edit.removedScenes || [];
    const addedScenes: any[] = edit.addedScenes || [];
    [...loc.scenes].filter((s: any) => !removedScenes.includes(s.number + '_' + s.idx)).forEach((s: any) => { const k = s.dayNumber || '—'; (g[k] = g[k] || []).push(s); });
    addedScenes.forEach((s: any) => { (g['—'] = g['—'] || []).push({ ...s, _ovKey: 'added_' + s._id }); });
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
            </div>
          </div>
          <div style={{ display: 'flex', gap: 1, background: 'var(--dk-line)', border: '1px solid var(--dk-line)', borderRadius: 10, overflow: 'hidden', flex: '0 0 auto' }}>
            {[['Scenes', visibleSceneCount], ['Shoot', shootDays.length], ['Prep', edit.prepDays || 0], ['Wrap', edit.wrapDays || 0]].map(([k, v]) => (
              <div key={k as string} style={{ background: 'var(--dk-card)', padding: '12px 18px', textAlign: 'center', minWidth: 78 }}>
                <div className="dk-serif" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, color: k === 'Prep' || k === 'Wrap' ? 'var(--dk-accent)' : '#221d15' }}>{v}</div>
                <div className="dk-mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dk-ink2)', marginTop: 6 }}>{k}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.06fr 1fr 232px', gap: 26, flex: 1, minHeight: 0, marginTop: 20 }}>
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
                  {list.map((a: any) => {
                    const c = CAT[a.cat] || CAT.other;
                    const thumbId = a.thumbAnnotatedId || a.thumb;
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '3px 0' }}>
                        <span className="dk-tick" style={{ background: c.color, marginTop: 6 }} />
                        <span style={{ fontSize: 12.5, lineHeight: 1.3, flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'var(--dk-ink3)' : '#221d15' }}>
                          {a.text}{a.measure && <span className="dk-mono" style={{ fontSize: 10.5, color: 'var(--dk-accent)', marginLeft: 6 }}>{a.measure}</span>}
                        </span>
                        {thumbId && <Img imgId={thumbId} style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--dk-line)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

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
                  {scs.map((s: any) => {
                    const ovKey = s._ovKey || (s.number + '_' + s.idx);
                    const ov = (edit.sceneOverrides || {})[ovKey] || {};
                    return (
                      <div key={ovKey} style={{ display: 'flex', gap: 8, padding: '2px 0', alignItems: 'baseline' }}>
                        <span className="dk-mono" style={{ fontSize: 10, fontWeight: 600, flex: '0 0 auto', width: 36 }}>{ov.number ?? s.number}</span>
                        <span style={{ fontSize: 11.5, lineHeight: 1.3, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(ov.synopsis ?? s.synopsis) || <span style={{ color: 'var(--dk-ink3)' }}>—</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--dk-line)', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'hidden' }}>
            <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 7 }}>Areas / sets</div>
              {loc.sets.length > 0
                ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {loc.sets.map((s: string) => <span key={s} style={{ fontFamily: 'var(--mono)', fontSize: 10, border: '1px solid var(--dk-line2)', borderRadius: 14, padding: '2px 8px', background: 'var(--dk-card)', color: 'var(--dk-ink2)' }}>{s}</span>)}
                  </div>
                : <div className="dk-mono" style={{ fontSize: 11, color: 'var(--dk-ink3)' }}>—</div>}
            </div>
            {edit.mapLink && <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Maps</div>
              <div style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--dk-ink2)', wordBreak: 'break-all' }}>{edit.mapLink}</div></div>}
            {edit.access && <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Access</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--dk-ink2)' }}>{edit.access}</div></div>}
            <div><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Visual references</div>
              <div style={{ fontSize: 11.5, color: 'var(--dk-ink2)' }}>{visualCount} image{visualCount !== 1 ? 's' : ''} — see appendix</div></div>
            {edit.notes && <div style={{ minHeight: 0, overflow: 'hidden' }}><div className="dk-kick" style={{ fontSize: 10, marginBottom: 6 }}>Notes</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.4, color: 'var(--dk-ink2)' }}>{edit.notes}</div></div>}
          </div>
        </div>
        <div className="dk-foot"><span>{scheduleName} — Location adjustments</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function ScenesPage({ loc, edit, name, scheduleName, scenes, part, parts }: any) {
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
          {scenes.map((s: any) => {
            const ovKey = s._ovKey || (s.number + '_' + s.idx);
            const ov = ((edit?.sceneOverrides) || {})[ovKey] || {};
            const num = ov.number ?? s.number;
            const syn = ov.synopsis ?? s.synopsis;
            return <div key={ovKey} style={{ breakInside: 'avoid', display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--dk-line)' }}>
              <span className="dk-mono" style={{ fontSize: 11, fontWeight: 600, width: 38, flex: '0 0 auto' }}>{num}</span>
              <span className="dk-mono" style={{ fontSize: 9, color: 'var(--dk-ink2)', width: 52, flex: '0 0 auto', paddingTop: 1 }}>{s.type}/{s.tod}</span>
              <span style={{ flex: 1, fontSize: 11.5, lineHeight: 1.3 }}>
                {syn || '—'}
                {s.segments.length > 1 && <span className="dk-mono" style={{ color: 'var(--dk-ink3)', fontSize: 9.5 }}>{'  '}· {s.segments.slice(1).join(' / ')}</span>}
              </span>
              <span className="dk-mono" style={{ fontSize: 9.5, color: 'var(--dk-ink3)', width: 56, flex: '0 0 auto', textAlign: 'right' }}>{s.dayNumber ? 'D' + s.dayNumber : ''}{s.year ? ' ·' + s.year.slice(2) : ''}</span>
            </div>;
          })}
        </div>
        <div className="dk-foot"><span>{scheduleName} — Scene breakdown</span><span>{name}</span></div>
      </div>
    </div>
  );
}

function AppendixPage({ name, scheduleName, label, items, part, parts, onZoom }: any) {
  const cols = items.length === 1 ? 1 : 2;
  return (
    <div className="deck-page">
      <div className="dk-pad">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px solid var(--dk-line)', paddingBottom: 12 }}>
          <span className="dk-kick">{name} · appendix</span>
          <span style={{ flex: 1 }} />
          {parts > 1 && <span className="dk-mono" style={{ fontSize: 11, color: 'var(--dk-ink3)' }}>{part} / {parts}</span>}
          <span className="dk-serif" style={{ fontSize: 24, fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(' + cols + ',1fr)', gridAutoRows: '1fr', gap: 16 }}>
          {items.map((it: any) => (
            <div key={it.id} style={{ border: '1px solid var(--dk-line)', borderRadius: 12, overflow: 'hidden', background: 'var(--dk-card)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="deck-img-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, background: '#ece4d2', position: 'relative', cursor: onZoom ? 'zoom-in' : 'default' }}
                onClick={() => onZoom && onZoom(shownId(it))}>
                <Img imgId={shownId(it)} style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: 4 }} />
                {onZoom && (
                  <button className="deck-zoom-btn no-print" title="Vergroot foto"
                    style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.55)', border: 'none', borderRadius: 6, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-in', color: '#fff' }}
                    onClick={e => { e.stopPropagation(); onZoom(shownId(it)); }}>
                    <Icon name="search" size={14} sw={2} />
                  </button>
                )}
              </div>
              {(it.cap || it.note) && (
                <div style={{ flex: '0 0 auto', padding: '9px 13px', borderTop: '1px solid var(--dk-line)' }}>
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

export function Deck({ entries, scheduleName, opts, onClose, readonly }: any) {
  const o = opts || {};
  const [scale, setScale] = useState(1);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(true);
  const [activeLocId, setActiveLocId] = useState<string | null>(entries[0]?.loc?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const navW = navOpen ? 220 : 0;
      setScale(Math.min(1, (window.innerWidth - navW - 80) / 1280));
    };
    fit(); window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit);
  }, [navOpen]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (lightbox) setLightbox(null); else onClose(); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose, lightbox]);

  // Track which location is in view by watching scroll position
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || entries.length < 2) return;
    const onScroll = () => {
      for (let i = entries.length - 1; i >= 0; i--) {
        const anchor = document.getElementById('loc-' + entries[i].loc.id);
        if (anchor && anchor.getBoundingClientRect().top <= window.innerHeight * 0.6) {
          setActiveLocId(entries[i].loc.id);
          return;
        }
      }
      setActiveLocId(entries[0]?.loc?.id ?? null);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [entries]);

  const scrollToLoc = (locId: string) => {
    const anchor = document.getElementById('loc-' + locId);
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveLocId(locId);
  };

  const PER_SCENE_PAGE = 40;
  const PER_APPENDIX = 4;

  // First pass: compute page start index for each location (for TOC page numbers)
  const pageMap: Record<string, number> = {};
  let pageCounter = o.toc ? 2 : 1; // TOC is page 1 if included
  entries.forEach(({ loc, edit }: any) => {
    pageMap[loc.id] = pageCounter;
    if (o.cover) pageCounter++;
    pageCounter++; // overview always
    if (o.scenes) {
      const removedSc: string[] = edit.removedScenes || [];
      const addedSc: any[] = edit.addedScenes || [];
      const list = [...loc.scenes].filter((s: any) => !removedSc.includes(s.number + '_' + s.idx)).concat(addedSc);
      pageCounter += Math.ceil(list.length / PER_SCENE_PAGE) || 1;
    }
    const gal = edit.galleries || {};
    ['photos', 'sketches', 'measurements', 'designs', 'moodboard'].forEach(k => {
      if (o[k] !== false) pageCounter += Math.ceil((gal[k] || []).length / PER_APPENDIX);
    });
  });

  // Second pass: build actual page elements
  const pages: React.ReactNode[] = [];
  if (o.toc) {
    pages.push(<TableOfContentsPage key="toc" entries={entries} scheduleName={scheduleName} pageMap={pageMap} />);
  }

  entries.forEach(({ loc, edit, name }: any) => {
    const locPages: React.ReactNode[] = [];
    if (o.cover) locPages.push(<CoverPage key={loc.id + '-cv'} loc={loc} edit={edit} name={name} scheduleName={scheduleName} />);
    locPages.push(<OverviewPage key={loc.id + '-ov'} loc={loc} edit={edit} name={name} scheduleName={scheduleName} />);
    if (o.scenes) {
      const removedSc: string[] = edit.removedScenes || [];
      const addedSc: any[] = (edit.addedScenes || []).map((s: any) => ({ ...s, _ovKey: 'added_' + s._id }));
      const list = [...loc.scenes].filter((s: any) => !removedSc.includes(s.number + '_' + s.idx)).sort((a: any, b: any) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx).concat(addedSc);
      const parts = Math.ceil(list.length / PER_SCENE_PAGE) || 1;
      for (let p = 0; p < parts; p++) {
        locPages.push(<ScenesPage key={loc.id + '-sc' + p} loc={loc} edit={edit} name={name} scheduleName={scheduleName}
          scenes={list.slice(p * PER_SCENE_PAGE, (p + 1) * PER_SCENE_PAGE)} part={p + 1} parts={parts} />);
      }
    }
    const gal = edit.galleries || {};
    [['photos', 'Photos'], ['sketches', 'Sketches'], ['measurements', 'Measurements'], ['designs', 'Designs'], ['moodboard', 'Moodboard']]
      .filter(([k]) => o[k] !== false && (gal[k] || []).length)
      .forEach(([k, label]) => {
        const imgs = gal[k];
        const aParts = Math.ceil(imgs.length / PER_APPENDIX) || 1;
        for (let p = 0; p < aParts; p++) {
          locPages.push(<AppendixPage key={loc.id + '-' + k + p} name={name} scheduleName={scheduleName} label={label}
            items={imgs.slice(p * PER_APPENDIX, (p + 1) * PER_APPENDIX)} part={p + 1} parts={aParts} onZoom={setLightbox} />);
        }
      });

    // Wrap the first page of each location in an anchor div
    locPages.forEach((page, pi) => {
      if (pi === 0) {
        pages.push(
          <div key={loc.id + '-anchor'} id={'loc-' + loc.id} style={{ display: 'contents' }}>
            {page}
          </div>
        );
      } else {
        pages.push(page);
      }
    });
  });

  const multi = entries.length > 1;
  return (
    <div className="deckroot">
      {lightbox && (
        <div className="no-print" onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'absolute', top: 18, right: 22, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8, width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Icon name="x" size={18} />
          </button>
          <Img imgId={lightbox} style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 8px 60px rgba(0,0,0,.6)', cursor: 'default' }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()} />
        </div>
      )}
      <style>{DECK_CSS}</style>
      <div className="deck-chrome">
        {!readonly && <button className="btn sm" onClick={onClose} style={{ background: '#2a2620', color: '#e9e2d2', borderColor: '#000' }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} />Back</button>}
        {entries.length > 1 && (
          <button className="btn sm" onClick={() => setNavOpen(n => !n)}
            style={{ background: navOpen ? 'rgba(255,255,255,.12)' : '#2a2620', color: '#e9e2d2', borderColor: '#000' }}
            title="Toggle location navigator">
            <Icon name="list" size={14} />Nav
          </button>
        )}
        <span className="t">{multi ? entries.length + ' locations · ' : entries[0].name + ' · '}{pages.length} page{pages.length !== 1 ? 's' : ''} · 1280×800</span>
        <span style={{ flex: 1 }} />
        <span className="t" style={{ opacity: .7 }}>Save as PDF → landscape, margins "None"</span>
        <button className="btn sm primary" onClick={() => window.print()}><Icon name="download" size={14} />Save PDF</button>
      </div>
      <div className="deck-body">
        {/* Side navigation */}
        {entries.length > 1 && (
          <nav className={'deck-sidenav no-print' + (navOpen ? '' : ' closed')} aria-label="Locations">
            <div className="deck-sidenav-inner">
              <div style={{ padding: '6px 14px 10px', fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6d6350', borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 4 }}>
                {entries.length} locaties
              </div>
              {entries.map(({ loc, edit, name }: any) => (
                <button key={loc.id} className={'deck-sidenav-item' + (activeLocId === loc.id ? ' active' : '')}
                  onClick={() => scrollToLoc(loc.id)}>
                  <div className="deck-sidenav-thumb">
                    {edit.cover
                      ? <Img imgId={edit.cover} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: '#2a2620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="pin" size={14} style={{ color: '#6d6350' }} />
                        </div>}
                  </div>
                  <span className="deck-sidenav-name">{name}</span>
                </button>
              ))}
            </div>
          </nav>
        )}
        <div className="deck-scroll" ref={scrollRef}>
          {pages.map((p, i) => (
            <div className="deck-page-wrap" key={i} style={{ width: 1280 * scale, height: 800 * scale }}>
              <div className="dk-scaler" style={{ transform: 'scale(' + scale + ')', transformOrigin: 'top left', width: 1280, height: 800 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
