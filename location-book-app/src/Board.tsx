import { useState, useRef } from 'react';
import { Icon, Img, Menu, useDrop, filesToIds, locName } from './components';

function LocCard({ loc, edit, name, onOpen, onPatch, onRename, onRemove, onCombine, onDuplicate, onCombineDrop }: any) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [cardOver, setCardOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inp = useRef<HTMLInputElement>(null);
  const [drag, handlers] = useDrop(async fl => { const ids = await filesToIds(fl); if (ids[0]) onPatch({ cover: ids[0] }); });
  const fileInp = useRef<HTMLInputElement>(null);

  const adj = edit.adjustments || [];
  const done = adj.filter((a: any) => a.done).length;
  const gal = edit.galleries || {};
  const photos = ['photos', 'sketches', 'measurements', 'designs', 'moodboard'].reduce((n: number, k: string) => n + (gal[k] || []).length, 0) + (edit.cover ? 1 : 0);

  const startRename = () => { setDraft(name); setRenaming(true); setTimeout(() => inp.current && inp.current.focus(), 0); };
  const commit = () => { const v = draft.trim(); if (v && v !== name) onRename(v); setRenaming(false); };
  const hasLocType = (e: React.DragEvent) => { const t = e.dataTransfer.types; return t && (Array.prototype.includes ? Array.prototype.includes.call(t, 'text/loc-id') : Array.prototype.indexOf.call(t, 'text/loc-id') >= 0); };

  return (
    <div className={'loc-card' + (cardOver ? ' cardrag-over' : '') + (dragging ? ' card-dragging' : '')}
      draggable={!renaming}
      onDragStart={e => { e.dataTransfer.setData('text/loc-id', loc.id); e.dataTransfer.effectAllowed = 'move'; setDragging(true); }}
      onDragEnd={() => { setDragging(false); setCardOver(false); }}
      onDragOver={e => { if (hasLocType(e) && !dragging) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setCardOver(true); } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCardOver(false); }}
      onDrop={e => { if (!hasLocType(e)) return; e.preventDefault(); setCardOver(false); const id = e.dataTransfer.getData('text/loc-id'); if (id && id !== loc.id) onCombineDrop(id, loc.id); }}>
      {cardOver && <div className="card-droplay"><Icon name="layers" size={20} /><span>Combine into "{name}"</span></div>}
      <div className={'loc-card-cover' + (drag ? ' drag' : '')} {...handlers} onClick={onOpen}>
        {edit.cover
          ? <Img imgId={edit.cover} className="cover-img" />
          : <div className="loc-card-ph"><div className="ic"><Icon name="image" size={22} /><span>drop a photo</span></div></div>}
        <div className="loc-card-badges">
          {adj.length > 0 && <span className="lc-badge accent">{done}/{adj.length} adj</span>}
          {photos > 0 && <span className="lc-badge">{photos} 📷</span>}
        </div>
        <button className="loc-card-cam" title="Add / replace cover" onClick={e => { e.stopPropagation(); fileInp.current?.click(); }}>
          <Icon name="image" size={15} />
        </button>
        <input ref={fileInp} type="file" accept="image/*" hidden onChange={async e => {
          const ids = await filesToIds(e.target.files!); if (ids[0]) onPatch({ cover: ids[0] }); e.target.value = '';
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
            { label: edit.cover ? 'Replace cover' : 'Add cover', icon: 'image', onClick: () => fileInp.current?.click() },
            { label: 'Duplicate location', icon: 'copy', onClick: onDuplicate },
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

export function Board({ model, edits, removed, onOpen, onPatchLoc, onRename, onRemove, onCombine, onDuplicate, onCombineDrop, onExport, onOpenSidebar }: any) {
  const visible = model.locations.filter((l: any) => !removed.includes(l.id));
  const regionOrder = model.regions || [];
  const groups: Record<string, any[]> = {};
  visible.forEach((l: any) => { const r = l.regions[0] || 'Other'; (groups[r] = groups[r] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  const withCover = visible.filter((l: any) => (edits[l.id] || {}).cover).length;

  return (
    <div className="board">
      <div className="board-top">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {onOpenSidebar && (
            <button className="btn sm ghost hamburger-btn" onClick={onOpenSidebar} style={{ padding: '5px 7px', marginTop: 4, flexShrink: 0 }} title="Menu">
              <Icon name="menu" size={18} />
            </button>
          )}
          <div>
            <div className="kicker">{model.scheduleName} · visual overview</div>
            <h1>All locations</h1>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>{visible.length} locations · {withCover} with a cover photo</div>
          </div>
        </div>
        <button className="btn primary" onClick={onExport}><Icon name="download" size={15} />Export…</button>
      </div>

      {keys.map(region => (
        <div key={region}>
          <div className="board-region">
            <span className="rn">{region}</span>
            <span className="rc">{groups[region].length}</span>
            <span className="ln" />
          </div>
          <div className="board-grid">
            {groups[region].map((l: any) => (
              <LocCard key={l.id} loc={l} edit={edits[l.id] || {}} name={locName(l, edits)}
                onOpen={() => onOpen(l.id)} onPatch={(p: any) => onPatchLoc(l.id, p)}
                onRename={(n: string) => onRename(l.id, n)} onRemove={() => onRemove(l.id)} onCombine={() => onCombine(l.id)} onDuplicate={() => onDuplicate(l.id)} onCombineDrop={onCombineDrop} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
