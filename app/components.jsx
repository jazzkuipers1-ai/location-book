/* Shared atoms, icons, constants. Exports to window for other babel files. */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

/* ---- adjustment categories (art-department change types) ---------------- */
const CATS = [
  { id: 'paint',    label: 'Paint',     color: 'oklch(0.62 0.12 40)' },
  { id: 'remove',   label: 'Remove',    color: 'oklch(0.56 0.04 250)' },
  { id: 'dress',    label: 'Dress',     color: 'oklch(0.56 0.09 150)' },
  { id: 'build',    label: 'Build',     color: 'oklch(0.64 0.10 70)' },
  { id: 'electric', label: 'Electric',  color: 'oklch(0.58 0.10 245)' },
  { id: 'repair',   label: 'Repair',    color: 'oklch(0.55 0.08 330)' },
  { id: 'other',    label: 'Other',     color: 'oklch(0.60 0.02 90)' },
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));

/* ---- icons -------------------------------------------------------------- */
const PATHS = {
  search: 'M11 11l4 4M7.5 13a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11Z',
  plus: 'M9 4v10M4 9h10',
  check: 'M4 8.5 7 11.5 13 4.5',
  trash: 'M3.5 5h11M7 5V3.5h4V5M5 5l.7 9h6.6l.7-9',
  image: 'M3 4h12v10H3zM3 11l3.5-3.5L10 11l2.5-2.5L15 11M6.2 7.2a1 1 0 1 0 0-.01',
  upload: 'M9 12V3M5.5 6.5 9 3l3.5 3.5M3.5 13.5h11',
  download: 'M9 3v9M5.5 8.5 9 12l3.5-3.5M3.5 14.5h11',
  x: 'M4 4l10 10M14 4 4 14',
  chevron: 'M6 4l5 5-5 5',
  chevronD: 'M4 6l5 5 5-5',
  cal: 'M3.5 4.5h11v10h-11zM3.5 7.5h11M6.5 3v3M11.5 3v3',
  pin: 'M9 16s5-4.5 5-9A5 5 0 0 0 4 7c0 4.5 5 9 5 9ZM9 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  ruler: 'M3 11 11 3l4 4-8 8zM6 6l1.5 1.5M8.5 3.5 10 5M5 9l1.5 1.5',
  layers: 'M9 3 2.5 6.5 9 10l6.5-3.5L9 3ZM3 10l6 3.2L15 10M3 13l6 3.2L15 13',
  film: 'M3 3h12v12H3zM3 6.5h12M3 11.5h12M6 3v12M12 3v12',
  edit: 'M4 12.5 11.5 5l2 2L6 14.5l-2.5.5.5-2.5ZM10.5 6l2 2',
  dots: 'M5 9h.01M9 9h.01M13 9h.01',
  grid: 'M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z',
  list: 'M6 5h9M6 9h9M6 13h9M3 5h.01M3 9h.01M3 13h.01',
  grip: 'M7 4h.01M7 9h.01M7 14h.01M11 4h.01M11 9h.01M11 14h.01',
  arrow: 'M4 9h10M10 5l4 4-4 4',
  reset: 'M4 9a5 5 0 1 1 1.6 3.7M4 9V5.5M4 9h3.5',
  undo: 'M4 9a5 5 0 1 0 1.6-3.7M4 9V5.5M4 9h3.5',
  redo: 'M14 9a5 5 0 1 1-1.6-3.7M14 9V5.5M14 9h-3.5',
  sliders: 'M4 6h7M4 12h3M13 6h1M9 12h5M11 4.5v3M7 10.5v3',
  page: 'M4 2.5h7L14 6v9.5H4zM10.5 2.5V6H14',
  lock: 'M5.5 8V6a3.5 3.5 0 0 1 7 0v2M3.5 8h11v7.5h-11zM9 11.5v1.5',
  eye: 'M1.5 9s3-5.5 7.5-5.5S16.5 9 16.5 9s-3 5.5-7.5 5.5S1.5 9 1.5 9ZM9 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  eyeOff: 'M3 3l12 12M10.58 10.58A2.5 2.5 0 0 1 6.42 6.42M7.36 3.64A7.8 7.8 0 0 1 9 3.5C13.5 3.5 16.5 9 16.5 9a13.2 13.2 0 0 1-1.67 2.43M5.42 4.92C3.22 6.22 1.5 9 1.5 9s3 5.5 7.5 5.5a7.7 7.7 0 0 0 3.58-.88',
};
function Icon({ name, size = 16, sw = 1.6, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

function IconBtn({ name, title, onClick, danger, size = 16 }) {
  return (
    <button className={'icon-btn' + (danger ? ' danger' : '')} title={title}
      onClick={onClick} type="button"><Icon name={name} size={size} /></button>
  );
}

/* ---- number stepper ----------------------------------------------------- */
function Stepper({ value, onChange, min = 0, max = 99 }) {
  const set = v => onChange(Math.max(min, Math.min(max, v)));
  return (
    <span className="stepper">
      <button type="button" onClick={() => set((value || 0) - 1)}>–</button>
      <input value={value || 0} onChange={e => {
        const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
        set(isNaN(n) ? 0 : n);
      }} />
      <button type="button" onClick={() => set((value || 0) + 1)}>+</button>
    </span>
  );
}

/* ---- async image from IndexedDB id -------------------------------------- */
function Img({ imgId, alt, className, style }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let live = true;
    if (!imgId) { setUrl(null); return; }
    LB.db.getURL(imgId).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [imgId]);
  if (!url) return <div className={className} style={{ ...style, background: 'var(--card-2)' }} />;
  return <img src={url} alt={alt || ''} className={className} style={style} />;
}

/* ---- file -> IndexedDB ids ---------------------------------------------- */
const IMG_MAX_PX = 2400;   // longest side — covers A4 at ~290 dpi
const IMG_QUALITY = 0.88;  // JPEG quality — excellent visual quality, ~50% smaller than raw

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.naturalWidth, h = img.naturalHeight;
      // Only downscale, never upscale
      if (w > IMG_MAX_PX || h > IMG_MAX_PX) {
        if (w >= h) { h = Math.round(h * IMG_MAX_PX / w); w = IMG_MAX_PX; }
        else         { w = Math.round(w * IMG_MAX_PX / h); h = IMG_MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('compress failed')), 'image/jpeg', IMG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('decode failed')); };
    img.src = blobUrl;
  });
}

function compressBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > IMG_MAX_PX || h > IMG_MAX_PX) {
        if (w >= h) { h = Math.round(h * IMG_MAX_PX / w); w = IMG_MAX_PX; }
        else         { w = Math.round(w * IMG_MAX_PX / h); h = IMG_MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(out => out ? resolve(out) : reject(new Error('compress failed')), 'image/jpeg', IMG_QUALITY);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('decode failed')); };
    img.src = blobUrl;
  });
}

// Collect all image IDs referenced in the project state
function collectAllImageIds(state) {
  const ids = new Set();
  Object.values(state.edits || {}).forEach(edit => {
    if (!edit) return;
    if (edit.cover) ids.add(edit.cover);
    if (edit.galleries) {
      Object.values(edit.galleries).forEach(arr => {
        (arr || []).forEach(it => {
          if (it.id) ids.add(it.id);
          if (it.annotatedId) ids.add(it.annotatedId);
        });
      });
    }
    (edit.adjustments || []).forEach(adj => { if (adj.thumb) ids.add(adj.thumb); });
  });
  return [...ids];
}

// Compress all existing photos in IndexedDB that are larger than 300 KB.
// Calls onProgress(done, total) after each image.
async function compressExistingPhotos(state, onProgress) {
  const ids = collectAllImageIds(state);
  let done = 0;
  for (const id of ids) {
    try {
      const blob = await LB.db.getBlob(id);
      // Only process blobs we actually have locally and that are large enough
      if (!blob || blob.size < 300 * 1024) { onProgress(++done, ids.length); continue; }
      const compressed = await compressBlob(blob);
      // Only replace if we meaningfully reduced the size (>15%)
      if (compressed.size < blob.size * 0.85) {
        await LB.db.replaceBlob(id, compressed);
        // Also re-upload to Supabase with the smaller version
        if (window.LB_SYNC) LB_SYNC.uploadImage(compressed, id).catch(() => { if (LB_SYNC.queueUpload) LB_SYNC.queueUpload(id); });
      }
    } catch (e) { /* skip broken/unsupported image */ }
    onProgress(++done, ids.length);
  }
}

window.compressExistingPhotos = compressExistingPhotos;

