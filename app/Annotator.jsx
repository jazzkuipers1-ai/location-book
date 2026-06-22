/* Image annotator — draw on photos (finger / Apple Pencil) + per-picture note.
   Strokes stored normalised (0..1); baked PNG for display & PDF export.        */

const PEN_COLORS = ['#e5484d', '#f5a623', '#facc15', '#2f7d4f', '#2f6df0', '#a855f7', '#ffffff', '#1a1a1a'];
const PEN_SIZES  = [{ k: 'XS', w: 2 }, { k: 'S', w: 5 }, { k: 'M', w: 10 }, { k: 'L', w: 18 }];

/* Draw one stroke on a canvas context (w/h = canvas display size in px). */
function drawStroke(ctx, s, w, h) {
  ctx.beginPath();
  if (s.shape === 'ellipse') {
    const cx = (s.x1 + s.x2) / 2 * w, cy = (s.y1 + s.y2) / 2 * h;
    const rx = Math.max(1, Math.abs(s.x2 - s.x1) / 2 * w);
    const ry = Math.max(1, Math.abs(s.y2 - s.y1) / 2 * h);
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else if (s.shape === 'rect') {
    ctx.rect(s.x1 * w, s.y1 * h, (s.x2 - s.x1) * w, (s.y2 - s.y1) * h);
  } else {
    s.pts.forEach((p, i) => { const x = p[0] * w, y = p[1] * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  }
  ctx.stroke();
}

async function bakeAnnotation(imgEl, strokes) {
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  const ink = document.createElement('canvas'); ink.width = W; ink.height = H;
  const ictx = ink.getContext('2d');
  ictx.lineCap = 'round'; ictx.lineJoin = 'round';
  for (const s of strokes) {
    ictx.globalAlpha = s.type === 'marker' ? 0.45 : 1;
    ictx.globalCompositeOperation = s.type === 'eraser' ? 'destination-out' : 'source-over';
    ictx.strokeStyle = s.color;
    ictx.lineWidth = Math.max(1, s.w * W);
    drawStroke(ictx, s, W, H);
  }
  ictx.globalAlpha = 1; ictx.globalCompositeOperation = 'source-over';
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, W, H);
  ctx.drawImage(ink, 0, 0);
  const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.9));
  return LB.db.putImage(blob);
}

