/* Location file editor — cover, meta, scenes, adjustments, annotated galleries. */

const shownId = item => (item.annotatedId || item.id);

/* Stepper that accepts decimals (0.25 / 0.5 steps) for prep & wrap days. */
function DayStepper({ value, onChange }) {
  const v = value || 0;
  const [draft, setDraft] = useState(String(v));
  useEffect(() => { setDraft(String(value || 0)); }, [value]);
  const step = delta => {
    const next = Math.max(0, Math.round((v + delta) * 4) / 4);
    onChange(next);
  };
  const commit = () => {
    const n = parseFloat(draft.replace(',', '.'));
    if (!isNaN(n) && n >= 0) onChange(Math.round(n * 4) / 4);
    else setDraft(String(v));
  };
  return (
    <span className="stepper">
      <button type="button" onClick={() => step(-0.5)}>–</button>
      <input value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && commit()}
        style={{ width: 40 }} />
      <button type="button" onClick={() => step(0.5)}>+</button>
    </span>
  );
}

function EditableDayNumber({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) onChange(n);
    else setDraft(String(value));
  };
  if (editing) return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(String(value)); } }}
      style={{ width: 36, fontSize: 22, fontWeight: 600, fontFamily: 'var(--serif)', color: 'var(--accent)', background: 'none', border: 'none', borderBottom: '1.5px solid var(--accent)', outline: 'none', padding: '0 2px', textAlign: 'center' }} />
  );
  return (
    <span className="serif" onClick={() => { setDraft(String(value)); setEditing(true); }} title="Click to change day number"
      style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)', cursor: 'text', minWidth: 24, display: 'inline-block', textAlign: 'center' }}>
      {value}
    </span>
  );
}

/* ---- notes textarea with local draft state ------------------------------ */
function NotesField({ value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <textarea className="input" rows={6} placeholder="Add notes… press Enter for a new line"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onChange(draft)}
      style={{ resize: 'vertical', lineHeight: 1.6 }} />
  );
}

/* ---- bullet-point notes editor ------------------------------------------ */
function parseBullets(str) {
  if (!str || !str.trim()) return [''];
  const lines = str.split(/[•\n]/).map(l => l.trim()).filter(Boolean);
  return lines.length ? lines : [''];
}
function serializeBullets(bullets) {
  return bullets.filter(b => b.trim()).map(b => '• ' + b).join('\n');
}

function BulletNotes({ value, onChange }) {
  const [bullets, setBullets] = useState(() => parseBullets(value));
  const refs = useRef([]);

  // Normalize old inline-bullet data on first mount
  useEffect(() => {
    const normalized = serializeBullets(parseBullets(value));
    if (normalized !== value) onChange(normalized);
  }, []);

  const update = next => { setBullets(next); onChange(serializeBullets(next)); };

  const onKeyDown = (e, i) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = [...bullets];
      next.splice(i + 1, 0, '');
      update(next);
      setTimeout(() => refs.current[i + 1] && refs.current[i + 1].focus(), 0);
    } else if (e.key === 'Backspace' && bullets[i] === '' && bullets.length > 1) {
      e.preventDefault();
      const next = bullets.filter((_, j) => j !== i);
      update(next);
      setTimeout(() => refs.current[Math.max(0, i - 1)] && refs.current[Math.max(0, i - 1)].focus(), 0);
    }
  };

  const onInput = (e, i) => {
    const next = [...bullets];
    next[i] = e.target.value;
    update(next);
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {bullets.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontSize: 16, lineHeight: 1, flexShrink: 0, userSelect: 'none' }}>•</span>
          <input
            ref={el => refs.current[i] = el}
            value={b}
            placeholder={i === 0 ? 'Anything else the department needs to know…' : ''}
            onChange={e => onInput(e, i)}
            onKeyDown={e => onKeyDown(e, i)}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--ink)', fontFamily: 'var(--sans)', padding: '4px 0', lineHeight: 1.5 }}
          />
        </div>
      ))}
    </div>
  );
}

const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toStoredDate(yyyy, mm, dd) {
  return `${String(dd).padStart(2,'0')}/${String(mm+1).padStart(2,'0')}/${yyyy}`;
}

function CalendarPicker({ date, onSave, onClose, portalPos }) {
  const parsed = date && /^\d{2}\/\d{2}\/\d{4}$/.test(date)
    ? (() => { const [dd,mm,yyyy] = date.split('/').map(Number); return new Date(yyyy, mm-1, dd); })()
    : new Date();
  const [view, setView] = React.useState(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  const ref = React.useRef(null);

  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', h); };
  }, [onClose]);

  const y = view.getFullYear(), m = view.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m+1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length: days}, (_,i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSel = d => {
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [dd,mm,yyyy] = date.split('/').map(Number);
    return d === dd && m === mm-1 && y === yyyy;
  };

  return (
    <div ref={ref} onMouseDown={e => e.stopPropagation()} style={{
      position: portalPos ? 'fixed' : 'absolute',
      top: portalPos ? portalPos.top : 'calc(100% + 6px)',
      left: portalPos ? portalPos.left : 0,
      zIndex:9999,
      background:'var(--card)', border:'1px solid var(--line-2)', borderRadius:12,
      boxShadow:'0 8px 32px rgba(0,0,0,.18)', padding:'14px 16px', width:248,
      userSelect:'none', minWidth:248,
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:14}}>{CAL_MONTHS[m]} {y}</span>
        <div style={{display:'flex',gap:2}}>
          <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={()=>setView(new Date(y,m-1,1))}
            style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-2)',padding:'2px 8px',borderRadius:6,fontSize:18,lineHeight:1}}>‹</button>
          <button type="button" onMouseDown={e=>e.stopPropagation()} onClick={()=>setView(new Date(y,m+1,1))}
            style={{background:'none',border:'none',cursor:'pointer',color:'var(--ink-2)',padding:'2px 8px',borderRadius:6,fontSize:18,lineHeight:1}}>›</button>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,textAlign:'center'}}>
        {CAL_DAYS.map(d => <div key={d} style={{fontSize:11,color:'var(--ink-3)',fontFamily:'var(--mono)',paddingBottom:6}}>{d}</div>)}
        {cells.map((d,i) => (
          <button key={i} type="button" disabled={!d}
            onMouseDown={e=>e.stopPropagation()}
            onClick={()=>{ if(d){ onSave(toStoredDate(y,m,d)); onClose(); } }}
            style={{
              background: d && isSel(d) ? 'var(--accent)' : 'none',
              color: d && isSel(d) ? '#fff' : d ? 'var(--ink)' : 'transparent',
              border:'none', borderRadius:'50%', width:32, height:32,
              cursor: d ? 'pointer' : 'default', fontSize:13,
              fontFamily:'var(--mono)', display:'flex', alignItems:'center', justifyContent:'center',
              transition:'background .1s',
            }}
          >{d||''}</button>
        ))}
      </div>
    </div>
  );
}

