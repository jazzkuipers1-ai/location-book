import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Icon, Img, IconBtn, DayStepper, CoverDrop, Menu, useDrop, filesToIds, fmtDate } from './components';
import { Adjustments } from './Adjustments';
import { Annotator, shownId } from './Annotator';
import { delImage, putImage, getURL } from './db';

const GAL_KINDS = [
  { id: 'photos', label: 'Photos', icon: 'image' },
  { id: 'sketches', label: 'Sketches', icon: 'edit' },
  { id: 'measurements', label: 'Measurements', icon: 'ruler' },
  { id: 'designs', label: 'Designs', icon: 'layers' },
  { id: 'moodboard', label: 'Moodboard', icon: 'grid' },
];

function GalleryCell({ item, onCap, onNote, onRemove, onDraw, onCrop, dragHandlers, isDragging, isOver }: any) {
  return (
    <div className={'gal-item' + (isDragging ? ' gal-dragging' : '') + (isOver ? ' gal-over' : '')}
      {...dragHandlers}>
      <div className="gal-drag-handle" title="Sleep om te herordenen">
        <Icon name="grip2" size={14} />
      </div>
      <div className="gal-cell">
        <Img imgId={shownId(item)} />
        {(item.strokes && item.strokes.length || item.annotatedId) ? <span className="annot-badge"><Icon name="edit" size={12} /></span> : null}
        <div className="tools">
          <button className="tbtn" title="Bijsnijden" onClick={onCrop}><Icon name="crop" size={14} /></button>
          <button className="tbtn" title="Draw / mark up" onClick={onDraw}><Icon name="edit" size={15} /></button>
          <button className="tbtn" title="Remove" onClick={onRemove}><Icon name="trash" size={14} /></button>
        </div>
        <div className="cap" contentEditable suppressContentEditableWarning
          onBlur={e => onCap(e.currentTarget.textContent?.trim())}>{item.cap || ''}</div>
      </div>
      <textarea className="gal-note" rows={1} placeholder="Add a note…" defaultValue={item.note || ''}
        onInput={(e: any) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
        onBlur={(e: any) => onNote(e.target.value)} />
    </div>
  );
}

export function CropModal({ imgId, onSave, onClose }: { imgId: string; onSave: (newId: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  // crop stored in IMAGE space (0–1 relative to actual image pixels)
  const [crop, setCrop] = useState({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  // rendered image area within the container (pixels, from top-left of container)
  const [lay, setLay] = useState<{ ox: number; oy: number; dw: number; dh: number; cw: number; ch: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ type: string; sx: number; sy: number; sc: typeof crop } | null>(null);

  useEffect(() => { getURL(imgId).then(setUrl); }, [imgId]);

  const computeLayout = useCallback(() => {
    const img = imgRef.current, cont = containerRef.current;
    if (!img || !cont || !img.naturalWidth) return;
    const { width: cw, height: ch } = cont.getBoundingClientRect();
    if (!cw || !ch) return;
    const ar = img.naturalWidth / img.naturalHeight, car = cw / ch;
    let dw: number, dh: number;
    if (ar > car) { dw = cw; dh = dw / ar; }
    else { dh = ch; dw = dh * ar; }
    setLay({ ox: (cw - dw) / 2, oy: (ch - dh) / 2, dw, dh, cw, ch });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', computeLayout);
    return () => window.removeEventListener('resize', computeLayout);
  }, [computeLayout]);

  // Convert pointer client coords → image space (0–1). Computes layout fresh each time so it's always accurate.
  const toImg = (clientX: number, clientY: number) => {
    const img = imgRef.current!, cont = containerRef.current!.getBoundingClientRect();
    const ar = img.naturalWidth / img.naturalHeight, car = cont.width / cont.height;
    let dw: number, dh: number;
    if (ar > car) { dw = cont.width; dh = dw / ar; }
    else { dh = cont.height; dw = dh * ar; }
    const ox = (cont.width - dw) / 2, oy = (cont.height - dh) / 2;
    return { x: (clientX - cont.left - ox) / dw, y: (clientY - cont.top - oy) / dh };
  };

  const cropRef = useRef(crop);
  useEffect(() => { cropRef.current = crop; }, [crop]);

  const startDrag = (type: string, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const p = toImg(e.clientX, e.clientY);
    drag.current = { type, sx: p.x, sy: p.y, sc: { ...cropRef.current } };

    const moveHandler = (ev: PointerEvent) => {
      if (!drag.current) return;
      const { type: t, sx, sy, sc } = drag.current;
      const pp = toImg(ev.clientX, ev.clientY);
      const dx = pp.x - sx, dy = pp.y - sy;
      setCrop(() => {
        let { x, y, w, h } = sc;
        if (t === 'move') {
          x = Math.max(0, Math.min(1 - w, sc.x + dx));
          y = Math.max(0, Math.min(1 - h, sc.y + dy));
        } else {
          if (t.includes('e')) w = Math.max(0.02, Math.min(1 - x, sc.w + dx));
          if (t.includes('s')) h = Math.max(0.02, Math.min(1 - y, sc.h + dy));
          if (t.includes('w')) { const nx = Math.max(0, Math.min(sc.x + sc.w - 0.02, sc.x + dx)); w = sc.x + sc.w - nx; x = nx; }
          if (t.includes('n')) { const ny = Math.max(0, Math.min(sc.y + sc.h - 0.02, sc.y + dy)); h = sc.y + sc.h - ny; y = ny; }
        }
        return { x, y, w, h };
      });
    };
    const upHandler = () => {
      drag.current = null;
      window.removeEventListener('pointermove', moveHandler);
      window.removeEventListener('pointerup', upHandler);
      window.removeEventListener('pointercancel', upHandler);
    };
    window.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', upHandler);
    window.addEventListener('pointercancel', upHandler);
  };

  // onMove/onUp kept on container as fallback for mouse (window listeners handle touch/pen)
  const onMove = () => {};
  const onUp = () => { drag.current = null; };

  const handleSave = async () => {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    const { naturalWidth: nw, naturalHeight: nh } = img;
    // crop is in image space — straight multiplication
    const cx = Math.round(Math.max(0, crop.x) * nw);
    const cy = Math.round(Math.max(0, crop.y) * nh);
    const cw = Math.max(1, Math.round(Math.min(1 - crop.x, crop.w) * nw));
    const ch = Math.max(1, Math.round(Math.min(1 - crop.y, crop.h) * nh));
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    canvas.getContext('2d')!.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
    canvas.toBlob(async (blob) => {
      if (!blob) { setSaving(false); return; }
      const newId = await putImage(blob);
      onSave(newId);
      setSaving(false);
    }, 'image/jpeg', 0.92);
  };

  // Convert image-space crop → container-space percentages for rendering
  const sc = lay ? {
    x: (lay.ox + crop.x * lay.dw) / lay.cw,
    y: (lay.oy + crop.y * lay.dh) / lay.ch,
    w: (crop.w * lay.dw) / lay.cw,
    h: (crop.h * lay.dh) / lay.ch,
  } : null;

  const hs: React.CSSProperties = { position: 'absolute', background: '#fff', border: '2px solid var(--accent)', borderRadius: 3, touchAction: 'none' };
  const corners = [['nw', 0, 0, 'nwse-resize', 16, 16], ['ne', 1, 0, 'nesw-resize', 16, 16], ['sw', 0, 1, 'nesw-resize', 16, 16], ['se', 1, 1, 'nwse-resize', 16, 16]] as const;
  const edges = [['n', 0.5, 0, 'ns-resize', 28, 12], ['s', 0.5, 1, 'ns-resize', 28, 12], ['e', 1, 0.5, 'ew-resize', 12, 28], ['w', 0, 0.5, 'ew-resize', 12, 28]] as const;

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(760px,96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div><div className="kicker">Foto bewerken</div><h3>Bijsnijden</h3></div>
          <IconBtn name="x" onClick={onClose} />
        </div>
        <div style={{ flex: 1, minHeight: 0, padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div ref={containerRef}
            style={{ position: 'relative', flex: 1, minHeight: 200, background: '#111', borderRadius: 10, overflow: 'hidden', userSelect: 'none', touchAction: 'none' }}
            onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {url ? (
              <>
                <img ref={imgRef} src={url} crossOrigin="anonymous" alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                  onLoad={computeLayout} />
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', pointerEvents: 'none' }} />
                {sc && (
                  <div style={{
                    position: 'absolute',
                    left: sc.x * 100 + '%', top: sc.y * 100 + '%',
                    width: sc.w * 100 + '%', height: sc.h * 100 + '%',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,.55)',
                    border: '2px solid rgba(255,255,255,.9)',
                    cursor: 'move', touchAction: 'none',
                  }} onPointerDown={e => startDrag('move', e)}>
                    {[1/3, 2/3].map(p => (<>
                      <div key={'v'+p} style={{ position: 'absolute', left: p*100+'%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.25)', pointerEvents: 'none' }} />
                      <div key={'h'+p} style={{ position: 'absolute', top: p*100+'%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.25)', pointerEvents: 'none' }} />
                    </>))}
                    {corners.map(([type, hx, hy, cursor, w, h]) => (
                      <div key={type} onPointerDown={e => startDrag(type, e)}
                        style={{ ...hs, width: w, height: h, left: hx*100+'%', top: hy*100+'%', transform: 'translate(-50%,-50%)', cursor }} />
                    ))}
                    {edges.map(([type, hx, hy, cursor, w, h]) => (
                      <div key={type} onPointerDown={e => startDrag(type, e)}
                        style={{ ...hs, width: w, height: h, left: hx*100+'%', top: hy*100+'%', transform: 'translate(-50%,-50%)', cursor }} />
                    ))}
                  </div>
                )}
              </>
            ) : <div style={{ color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 13 }}>Laden…</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>Sleep de hoeken of randen om bij te snijden.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={onClose}>Annuleren</button>
              <button className="btn primary" disabled={saving || !url} onClick={handleSave}>
                <Icon name="check" size={14} />{saving ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dropzone({ onFiles }: { onFiles: (fl: FileList) => void }) {
  const [drag, handlers] = useDrop(onFiles);
  // Use a unique id so <label htmlFor> natively activates the input — works reliably on iPad/iOS
  const inputId = useRef('dz_' + Math.random().toString(36).slice(2)).current;
  return (
    <label htmlFor={inputId} className={'dropzone' + (drag ? ' drag' : '')} {...(handlers as any)}>
      <div>
        <div className="ic"><Icon name="upload" size={20} /></div>
        <div className="t">Drop images</div>
        <div className="s mono">or click to browse</div>
      </div>
      <input id={inputId} type="file" accept="image/*" multiple hidden onChange={async e => {
        if (e.target.files?.length) await onFiles(e.target.files); e.target.value = '';
      }} />
    </label>
  );
}

function Gallery({ items, onChange, onDraw }: any) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [cropItem, setCropItem] = useState<any>(null);

  // Keep refs so async uploads always use the latest items and onChange, not stale closures
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const add = async (fl: FileList) => {
    const ids = await filesToIds(fl);
    onChangeRef.current([...itemsRef.current, ...ids.map((id: string) => ({ id, cap: '', note: '', strokes: [] }))]);
  };
  const remove = async (it: any) => { if (it.annotatedId) await delImage(it.annotatedId); await delImage(it.id); onChange(items.filter((i: any) => i.id !== it.id)); };
  const patch = (id: string, p: any) => onChange(items.map((i: any) => i.id === id ? { ...i, ...p } : i));

  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...items];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(toIdx, 0, moved);
    onChange(arr);
    setDragIdx(null); setOverIdx(null);
  };

  const handleCropSave = async (newId: string) => {
    if (!cropItem) return;
    const oldId = cropItem.id;
    await delImage(oldId);
    // Use refs so the async callback has the latest items and onChange
    onChangeRef.current(itemsRef.current.map((i: any) => i.id === oldId ? { ...i, id: newId } : i));
    setCropItem(null);
  };

  return (
    <>
      <div className="gal-grid">
        {items.map((it: any, i: number) => (
          <GalleryCell key={it.id} item={it}
            isDragging={dragIdx === i} isOver={overIdx === i && dragIdx !== i}
            dragHandlers={{
              draggable: true,
              onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; setDragIdx(i); },
              onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverIdx(i); },
              onDragLeave: () => setOverIdx(null),
              onDrop: (e: React.DragEvent) => { e.preventDefault(); handleDrop(i); },
              onDragEnd: () => { setDragIdx(null); setOverIdx(null); },
            }}
            onCap={(c: string) => patch(it.id, { cap: c })}
            onNote={(n: string) => patch(it.id, { note: n })}
            onRemove={() => remove(it)}
            onDraw={() => onDraw(it)}
            onCrop={() => setCropItem(it)}
          />
        ))}
        <Dropzone onFiles={add} />
      </div>
      {cropItem && <CropModal imgId={cropItem.id} onSave={handleCropSave} onClose={() => setCropItem(null)} />}
    </>
  );
}

function VisualSection({ edit, onPatch, onDraw }: any) {
  const gal = edit.galleries || {};
  const galRef = useRef(gal);
  useEffect(() => { galRef.current = gal; }, [gal]);
  const setGal = (k: string, arr: any[]) => onPatch({ galleries: { ...galRef.current, [k]: arr } });
  const total = GAL_KINDS.reduce((n, g) => n + (gal[g.id] || []).length, 0);
  return (
    <div className="sec">
      <div className="sec-h"><span className="num">04</span><h2>Visual references</h2>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{total} image{total !== 1 ? 's' : ''}</span><span className="ln" /></div>
      {GAL_KINDS.map(g => (
        <div className="vis-block" key={g.id}>
          <div className="vis-block-h">
            <Icon name={g.icon} size={15} style={{ color: 'var(--ink-2)' }} />
            <span className="vn">{g.label}</span>
            <span className="vc">{(gal[g.id] || []).length}</span>
            <span className="ln" />
          </div>
          <Gallery items={gal[g.id] || []} onChange={(arr: any[]) => setGal(g.id, arr)} onDraw={(it: any) => onDraw(g.id, it)} />
        </div>
      ))}
    </div>
  );
}

function EditableSpan({ value, fallback, onSave, className, style, title, mono }: any) {
  return (
    <span
      className={className}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title={title}
      style={{ outline: 'none', cursor: 'text', fontFamily: mono ? 'var(--mono)' : undefined, ...style }}
      onBlur={e => {
        const v = e.currentTarget.textContent?.trim() || '';
        onSave(v || fallback);
        if (!v && fallback) e.currentTarget.textContent = fallback;
      }}
    >{value || fallback || ''}</span>
  );
}

// Converts DD/MM/YYYY ↔ YYYY-MM-DD for <input type="date">
function toInputDate(d: string) {
  if (!d || !/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return '';
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}-${mm}-${dd}`;
}
function fromInputDate(v: string) {
  if (!v) return '';
  const [yyyy, mm, dd] = v.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function CalendarPopover({ date, onSave, onClose }: { date: string | null; onSave: (d: string) => void; onClose: () => void }) {
  const parsed = date && /^\d{2}\/\d{2}\/\d{4}$/.test(date)
    ? (() => { const [dd, mm, yyyy] = date.split('/').map(Number); return new Date(yyyy, mm - 1, dd); })()
    : new Date();
  const [view, setView] = useState(new Date(parsed.getFullYear(), parsed.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d: number) => {
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return false;
    const [dd, mm, yyyy] = date.split('/').map(Number);
    return d === dd && month === mm - 1 && year === yyyy;
  };

  const pick = (d: number) => {
    onSave(`${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`);
    onClose();
  };

  return (
    <div onMouseDown={e => e.stopPropagation()} style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
      background: 'var(--card)', border: '1px solid var(--line-2)', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: '14px 16px', width: 248, userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS[month]} {year}</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={() => setView(new Date(year, month - 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', padding: '2px 8px', borderRadius: 6, fontSize: 18, lineHeight: 1 }}>‹</button>
          <button type="button" onMouseDown={e => e.stopPropagation()} onClick={() => setView(new Date(year, month + 1, 1))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-2)', padding: '2px 8px', borderRadius: 6, fontSize: 18, lineHeight: 1 }}>›</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {DAYS.map(d => <div key={d} style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingBottom: 6 }}>{d}</div>)}
        {cells.map((d, i) => (
          <button key={i} type="button" disabled={!d}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => { if (d) pick(d); }}
            style={{
              background: d && isSelected(d) ? 'var(--accent)' : 'none',
              color: d && isSelected(d) ? '#fff' : d ? 'var(--ink)' : 'transparent',
              border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: d ? 'pointer' : 'default',
              fontSize: 13, fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .1s',
            }}
            onMouseEnter={e => { if (d && !isSelected(d)) (e.currentTarget as HTMLElement).style.background = 'var(--hover)'; }}
            onMouseLeave={e => { if (d && !isSelected(d)) (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >{d || ''}</button>
        ))}
      </div>
    </div>
  );
}

function DatePickerSpan({ date, onSave, style, className }: { date: string | null; onSave: (d: string) => void; style?: React.CSSProperties; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const formatted = date ? fmtDate(date) : null;
  const display = (formatted && formatted !== 'Invalid Date') ? formatted : (date && date !== 'Invalid Date' ? date : 'Add date');

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <span ref={ref} className={className} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button type="button" onMouseDown={e => e.stopPropagation()} onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit', borderBottom: '1px dashed var(--ink-3)' }}
        title="Change shoot date">
        {display}
      </button>
      {open && <CalendarPopover date={date} onSave={onSave} onClose={() => setOpen(false)} />}
    </span>
  );
}

function SceneRow({ s, overrides, onOverride, onRemoveScene, showDay }: any) {
  const key = s.number + '_' + s.idx;
  const ov = overrides?.[key] || {};
  const num = ov.number ?? s.number;
  const type = ov.type ?? s.type;
  const tod = ov.tod ?? s.tod;
  const synopsis = ov.synopsis ?? s.synopsis;
  const year = ov.year ?? s.year;
  const date = ov.date ?? s.date;
  const dayLabel = showDay
    ? `${s.dayNumber ? 'D' + s.dayNumber + ' · ' : ''}${year || ''}`
    : `${s.season ? s.season + ' ' : ''}${year || ''}`;

  return (
    <div className="scene-row" style={{ position: 'relative' }} title="">
      <EditableSpan className="sn" value={num} fallback={s.number} mono
        title="Edit scene number" onSave={(v: string) => onOverride(key, { number: v })} />
      <span className="ie" style={{ display: 'flex', gap: 0, alignItems: 'baseline' }}>
        <EditableSpan value={type} fallback={s.type} mono
          title="Edit INT/EXT" style={{ fontWeight: 700 }}
          onSave={(v: string) => onOverride(key, { type: v.toUpperCase() })} />
        <span>/</span>
        <EditableSpan value={tod} fallback={s.tod} mono
          title="Edit time of day (DAY/NIGHT/…)"
          onSave={(v: string) => onOverride(key, { tod: v.toUpperCase() })} />
      </span>
      <span>
        <div
          className="syn"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          title="Edit scene description"
          style={{ outline: 'none', cursor: 'text' }}
          onBlur={e => {
            const v = e.currentTarget.textContent?.trim() || '';
            onOverride(key, { synopsis: v });
          }}
        >{synopsis || ''}{!synopsis && <span className="faint" contentEditable={false}>—</span>}</div>
        {s.segments.length > 1 && <div className="setp">{s.segments.slice(1).join(' / ')}</div>}
      </span>
      <EditableSpan className="yr" value={dayLabel}
        fallback={dayLabel} title="Edit year / date info"
        onSave={(v: string) => onOverride(key, { year: v, date })} />
      <button className="scene-remove-btn" title="Remove scene from this location"
        onClick={() => onRemoveScene(key)}
        style={{ opacity: 0, position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: '2px 4px', transition: 'opacity .15s' }}>
        <Icon name="x" size={13} sw={2} />
      </button>
    </div>
  );
}

function makeAddedScene(id: string) {
  return { number: '—', type: 'EXT', tod: 'DAY', synopsis: '', year: '', date: null, dayNumber: null, season: null, storyNum: null, setPath: '', segments: [], location: '', pageLength: null, cast: null, extras: null, region: null, idx: 0, _added: true, _id: id };
}

function ScenesTable({ loc, view, overrides, removedScenes, addedScenes, dayOverrides, onOverride, onRemoveScene, onAddScene, onRemoveAdded, onDayOverride }: { loc: any; view: string; overrides: any; removedScenes: string[]; addedScenes: any[]; dayOverrides: Record<string, any>; onOverride: (key: string, patch: any) => void; onRemoveScene: (key: string) => void; onAddScene: () => void; onRemoveAdded: (id: string) => void; onDayOverride: (dayNum: string, patch: any) => void }) {
  const isRemoved = (s: any) => !s._added && removedScenes.includes(s.number + '_' + s.idx);
  const addBtn = (
    <button className="btn sm" style={{ margin: '10px 0 2px 16px' }} onClick={onAddScene}>
      <Icon name="plus" size={13} /> Add scene
    </button>
  );

  if (view === 'flat') {
    const scenes = [...loc.scenes].filter(s => !isRemoved(s)).sort((a: any, b: any) => parseFloat(a.number) - parseFloat(b.number));
    const all = [...scenes, ...addedScenes];
    return (
      <div>
        <div className="scenes">
          {all.map((s: any) => s._added
            ? <SceneRow key={'added_' + s._id} s={s} overrides={overrides} onOverride={(_key: string, p: any) => onOverride('added_' + s._id, p)} onRemoveScene={() => onRemoveAdded(s._id)} showDay />
            : <SceneRow key={s.number + s.idx} s={s} overrides={overrides} onOverride={onOverride} onRemoveScene={onRemoveScene} showDay />
          )}
        </div>
        {addBtn}
      </div>
    );
  }

  const byDay = useMemo(() => {
    const g: Record<string, any[]> = {};
    loc.scenes.filter((s: any) => !isRemoved(s)).forEach((s: any) => { const k = s.dayNumber || '—'; (g[k] = g[k] || []).push(s); });
    return Object.entries(g).sort((a, b) => (a[0] === '—' ? 999 : +a[0]) - (b[0] === '—' ? 999 : +b[0]));
  }, [loc, removedScenes]);

  return (
    <div>
      <div className="scenes">
        {byDay.map(([day, scenes]) => {
          const d0 = scenes[0];
          return (
            <div key={day}>
              <div className="scene-daygroup-h">
                {day !== '—' ? <>
                  <span className="dn">Day {day}</span>
                  <DatePickerSpan
                    date={(dayOverrides[day] || {}).date ?? d0.date}
                    onSave={(v: string) => onDayOverride(day, { date: v })}
                  />
                </> : <span>Unscheduled</span>}
                <span style={{ flex: 1 }} />
                <span>{scenes.length} scene{scenes.length !== 1 ? 's' : ''}</span>
              </div>
              {scenes.map((s: any) => (
                <SceneRow key={s.number + s.idx} s={s} overrides={overrides} onOverride={onOverride} onRemoveScene={onRemoveScene} showDay={false} />
              ))}
            </div>
          );
        })}
        {addedScenes.length > 0 && (
          <div>
            <div className="scene-daygroup-h"><span>Added manually</span><span style={{ flex: 1 }} /><span>{addedScenes.length} scene{addedScenes.length !== 1 ? 's' : ''}</span></div>
            {addedScenes.map((s: any) => (
              <SceneRow key={'added_' + s._id} s={s} overrides={overrides}
                onOverride={(_key: string, p: any) => onOverride('added_' + s._id, p)}
                onRemoveScene={() => onRemoveAdded(s._id)} showDay={false} />
            ))}
          </div>
        )}
      </div>
      {addBtn}
    </div>
  );
}

function useVisibleShootDays(loc: any, edit: any) {
  const removedScenes: string[] = edit.removedScenes || [];
  const removedDays: string[] = edit.removedDays || [];
  const dayOverrides: Record<string, any> = edit.dayOverrides || {};

  // Collect day numbers that still have at least one visible scene
  const activeDayNums = new Set<number>();
  loc.scenes.forEach((s: any) => {
    if (s.dayNumber != null && !removedScenes.includes(s.number + '_' + s.idx)) {
      activeDayNums.add(s.dayNumber);
    }
  });
  (edit.addedScenes || []).forEach((s: any) => {
    if (s.dayNumber != null) activeDayNums.add(s.dayNumber);
  });

  return loc.shootDates
    .filter((d: any) => activeDayNums.has(d.dayNumber) && !removedDays.includes(String(d.dayNumber)))
    .map((d: any) => {
      const ov = dayOverrides[String(d.dayNumber)] || {};
      return { ...d, dayNumber: ov.dayNumber ?? d.dayNumber, date: ov.date ?? d.date, _orig: d.dayNumber };
    });
}

export function LocationFile({ loc, edit, name, onPatch, onRename, onRemove, onCombine, onDuplicate, sceneView, onDayDateGlobal }: any) {
  const adj = edit.adjustments || [];
  const region = loc.regions.join(' · ');
  const [annot, setAnnot] = useState<any>(null);
  const shootDays = useVisibleShootDays(loc, edit);

  const openDraw = (kind: string, item: any) => setAnnot({ kind, item });
  const saveAnnot = ({ strokes, note, annotatedId }: any) => {
    const kind = annot.kind, id = annot.item.id;
    const gal = edit.galleries || {};
    const arr = (gal[kind] || []).map((i: any) => i.id === id ? { ...i, strokes, note, annotatedId } : i);
    onPatch({ galleries: { ...gal, [kind]: arr } });
    setAnnot(null);
  };

  return (
    <div className="canvas">
      <div style={{ marginBottom: 22 }}>
        <CoverDrop id={edit.cover} height={220} radius={14} label="Add a cover photo for this location"
          onSet={id => onPatch({ cover: id })} onClear={() => onPatch({ cover: null })} />
      </div>

      <div className="loc-hero">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="kicker">{region || 'Location'}</div>
          <h1 contentEditable suppressContentEditableWarning spellCheck={false}
            style={{ outline: 'none' }} title="Click to rename"
            onBlur={e => { const v = e.currentTarget.textContent?.trim() || ''; if (v && v !== name) onRename(v); else e.currentTarget.textContent = name; }}>{name}</h1>
          <div className="meta-line">
            <span className="tag">{loc.sceneCount - (edit.removedScenes || []).length} scenes</span>
            <span className="tag">{shootDays.length} shoot day{shootDays.length !== 1 ? 's' : ''}</span>
            {loc.sets.length > 0 && <span className="tag">{loc.sets.length} set{loc.sets.length !== 1 ? 's' : ''}</span>}
            {adj.length > 0 && <span className="tag accent">{adj.length} adjustment{adj.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>
        <Menu align="right" button={<button className="btn"><Icon name="dots" size={16} /></button>} items={[
          { label: 'Rename location', icon: 'edit', onClick: () => { const h = document.querySelector('.loc-hero h1') as HTMLElement; if (h) { h.focus(); document.getSelection()?.selectAllChildren(h); } } },
          { label: edit.cover ? 'Replace cover photo' : 'Add cover photo', icon: 'image', onClick: () => { const el = document.querySelector('.cover') as HTMLElement; if (el) el.click(); } },
          { label: 'Duplicate location', icon: 'copy', onClick: onDuplicate },
          { label: 'Combine with…', icon: 'layers', onClick: onCombine },
          { sep: true },
          { label: 'Remove location', icon: 'trash', danger: true, onClick: onRemove },
        ]} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Address</label>
            <input className="input" placeholder="Street, city, country…" defaultValue={edit.address || ''}
              onBlur={e => onPatch({ address: e.target.value })} key={'addr' + loc.id} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="mappin" size={12} />Google Maps link
              {edit.mapLink && (
                <a href={edit.mapLink} target="_blank" rel="noopener noreferrer"
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--mono)', letterSpacing: '.06em' }}>
                  Bekijk <Icon name="externallink" size={11} />
                </a>
              )}
            </label>
            <input className="input" placeholder="Plak een Google Maps URL…" defaultValue={edit.mapLink || ''}
              onBlur={e => onPatch({ mapLink: e.target.value.trim() })} key={'map' + loc.id} />
          </div>
          <div className="field">
            <label>Access / parking notes</label>
            <input className="input" placeholder="Gate code, unit base, load-in…" defaultValue={edit.access || ''}
              onBlur={e => onPatch({ access: e.target.value })} key={'acc' + loc.id} />
          </div>
        </div>
        <div className="metrics" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="metric"><div className="k">Prep</div>
            <div className="v"><DayStepper value={edit.prepDays} onChange={v => onPatch({ prepDays: v })} /><small>days</small></div></div>
          <div className="metric"><div className="k">Wrap</div>
            <div className="v"><DayStepper value={edit.wrapDays} onChange={v => onPatch({ wrapDays: v })} /><small>days</small></div></div>
        </div>
      </div>

      <div className="sec">
        <div className="sec-h"><span className="num">01</span><h2>Shoot days</h2>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>auto-updates with scenes · click to edit</span>
          <span className="ln" /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {shootDays.length ? shootDays.map((d: any) => (
            <div key={d._orig} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
              <EditableSpan
                value={String(d.dayNumber)} fallback={String(d._orig)} mono={false}
                style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--serif)', lineHeight: 1 }}
                title="Edit day number"
                onSave={(v: string) => {
                  const cur = edit.dayOverrides || {};
                  onPatch({ dayOverrides: { ...cur, [String(d._orig)]: { ...(cur[String(d._orig)] || {}), dayNumber: v } } });
                }}
              />
              <span>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.1em' }}>DAY</div>
                <DatePickerSpan
                  date={d.date}
                  style={{ fontSize: 13, fontWeight: 600 }}
                  onSave={(v: string) => {
                    if (onDayDateGlobal) {
                      onDayDateGlobal(String(d._orig), d.date, v);
                    } else {
                      const cur = edit.dayOverrides || {};
                      onPatch({ dayOverrides: { ...cur, [String(d._orig)]: { ...(cur[String(d._orig)] || {}), date: v } } });
                    }
                  }}
                />
              </span>
              <button title="Remove this shoot day from location"
                onClick={() => {
                  const cur: string[] = edit.removedDays || [];
                  onPatch({ removedDays: [...cur, String(d._orig)] });
                }}
                style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, opacity: 0, transition: 'opacity .15s' }}
                className="day-remove-btn">
                <Icon name="x" size={12} sw={2} />
              </button>
            </div>
          )) : <span className="muted">No shoot days — all scenes removed or none scheduled.</span>}
        </div>
      </div>

      <div className="sec">
        <div className="sec-h"><span className="num">02</span><h2>Adjustments</h2><span className="ln" /></div>
        <Adjustments loc={loc} items={adj} onChange={(a: any[]) => onPatch({ adjustments: a })} />
      </div>

      <div className="sec">
        <div className="sec-h"><span className="num">03</span><h2>Scenes here</h2>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>click any number or description to edit</span><span className="ln" /></div>
        <ScenesTable
          loc={loc}
          view={sceneView}
          overrides={edit.sceneOverrides || {}}
          removedScenes={edit.removedScenes || []}
          addedScenes={edit.addedScenes || []}
          dayOverrides={edit.dayOverrides || {}}
          onOverride={(key: string, patch: any) => {
            const cur = edit.sceneOverrides || {};
            onPatch({ sceneOverrides: { ...cur, [key]: { ...(cur[key] || {}), ...patch } } });
          }}
          onDayOverride={(dayNum: string, patch: any) => {
            if (patch.date !== undefined && onDayDateGlobal) {
              // Get the original date for this day (before any override)
              const origDay = loc.shootDates?.find((d: any) => String(d.dayNumber) === dayNum);
              const currentDate = (edit.dayOverrides?.[dayNum] || {}).date ?? origDay?.date ?? null;
              onDayDateGlobal(dayNum, currentDate, patch.date);
            } else {
              const cur = edit.dayOverrides || {};
              onPatch({ dayOverrides: { ...cur, [dayNum]: { ...(cur[dayNum] || {}), ...patch } } });
            }
          }}
          onRemoveScene={(key: string) => {
            const cur: string[] = edit.removedScenes || [];
            onPatch({ removedScenes: [...cur, key] });
          }}
          onAddScene={() => {
            const id = 'added_' + Date.now();
            const cur: any[] = edit.addedScenes || [];
            onPatch({ addedScenes: [...cur, makeAddedScene(id)] });
          }}
          onRemoveAdded={(id: string) => {
            const cur: any[] = edit.addedScenes || [];
            onPatch({ addedScenes: cur.filter((s: any) => s._id !== id) });
          }}
        />
      </div>

      <VisualSection edit={edit} onPatch={onPatch} onDraw={openDraw} />

      <div className="sec">
        <div className="sec-h"><span className="num">05</span><h2>Notes</h2><span className="ln" /></div>
        <textarea className="input" rows={4} placeholder="Anything else the department needs to know…"
          defaultValue={edit.notes || ''} onBlur={e => onPatch({ notes: e.target.value })} key={'notes' + loc.id} />
      </div>

      {annot && <Annotator originalId={annot.item.id} init={{ strokes: annot.item.strokes, note: annot.item.note }}
        onSave={saveAnnot} onClose={() => setAnnot(null)} />}
    </div>
  );
}
