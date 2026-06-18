import { useState, useMemo } from 'react';
import { Icon, Img, locName } from './components';

function LocItem({ loc, edit, name, active, onClick }: { loc: any; edit: any; name: string; active: boolean; onClick: () => void }) {
  const adj = (edit && edit.adjustments) || [];
  const done = adj.filter((a: any) => a.done).length;
  const days = loc.dayNums.length;
  const cover = edit && edit.cover;
  return (
    <button className={'loc-item' + (active ? ' active' : '')} onClick={onClick}>
      <div className={'loc-thumb' + (cover ? '' : ' ph')}>
        {cover ? <Img imgId={cover} /> : <Icon name="image" size={14} />}
      </div>
      <div className="loc-item-main">
        <div className="row1">
          <span className="nm" style={active ? { color: 'var(--accent)' } : undefined}>{name}</span>
          <span className="cnt">{loc.sceneCount} sc</span>
        </div>
        <div className="row2">
          {adj.length > 0 && <span className="adj-dot" />}
          <span>{adj.length ? adj.length + ' adj' : 'no adj'}</span>
          <span>·</span>
          <span>{days} day{days !== 1 ? 's' : ''}</span>
        </div>
        {adj.length > 0 && <div className="bartrack"><div className="bar" style={{ width: (done / adj.length * 100) + '%' }} /></div>}
      </div>
    </button>
  );
}

export function Sidebar({ model, edits, activeId, onSelect, onImport, onExport, navSort, view, onOverview, removed, onRestore, onGoHome, className }: any) {
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const ql = q.trim().toLowerCase();

  const visible = model.locations.filter((l: any) => !removed.includes(l.id));
  const filtered = visible.filter((l: any) =>
    !ql || locName(l, edits).toLowerCase().includes(ql) ||
    l.scenes.some((s: any) => (s.synopsis || '').toLowerCase().includes(ql)));

  const regionOrder = model.regions || [];
  const groups: [string, any[]][] = useMemo(() => {
    if (navSort === 'count')
      return [['All locations · most scenes', [...filtered].sort((a: any, b: any) => b.sceneCount - a.sceneCount)]];
    if (navSort === 'a–z')
      return [['All locations · A–Z', [...filtered].sort((a: any, b: any) => locName(a, edits).localeCompare(locName(b, edits)))]];
    const g: Record<string, any[]> = {};
    filtered.forEach((l: any) => { const r = l.regions[0] || 'Other'; (g[r] = g[r] || []).push(l); });
    const keys = Object.keys(g).sort((a, b) => {
      const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map(k => [k, g[k]]);
  }, [filtered, navSort, edits]);

  const hiddenLocs = model.locations.filter((l: any) => removed.includes(l.id));

  return (
    <aside className={'side' + (className ? ' ' + className : '')}>
      <div className="side-head">
        <div className="brand"><span className="dot" /><b>Locations</b></div>
        <div className="sched-name">
          <Icon name="film" size={13} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.scheduleName || 'Shooting schedule'}</span>
        </div>
      </div>

      <div className="nav-tabs">
        <button className={'nav-tab' + (view === 'board' ? ' on' : '')} onClick={onOverview}><Icon name="grid" size={14} />Overview</button>
        <button className={'nav-tab' + (view !== 'board' ? ' on' : '')} onClick={() => onSelect(activeId)}><Icon name="list" size={14} />List</button>
      </div>

      <div className="search">
        <Icon name="search" size={15} />
        <input placeholder="Search locations & scenes…" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="loc-list">
        {groups.map(([region, locs]) => (
          <div key={region}>
            <div className="loc-group-h">
              <span className="kicker">{region}</span>
              <span className="ln" />
              <span className="kicker">{locs.length}</span>
            </div>
            {locs.map((l: any) => (
              <LocItem key={l.id} loc={l} edit={edits[l.id]} name={locName(l, edits)}
                active={view !== 'board' && l.id === activeId} onClick={() => onSelect(l.id)} />
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No matches.</div>}

        {hiddenLocs.length > 0 && (
          <div className="hidden-restore">
            <div className="loc-group-h" style={{ cursor: 'pointer' }} onClick={() => setShowHidden(s => !s)}>
              <span className="kicker">Hidden · {hiddenLocs.length}</span>
              <span className="ln" />
              <Icon name={showHidden ? 'chevronD' : 'chevron'} size={12} style={{ color: 'var(--ink-3)' }} />
            </div>
            {showHidden && hiddenLocs.map((l: any) => (
              <div key={l.id} className="hr-item">
                <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locName(l, edits)}</span>
                <button className="btn sm ghost" onClick={() => onRestore(l.id)}><Icon name="reset" size={13} />Restore</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="side-foot" style={{ flexDirection: 'column', gap: 8 }}>
        <button className="btn block sm primary" onClick={onExport}><Icon name="download" size={14} />Export decks…</button>
        <button className="btn block sm" onClick={onImport}><Icon name="upload" size={14} />Import schedule</button>
        {onGoHome && (
          <button className="btn block sm ghost" onClick={onGoHome} style={{ color: 'var(--ink-3)', marginTop: 2 }}>
            <Icon name="grid" size={13} />All projects
          </button>
        )}
      </div>
    </aside>
  );
}