function DateButton({ date, onSave, style }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);
  const isValid = date && /^\d{2}\/\d{2}\/\d{4}$/.test(date);
  const fmt = isValid
    ? (() => { const [dd,mm,yyyy]=date.split('/').map(Number); return new Date(yyyy,mm-1,dd).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}); })()
    : 'Set date';

  const updatePos = React.useCallback(() => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 270) });
    }
  }, []);

  const openPicker = () => {
    updatePos();
    setOpen(o => !o);
  };

  React.useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <span style={{position:'relative',display:'inline-block',...style}}>
      <button ref={btnRef} type="button" onClick={openPicker}
        style={{background:'none',border:'none',padding:0,cursor:'pointer',font:'inherit',
          fontWeight:600,fontSize:13,borderBottom:'1px dashed var(--ink-3)',color: isValid ? 'inherit' : 'var(--accent)'}}>
        {fmt}
      </button>
      {open && ReactDOM.createPortal(
        <CalendarPicker date={isValid ? date : null} onSave={v=>{onSave(v);setOpen(false);}} onClose={()=>setOpen(false)} portalPos={pos} />,
        document.body
      )}
    </span>
  );
}

const GAL_KINDS = [
  { id: 'photos', label: 'Photos', icon: 'image' },
  { id: 'sketches', label: 'Sketches', icon: 'edit' },
  { id: 'measurements', label: 'Measurements', icon: 'ruler' },
  { id: 'designs', label: 'Designs', icon: 'layers' },
  { id: 'moodboard', label: 'Moodboard', icon: 'grid' },
];

function Lightbox({ imgIds, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx || 0);
  const [url, setUrl] = useState(null);
  const imgId = imgIds[idx];
  useEffect(() => { setUrl(null); LB.db.getURL(imgId).then(setUrl); }, [imgId]);
  const prev = () => setIdx(i => Math.max(0, i - 1));
  const next = () => setIdx(i => Math.min(imgIds.length - 1, i + 1));
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape' || e.key === 'Backspace') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return ReactDOM.createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <button onClick={onClose} style={{ position: 'fixed', top: 16, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="x" size={16} />
      </button>
      {imgIds.length > 1 && idx > 0 && (
        <button onClick={e => { e.stopPropagation(); prev(); }}
          style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
      )}
      {imgIds.length > 1 && idx < imgIds.length - 1 && (
        <button onClick={e => { e.stopPropagation(); next(); }}
          style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      )}
      {url
        ? <img src={url} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        : <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)', fontSize: 12 }}>Loading…</div>
      }
      {imgIds.length > 1 && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          {idx + 1} / {imgIds.length}
        </div>
      )}
    </div>,
    document.body
  );
}

function GalleryCell({ item, allImgIds, itemIdx, onCap, onNote, onRemove, onDraw, onCrop, onDragStart, onDragEnter, onDragEnd, isDragOver, accentColor, isSelected, onToggleSelect }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <div className={'gal-item' + (isDragOver ? ' drag-over' : '') + (isSelected ? ' gal-selected' : '')}
      style={{ ...(isDragOver && accentColor ? { boxShadow: '0 0 0 2px ' + accentColor } : {}), ...(isSelected ? { outline: '2px solid var(--accent)', outlineOffset: 1 } : {}) }}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}>
      <div className="gal-cell">
        <div className="gal-drag-handle" title="Drag to reorder"><Icon name="grip" size={14} /></div>
        {/* selection checkbox */}
        <div onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          style={{ position: 'absolute', top: 7, left: 38, width: 20, height: 20, borderRadius: 5, border: '2px solid ' + (isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.7)'), background: isSelected ? 'var(--accent)' : 'rgba(20,16,8,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 3, opacity: isSelected ? 1 : 0, transition: 'opacity .12s' }}
          className="gal-checkbox">
          {isSelected && <svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
        {/* Click photo → open annotator directly so editing tools are immediately available */}
        <div onClick={e => { e.stopPropagation(); onDraw(); }} onTouchStart={e => e.stopPropagation()} style={{ cursor: 'crosshair' }}>
          <Img imgId={shownId(item)} />
        </div>
        {(item.strokes && item.strokes.length || item.annotatedId) ? <span className="annot-badge"><Icon name="edit" size={12} /></span> : null}
        <div className="tools">
          <button className="tbtn" title="Crop" onClick={onCrop}><Icon name="ruler" size={15} /></button>
          <button className="tbtn" title="Lightbox" onClick={e => { e.stopPropagation(); setLightbox(true); }}><Icon name="eye" size={15} /></button>
          <button className="tbtn" title="Remove" onClick={onRemove}><Icon name="trash" size={14} /></button>
        </div>
        <div className="cap" contentEditable suppressContentEditableWarning
          onBlur={e => onCap(e.currentTarget.textContent.trim())}>{item.cap || ''}</div>
      </div>
      <textarea className="gal-note" rows={1} placeholder="Add a note…" defaultValue={item.note || ''}
        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        onBlur={e => onNote(e.target.value)} />
      {lightbox && <Lightbox imgIds={allImgIds || [shownId(item)]} startIdx={itemIdx || 0} onClose={() => setLightbox(false)} />}
    </div>
  );
}

