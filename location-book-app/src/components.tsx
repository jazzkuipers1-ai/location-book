import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { getURL, putImage } from './db';

export { useState, useEffect, useRef, useCallback, useMemo };

/* ---- adjustment categories (art-department change types) ---------------- */
export const CATS = [
  { id: 'paint',    label: 'Paint',     color: 'oklch(0.62 0.12 40)' },
  { id: 'remove',   label: 'Remove',    color: 'oklch(0.56 0.04 250)' },
  { id: 'dress',    label: 'Dress',     color: 'oklch(0.56 0.09 150)' },
  { id: 'build',    label: 'Build',     color: 'oklch(0.64 0.10 70)' },
  { id: 'electric', label: 'Electric',  color: 'oklch(0.58 0.10 245)' },
  { id: 'repair',   label: 'Repair',    color: 'oklch(0.55 0.08 330)' },
  { id: 'other',    label: 'Other',     color: 'oklch(0.60 0.02 90)' },
];
export const CAT: Record<string, typeof CATS[0]> = Object.fromEntries(CATS.map(c => [c.id, c]));

/* ---- icons -------------------------------------------------------------- */
const PATHS: Record<string, string> = {
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
  copy: 'M6 4.5h8v9H6zM4 6.5H3v9h8v-1.5',
  menu: 'M3 5h12M3 9h12M3 13h12',
  mappin: 'M9 16s5-4.5 5-9A5 5 0 0 0 4 7c0 4.5 5 9 5 9ZM9 5.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  externallink: 'M11 3h4v4M9 9l6-6M7 5H4v10h10v-3',
  crop: 'M5 1v4m0 8v2h2m6 2V5H5m8 0h2',
  grip2: 'M7 6h.01M7 12h.01M11 6h.01M11 12h.01',
};

export function Icon({ name, size = 16, sw = 1.6, style }: { name: string; size?: number; sw?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
      <path d={PATHS[name] || ''} />
    </svg>
  );
}

export function IconBtn({ name, title, onClick, danger, size = 16 }: { name: string; title?: string; onClick?: () => void; danger?: boolean; size?: number }) {
  return (
    <button className={'icon-btn' + (danger ? ' danger' : '')} title={title}
      onClick={onClick} type="button"><Icon name={name} size={size} /></button>
  );
}

/* ---- number stepper ----------------------------------------------------- */
export function Stepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
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

/* ---- day stepper (supports decimals like 0.2) --------------------------- */
export function DayStepper({ value, onChange, min = 0, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  // draft is non-null only while the input is actively focused
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n * 100) / 100));

  return (
    <span className="stepper">
      <button type="button" onMouseDown={e => e.preventDefault()}
        onClick={() => onChange(clamp((value ?? 0) - 1))}>–</button>
      <input
        value={draft !== null ? draft : String(value ?? 0)}
        onFocus={() => setDraft(String(value ?? 0))}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const n = parseFloat(draft.replace(',', '.'));
            onChange(!isNaN(n) ? clamp(n) : (value ?? 0));
            setDraft(null);
          }
        }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ width: 44 }}
      />
      <button type="button" onMouseDown={e => e.preventDefault()}
        onClick={() => onChange(clamp((value ?? 0) + 1))}>+</button>
    </span>
  );
}

/* ---- async image from IndexedDB id -------------------------------------- */
export function Img({ imgId, alt, className, style, onClick }: { imgId?: string | null; alt?: string; className?: string; style?: React.CSSProperties; onClick?: (e: React.MouseEvent) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!imgId) { setUrl(null); return; }
    getURL(imgId).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [imgId]);
  if (!url) return <div className={className} style={{ ...style, background: 'var(--card-2)' }} />;
  return <img src={url} alt={alt || ''} className={className} style={style} onClick={onClick} />;
}

/* ---- normalise any image file to a JPEG blob (max 2000px, sequential) --- */
const MAX_PX = 2000;
async function normaliseToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const cleanup = () => URL.revokeObjectURL(url);
    img.onload = () => {
      cleanup();
      try {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w > MAX_PX || h > MAX_PX) {
          const scale = MAX_PX / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob ?? file), 'image/jpeg', 0.88);
      } catch { resolve(file); }
    };
    img.onerror = () => { cleanup(); resolve(file); };
    img.src = url;
  });
}

/* ---- file -> storage ids ------------------------------------------------- */
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp|tiff?)$/i;
export async function filesToIds(fileList: FileList | File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const f of Array.from(fileList)) {
    const isImage = f.type.startsWith('image/') || IMAGE_EXTS.test(f.name) || f.type === '';
    if (!isImage) continue;
    // Convert to JPEG so HEIC/HEIF and other formats work everywhere
    const blob = await normaliseToJpeg(f).catch(() => f as Blob);
    const id = await putImage(blob);
    ids.push(id);
  }
  return ids;
}

/* ---- drop wrapper hook -------------------------------------------------- */
export function useDrop(onFiles: (files: FileList) => void): [boolean, React.HTMLAttributes<HTMLElement>] {
  const [drag, setDrag] = useState(false);
  const handlers: React.HTMLAttributes<HTMLElement> = {
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
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function fmtDate(d: string) {
  if (!d) return '';
  const [dd, mm, yy] = d.split('/').map(Number);
  if (!dd || !mm || !yy) return d;
  const dt = new Date(yy, mm - 1, dd);
  const s = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return s === 'Invalid Date' ? d : s;
}

/* ---- kebab / popover menu (portaled + fixed so it never clips) --------- */
export function Menu({ button, items, align = 'right' }: { button: React.ReactNode; items: any[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number | null; right: number | null } | null>(null);
  const trigRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = trigRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: align === 'left' ? r.left : null, right: align === 'left' ? null : (window.innerWidth - r.right) });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && trigRef.current && !trigRef.current.contains(e.target as Node)) setOpen(false);
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
export function CoverDrop({ id, onSet, onClear, height = 210, radius = 14, label = 'Add a cover photo' }: {
  id?: string | null; onSet: (id: string) => void; onClear: () => void; height?: number; radius?: number; label?: string;
}) {
  const [drag, handlers] = useDrop(async (fl) => { const ids = await filesToIds(fl); if (ids[0]) onSet(ids[0]); });
  const inp = useRef<HTMLInputElement>(null);
  const pick = () => inp.current?.click();
  return (
    <div className={'cover' + (drag ? ' drag' : '')} style={{ height, borderRadius: radius }} {...handlers}
      onClick={() => { if (!id) pick(); }}>
      {id ? <>
        <Img imgId={id} className="cover-img" />
        <div className="cover-actions">
          <button className="btn sm" type="button" onClick={e => { e.stopPropagation(); pick(); }}><Icon name="image" size={13} />Replace</button>
          <button className="btn sm" type="button" onClick={e => { e.stopPropagation(); onClear(); }}><Icon name="trash" size={13} /></button>
        </div>
      </> : (
        <div className="cover-empty" style={{ borderRadius: radius }}>
          <Icon name="image" size={24} />
          <div className="t">{label}</div>
          <div className="s mono">drag &amp; drop or click to browse</div>
        </div>
      )}
      <input ref={inp} type="file" accept="image/*" hidden onChange={async e => {
        const ids = await filesToIds(e.target.files!); if (ids[0]) onSet(ids[0]); e.target.value = '';
      }} />
    </div>
  );
}

/* display name honours a user rename stored in edits[id].name */
export function locName(loc: any, edits: any) { const e = edits && edits[loc.id]; return (e && e.name) || loc.name; }
