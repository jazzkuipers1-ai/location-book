/* Visual overview — board of location cards with cover photos. */

function LocCard({ loc, edit, name, onOpen, onPatch, onRename, onRemove, onCombine, onCombineDrop, onDuplicate }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [cardOver, setCardOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inp = useRef();
  const [drag, handlers] = useDrop(async fl => { const ids = await filesToIds(fl); if (ids[0]) onPatch({ cover: ids[0] }); });
  const fileInp = useRef();

  const adj = edit.adjustments || [];
  const done = adj.filter(a => a.done).length;
  const gal = edit.galleries || {};
  const photos = ['photos', 'sketches', 'measurements', 'designs', 'moodboard'].reduce((n, k) => n + (gal[k] || []).length, 0) + (edit.cover ? 1 : 0);

  const startRename = () => { setDraft(name); setRenaming(true); setTimeout(() => inp.current && inp.current.focus(), 0); };
  const commit = () => { const v = draft.trim(); if (v && v !== name) onRename(v); setRenaming(false); };
  const hasLocType = e => { const t = e.dataTransfer.types; return t && (t.includes ? t.includes('text/loc-id') : Array.prototype.indexOf.call(t, 'text/loc-id') >= 0); };

  return (
    <div className={'loc-card' + (cardOver ? ' cardrag-over' : '') + (dragging ? ' card-dragging' : '')}
      draggable={!renaming}
      onDragStart={e => { e.dataTransfer.setData('text/loc-id', loc.id); e.dataTransfer.effectAllowed = 'move'; setDragging(true); }}
      onDragEnd={() => { setDragging(false); setCardOver(false); }}
      onDragOver={e => { if (hasLocType(e) && !dragging) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setCardOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setCardOver(false); }}
      onDrop={e => { if (!hasLocType(e)) return; e.preventDefault(); setCardOver(false); const id = e.dataTransfer.getData('text/loc-id'); if (id && id !== loc.id) onCombineDrop(id, loc.id); }}>
      {cardOver && <div className="card-droplay"><Icon name="layers" size={20} /><span>Combine into “{name}”</span></div>}
      <div className={'loc-card-cover' + (drag ? ' drag' : '')} {...handlers} onClick={onOpen}>
        {edit.cover
          ? <Img imgId={edit.cover} className="cover-img" />
          : <div className="loc-card-ph"><div className="ic"><Icon name="image" size={22} /><span>drop a photo</span></div></div>}
        <div className="loc-card-badges">
          {adj.length > 0 && <span className="lc-badge accent">{done}/{adj.length} adj</span>}
          {photos > 0 && <span className="lc-badge">{photos} 📷</span>}
        </div>
        <button className="loc-card-cam" title="Add / replace cover" onClick={e => { e.stopPropagation(); fileInp.current.click(); }}>
          <Icon name="image" size={15} />
        </button>
        <input ref={fileInp} type="file" accept="image/*" hidden onChange={async e => {
          const ids = await filesToIds(e.target.files); if (ids[0]) onPatch({ cover: ids[0] }); e.target.value = '';
        }} />
      </div>
      <div className="loc-card-body">
        <div className="loc-card-h">
          {!renaming && <span className="loc-card-grip" title="Drag onto another location to combine them"><Icon name="grip" size={14} /></span>}
          {renaming
            ? <div className="loc-card-rename" style={{ flex: 1 }}>
                <input ref={inp} value={draft} onChange={e => setDraft(e.target.value)}
                  onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setRenaming(false); }} />
              </div>
            : <span className="nm" onClick={onOpen}>{name}</span>}
          <Menu button={<span className="icon-btn"><Icon name="dots" /></span>} items={[
            { label: 'Open', icon: 'arrow', onClick: onOpen },
            { label: 'Rename', icon: 'edit', onClick: startRename },
            { label: edit.cover ? 'Replace cover' : 'Add cover', icon: 'image', onClick: () => fileInp.current.click() },
            { label: 'Duplicate', icon: 'copy', onClick: onDuplicate },
            { label: 'Combine with…', icon: 'layers', onClick: onCombine },
            { sep: true },
            { label: 'Remove location', icon: 'trash', danger: true, onClick: onRemove },
          ]} />
        </div>
        <div className="loc-card-meta">{loc.sceneCount} sc · {loc.dayNums.length} day{loc.dayNums.length !== 1 ? 's' : ''} · {photos} photo{photos !== 1 ? 's' : ''}</div>
        {adj.length > 0 && <div className="bartrack"><div className="bar" style={{ width: (done / adj.length * 100) + '%' }} /></div>}
      </div>
    </div>
  );
}

const SEASON_ORDER = ['winter', 'spring', 'summer', 'autumn'];
const SEASON_LABEL = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', other: 'Other' };

function dominantSeason(scenes) {
  const counts = {};
  (scenes || []).forEach(s => { if (s.season) counts[s.season] = (counts[s.season] || 0) + 1; });
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
}