function Dropzone({ onFiles }) {
  const [drag, handlers] = useDrop(onFiles);
  const inp = useRef();
  return (
    <div className={'dropzone' + (drag ? ' drag' : '')} {...handlers} onClick={() => inp.current.click()}>
      <div>
        <div className="ic"><Icon name="upload" size={20} /></div>
        <div className="t">Drop images</div>
        <div className="s mono">or click to browse</div>
      </div>
      <input ref={inp} type="file" accept="image/*" multiple hidden onChange={async e => {
        await onFiles(e.target.files); e.target.value = '';
      }} />
    </div>
  );
}

/* ---- palette for category colors ---- */
const CAT_COLORS = [
  { id: 'slate',   hex: '#6b7a8d', soft: '#e8ecf0' },
  { id: 'rust',    hex: '#9e3b2e', soft: '#f0ddd6' },
  { id: 'forest',  hex: '#3d6b4f', soft: '#d6ead9' },
  { id: 'gold',    hex: '#a07020', soft: '#f0e4c0' },
  { id: 'ocean',   hex: '#2c5f8a', soft: '#d4e5f5' },
  { id: 'plum',    hex: '#6b3d7a', soft: '#eadaf0' },
  { id: 'terra',   hex: '#8a5a35', soft: '#f0e0cc' },
  { id: 'steel',   hex: '#3d5a6b', soft: '#d4e4ed' },
];

function makeCatId() { return 'cat_' + Math.random().toString(36).slice(2, 8); }

/* shared drag state — lives outside components so cross-category drag works */
const _drag = { catId: null, idx: null, selectedIds: [] };

