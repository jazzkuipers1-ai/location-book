import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon, IconBtn } from './components';
import { getURL, putImage } from './db';

const PALETTE = [
  '#111111', '#555555', '#aaaaaa', '#ffffff',
  '#e5484d', '#ff6b35', '#f5a623', '#ffd700',
  '#4ade80', '#22c55e', '#0ea5e9', '#6366f1',
  '#d946ef', '#f472b6', '#a78060', '#c0c0c0',
];

const SIZES = [
  { k: 'XS', w: 1.5 },
  { k: 'S',  w: 3.5 },
  { k: 'M',  w: 7 },
  { k: 'L',  w: 14 },
  { k: 'XL', w: 24 },
];

const OPACITIES = [
  { k: '100%', v: 1 },
  { k: '70%',  v: 0.7 },
  { k: '40%',  v: 0.4 },
  { k: '20%',  v: 0.2 },
];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: any[], W: number, H: number) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    const pts: number[][] = s.pts;
    if (!pts.length) continue;
    const color = hexToRgba(s.hex, s.opacity ?? 1);
    const baseW = Math.max(0.5, s.w * W);

    if (pts.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pts[0][0] * W, pts[0][1] * H, baseW * (pts[0][2] || 0.7) * 0.6, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1, pr1 = 0.8] = pts[i - 1];
      const [x2, y2, pr2 = 0.8] = pts[i];
      const pressure = (pr1 + pr2) / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(0.5, baseW * pressure * 1.4);
      ctx.beginPath();
      ctx.moveTo(x1 * W, y1 * H);
      ctx.lineTo(x2 * W, y2 * H);
      ctx.stroke();
    }
  }
}

async function bakeAnnotation(imgEl: HTMLImageElement, strokes: any[]): Promise<string> {
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(imgEl, 0, 0, W, H);
  drawStrokes(ctx, strokes, W, H);
  const blob = await new Promise<Blob>(res => c.toBlob(b => res(b!), 'image/jpeg', 0.9));
  return putImage(blob);
}

export function shownId(item: any) { return item.annotatedId || item.id; }