async function filesToIds(fileList) {
  const ids = [];
  for (const f of fileList) {
    if (!f.type.startsWith('image/')) continue;
    const blob = await compressImage(f).catch(() => f); // fall back to original if compress fails
    const id = await LB.db.putImage(blob);
    ids.push(id);
  }
  return ids;
}

/* ---- drop wrapper hook -------------------------------------------------- */
function useDrop(onFiles) {
  const [drag, setDrag] = useState(false);
  const handlers = {
    onDragOver: e => { e.preventDefault(); setDrag(true); },
    onDragLeave: e => { e.preventDefault(); setDrag(false); },
    onDrop: e => {
      e.preventDefault(); setDrag(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
    },
  };
  return [drag, handlers];
}

/* ---- small helpers ------------------------------------------------------ */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function fmtDate(d) { // "31/08/2026" -> "Mon 31 Aug"
  if (!d) return '';
  const [dd, mm, yy] = d.split('/').map(Number);
  const dt = new Date(yy, mm - 1, dd);
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ---- kebab / popover menu (portaled + fixed so it never clips) --------- */
function Menu({ button, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const trigRef = useRef();
  const menuRef = useRef();

  const place = useCallback(() => {
    const el = trigRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: align === 'left' ? r.left : null, right: align === 'left' ? null : (window.innerWidth - r.right) });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = e => {
      if (menuRef.current && !menuRef.current.contains(e.target) && trigRef.current && !trigRef.current.contains(e.target)) setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove); };
  }, [open, place]);

  return (
    <span style={{ display: 'inline-flex' }} ref={trigRef}>
      <span onClick={e => { e.stopPropagation(); setOpen(o => !o); }} style={{ display: 'inline-flex' }}>{button}</span>
      {open && pos && ReactDOM.createPortal(
        <div className="menu" ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left != null ? pos.left : 'auto', right: pos.right != null ? pos.right : 'auto' }}>
          {items.map((it, i) => it.sep
            ? <div key={i} className="menu-sep" />
            : <button key={i} className={'menu-item' + (it.danger ? ' danger' : '')} type="button"
                onClick={e => { e.stopPropagation(); setOpen(false); it.onClick && it.onClick(); }}>
                {it.icon && <Icon name={it.icon} size={14} />}{it.label}
              </button>)}
        </div>, document.body)}
    </span>
  );
}

/* ---- cover-photo dropzone ----------------------------------------------- */
function CoverDrop({ id, onSet, onClear, height = 210, radius = 14, label = 'Add a cover photo' }) {
  const [drag, handlers] = useDrop(async fl => { const ids = await filesToIds(fl); if (ids[0]) onSet(ids[0]); });
  const [cropping, setCropping] = useState(false);
  const inp = useRef();
  const pick = () => inp.current.click();
  return (
    <div className={'cover' + (drag ? ' drag' : '')} style={{ height, borderRadius: radius }} {...handlers}
      onClick={() => { if (!id) pick(); }}>
      {id ? <>
        <Img imgId={id} className="cover-img" />
        <div className="cover-actions">
          <button className="btn sm" type="button" onClick={e => { e.stopPropagation(); setCropping(true); }}><Icon name="ruler" size={13} />Crop</button>
          <button className="btn sm" type="button" onClick={e => { e.stopPropagation(); pick(); }}><Icon name="image" size={13} />Replace</button>
          <button className="btn sm" type="button" onClick={e => { e.stopPropagation(); onClear(); }}><Icon name="trash" size={13} /></button>
        </div>
        {cropping && <CropModal imgId={id} onClose={() => setCropping(false)} onDone={newId => { onSet(newId); setCropping(false); }} />}
      </> : (
        <div className="cover-empty" style={{ borderRadius: radius }}>
          <Icon name="image" size={24} />
          <div className="t">{label}</div>
          <div className="s mono">drag &amp; drop or click to browse</div>
        </div>
      )}
      <input ref={inp} type="file" accept="image/*" hidden onChange={async e => {
        const ids = await filesToIds(e.target.files); if (ids[0]) onSet(ids[0]); e.target.value = '';
      }} />
    </div>
  );
}

/* display name honours a user rename stored in edits[id].name */
function locName(loc, edits) { const e = edits && edits[loc.id]; return (e && e.name) || loc.name; }

Object.assign(window, {
  Icon, IconBtn, Stepper, Img, CATS, CAT, filesToIds, useDrop, uid, fmtDate, Menu, CoverDrop, locName,
  useState, useEffect, useRef, useCallback, useMemo,
});