function SeasonGroup({ season, locs, edits, onOpen, onPatchLoc, onRename, onRemove, onCombine, onCombineDrop, onDropSeason, onDuplicate }) {
  const [over, setOver] = useState(false);
  const hasLocId = e => { const t = e.dataTransfer.types; return t && (t.includes ? t.includes('text/loc-id') : Array.prototype.indexOf.call(t, 'text/loc-id') >= 0); };
  return (
    <div
      onDragOver={e => { if (hasLocId(e)) { e.preventDefault(); setOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={e => {
        if (!hasLocId(e)) return;
        e.preventDefault(); setOver(false);
        const id = e.dataTransfer.getData('text/loc-id');
        if (id) onDropSeason(id, season);
      }}
      style={{ outline: over ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 12, transition: 'outline .12s' }}>
      <div className="board-region">
        <span className="rn">{SEASON_LABEL[season] || season}</span>
        <span className="rc">{locs.length}</span>
        <span className="ln" />
      </div>
      <div className="board-grid">
        {locs.map(l => (
          <LocCard key={l.id} loc={l} edit={edits[l.id] || {}} name={locName(l, edits)}
            onOpen={() => onOpen(l.id)} onPatch={p => onPatchLoc(l.id, p)}
            onRename={n => onRename(l.id, n)} onRemove={() => onRemove(l.id)} onCombine={() => onCombine(l.id)} onCombineDrop={onCombineDrop} onDuplicate={() => onDuplicate(l.id)} />
        ))}
        {locs.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '20px 0', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
            Sleep een locatie hierheen
          </div>
        )}
      </div>
    </div>
  );
}

function Board({ model, edits, removed, onOpen, onPatchLoc, onRename, onRemove, onCombine, onCombineDrop, onExport, onAddLocation, onDuplicate, onShareProject }) {
  const visible = model.locations.filter(l => !removed.includes(l.id));

  // Only use season grouping when the schedule actually has seasonal data
  const hasSeasons = visible.some(l => dominantSeason(l.scenes) !== null);

  const withCover = visible.filter(l => (edits[l.id] || {}).cover).length;

  const handleDropSeason = (locId, season) => {
    onPatchLoc(locId, { seasonOverride: season });
  };

  // Season grouping
  const seasonGroups = {};
  if (hasSeasons) {
    const usedSeasons = new Set();
    visible.forEach(l => {
      const s = (edits[l.id] || {}).seasonOverride || dominantSeason(l.scenes) || 'other';
      usedSeasons.add(s);
      (seasonGroups[s] = seasonGroups[s] || []).push(l);
    });
    // Ensure all detected seasons appear (even if empty after drag)
    SEASON_ORDER.forEach(s => { if (usedSeasons.has(s) && !seasonGroups[s]) seasonGroups[s] = []; });
  }

  // Region grouping (fallback when no seasons)
  const regionOrder = model.regions || [];
  const regionGroups = {};
  visible.forEach(l => { const r = l.regions[0] || 'Other'; (regionGroups[r] = regionGroups[r] || []).push(l); });
  const regionKeys = Object.keys(regionGroups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return (
    <div className="board">
      <div className="board-top">
        <div>
          <div className="kicker">{model.scheduleName} · visual overview</div>
          <h1>All locations</h1>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>{visible.length} locations · {withCover} with a cover photo</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onAddLocation}><Icon name="plus" size={15} />Add location</button>
          <button className="btn" onClick={onShareProject}><Icon name="arrow" size={15} />Share project…</button>
          <button className="btn primary" onClick={onExport}><Icon name="download" size={15} />Export…</button>
        </div>
      </div>

      {hasSeasons
        ? [...SEASON_ORDER, 'other'].filter(s => seasonGroups[s] && seasonGroups[s].length > 0).map(season => (
            <SeasonGroup key={season} season={season} locs={seasonGroups[season] || []}
              edits={edits} onOpen={onOpen} onPatchLoc={onPatchLoc} onRename={onRename}
              onRemove={onRemove} onCombine={onCombine} onCombineDrop={onCombineDrop}
              onDropSeason={handleDropSeason} onDuplicate={onDuplicate} />
          ))
        : regionKeys.map(region => (
            <div key={region}>
              <div className="board-region">
                <span className="rn">{region}</span>
                <span className="rc">{regionGroups[region].length}</span>
                <span className="ln" />
              </div>
              <div className="board-grid">
                {regionGroups[region].map(l => (
                  <LocCard key={l.id} loc={l} edit={edits[l.id] || {}} name={locName(l, edits)}
                    onOpen={() => onOpen(l.id)} onPatch={p => onPatchLoc(l.id, p)}
                    onRename={n => onRename(l.id, n)} onRemove={() => onRemove(l.id)} onCombine={() => onCombine(l.id)} onCombineDrop={onCombineDrop} onDuplicate={() => onDuplicate(l.id)} />
                ))}
              </div>
            </div>
          ))
      }
    </div>
  );
}

window.Board = Board;