function Gallery({ catId, catColor, items, onChange, onDraw, onDropFromOther }) {
  const [cropId, setCropId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dropZoneOver, setDropZoneOver] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const add = async fl => { const ids = await filesToIds(fl); onChange([...items, ...ids.map(id => ({ id, cap: '', note: '', strokes: [] }))]); };
  const remove = async (it) => { if (it.annotatedId) await LB.db.delImage(it.annotatedId); await LB.db.delImage(it.id); onChange(items.filter(i => i.id !== it.id)); };
  const patch = (id, p) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));

  const toggleSelect = id => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleDragStart = (idx) => {
    const id = items[idx].id;
    // If dragging an unselected item, clear selection and select just this one
    const sel = selected.has(id) ? selected : new Set([id]);
    if (!selected.has(id)) setSelected(sel);
    _drag.catId = catId;
    _drag.idx = idx;
    _drag.selectedIds = items.map(it => it.id).filter(i => sel.has(i));
  };

  const handleDragEnter = idx => { if (_drag.catId === catId) setDragOver(idx); };

  const handleDragEnd = () => {
    if (_drag.catId === catId && _drag.idx !== null && dragOver !== null && _drag.idx !== dragOver) {
      const selSet = new Set(_drag.selectedIds);
      const staying = items.filter(it => !selSet.has(it.id));
      const moving = _drag.selectedIds.map(id => items.find(it => it.id === id)).filter(Boolean);
      // insert position: index among staying items
      const refItem = items[dragOver];
      let insertAt = refItem && !selSet.has(refItem.id)
        ? staying.findIndex(it => it.id === refItem.id)
        : staying.length;
      if (insertAt < 0) insertAt = staying.length;
      // if dragging forward, insert after the target
      if (_drag.idx < dragOver) insertAt = Math.min(insertAt + 1, staying.length);
      staying.splice(insertAt, 0, ...moving);
      onChange(staying);
    }
    _drag.catId = null; _drag.idx = null; _drag.selectedIds = [];
    setDragOver(null); setDropZoneOver(false);
  };

  /* drop area for items coming from another category */
  const zoneProps = {
    onDragOver: e => { if (_drag.catId && _drag.catId !== catId) { e.preventDefault(); setDropZoneOver(true); } },
    onDragLeave: () => setDropZoneOver(false),
    onDrop: e => { e.preventDefault(); if (_drag.catId && _drag.catId !== catId) { onDropFromOther(_drag.catId, _drag.idx); setDropZoneOver(false); } },
  };

  const accentColor = catColor ? catColor.hex : 'var(--accent)';
  const softColor   = catColor ? catColor.soft : 'var(--accent-soft)';
  const selCount = selected.size;

  return (
    <div style={{ display: 'contents' }}>
      {selCount > 0 && (
        <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 2px', marginBottom: -4 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>{selCount} foto{selCount !== 1 ? "'s" : ''} geselecteerd</span>
          <button className="btn sm ghost" style={{ fontSize: 11 }} onClick={() => setSelected(new Set())}>Deselecteer</button>
          <button className="btn sm ghost" style={{ fontSize: 11, color: 'var(--accent)' }} onClick={() => {
            selected.forEach(async id => { const it = items.find(i => i.id === id); if (it) { if (it.annotatedId) await LB.db.delImage(it.annotatedId); await LB.db.delImage(it.id); } });
            onChange(items.filter(it => !selected.has(it.id)));
            setSelected(new Set());
          }}>Verwijder selectie</button>
        </div>
      )}
      <div className={'gal-grid' + (dropZoneOver ? ' gal-drop-zone' : '')}
        style={{ '--gal-accent': accentColor, '--gal-soft': softColor }}
        {...zoneProps}>
        {items.map((it, idx) => <GalleryCell key={it.id} item={it}
          allImgIds={items.map(i => shownId(i))} itemIdx={idx}
          onCap={c => patch(it.id, { cap: c })} onNote={n => patch(it.id, { note: n })}
          onRemove={() => remove(it)} onDraw={() => onDraw(it)}
          onCrop={() => setCropId(it.id)}
          onDragStart={() => handleDragStart(idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragEnd={handleDragEnd}
          isDragOver={dragOver === idx && _drag.catId === catId && _drag.idx !== idx}
          accentColor={accentColor}
          isSelected={selected.has(it.id)}
          onToggleSelect={() => toggleSelect(it.id)} />)}
        <Dropzone onFiles={add} />
        {cropId && <CropModal imgId={cropId} onClose={() => setCropId(null)}
          onDone={newId => { patch(cropId, { id: newId }); setCropId(null); }} />}
      </div>
    </div>
  );
}

function VisualSection({ edit, onPatch, onDraw, onSketch }) {
  const cats = edit.galCategories && edit.galCategories.length
    ? edit.galCategories
    : [{ id: 'photos', label: 'Photos', colorId: 'slate' }];
  const gal = edit.galleries || {};

  const setCats = newCats => onPatch({ galCategories: newCats });
  // Functional form: always read current galleries from state, never from stale closure
  const setGal = (k, arr) => onPatch(cur => ({ galleries: { ...(cur.galleries || {}), [k]: arr } }));

  const total = cats.reduce((n, c) => n + (gal[c.id] || []).length, 0);

  const addCat = () => {
    const id = makeCatId();
    const usedIds = cats.map(c => c.colorId);
    const colorId = (CAT_COLORS.find(c => !usedIds.includes(c.id)) || CAT_COLORS[0]).id;
    setCats([...cats, { id, label: 'New category', colorId }]);
  };

  const removeCat = catId => {
    const remaining = cats.filter(c => c.id !== catId);
    if (remaining.length === 0) return;
    const firstId = remaining[0].id;
    onPatch(cur => {
      const g = cur.galleries || {};
      const orphans = g[catId] || [];
      const merged = { ...g, [firstId]: [...(g[firstId] || []), ...orphans] };
      delete merged[catId];
      return { galCategories: remaining, galleries: merged };
    });
  };

  const renameCat = (catId, label) => setCats(cats.map(c => c.id === catId ? { ...c, label } : c));
  const recolorCat = (catId, colorId) => setCats(cats.map(c => c.id === catId ? { ...c, colorId } : c));

  /* move photo from one category to another */
  const movePhoto = (fromCatId, fromIdx, toCatId) => {
    onPatch(cur => {
      const g = cur.galleries || {};
      const fromArr = [...(g[fromCatId] || [])];
      const [photo] = fromArr.splice(fromIdx, 1);
      const toArr = [...(g[toCatId] || []), photo];
      return { galleries: { ...g, [fromCatId]: fromArr, [toCatId]: toArr } };
    });
  };

  return (
    <div className="sec">
      <div className="sec-h">
        <span className="num">04</span><h2>Visual references</h2>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{total} image{total !== 1 ? 's' : ''}</span>
        <span className="ln" />
        <button className="btn sm ghost" onClick={addCat} style={{ marginLeft: 8, flexShrink: 0 }}>
          <Icon name="plus" size={13} />Category
        </button>
      </div>
      {cats.map(cat => {
        const color = CAT_COLORS.find(c => c.id === cat.colorId) || CAT_COLORS[0];
        return (
          <div className="vis-block" key={cat.id} style={{ '--cat-accent': color.hex, '--cat-soft': color.soft }}>
            <div className="vis-block-h" style={{ borderLeft: '3px solid ' + color.hex, paddingLeft: 10 }}>
              {/* color picker dots */}
              <div className="cat-colors">
                {CAT_COLORS.map(c => (
                  <button key={c.id} className={'cat-color-dot' + (c.id === cat.colorId ? ' on' : '')}
                    style={{ background: c.hex }}
                    onClick={() => recolorCat(cat.id, c.id)} title={c.id} />
                ))}
              </div>
              {/* editable label */}
              <span className="vn" contentEditable suppressContentEditableWarning
                onBlur={e => renameCat(cat.id, e.currentTarget.textContent.trim() || cat.label)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                style={{ cursor: 'text', outline: 'none', borderBottom: '1px dashed transparent' }}
                onFocus={e => e.currentTarget.style.borderBottomColor = color.hex}
                suppressHydrationWarning>
                {cat.label}
              </span>
              <span className="vc">{(gal[cat.id] || []).length}</span>
              <span className="ln" />
              {cats.length > 1 && (
                <button className="btn sm ghost" style={{ padding: '3px 7px', color: 'var(--ink-3)' }}
                  onClick={() => removeCat(cat.id)} title="Remove category (photos move to first)">
                  <Icon name="trash" size={13} />
                </button>
              )}
            </div>
            <Gallery
              catId={cat.id}
              catColor={color}
              items={gal[cat.id] || []}
              onChange={arr => setGal(cat.id, arr)}
              onDraw={it => onDraw(cat.id, it)}
              onDropFromOther={(fromCatId, fromIdx) => movePhoto(fromCatId, fromIdx, cat.id)}
            />
          </div>
        );
      })}

      {/* Fixed sections — always present below custom photo categories */}
      {[
        { id: 'sketches',     label: 'Sketches',     icon: 'edit',   canSketch: true  },
        { id: 'measurements', label: 'Measurements', icon: 'ruler',  canSketch: true  },
        { id: 'designs',      label: 'Designs',      icon: 'layers', canSketch: false },
        { id: 'moodboard',    label: 'Moodboard',    icon: 'grid',   canSketch: false },
      ].map(g => (
        <div className="vis-block" key={g.id}>
          <div className="vis-block-h">
            <Icon name={g.icon} size={15} style={{ color: 'var(--ink-2)' }} />
            <span className="vn">{g.label}</span>
            <span className="vc">{(gal[g.id] || []).length}</span>
            <span className="ln" />
            {g.canSketch && onSketch && (
              <button className="btn sm ghost" onClick={() => onSketch(g.id)}
                style={{ marginLeft: 6, flexShrink: 0, gap: 4 }}>
                <Icon name="edit" size={12} />Sketch
              </button>
            )}
          </div>
          <Gallery
            catId={g.id}
            catColor={null}
            items={gal[g.id] || []}
            onChange={arr => setGal(g.id, arr)}
            onDraw={it => onDraw(g.id, it)}
            onDropFromOther={() => {}}
          />
        </div>
      ))}
    </div>
  );
}

function AddSceneForm({ onAdd, onCancel, dayNums }) {
  const [num,  setNum]  = useState('');
  const [type, setType] = useState('INT');
  const [tod,  setTod]  = useState('D');
  const [syn,  setSyn]  = useState('');
  const [day,  setDay]  = useState(dayNums && dayNums.length === 1 ? dayNums[0] : (dayNums && dayNums[0]) || null);
  const submit = () => {
    if (!num.trim()) return;
    onAdd({ id: 'ms_' + Date.now(), number: num.trim(), type, tod, synopsis: syn.trim(), segments: [], manual: true, dayNumber: day || null });
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--line-2)' }}>
      <input className="input" placeholder="Sc. nr" value={num} onChange={e => setNum(e.target.value)}
        style={{ width: 64 }} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
      <select className="input" value={type} onChange={e => setType(e.target.value)} style={{ width: 70 }}>
        <option>INT</option><option>EXT</option><option>INT/EXT</option>
      </select>
      <select className="input" value={tod} onChange={e => setTod(e.target.value)} style={{ width: 60 }}>
        <option value="D">D</option><option value="N">N</option><option value="DN">D/N</option>
      </select>
      {dayNums && dayNums.length > 1 && (
        <select className="input" value={day || ''} onChange={e => setDay(e.target.value ? +e.target.value : null)} style={{ width: 80 }}>
          <option value="">Dag...</option>
          {dayNums.map(d => <option key={d} value={d}>Dag {d}</option>)}
        </select>
      )}
      <input className="input" placeholder="Synopsis" value={syn} onChange={e => setSyn(e.target.value)}
        style={{ flex: 1, minWidth: 120 }} onKeyDown={e => e.key === 'Enter' && submit()} />
      <button className="btn sm primary" onClick={submit}><Icon name="check" size={13} />Add</button>
      <button className="btn sm ghost" onClick={onCancel}><Icon name="x" size={13} /></button>
    </div>
  );
}

function ScenesTable({ loc, view, edit, onPatch }) {
  const [adding, setAdding] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [editingYrKey, setEditingYrKey] = useState(null);
  const [editYrDraft, setEditYrDraft] = useState('');
  const [dragKey, setDragKey] = useState(null);
  const [draggedScene, setDraggedScene] = useState(null);
  const [dropDay, setDropDay] = useState(null);
  const [dropBefore, setDropBefore] = useState(null);

  const removedKeys = useMemo(() => new Set((edit && edit.removedSceneKeys) || []), [edit]);
  const extraScenes = useMemo(() => (edit && edit.extraScenes) || [], [edit]);
  const removedShootDays = useMemo(() => new Set((edit && edit.removedShootDays || []).map(String)), [edit]);
  const sceneOverrides = useMemo(() => (edit && edit.sceneOverrides) || {}, [edit]);
  const sceneOrders = useMemo(() => (edit && edit.sceneOrders) || {}, [edit]);
  const dayNums = useMemo(() =>
    (loc.shootDates || []).filter(d => !removedShootDays.has(String(d.dayNumber))).map(d => d.dayNumber).filter(Boolean),
    [loc, removedShootDays]);

  const sceneKey = s => s.manual ? ('m|' + s.id) : (s.number + '|' + (s.idx ?? ''));

  const effectiveDay = s => {
    if (!s.manual) {
      const ov = sceneOverrides[sceneKey(s)];
      if (ov && ov.dayNumber !== undefined) return ov.dayNumber;
    }
    return s.dayNumber;
  };

  const effectiveSyn = s => {
    if (!s.manual) {
      const ov = sceneOverrides[sceneKey(s)];
      if (ov && ov.synopsis !== undefined) return ov.synopsis;
    }
    return s.synopsis;
  };

  const effectiveYr = s => {
    const ov = sceneOverrides[sceneKey(s)] || {};
    const season = ov.season !== undefined ? ov.season : s.season;
    const year = ov.year !== undefined ? ov.year : s.year;
    return (season ? season + ' ' : '') + (year || '');
  };

  const commitYr = (s, draft) => {
    const parts = draft.trim().split(/\s+/);
    const yearPart = parts.find(p => /^\d{4}$/.test(p));
    const seasonPart = parts.filter(p => !/^\d{4}$/.test(p)).join(' ').toLowerCase() || null;
    patchScene(s, { season: seasonPart, year: yearPart || null });
    setEditingYrKey(null);
  };

  const patchScene = (s, patch) => {
    if (!onPatch) return;
    if (s.manual) {
      onPatch(cur => ({ extraScenes: (cur.extraScenes || []).map(x => x.id === s.id ? { ...x, ...patch } : x) }));
    } else {
      const k = sceneKey(s);
      onPatch(cur => ({ sceneOverrides: { ...(cur.sceneOverrides || {}), [k]: { ...((cur.sceneOverrides || {})[k] || {}), ...patch } } }));
    }
  };

  const removeScene = s => {
    if (!onPatch) return;
    if (s.manual) {
      onPatch(cur => ({ extraScenes: (cur.extraScenes || []).filter(x => x.id !== s.id) }));
    } else {
      const key = sceneKey(s);
      onPatch(cur => ({ removedSceneKeys: [...new Set([...((cur.removedSceneKeys) || []), key])] }));
    }
  };

  const addScene = scene => {
    if (!onPatch) return;
    onPatch(cur => ({ extraScenes: [...(cur.extraScenes || []), scene] }));
    setAdding(false);
  };

  // Move scene to targetDayStr (e.g. '5' or '—'), optionally inserting before beforeKey
  const commitDrop = (s, targetDayStr, beforeKey) => {
    if (!onPatch || !s) return;
    const key = sceneKey(s);
    const targetDay = targetDayStr === '—' ? null : (targetDayStr ? +targetDayStr : null);
    const curDayStr = String(effectiveDay(s) || '—');

    if (curDayStr !== targetDayStr) patchScene(s, { dayNumber: targetDay });

    onPatch(cur => {
      const orders = { ...(cur.sceneOrders || {}) };
      if (orders[curDayStr]) orders[curDayStr] = orders[curDayStr].filter(k => k !== key);
      const target = (orders[targetDayStr] || []).filter(k => k !== key);
      const idx = beforeKey ? target.indexOf(beforeKey) : target.length;
      target.splice(idx < 0 ? target.length : idx, 0, key);
      orders[targetDayStr] = target;
      return { sceneOrders: orders };
    });
  };

  const sortDay = (scenes, dayStr) => {
    const order = sceneOrders[dayStr];
    if (!order || !order.length) return scenes;
    return [...scenes].sort((a, b) => {
      const ai = order.indexOf(sceneKey(a)), bi = order.indexOf(sceneKey(b));
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1; if (bi === -1) return -1;
      return ai - bi;
    });
  };

  const SceneRow = ({ s, dayStr }) => {
    const key = sceneKey(s);
    const isEditing = editingKey === key;
    const isEditingYr = editingYrKey === key;
    const syn = effectiveSyn(s);
    const yr = effectiveYr(s);
    const isDropTarget = dropBefore === key && dragKey && dragKey !== key;

    const startEdit = () => { setEditingKey(key); setEditDraft(syn || ''); };
    const commitEdit = () => { patchScene(s, { synopsis: editDraft }); setEditingKey(null); };

    return (
      <>
        {isDropTarget && <div style={{ height: 2, background: 'var(--accent)', borderRadius: 1, margin: '1px 0', gridColumn: '1/-1' }} />}
        <div className="scene-row" style={{ opacity: dragKey === key ? 0.4 : 1 }}
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragKey(key); setDraggedScene(s); }}
          onDragEnd={() => { setDragKey(null); setDraggedScene(null); setDropDay(null); setDropBefore(null); }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropDay(dayStr); setDropBefore(key); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); if (dragKey && dragKey !== key && draggedScene) commitDrop(draggedScene, dayStr, key); setDragKey(null); setDraggedScene(null); setDropDay(null); setDropBefore(null); }}>
          {/* col 1: grip */}
          <span style={{ cursor: 'grab', color: 'var(--ink-3)', fontSize: 12, lineHeight: 1 }}>⠿</span>
          {/* col 2: scene number */}
          <span className="sn">{s.number}</span>
          {/* col 3: type/tod */}
          <span className="ie"><b>{s.type || 'INT'}</b>/{s.tod || 'D'}</span>
          {/* col 4: synopsis */}
          <span style={{ minWidth: 0 }}>
            {isEditing
              ? <input autoFocus className="input" value={editDraft} onChange={e => setEditDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingKey(null); }}
                  style={{ width: '100%', fontSize: 13, padding: '1px 4px' }} />
              : <div className="syn" onClick={onPatch ? startEdit : undefined}
                  title={onPatch ? 'Klik om te bewerken' : undefined}
                  style={{ cursor: onPatch ? 'text' : 'default' }}>
                  {syn || <span className="faint">—</span>}
                </div>
            }
            {s.segments && s.segments.length > 1 && <div className="setp">{s.segments.slice(1).join(' / ')}</div>}
          </span>
          {/* col 5: season / year — editable */}
          {isEditingYr
            ? <input autoFocus className="input" value={editYrDraft} onChange={e => setEditYrDraft(e.target.value)}
                onBlur={() => commitYr(s, editYrDraft)}
                onKeyDown={e => { if (e.key === 'Enter') commitYr(s, editYrDraft); if (e.key === 'Escape') setEditingYrKey(null); }}
                style={{ fontSize: 11, padding: '1px 4px', textAlign: 'right', fontFamily: 'var(--mono)' }} />
            : <span className="yr"
                onClick={onPatch ? () => { setEditingYrKey(key); setEditYrDraft(yr); } : undefined}
                title={onPatch ? 'Klik om seizoen/jaar te bewerken' : undefined}
                style={{ cursor: onPatch ? 'text' : 'default' }}>
                {yr || (onPatch ? <span style={{ color: 'var(--ink-3)', fontStyle: 'italic', fontSize: 10 }}>—</span> : null)}
              </span>
          }
          {/* col 6: remove button */}
          {onPatch
            ? <button onClick={e => { e.stopPropagation(); removeScene(s); }} title="Remove scene"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '2px 4px', lineHeight: 1, justifySelf: 'center' }}>
                <Icon name="x" size={13} />
              </button>
            : <span />
          }
        </div>
      </>
    );
  };

  const addBtn = (
    <div style={{ paddingTop: 6 }}>
      {adding
        ? <AddSceneForm onAdd={addScene} onCancel={() => setAdding(false)} dayNums={dayNums} />
        : onPatch && <button className="btn sm ghost" onClick={() => setAdding(true)} style={{ width: '100%' }}>
            <Icon name="plus" size={13} />Handmatig scene toevoegen
          </button>
      }
    </div>
  );

  if (view === 'flat') {
    const scenes = [...loc.scenes.filter(s => !removedKeys.has(sceneKey(s))), ...extraScenes]
      .sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    return (
      <div className="scenes">
        {scenes.map(s => <SceneRow key={sceneKey(s)} s={s} dayStr={null} />)}
        {addBtn}
      </div>
    );
  }

  const byDay = useMemo(() => {
    const g = {};
    loc.scenes.filter(s => !removedKeys.has(sceneKey(s))).forEach(s => {
      const k = String(effectiveDay(s) || '—'); (g[k] = g[k] || []).push(s);
    });
    extraScenes.forEach(s => {
      const k = String(effectiveDay(s) || '—'); (g[k] = g[k] || []).push(s);
    });
    return Object.entries(g).sort((a, b) =>
      (a[0] === '—' ? 999 : +a[0]) - (b[0] === '—' ? 999 : +b[0])
    );
  }, [loc, removedKeys, extraScenes, sceneOverrides]);

  return (
    <div className="scenes">
      {byDay.map(([day, scenes]) => {
        const sortedScenes = sortDay(scenes, day);
        const d0 = scenes.find(s => !s.manual) || scenes[0];
        const isDayDrop = dropDay === day && dragKey && !dropBefore;
        return (
          <div key={day}
            onDragOver={dragKey ? e => { e.preventDefault(); } : undefined}
            onDrop={dragKey ? e => {
              e.preventDefault();
              if (!dropBefore && draggedScene) commitDrop(draggedScene, day, null);
              setDragKey(null); setDraggedScene(null); setDropDay(null); setDropBefore(null);
            } : undefined}
            style={isDayDrop ? { outline: '2px solid var(--accent)', borderRadius: 8 } : {}}>
            <div className="scene-daygroup-h"
              onDragOver={dragKey ? e => { e.preventDefault(); e.stopPropagation(); setDropDay(day); setDropBefore(null); } : undefined}>
              {day !== '—' ? (() => {
                const ov = (edit && edit.dayOverrides && edit.dayOverrides[day]) || {};
                const displayDay = ov.dayNumber != null ? ov.dayNumber : day;
                const patchDayOv = patch => { if (!onPatch) return; const o = (edit && edit.dayOverrides) || {}; onPatch({ dayOverrides: { ...o, [day]: { ...(o[day] || {}), ...patch } } }); };
                return <>
                  <span className="dn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Day <EditableDayNumber value={displayDay} onChange={v => patchDayOv({ dayNumber: v })} />
                  </span>
                  <DateButton date={ov.date ? ov.date : (d0 && d0.date)} onSave={v => patchDayOv({ date: v })} style={{ fontSize: 13 }} />
                </>;
              })() : <span>Unscheduled</span>}
              <span style={{ flex: 1 }} />
              <span>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
            </div>
            {sortedScenes.map(s => <SceneRow key={sceneKey(s)} s={s} dayStr={day} />)}
          </div>
        );
      })}
      {addBtn}
    </div>
  );
}

