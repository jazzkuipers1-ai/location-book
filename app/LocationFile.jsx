/* Location file editor — cover, meta, scenes, adjustments, annotated galleries. */

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

function CalendarPicker({ date, onSave, onClose }) {
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
      position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:9999,
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
  const ref = React.useRef(null);
  const isValid = date && /^\d{2}\/\d{2}\/\d{4}$/.test(date);
  const fmt = isValid
    ? (() => { const [dd,mm,yyyy]=date.split('/').map(Number); return new Date(yyyy,mm-1,dd).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}); })()
    : 'Set date';
  return (
    <span ref={ref} style={{position:'relative',display:'inline-block',...style}}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{background:'none',border:'none',padding:0,cursor:'pointer',font:'inherit',color:'inherit',
          fontWeight:600,fontSize:13,borderBottom:'1px dashed var(--ink-3)',color: isValid ? 'inherit' : 'var(--accent)'}}>
        {fmt}
      </button>
      {open && <CalendarPicker date={isValid ? date : null} onSave={onSave} onClose={()=>setOpen(false)} />}
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

function GalleryCell({ item, onCap, onNote, onRemove, onDraw, onCrop, onDragStart, onDragEnter, onDragEnd, isDragOver, accentColor }) {
  return (
    <div className={'gal-item' + (isDragOver ? ' drag-over' : '')}
      style={isDragOver && accentColor ? { boxShadow: '0 0 0 2px ' + accentColor } : undefined}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}>
      <div className="gal-cell">
        <div className="gal-drag-handle" title="Drag to reorder"><Icon name="grip" size={14} /></div>
        <Img imgId={shownId(item)} />
        {(item.strokes && item.strokes.length || item.annotatedId) ? <span className="annot-badge"><Icon name="edit" size={12} /></span> : null}
        <div className="tools">
          <button className="tbtn" title="Crop" onClick={onCrop}><Icon name="ruler" size={15} /></button>
          <button className="tbtn" title="Draw / mark up" onClick={onDraw}><Icon name="edit" size={15} /></button>
          <button className="tbtn" title="Remove" onClick={onRemove}><Icon name="trash" size={14} /></button>
        </div>
        <div className="cap" contentEditable suppressContentEditableWarning
          onBlur={e => onCap(e.currentTarget.textContent.trim())}>{item.cap || ''}</div>
      </div>
      <textarea className="gal-note" rows={1} placeholder="Add a note…" defaultValue={item.note || ''}
        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        onBlur={e => onNote(e.target.value)} />
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
const _drag = { catId: null, idx: null };

function Gallery({ catId, catColor, items, onChange, onDraw, onDropFromOther }) {
  const [cropId, setCropId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [dropZoneOver, setDropZoneOver] = useState(false);

  const add = async fl => { const ids = await filesToIds(fl); onChange([...items, ...ids.map(id => ({ id, cap: '', note: '', strokes: [] }))]); };
  const remove = async (it) => { if (it.annotatedId) await LB.db.delImage(it.annotatedId); await LB.db.delImage(it.id); onChange(items.filter(i => i.id !== it.id)); };
  const patch = (id, p) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));

  const handleDragStart = idx => { _drag.catId = catId; _drag.idx = idx; };
  const handleDragEnter = idx => { if (_drag.catId === catId) setDragOver(idx); };
  const handleDragEnd = () => {
    if (_drag.catId === catId && _drag.idx !== null && dragOver !== null && _drag.idx !== dragOver) {
      const next = [...items];
      const [moved] = next.splice(_drag.idx, 1);
      next.splice(dragOver, 0, moved);
      onChange(next);
    }
    _drag.catId = null; _drag.idx = null;
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

  return (
    <div className={'gal-grid' + (dropZoneOver ? ' gal-drop-zone' : '')}
      style={{ '--gal-accent': accentColor, '--gal-soft': softColor }}
      {...zoneProps}>
      {items.map((it, idx) => <GalleryCell key={it.id} item={it}
        onCap={c => patch(it.id, { cap: c })} onNote={n => patch(it.id, { note: n })}
        onRemove={() => remove(it)} onDraw={() => onDraw(it)}
        onCrop={() => setCropId(it.id)}
        onDragStart={() => handleDragStart(idx)}
        onDragEnter={() => handleDragEnter(idx)}
        onDragEnd={handleDragEnd}
        isDragOver={dragOver === idx && _drag.catId === catId && _drag.idx !== idx}
        accentColor={accentColor} />)}
      <Dropzone onFiles={add} />
      {cropId && <CropModal imgId={cropId} onClose={() => setCropId(null)}
        onDone={newId => { patch(cropId, { id: newId }); setCropId(null); }} />}
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

function ScenesTable({ loc, view, edit, onPatch }) {
  if (view === 'flat') {
    const scenes = [...loc.scenes].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    return (
      <div className="scenes">
        {scenes.map(s => (
          <div className="scene-row" key={s.number + s.idx}>
            <span className="sn">{s.number}</span>
            <span className="ie"><b>{s.type}</b>/{s.tod}</span>
            <span>
              <div className="syn">{s.synopsis || <span className="faint">—</span>}</div>
              {s.segments.length > 1 && <div className="setp">{s.segments.slice(1).join(' / ')}</div>}
            </span>
            <span className="yr">{s.dayNumber ? 'D' + s.dayNumber + ' · ' : ''}{s.year || ''}</span>
          </div>
        ))}
      </div>
    );
  }
  const byDay = useMemo(() => {
    const g = {};
    loc.scenes.forEach(s => { const k = s.dayNumber || '—'; (g[k] = g[k] || []).push(s); });
    return Object.entries(g).sort((a, b) => (a[0] === '—' ? 999 : +a[0]) - (b[0] === '—' ? 999 : +b[0]));
  }, [loc]);
  return (
    <div className="scenes">
      {byDay.map(([day, scenes]) => {
        const d0 = scenes[0];
        return (
          <div key={day}>
            <div className="scene-daygroup-h">
              {day !== '—' ? (() => {
                const ov = (edit && edit.dayOverrides && edit.dayOverrides[String(day)]) || {};
                const displayDay = ov.dayNumber != null ? ov.dayNumber : day;
                const patchDayOv = patch => { if (!onPatch) return; const o = (edit && edit.dayOverrides) || {}; onPatch({ dayOverrides: { ...o, [String(day)]: { ...(o[String(day)] || {}), ...patch } } }); };
                return <>
                  <span className="dn" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Day <EditableDayNumber value={displayDay} onChange={v => patchDayOv({ dayNumber: v })} />
                  </span>
                  <DateButton
                    date={ov.date ? ov.date : d0.date}
                    onSave={v => patchDayOv({ date: v })}
                    style={{ fontSize: 13 }}
                  />
                </>;
              })() : <span>Unscheduled</span>}
              <span style={{ flex: 1 }} />
              <span>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
            </div>
            {scenes.map(s => (
              <div className="scene-row" key={s.number + s.idx}>
                <span className="sn">{s.number}</span>
                <span className="ie"><b>{s.type}</b>/{s.tod}</span>
                <span>
                  <div className="syn">{s.synopsis || <span className="faint">—</span>}</div>
                  {s.segments.length > 1 && <div className="setp">{s.segments.slice(1).join(' / ')}</div>}
                </span>
                <span className="yr">{s.season ? s.season + ' ' : ''}{s.year || ''}</span>
              </div>
            ))}
          </div>
        );
      })}
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
            <span className="tag">{loc.sceneCount} scenes</span>
            <span className="tag">{loc.dayNums.length} shoot day{loc.dayNums.length !== 1 ? 's' : ''}</span>
            {loc.sets.length > 0 && <span className="tag">{loc.sets.length} set{loc.sets.length !== 1 ? 's' : ''}</span>}
            {adj.length > 0 && <span className="tag accent">{adj.length} adjustment{adj.length !== 1 ? 's' : ''}</span>}
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
            <div className="v"><Stepper value={edit.prepDays} onChange={v => onPatch({ prepDays: v })} /><small>days</small></div></div>
          <div className="metric"><div className="k">Wrap</div>
            <div className="v"><Stepper value={edit.wrapDays} onChange={v => onPatch({ wrapDays: v })} /><small>days</small></div></div>
        </div>
      </div>

      {/* shoot days */}
      <div className="sec">
        <div className="sec-h"><span className="num">01</span><h2>Shoot days</h2><span className="ln" /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
          {loc.shootDates.map(d => {
            const ov = (edit.dayOverrides||{})[String(d.dayNumber)] || {};
            const displayDay = ov.dayNumber != null ? ov.dayNumber : d.dayNumber;
            const patchOv = patch => { const o = edit.dayOverrides||{}; onPatch({ dayOverrides: { ...o, [String(d.dayNumber)]: { ...(o[String(d.dayNumber)]||{}), ...patch } } }); };
            return (
              <div key={d.dayNumber} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <EditableDayNumber value={displayDay} onChange={v => patchOv({ dayNumber: v })} />
                <span>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.1em' }}>DAY</div>
                  <DateButton
                    date={ov.date ? ov.date : d.date}
                    onSave={v => patchOv({ date: v })}
                  />
                </span>
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
