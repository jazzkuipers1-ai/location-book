/* Sidebar — location index grouped by region, with search + cover thumbs. */

function EditableName({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inp = useRef(null);
  const commit = () => { setEditing(false); if (draft.trim() && draft.trim() !== value && onChange) onChange(draft.trim()); };
  if (!onChange) return <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>;
  if (editing) return (
    <input value={draft} autoFocus
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value); } }}
      style={{ flex: 1, background: 'none', border: 'none', borderBottom: '1px solid var(--accent)', outline: 'none', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit', padding: '0 2px', minWidth: 0 }} />
  );
  return (
    <span onClick={() => { setDraft(value); setEditing(true); }} title="Click to rename"
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', borderBottom: '1px dashed transparent' }}
      onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--ink-3)'}
      onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}>
      {value}
    </span>
  );
}

function LocItem({ loc, edit, name, active, onClick }) {
  const adj = (edit && edit.adjustments) || [];
  const done = adj.filter(a => a.done).length;
  const days = loc.dayNums.length;
  const cover = edit && edit.cover;
  return (
    <button className={'loc-item' + (active ? ' active' : '')} onClick={onClick}>
      <div className={'loc-thumb' + (cover ? '' : ' ph')}>
        {cover ? <Img imgId={cover} /> : <Icon name="image" size={14} />}
      </div>
      <div className="loc-item-main">
        <div className="row1">
          <span className="nm" style={active ? { color: 'var(--accent)' } : null}>{name}</span>
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

function Sidebar({ model, edits, activeId, onSelect, onImport, onUpdateSchedule, onExport, navSort, view, onOverview, removed, onRestore, onRenameSchedule, onGoHome, hasPassword, onSetPassword }) {
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const ql = q.trim().toLowerCase();

  const visible = model.locations.filter(l => !removed.includes(l.id));
  const filtered = visible.filter(l =>
    !ql || locName(l, edits).toLowerCase().includes(ql) ||
    l.scenes.some(s => (s.synopsis || '').toLowerCase().includes(ql)));

  const regionOrder = model.regions || [];
  const groups = useMemo(() => {
    if (navSort === 'count')
      return [['All locations · most scenes', [...filtered].sort((a, b) => b.sceneCount - a.sceneCount)]];
    if (navSort === 'a–z')
      return [['All locations · A–Z', [...filtered].sort((a, b) => locName(a, edits).localeCompare(locName(b, edits)))]];
    const g = {};
    filtered.forEach(l => { const r = l.regions[0] || 'Other'; (g[r] = g[r] || []).push(l); });
    const keys = Object.keys(g).sort((a, b) => {
      const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map(k => [k, g[k]]);
  }, [filtered, navSort, edits]);

  const hiddenLocs = model.locations.filter(l => removed.includes(l.id));

  return (
    <aside className="side">
      <div className="side-head">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onGoHome && <button type="button" onClick={onGoHome} title="All projects" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', marginLeft: -4 }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /></button>}
          <span className="dot" /><b>Locations</b>
        </div>
        <div className="sched-name">
          <Icon name="film" size={13} />
          <EditableName value={model.scheduleName || 'Shooting schedule'} onChange={onRenameSchedule} />
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
            {locs.map(l => (
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
            {showHidden && hiddenLocs.map(l => (
              <div key={l.id} className="hr-item">
                <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locName(l, edits)}</span>
                <button className="btn sm ghost" onClick={() => onRestore(l.id)}><Icon name="reset" size={13} />Restore</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="side-foot" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px' }}>
        <button className="btn block sm primary" onClick={onExport}><Icon name="download" size={14} />Export decks…</button>
        {onUpdateSchedule && <button className="btn block sm" onClick={onUpdateSchedule}><Icon name="reset" size={14} />Update schedule…</button>}
        {onSetPassword && <button className="btn block sm ghost" onClick={onSetPassword}><Icon name="lock" size={14} />{hasPassword ? 'Change password…' : 'Set password…'}</button>}
        <button className="btn block sm ghost" onClick={onImport}><Icon name="upload" size={14} />Import schedule</button>
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