function Annotator({ originalId, init, onSave, onClose }) {
  const [strokes,   setStrokes]   = useState((init && init.strokes) || []);
  const [future,    setFuture]    = useState([]);
  const [note,      setNote]      = useState((init && init.note) || '');
  const [color,     setColor]     = useState('#e5484d');
  const [size,      setSize]      = useState(5);
  const [tool,      setTool]      = useState('pen');     // 'pen' | 'marker' | 'eraser'
  const [snapShape, setSnapShape] = useState('line');    // 'line' | 'rect' | 'ellipse'
  const [url,       setUrl]       = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [zoom,      setZoom]      = useState(1);
  const [pan,       setPan]       = useState({ x: 0, y: 0 });

  const imgRef = useRef(); const canRef = useRef();

  // Refs for use inside event handlers (stable, no stale closures)
  const strokesRef   = useRef(strokes);
  const toolRef      = useRef(tool);
  const colorRef     = useRef(color);
  const sizeRef      = useRef(size);
  const snapShapeRef = useRef(snapShape);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { toolRef.current = tool; colorRef.current = color; sizeRef.current = size; }, [tool, color, size]);
  useEffect(() => { snapShapeRef.current = snapShape; }, [snapShape]);

  const cur               = useRef(null);
  const holdTimer         = useRef(null);
  const isSnapped         = useRef(false);
  const lastSignificantPt = useRef(null);
  const activePointers    = useRef(new Map());
  const pinchState        = useRef(null);

  useEffect(() => { LB.db.getURL(originalId).then(setUrl); }, [originalId]);

  const redraw = useCallback(() => {
    const can = canRef.current, img = imgRef.current;
    if (!can || !img || !img.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const w = img.clientWidth, h = img.clientHeight;
    if (can.width !== w * dpr || can.height !== h * dpr) { can.width = w * dpr; can.height = h * dpr; }
    can.style.width = w + 'px'; can.style.height = h + 'px';
    const ctx = can.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const all = cur.current ? [...strokesRef.current, cur.current] : strokesRef.current;
    for (const s of all) {
      ctx.globalAlpha = s.type === 'marker' ? 0.45 : 1;
      ctx.globalCompositeOperation = s.type === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(1, s.w * w);
      drawStroke(ctx, s, w, h);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }, []); // reads from refs — stable identity

  useEffect(() => { strokesRef.current = strokes; redraw(); }, [strokes, redraw]);
  useEffect(() => { redraw(); }, [url, redraw]);
  useEffect(() => {
    const on = () => redraw(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [redraw]);

  const pt = e => {
    const r = canRef.current.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top)  / r.height)),
    ];
  };

  const snapToCurrent = () => {
    if (!cur.current || cur.current.pts.length < 2) return;
    const pts = cur.current.pts;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x1 = Math.min(...xs), x2 = Math.max(...xs);
    const y1 = Math.min(...ys), y2 = Math.max(...ys);
    const shape = snapShapeRef.current;
    if (shape === 'ellipse') {
      cur.current = { ...cur.current, shape: 'ellipse', x1, y1, x2, y2 };
    } else if (shape === 'rect') {
      cur.current = { ...cur.current, shape: 'rect', x1, y1, x2, y2 };
    } else {
      cur.current = { ...cur.current, pts: [pts[0], pts[pts.length - 1]] };
    }
    isSnapped.current = true;
    redraw();
  };

  const down = e => {
    e.preventDefault();
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canRef.current.setPointerCapture(e.pointerId);

    if (activePointers.current.size === 2) {
      clearTimeout(holdTimer.current);
      cur.current = null; isSnapped.current = false;
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchState.current = { prevDist: dist, prevCx: (pts[0].x + pts[1].x) / 2, prevCy: (pts[0].y + pts[1].y) / 2 };
      redraw(); return;
    }

    const w = imgRef.current ? imgRef.current.clientWidth || 1 : 1;
    const t = toolRef.current;
    const strokeW = t === 'eraser' ? sizeRef.current * 4 : sizeRef.current;
    isSnapped.current = false;
    const startPt = pt(e);
    lastSignificantPt.current = startPt;
    cur.current = { type: t, color: colorRef.current, w: strokeW / w, pts: [startPt] };
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(snapToCurrent, 800);
    redraw();
  };

  const move = e => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchState.current) {
      e.preventDefault();
      const pts = [...activePointers.current.values()];
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const newCx = (pts[0].x + pts[1].x) / 2, newCy = (pts[0].y + pts[1].y) / 2;
      const { prevDist, prevCx, prevCy } = pinchState.current;
      setZoom(z => Math.max(1, Math.min(5, z * (newDist / prevDist))));
      setPan(p => ({ x: p.x + (newCx - prevCx), y: p.y + (newCy - prevCy) }));
      pinchState.current = { prevDist: newDist, prevCx: newCx, prevCy: newCy };
      return;
    }

    if (!cur.current) return;
    e.preventDefault();

    if (isSnapped.current) {
      const newPt = pt(e);
      if (cur.current.shape === 'ellipse' || cur.current.shape === 'rect') {
        cur.current = { ...cur.current, x2: newPt[0], y2: newPt[1] };
      } else {
        cur.current = { ...cur.current, pts: [cur.current.pts[0], newPt] };
      }
    } else {
      const newPt = pt(e);
      cur.current.pts.push(newPt);
      // 8 px dead-zone — ignores Apple Pencil jitter so hold timer fires reliably
      const lsp = lastSignificantPt.current;
      const canW = canRef.current.clientWidth || 1, canH = canRef.current.clientHeight || 1;
      const dx = (newPt[0] - lsp[0]) * canW, dy = (newPt[1] - lsp[1]) * canH;
      if (Math.sqrt(dx * dx + dy * dy) > 8) {
        lastSignificantPt.current = newPt;
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(snapToCurrent, 800);
      }
    }
    redraw();
  };

  const up = e => {
    activePointers.current.delete(e.pointerId);
    clearTimeout(holdTimer.current);
    isSnapped.current = false;
    if (activePointers.current.size < 2) pinchState.current = null;
    if (!cur.current) return;
    const s = cur.current; cur.current = null;
    if (s.pts && s.pts.length || s.shape) { setStrokes(p => [...p, s]); setFuture([]); }
    redraw();
  };

  useEffect(() => { if (zoom <= 1) setPan({ x: 0, y: 0 }); }, [zoom]);

  const undo = () => {
    if (!strokes.length) return;
    setFuture(f => [strokes[strokes.length - 1], ...f]);
    setStrokes(strokes.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setStrokes(s => [...s, future[0]]);
    setFuture(future.slice(1));
  };
  const clear = () => { setStrokes([]); setFuture([]); };

  async function save() {
    setSaving(true);
    let annotatedId = null;
    try { if (strokes.length && imgRef.current) annotatedId = await bakeAnnotation(imgRef.current, strokes); }
    catch (e) { console.warn('bake failed', e); }
    onSave({ strokes, note, annotatedId });
  }

  const wrapTransform = (zoom !== 1 || pan.x || pan.y)
    ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` : undefined;

  return (
    <div className="scrim" style={{ alignItems: 'stretch' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="annot">
        <div className="annot-stage" style={{ overflow: 'hidden' }}>
          <div className="annot-imgwrap"
            style={{ transformOrigin: 'center', transform: wrapTransform, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}>
            {url && <img ref={imgRef} src={url} alt="" className="annot-img" onLoad={redraw} draggable="false" crossOrigin="anonymous" />}
            <canvas ref={canRef} className="annot-canvas"
              style={{ touchAction: 'none', cursor: 'crosshair', userSelect: 'none', WebkitUserSelect: 'none' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onDoubleClick={e => e.preventDefault()}
              onMouseDown={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()} />
          </div>
        </div>

        <div className="annot-side">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kicker">Mark up photo</div>
            <IconBtn name="x" onClick={onClose} title="Close" />
          </div>

          <div className="annot-tools">
            {/* Tool */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              {[['pen','Pen'],['marker','Marker'],['eraser','Eraser']].map(([id, label]) => (
                <button key={id} className={'btn sm' + (tool === id ? ' primary' : ' ghost')} style={{ flex: 1 }}
                  onClick={() => setTool(id)}>{label}</button>
              ))}
            </div>

            {/* Quick shape — not for eraser */}
            {tool !== 'eraser' && (
              <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                {[['line','╱ Lijn'],['rect','▭ Rect'],['ellipse','◯ Cirkel']].map(([id, label]) => (
                  <button key={id} className={'btn sm' + (snapShape === id ? ' primary' : ' ghost')} style={{ flex: 1 }}
                    onClick={() => setSnapShape(id)}>{label}</button>
                ))}
              </div>
            )}

            {/* Color — not for eraser */}
            {tool !== 'eraser' && (
              <div className="swatches" style={{ marginBottom: 10 }}>
                {PEN_COLORS.map(c => (
                  <button key={c} className={'swatch' + (color === c ? ' on' : '')}
                    style={{ background: c, opacity: tool === 'marker' ? 0.6 : 1 }}
                    onClick={() => setColor(c)} />
                ))}
              </div>
            )}

            {/* Size */}
            <div className="sizes" style={{ marginBottom: 12 }}>
              {PEN_SIZES.map(s => (
                <button key={s.k} className={'sizebtn' + (size === s.w ? ' on' : '')} onClick={() => setSize(s.w)}>
                  <span style={{ width: Math.min(s.w + 2, 18), height: Math.min(s.w + 2, 18), borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                </button>
              ))}
            </div>

            {/* History */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={undo} disabled={!strokes.length}><Icon name="undo" size={13} />Undo</button>
              <button className="btn sm" onClick={redo} disabled={!future.length}><Icon name="redo" size={13} />Redo</button>
              <button className="btn sm" onClick={clear} disabled={!strokes.length}><Icon name="trash" size={13} />Clear</button>
            </div>

            {zoom > 1 && (
              <button className="btn sm ghost" style={{ marginTop: 8, width: '100%' }}
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                Reset zoom ×{zoom.toFixed(1)}
              </button>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              Hou pen stil → snapt naar {snapShape === 'ellipse' ? 'cirkel' : snapShape === 'rect' ? 'rechthoek' : 'lijn'}
            </div>
          </div>

          <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Note</label>
            <textarea className="input" style={{ flex: 1, minHeight: 90 }} placeholder="Notes about this photo…"
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn block" onClick={onClose}>Cancel</button>
            <button className="btn block primary" onClick={save} disabled={saving}>
              <Icon name="check" size={15} />{saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const shownId = item => (item.annotatedId || item.id);

window.Annotator = Annotator;
window.shownId = shownId;
