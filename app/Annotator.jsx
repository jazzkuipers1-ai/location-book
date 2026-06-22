/* Image annotator — draw on photos (finger / Apple Pencil) + per-picture note.
   Features: pen, marker, eraser, undo/redo, pinch-to-zoom, quick-shape snap.  */

const PEN_COLORS = ['#e5484d', '#f5a623', '#facc15', '#2f7d4f', '#2f6df0', '#a855f7', '#ffffff', '#1a1a1a'];
const PEN_SIZES = [{ k: 'XS', w: 2 }, { k: 'S', w: 5 }, { k: 'M', w: 10 }, { k: 'L', w: 18 }];

async function bakeAnnotation(imgEl, strokes) {
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  // Ink layer: draw all pen/marker strokes, use destination-out for eraser
  const ink = document.createElement('canvas');
  ink.width = W; ink.height = H;
  const ictx = ink.getContext('2d');
  ictx.lineCap = 'round'; ictx.lineJoin = 'round';
  for (const s of strokes) {
    ictx.globalAlpha = s.type === 'marker' ? 0.45 : 1;
    ictx.globalCompositeOperation = s.type === 'eraser' ? 'destination-out' : 'source-over';
    ictx.strokeStyle = s.color;
    ictx.lineWidth = Math.max(1, s.w * W);
    ictx.beginPath();
    s.pts.forEach((p, i) => { const x = p[0]*W, y = p[1]*H; i ? ictx.lineTo(x,y) : ictx.moveTo(x,y); });
    ictx.stroke();
  }
  ictx.globalAlpha = 1; ictx.globalCompositeOperation = 'source-over';
  // Composite: photo + ink layer
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, W, H);
  ctx.drawImage(ink, 0, 0);
  const blob = await new Promise(res => out.toBlob(res, 'image/jpeg', 0.9));
  return LB.db.putImage(blob);
}