export function Annotator({ originalId, init, onSave, onClose }: { originalId: string; init?: any; onSave: (r: any) => void; onClose: () => void }) {
  const [strokes, setStrokes] = useState<any[]>((init && init.strokes) || []);
  const [note, setNote] = useState((init && init.note) || '');
  const [hex, setHex] = useState('#e5484d');
  const [size, setSize] = useState(7);
  const [opacity, setOpacity] = useState(1);
  const [eraser, setEraser] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const canRef = useRef<HTMLCanvasElement>(null);
  const cur = useRef<any>(null);

  useEffect(() => { getURL(originalId).then(setUrl); }, [originalId]);

  const redraw = useCallback(() => {
    const can = canRef.current, img = imgRef.current;
    if (!can || !img || !img.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const w = img.clientWidth, h = img.clientHeight;
    if (can.width !== w * dpr || can.height !== h * dpr) { can.width = w * dpr; can.height = h * dpr; }
    can.style.width = w + 'px'; can.style.height = h + 'px';
    const ctx = can.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const all = cur.current ? strokes.concat([cur.current]) : strokes;
    drawStrokes(ctx, all, w, h);
  }, [strokes]);

  useEffect(() => { redraw(); }, [redraw, url]);
  useEffect(() => {
    const on = () => redraw();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [redraw]);

  const isPen = (e: React.PointerEvent) => e.pointerType === 'pen' || e.pointerType === 'mouse';

  const pt = (e: React.PointerEvent): number[] => {
    const r = canRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? Math.max(0.1, e.pressure) : 0.8;
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      pressure,
    ];
  };

  const down = (e: React.PointerEvent) => {
    if (!isPen(e)) return;
    e.preventDefault(); canRef.current!.setPointerCapture(e.pointerId);
    const w = imgRef.current?.clientWidth || 1;
    if (eraser) {
      cur.current = { hex: '#000000', opacity: 0, w: (size * 2) / w, pts: [pt(e)], _eraser: true };
    } else {
      cur.current = { hex, opacity, w: size / w, pts: [pt(e)] };
    }
    redraw();
  };

  const move = (e: React.PointerEvent) => {
    if (!cur.current || !isPen(e)) return;
    e.preventDefault();
    cur.current.pts.push(pt(e));
    if (cur.current._eraser) {
      // Erase: remove strokes near current point
      const [px, py] = pt(e);
      const threshold = cur.current.w * 2;
      setStrokes(prev => prev.filter(s =>
        !s.pts.some((p: number[]) => Math.hypot(p[0] - px, p[1] - py) < threshold)
      ));
    }
    redraw();
  };

  const up = () => {
    if (!cur.current) return;
    const s = cur.current; cur.current = null;
    if (!s._eraser && s.pts.length) setStrokes(p => [...p, s]);
  };

  const undo = () => setStrokes(p => p.slice(0, -1));
  const clear = () => setStrokes([]);

  async function save() {
    setSaving(true);
    let annotatedId = null;
    try { if (strokes.length && imgRef.current) annotatedId = await bakeAnnotation(imgRef.current, strokes); }
    catch (e) { console.warn('bake failed', e); }
    onSave({ strokes, note, annotatedId });
  }

  const cursorStyle = eraser ? 'cell' : 'crosshair';

  return (
    <div className="scrim" style={{ alignItems: 'stretch' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="annot">
        <div className="annot-stage">
          <div className="annot-imgwrap">
            {url && <img ref={imgRef} src={url} alt="" className="annot-img" crossOrigin="anonymous" onLoad={redraw} draggable={false} />}
            <canvas ref={canRef} className="annot-canvas" style={{ cursor: cursorStyle }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </div>
        </div>
        <div className="annot-side">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kicker">Mark up photo</div>
            <IconBtn name="x" onClick={onClose} title="Close" />
          </div>

          <div className="annot-tools">
            {/* Color palette */}
            <div className="kicker" style={{ marginBottom: 8 }}>Kleur</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 5, marginBottom: 12 }}>
              {PALETTE.map(c => (
                <button key={c} onClick={() => { setHex(c); setEraser(false); }}
                  style={{ width: '100%', aspectRatio: '1', borderRadius: 6, background: c, border: hex === c && !eraser ? '2.5px solid var(--accent)' : '1.5px solid var(--line-2)', cursor: 'pointer', outline: hex === c && !eraser ? '2px solid var(--accent-soft)' : 'none' }} />
              ))}
            </div>

            {/* Size */}
            <div className="kicker" style={{ marginBottom: 6 }}>Dikte</div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
              {SIZES.map(s => (
                <button key={s.k} onClick={() => setSize(s.w)}
                  style={{ flex: 1, padding: '6px 2px', border: size === s.w ? '2px solid var(--accent)' : '1px solid var(--line-2)', borderRadius: 7, background: size === s.w ? 'var(--accent-soft)' : 'var(--card-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: Math.min(s.w + 2, 18), height: Math.min(s.w + 2, 18), borderRadius: '50%', background: 'var(--ink)', display: 'block' }} />
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-2)' }}>{s.k}</span>
                </button>
              ))}
            </div>

            {/* Opacity */}
            <div className="kicker" style={{ marginBottom: 6 }}>Transparantie</div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
              {OPACITIES.map(o => (
                <button key={o.k} onClick={() => setOpacity(o.v)}
                  style={{ flex: 1, padding: '5px 2px', border: opacity === o.v ? '2px solid var(--accent)' : '1px solid var(--line-2)', borderRadius: 7, background: opacity === o.v ? 'var(--accent-soft)' : 'var(--card-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 16, height: 12, borderRadius: 3, background: hex, opacity: o.v, border: '1px solid var(--line)' }} />
                  <span className="mono" style={{ fontSize: 9, color: 'var(--ink-2)' }}>{o.k}</span>
                </button>
              ))}
            </div>

            {/* Preview dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#1c1813', borderRadius: 8, marginBottom: 4 }}>
              <span style={{ width: Math.min(size + 4, 28), height: Math.min(size + 4, 28), borderRadius: '50%', background: hex, opacity, display: 'block', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 10, color: '#888' }}>Apple Pencil druk beïnvloedt dikte</span>
            </div>

            {/* Tools */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className={'btn sm' + (eraser ? ' primary' : '')} onClick={() => setEraser(e => !e)} title="Gum">
                <Icon name="x" size={13} />{eraser ? 'Gum aan' : 'Gum'}
              </button>
              <button className="btn sm" onClick={undo} disabled={!strokes.length}><Icon name="reset" size={13} />Undo</button>
              <button className="btn sm" onClick={clear} disabled={!strokes.length}><Icon name="trash" size={13} /></button>
            </div>
          </div>

          <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Notitie</label>
            <textarea className="input" style={{ flex: 1, minHeight: 70 }} placeholder="Aantekeningen bij deze foto…"
              value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn block" onClick={onClose}>Annuleren</button>
            <button className="btn block primary" onClick={save} disabled={saving}>
              <Icon name="check" size={15} />{saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