function AddDayButton({ onAdd }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'none',
          border: '1.5px dashed var(--line-2)', borderRadius: 12, cursor: 'pointer',
          color: 'var(--ink-2)', fontSize: 13, fontWeight: 500 }}>
        <span style={{ fontSize: 18, lineHeight: 1, color: 'var(--accent)' }}>+</span> Add date
      </button>
      {open && <CalendarPicker date={null} onSave={v => { onAdd(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </span>
  );
}

function LocationFile({ loc, edit, name, onPatch, onRename, onRemove, onCombine, sceneView, onExport }) {
  const adj = edit.adjustments || [];
  const region = loc.regions.join(' · ');
  const [annot, setAnnot] = useState(null);    // {kind, item}
  const [sketch, setSketch] = useState(null);  // galKindId to add sketch into

  const openDraw = (kind, item) => setAnnot({ kind, item });
  const saveAnnot = ({ strokes, note, annotatedId }) => {
    const kind = annot.kind, id = annot.item.id;
    onPatch(cur => {
      const g = cur.galleries || {};
      const arr = (g[kind] || []).map(i => i.id === id ? { ...i, strokes, note, annotatedId } : i);
      return { galleries: { ...g, [kind]: arr } };
    });
    setAnnot(null);
  };

  return (
    <div className="canvas">
      {/* cover banner */}
      <div style={{ marginBottom: 22 }}>
        <CoverDrop id={edit.cover} height={220} radius={14} label="Add a cover photo for this location"
          onSet={id => onPatch({ cover: id })} onClear={() => onPatch({ cover: null })} />
      </div>

      <div className="loc-hero">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="kicker">{region || 'Location'}</div>
          <h1 contentEditable suppressContentEditableWarning spellCheck={false}
            style={{ outline: 'none' }} title="Click to rename"
            onBlur={e => { const v = e.currentTarget.textContent.trim(); if (v && v !== name) onRename(v); else e.currentTarget.textContent = name; }}>{name}</h1>
          <div className="meta-line">
            {(() => {
              const removedSceneKeys = new Set((edit.removedSceneKeys) || []);
              const sceneKey = s => s.number + '|' + (s.idx ?? '');
              const sceneCount = loc.scenes.filter(s => !removedSceneKeys.has(sceneKey(s))).length + ((edit.extraScenes || []).length);
              const removedDays = new Set((edit.removedShootDays) || []);
              const dayCount = loc.shootDates.filter(d => !removedDays.has(String(d.dayNumber))).length + ((edit.extraShootDays || []).length);
              return <>
                <span className="tag">{sceneCount} scene{sceneCount !== 1 ? 's' : ''}</span>
                <span className="tag">{dayCount} shoot day{dayCount !== 1 ? 's' : ''}</span>
                {loc.sets.length > 0 && <span className="tag">{loc.sets.length} set{loc.sets.length !== 1 ? 's' : ''}</span>}
                {adj.length > 0 && <span className="tag accent">{adj.length} adjustment{adj.length !== 1 ? 's' : ''}</span>}
              </>;
            })()}
          </div>
        </div>
        <Menu align="right" button={<button className="btn"><Icon name="dots" size={16} /></button>} items={[
          { label: 'Rename location', icon: 'edit', onClick: () => { const h = document.querySelector('.loc-hero h1'); if (h) { h.focus(); document.getSelection().selectAllChildren(h); } } },
          { label: edit.cover ? 'Replace cover photo' : 'Add cover photo', icon: 'image', onClick: () => { const el = document.querySelector('.cover'); if (el) el.click(); } },
          { label: 'Combine with…', icon: 'layers', onClick: onCombine },
          { sep: true },
          { label: 'Remove location', icon: 'trash', danger: true, onClick: onRemove },
        ]} />
      </div>

      {/* meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Address</label>
            <input className="input" placeholder="Street, city, country…" defaultValue={edit.address || ''}
              onBlur={e => onPatch({ address: e.target.value })} key={'addr' + loc.id} />
            <label style={{ marginTop: 8 }}>Google Maps link</label>
            <input className="input" placeholder="https://maps.google.com/…" defaultValue={edit.mapsUrl || ''}
              onBlur={e => onPatch({ mapsUrl: e.target.value })} key={'maps' + loc.id} />
          </div>
          <div className="field">
            <label>Access / parking notes</label>
            <input className="input" placeholder="Gate code, unit base, load-in…" defaultValue={edit.access || ''}
              onBlur={e => onPatch({ access: e.target.value })} key={'acc' + loc.id} />
          </div>
        </div>
        <div className="metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="metric"><div className="k">Prep</div>
            <div className="v" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DayStepper value={edit.prepDays} onChange={v => {
                  const old = edit.prepDates || [];
                  onPatch({ prepDays: v, prepDates: Array.from({ length: v }, (_, i) => old[i] ?? null) });
                }} /><small>days</small>
              </div>
              <select className="input" style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}
                value={edit.prepTiming || ''}
                onChange={e => onPatch({ prepTiming: e.target.value || null })}>
                <option value="">—</option>
                <option value="before_shooting">Before shooting</option>
                <option value="after_wrap">After wrap</option>
              </select>
              {(edit.prepDays || 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', marginTop: 2 }}>
                  {Array.from({ length: edit.prepDays }, (_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', minWidth: 38 }}>Prep {i + 1}</span>
                      <DateButton
                        date={(edit.prepDates || [])[i] || null}
                        onSave={v => {
                          const dates = Array.from({ length: edit.prepDays }, (_, j) => (edit.prepDates || [])[j] ?? null);
                          dates[i] = v;
                          onPatch({ prepDates: dates });
                        }}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="metric"><div className="k">Wrap</div>
            <div className="v" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DayStepper value={edit.wrapDays} onChange={v => {
                  const old = edit.wrapDates || [];
                  onPatch({ wrapDays: v, wrapDates: Array.from({ length: v }, (_, i) => old[i] ?? null) });
                }} /><small>days</small>
              </div>
              <select className="input" style={{ fontSize: 12, padding: '3px 6px', width: '100%' }}
                value={edit.wrapTiming || ''}
                onChange={e => onPatch({ wrapTiming: e.target.value || null })}>
                <option value="">—</option>
                <option value="after_wrap">After wrap</option>
                <option value="before_shooting">Before shooting</option>
              </select>
              {(edit.wrapDays || 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%', marginTop: 2 }}>
                  {Array.from({ length: edit.wrapDays }, (_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', minWidth: 38 }}>Wrap {i + 1}</span>
                      <DateButton
                        date={(edit.wrapDates || [])[i] || null}
                        onSave={v => {
                          const dates = Array.from({ length: edit.wrapDays }, (_, j) => (edit.wrapDates || [])[j] ?? null);
                          dates[i] = v;
                          onPatch({ wrapDates: dates });
                        }}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* shoot days */}
      <div className="sec">
        <div className="sec-h"><span className="num">01</span><h2>Shoot days</h2><span className="ln" /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          {loc.shootDates.filter(d => !(edit.removedShootDays||[]).includes(String(d.dayNumber))).map(d => {
            const ov = (edit.dayOverrides||{})[String(d.dayNumber)] || {};
            const displayDay = ov.dayNumber != null ? ov.dayNumber : d.dayNumber;
            const patchOv = patch => { const o = edit.dayOverrides||{}; onPatch({ dayOverrides: { ...o, [String(d.dayNumber)]: { ...(o[String(d.dayNumber)]||{}), ...patch } } }); };
            const removeDay = () => onPatch({ removedShootDays: [...new Set([...(edit.removedShootDays||[]), String(d.dayNumber)])] });
            return (
              <div key={d.dayNumber} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <EditableDayNumber value={displayDay} onChange={v => patchOv({ dayNumber: v })} />
                <span>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.1em' }}>DAY</div>
                  <DateButton date={ov.date ? ov.date : d.date} onSave={v => patchOv({ date: v })} />
                </span>
                <button type="button" title="Remove" onClick={removeDay}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, lineHeight: 1, fontSize: 14 }}>×</button>
              </div>
            );
          })}
          {(edit.extraShootDays||[]).map((d, i) => (
            <div key={d.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
              <span>
                <DateButton
                  date={d.date}
                  onSave={v => { const days = (edit.extraShootDays||[]).map((x,j) => j===i ? {...x,date:v} : x); onPatch({ extraShootDays: days }); }}
                />
              </span>
              <button type="button" title="Remove" onClick={() => onPatch({ extraShootDays: (edit.extraShootDays||[]).filter((_,j)=>j!==i) })}
                style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', color:'var(--ink-3)', padding:2, lineHeight:1, fontSize:14 }}>×</button>
            </div>
          ))}
          <AddDayButton onAdd={date => onPatch({ extraShootDays: [...(edit.extraShootDays||[]), { id: Date.now().toString(36), date }] })} />
        </div>
      </div>

      {/* adjustments */}
      <div className="sec">
        <div className="sec-h"><span className="num">02</span><h2>Adjustments</h2><span className="ln" /></div>
        <Adjustments loc={loc} items={adj} onChange={a => onPatch({ adjustments: a })} />
      </div>

      {/* scenes */}
      <div className="sec">
        <div className="sec-h"><span className="num">03</span><h2>Scenes here</h2>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>from schedule</span><span className="ln" /></div>
        <ScenesTable loc={loc} view={sceneView} edit={edit} onPatch={onPatch} />
      </div>

      {/* visuals */}
      <VisualSection edit={edit} onPatch={onPatch} onDraw={openDraw} onSketch={kind => setSketch(kind)} />

      {/* notes */}
      <div className="sec">
        <div className="sec-h"><span className="num">05</span><h2>Notes</h2><span className="ln" /></div>
        <BulletNotes key={'notes' + loc.id} value={edit.notes || ''} onChange={v => onPatch({ notes: v })} />
      </div>

      {annot && <Annotator originalId={annot.item.id} init={{ strokes: annot.item.strokes, note: annot.item.note }}
        onSave={saveAnnot} onClose={() => setAnnot(null)} />}
      {sketch && <SketchPad
        onSave={item => {
          const kind = sketch;
          onPatch(cur => {
            const g = cur.galleries || {};
            return { galleries: { ...g, [kind]: [...(g[kind] || []), item] } };
          });
          setSketch(null);
        }}
        onClose={() => setSketch(null)} />}
    </div>
  );
}

window.LocationFile = LocationFile;