function Annotator({ originalId, init, onSave, onClose }) {
  const [strokes, setStrokes] = useState((init && init.strokes) || []);
  const [future,  setFuture]  = useState([]);
  const [note,    setNote]    = useState((init && init.note) || '');
  const [color,   setColor]   = useState('#e5484d');
  const [size,    setSize]    = useState(5);
  const [tool,    setTool]    = useState('pen'); // 'pen' | 'marker' | 'eraser'
  const [url,     setUrl]     = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [zoom,    setZoom]    = useState(1);
  const [pan,     setPan]     = useState({ x: 0, y: 0 });

  const imgRef = useRef();
  const canRef = useRef();

  // Refs mirror state for use inside event handlers (avoid stale closures)
  const strokesRef = useRef(strokes);
  const toolRef    = useRef(tool);
  const colorRef   = useRef(color);
  const sizeRef    = useRef(size);
  const zoomRef    = useRef(zoom);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  useEffect(() => { toolRef.current = tool; colorRef.current = color; sizeRef.current = size; }, [tool, color, size]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Drawing state
  const cur        = useRef(null);
  const holdTimer  = useRef(null);
  const isSnapped  = useRef(false);

  // Multi-touch tracking for pinch-to-zoom
  const activePointers = useRef(new Map()); // pointerId → {x,y}
  const pinchState     = useRef(null);       // { prevDist, prevCx, prevCy }

  useEffect(() => { LB.db.getURL(originalId).then(setUrl); }, [originalId]);

  // Stable redraw — reads from refs so it never goes stale
  const redraw = useCallback(() => {
    const can = canRef.current, img = imgRef.current;
    if (!can || !img || !img.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const w = img.clientWidth, h = img.clientHeight;
    if (can.width !== w*dpr || can.height !== h*dpr) { can.width = w*dpr; can.height = h*dpr; }
    can.style.width = w+'px'; can.style.height = h+'px';
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
      ctx.beginPath();
      s.pts.forEach((p, i) => { const x = p[0]*w, y = p[1]*h; i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); });
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }, []); // empty deps — reads from refs

  // Re-draw whenever strokes change or image loads
  useEffect(() => { strokesRef.current = strokes; redraw(); }, [strokes, redraw]);
  useEffect(() => { redraw(); }, [url, redraw]);
  useEffect(() => {
    const on = () => redraw(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [redraw]);

  // Normalise pointer position to [0,1] image space — works through CSS zoom transform
  const pt = e => {
    const r = canRef.current.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top)  / r.height)),
    ];
  };

  // Quick shape: snap current stroke to straight line (fires if pointer holds still)
  const snapToLine = () => {
    if (!cur.current || cur.current.pts.length < 2) return;
    const pts = cur.current.pts;
    cur.current = { ...cur.current, pts: [pts[0], pts[pts.length - 1]] };
    isSnapped.current = true;
    redraw();
  };

  const down = e => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      // Second finger — enter pinch-to-zoom, cancel any drawing stroke
      clearTimeout(holdTimer.current);
      cur.current = null; isSnapped.current = false;
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      pinchState.current = { prevDist: dist, prevCx: (pts[0].x+pts[1].x)/2, prevCy: (pts[0].y+pts[1].y)/2 };
      canRef.current.setPointerCapture(e.pointerId);
      redraw();
      return;
    }

    e.preventDefault();
    canRef.current.setPointerCapture(e.pointerId);

    const w = imgRef.current ? imgRef.current.clientWidth || 1 : 1;
    const t = toolRef.current;
    // Eraser is 4× wider than selected pen size
    const strokeW = t === 'eraser' ? sizeRef.current * 4 : sizeRef.current;
    isSnapped.current = false;
    cur.current = { type: t, color: colorRef.current, w: strokeW / w, pts: [pt(e)] };

    // Quick shape: if pointer stays still for 800 ms, snap to straight line
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(snapToLine, 800);
    redraw();
  };

  const move = e => {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch — update zoom + pan
    if (activePointers.current.size === 2 && pinchState.current) {
      e.preventDefault();
      const pts = [...activePointers.current.values()];
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const newCx = (pts[0].x + pts[1].x) / 2;
      const newCy = (pts[0].y + pts[1].y) / 2;
      const { prevDist, prevCx, prevCy } = pinchState.current;
      setZoom(z => Math.max(1, Math.min(5, z * (newDist / prevDist))));
      setPan(p => ({ x: p.x + (newCx - prevCx), y: p.y + (newCy - prevCy) }));
      pinchState.current = { prevDist: newDist, prevCx: newCx, prevCy: newCy };
      return;
    }

    if (!cur.current) return;
    e.preventDefault();

    if (isSnapped.current) {
      // Snapped: only update the endpoint — allows repositioning the line
      cur.current = { ...cur.current, pts: [cur.current.pts[0], pt(e)] };
    } else {
      cur.current.pts.push(pt(e));
      // Reset hold timer: snap fires 800 ms after last movement
      clearTimeout(holdTimer.current);
      holdTimer.current = setTimeout(snapToLine, 800);
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
    if (s.pts.length) { setStrokes(p => [...p, s]); setFuture([]); }
    redraw();
  };

  // Reset pan when fully zoomed out
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
    ? `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
    : undefined;

  return (
    <div className="scrim" style={{ alignItems: 'stretch' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="annot">
        <div className="annot-stage" style={{ overflow: 'hidden' }}>
          <div className="annot-imgwrap"
            style={{ transformOrigin: 'center', transform: wrapTransform, touchAction: 'none', userSelect: 'none' }}>
            {url && <img ref={imgRef} src={url} alt="" className="annot-img" onLoad={redraw} draggable="false" />}
            <canvas ref={canRef} className="annot-canvas"
              style={{ touchAction: 'none', cursor: 'crosshair' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </div>
        </div>

        <div className="annot-side">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kicker">Mark up photo</div>
            <IconBtn name="x" onClick={onClose} title="Close" />
          </div>

          <div className="annot-tools">
            {/* Tool selector */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
              {[['pen','Pen'],['marker','Marker'],['eraser','Eraser']].map(([id, label]) => (
                <button key={id}
                  className={'btn sm' + (tool === id ? ' primary' : ' ghost')}
                  style={{ flex: 1 }}
                  onClick={() => setTool(id)}>{label}</button>
              ))}
            </div>

            {/* Color swatches — hidden for eraser */}
            {tool !== 'eraser' && (
              <div className="swatches" style={{ marginBottom: 10 }}>
                {PEN_COLORS.map(c => (
                  <button key={c} className={'swatch' + (color === c ? ' on' : '')}
                    style={{ background: c, opacity: tool === 'marker' ? 0.55 : 1 }}
                    onClick={() => setColor(c)} />
                ))}
              </div>
            )}

            {/* Size picker */}
            <div className="sizes" style={{ marginBottom: 12 }}>
              {PEN_SIZES.map(s => (
                <button key={s.k} className={'sizebtn' + (size === s.w ? ' on' : '')} onClick={() => setSize(s.w)}>
                  <span style={{
                    width: Math.min(s.w + 2, 18), height: Math.min(s.w + 2, 18),
                    borderRadius: '50%', background: 'currentColor', display: 'block'
                  }} />
                </button>
              ))}
            </div>

            {/* History */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={undo} disabled={!strokes.length}>
                <Icon name="undo" size={13} />Undo
              </button>
              <button className="btn sm" onClick={redo} disabled={!future.length}>
                <Icon name="redo" size={13} />Redo
              </button>
              <button className="btn sm" onClick={clear} disabled={!strokes.length}>
                <Icon name="trash" size={13} />Clear
              </button>
            </div>

            {/* Zoom indicator */}
            {zoom > 1 && (
              <button className="btn sm ghost" style={{ marginTop: 8, width: '100%' }}
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                Reset zoom ×{zoom.toFixed(1)}
              </button>
            )}

            {/* Hint for quick shape */}
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              Hold pen still at end of stroke → straight line
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
