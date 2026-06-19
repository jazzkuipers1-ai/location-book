/* SketchPad — full-featured drawing canvas for Sketches & Measurements */

const _SP_COLORS = [
  '#111111', '#ffffff', '#9e3b2e', '#c87040',
  '#d4a020', '#3d6b4f', '#2c5f8a', '#7b4d9e',
  '#888888', '#d4c5a0',
];

const _SP_WIDTHS = [2, 5, 10, 18, 32];
const SP_W = 1600, SP_H = 1200;

/* ── Draggable / resizable image overlay ── */
function SketchImage({ img, selected, onSelect, onChange, onDelete, canvasW, canvasH }) {
  const origin = useRef(null);
  const activeHandle = useRef(null);
  const isActive = useRef(false);

  function startDrag(e, handle) {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    origin.current = { cx: e.clientX, cy: e.clientY, x: img.x, y: img.y, w: img.w, h: img.h };
    activeHandle.current = handle;
    isActive.current = true;
  }

  useEffect(() => {
    if (!selected) return;
    const move = e => {
      if (!isActive.current || !origin.current) return;
      const { cx, cy, x, y, w, h } = origin.current;
      const dx = (e.clientX - cx) / canvasW * SP_W;
      const dy = (e.clientY - cy) / canvasH * SP_H;
      const hd = activeHandle.current;
      if (!hd) {
        onChange({ x: x + dx, y: y + dy });
      } else {
        let nx = x, ny = y, nw = w, nh = h;
        if (hd.includes('r')) nw = Math.max(60, w + dx);
        if (hd.includes('l')) { nx = x + dx; nw = Math.max(60, w - dx); }
        if (hd.includes('b')) nh = Math.max(60, h + dy);
        if (hd.includes('t')) { ny = y + dy; nh = Math.max(60, h - dy); }
        onChange({ x: nx, y: ny, w: nw, h: nh });
      }
    };
    const up = () => { isActive.current = false; origin.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [selected, canvasW, canvasH, onChange]);

  const pct = (v, total) => (v / total * 100).toFixed(3) + '%';

  const boxStyle = {
    position: 'absolute',
    left:   pct(img.x, SP_W),
    top:    pct(img.y, SP_H),
    width:  pct(img.w, SP_W),
    height: pct(img.h, SP_H),
    boxSizing: 'border-box',
    border: selected ? '2px solid #2c7bd4' : '1px solid transparent',
    cursor: 'move',
    touchAction: 'none',
  };

  const dot = (pos, hd) => {
    const s = {
      position: 'absolute', width: 14, height: 14, background: '#2c7bd4',
      borderRadius: 3, cursor: hd + '-resize', zIndex: 2, touchAction: 'none',
      ...(pos.t !== undefined ? { top: -7 } : { bottom: -7 }),
      ...(pos.l !== undefined ? { left: -7 } : { right: -7 }),
    };
    return <div key={hd} style={s} onPointerDown={e => startDrag(e, hd)} />;
  };

  return (
    <div style={boxStyle} onPointerDown={e => startDrag(e, null)}>
      <img src={img.url} draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />
      {selected && <>
        {dot({ t: 1, l: 1 }, 'nw-resize')}
        {dot({ t: 1, r: 1 }, 'ne-resize')}
        {dot({ b: 1, l: 1 }, 'sw-resize')}
        {dot({ b: 1, r: 1 }, 'se-resize')}
        <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ position: 'absolute', top: -22, right: 0, background: '#9e3b2e', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, padding: '2px 7px', cursor: 'pointer', fontFamily: 'var(--mono)' }}>
          ✕ Remove
        </button>
      </>}
    </div>
  );
}

/* ── Main SketchPad ── */
function SketchPad({ onSave, onClose }) {
  const bgRef   = useRef(null);  // white bg + grid (never touched by user)
  const drawRef = useRef(null);  // transparent drawing layer

  const [tool, setTool]       = useState('pen');
  const [color, setColor]     = useState('#111111');
  const [widthIdx, setWidthIdx] = useState(1);
  const [grid, setGrid]       = useState('dots');
  const [imgs, setImgs]       = useState([]);
  const [selId, setSelId]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ w: 1, h: 1 });

  const isDown    = useRef(false);
  const lastPt    = useRef(null);
  const lineFrom  = useRef(null);
  const preSnap   = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const imgIdCtr  = useRef(0);

  /* ─── Init ─── */
  useEffect(() => {
    const bg   = bgRef.current;
    const draw = drawRef.current;
    const bc   = bg.getContext('2d');
    bc.fillStyle = '#ffffff';
    bc.fillRect(0, 0, SP_W, SP_H);
    paintGrid(bc, 'dots');
    draw.getContext('2d').clearRect(0, 0, SP_W, SP_H);
    pushUndo();
  }, []);

  // Track canvas CSS size so SketchImage % coords stay in sync
  useEffect(() => {
    const el = drawRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setCanvasDisplaySize({ w: r.width, h: r.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Repaint grid background when grid option changes
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    const ctx = bg.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SP_W, SP_H);
    paintGrid(ctx, grid);
  }, [grid]);

  function paintGrid(ctx, mode) {
    if (mode === 'none') return;
    ctx.save();
    if (mode === 'lines') {
      ctx.strokeStyle = '#dddad4';
      ctx.lineWidth = 1;
      for (let x = 40; x < SP_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SP_H); ctx.stroke(); }
      for (let y = 40; y < SP_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SP_W, y); ctx.stroke(); }
    } else {
      ctx.fillStyle = '#b8b2a8';
      for (let x = 40; x < SP_W; x += 40)
        for (let y = 40; y < SP_H; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
    }
    ctx.restore();
  }

  /* ─── Undo / Redo ─── */
  function pushUndo() {
    const ctx  = drawRef.current.getContext('2d');
    const data = ctx.getImageData(0, 0, SP_W, SP_H);
    undoStack.current = [...undoStack.current.slice(-29), data];
    redoStack.current = [];
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(false);
  }

  function undo() {
    if (undoStack.current.length <= 1) return;
    const ctx = drawRef.current.getContext('2d');
    redoStack.current = [ctx.getImageData(0, 0, SP_W, SP_H), ...redoStack.current.slice(0, 29)];
    undoStack.current = undoStack.current.slice(0, -1);
    ctx.putImageData(undoStack.current[undoStack.current.length - 1], 0, 0);
    setCanUndo(undoStack.current.length > 1);
    setCanRedo(true);
  }

  function redo() {
    if (!redoStack.current.length) return;
    const ctx = drawRef.current.getContext('2d');
    undoStack.current = [...undoStack.current, ctx.getImageData(0, 0, SP_W, SP_H)];
    ctx.putImageData(redoStack.current[0], 0, 0);
    redoStack.current = redoStack.current.slice(1);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }

  /* ─── Pointer coordinate mapping ─── */
  function getCoords(e) {
    const canvas = drawRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * SP_W / rect.width,
      y: (e.clientY - rect.top)  * SP_H / rect.height,
      // Apple Pencil: e.pointerType === 'pen', e.pressure 0–1
      p: e.pointerType === 'pen' ? Math.max(0.08, e.pressure || 0.5) : 0.5,
    };
  }

  /* ─── Apply tool style to context ─── */
  function applyStyle(ctx, pressure) {
    const w = _SP_WIDTHS[widthIdx];
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.fillStyle   = 'rgba(0,0,0,1)';
      ctx.lineWidth   = w * 3;
      ctx.globalAlpha = 1;
    } else if (tool === 'marker') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = w * 2.5;
      ctx.globalAlpha = 0.28;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      // Pen: pressure-sensitive width; pencil/line/rect: fixed
      ctx.lineWidth   = tool === 'pen' ? w * (0.3 + pressure * 1.4) : w;
      ctx.globalAlpha = 1;
    }
  }

  function resetStyle(ctx) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* ─── Pointer event handlers ─── */
  function onPtrDown(e) {
    if (tool === 'move') return;
    e.preventDefault();
    drawRef.current.setPointerCapture(e.pointerId);
    setSelId(null);
    isDown.current = true;
    const pt = getCoords(e);
    lastPt.current = pt;

    if (tool === 'line' || tool === 'rect') {
      lineFrom.current = pt;
      preSnap.current  = drawRef.current.getContext('2d').getImageData(0, 0, SP_W, SP_H);
      return;
    }

    // Dot at touchdown point
    const ctx = drawRef.current.getContext('2d');
    applyStyle(ctx, pt.p);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(ctx.lineWidth / 2, 0.5), 0, Math.PI * 2);
    ctx.fill();
    resetStyle(ctx);
  }

  function onPtrMove(e) {
    if (!isDown.current) return;
    e.preventDefault();
    const pt  = getCoords(e);
    const ctx = drawRef.current.getContext('2d');

    if (tool === 'line') {
      ctx.putImageData(preSnap.current, 0, 0);
      applyStyle(ctx, 0.5);
      ctx.beginPath();
      ctx.moveTo(lineFrom.current.x, lineFrom.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      resetStyle(ctx);
      return;
    }

    if (tool === 'rect') {
      ctx.putImageData(preSnap.current, 0, 0);
      const x = Math.min(lineFrom.current.x, pt.x);
      const y = Math.min(lineFrom.current.y, pt.y);
      const w = Math.abs(pt.x - lineFrom.current.x);
      const h = Math.abs(pt.y - lineFrom.current.y);
      applyStyle(ctx, 0.5);
      ctx.strokeRect(x, y, w, h);
      resetStyle(ctx);
      return;
    }

    // Freehand stroke
    applyStyle(ctx, pt.p);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    resetStyle(ctx);
    lastPt.current = pt;
  }

  function onPtrUp() {
    if (!isDown.current) return;
    isDown.current = false;
    pushUndo();
  }

  /* ─── Insert image from file ─── */
  function insertImage() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const el  = new Image();
      el.onload = () => {
        const scale = Math.min(SP_W * 0.55 / el.naturalWidth, SP_H * 0.55 / el.naturalHeight, 1);
        const w = el.naturalWidth * scale;
        const h = el.naturalHeight * scale;
        const id = ++imgIdCtr.current;
        setImgs(prev => [...prev, { id, el, url, x: (SP_W - w) / 2, y: (SP_H - h) / 2, w, h }]);
        setSelId(id);
        setTool('move');
      };
      el.src = url;
    };
    inp.click();
  }

  /* ─── Save canvas as gallery image ─── */
  async function doSave() {
    setSaving(true);
    const out  = document.createElement('canvas');
    out.width  = SP_W;
    out.height = SP_H;
    const ctx  = out.getContext('2d');
    ctx.drawImage(bgRef.current, 0, 0);
    imgs.forEach(img => ctx.drawImage(img.el, img.x, img.y, img.w, img.h));
    ctx.drawImage(drawRef.current, 0, 0);
    out.toBlob(async blob => {
      try {
        const id = await LB.db.putImage(blob);
        onSave({ id, cap: '', note: '', strokes: [] });
      } catch (err) {
        console.error('[SketchPad] save failed', err);
        setSaving(false);
      }
    }, 'image/png', 0.92);
  }

  /* ─── Keyboard shortcuts ─── */
  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
      if (!e.metaKey && !e.ctrlKey) {
        if (e.key === 'p') setTool('pen');
        if (e.key === 'm') setTool('marker');
        if (e.key === 'e') setTool('eraser');
        if (e.key === 'l') setTool('line');
        if (e.key === 'r') setTool('rect');
        if (e.key === 'v') setTool('move');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* ─── Tool list ─── */
  const toolList = [
    { id: 'pen',    icon: 'edit',   label: 'Pen',    key: 'P' },
    { id: 'marker', icon: 'layers', label: 'Marker', key: 'M' },
    { id: 'line',   icon: 'arrow',  label: 'Line',   key: 'L' },
    { id: 'rect',   icon: 'film',   label: 'Rect',   key: 'R' },
    { id: 'eraser', icon: 'x',      label: 'Eraser', key: 'E' },
    { id: 'move',   icon: 'grip',   label: 'Move',   key: 'V' },
  ];

  const gridOpts = [
    { id: 'none',  label: '—',  title: 'No grid'   },
    { id: 'dots',  label: '·',  title: 'Dot grid'  },
    { id: 'lines', label: '⊞', title: 'Line grid'  },
  ];

  /* ─── Draw canvas pointer events pass-through when in move mode ─── */
  const drawPointerEvents = tool === 'move' ? 'none' : 'auto';

  const btnBase = {
    border: 'none', cursor: 'pointer', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, borderRadius: 12, transition: 'background .12s',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', flexDirection: 'column', background: '#191714', userSelect: 'none' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: '#222019', borderBottom: '1px solid #0c0b09', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>

        <button onClick={onClose}
          style={{ background: '#38332a', border: 'none', borderRadius: 8, padding: '8px 13px', color: '#c0b8a8', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, flexShrink: 0 }}>
          ✕
        </button>

        {/* Color swatches */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 5, flexShrink: 0 }}>
          {_SP_COLORS.map(c => {
            const active = color === c && tool !== 'eraser';
            return (
              <button key={c}
                onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
                style={{ width: 30, height: 30, borderRadius: 7, background: c, padding: 0, flexShrink: 0, cursor: 'pointer', border: active ? '3px solid #fff' : '1.5px solid rgba(255,255,255,0.18)', boxShadow: active ? '0 0 0 2px #9e3b2e' : 'none' }} />
            );
          })}
        </div>

        <div style={{ width: 1, height: 22, background: '#3a342a', flexShrink: 0, marginLeft: 4 }} />

        {/* Width presets */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {_SP_WIDTHS.map((w, i) => (
            <button key={w} onClick={() => setWidthIdx(i)}
              style={{ width: 36, height: 36, borderRadius: 8, border: widthIdx === i ? '2px solid #9e3b2e' : '1.5px solid #3a342a', background: '#191714', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: Math.min(w + 4, 26), height: Math.min(w + 4, 26), borderRadius: '50%', background: widthIdx === i ? '#fff' : '#706050' }} />
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: '#3a342a', flexShrink: 0 }} />

        {/* Grid options */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {gridOpts.map(g => (
            <button key={g.id} onClick={() => setGrid(g.id)} title={g.title}
              style={{ padding: '6px 11px', borderRadius: 7, border: 'none', background: grid === g.id ? '#9e3b2e' : '#38332a', color: '#e0d8c8', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 14 }}>
              {g.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 8 }} />

        {/* Undo / Redo */}
        <button disabled={!canUndo} onClick={undo}
          style={{ background: canUndo ? '#38332a' : 'transparent', border: 'none', borderRadius: 8, padding: '8px 12px', color: canUndo ? '#e0d8c8' : '#484038', cursor: canUndo ? 'pointer' : 'default', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Icon name="undo" size={17} />
        </button>
        <button disabled={!canRedo} onClick={redo}
          style={{ background: canRedo ? '#38332a' : 'transparent', border: 'none', borderRadius: 8, padding: '8px 12px', color: canRedo ? '#e0d8c8' : '#484038', cursor: canRedo ? 'pointer' : 'default', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Icon name="redo" size={17} />
        </button>

        <button onClick={doSave} disabled={saving}
          style={{ background: saving ? '#7a2e22' : '#9e3b2e', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {saving ? 'Saving…' : 'Save to gallery'}
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Left toolbar ── */}
        <div style={{ width: 68, background: '#222019', borderRight: '1px solid #0c0b09', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 2, flexShrink: 0, overflowY: 'auto' }}>

          {toolList.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label + ' (' + t.key + ')'}
              style={{ ...btnBase, width: 54, height: 54, background: tool === t.id ? '#9e3b2e' : 'transparent', color: tool === t.id ? '#fff' : '#8a7868' }}>
              <Icon name={t.icon} size={22} sw={1.7} />
              <span style={{ fontSize: 8, fontFamily: 'var(--mono)', letterSpacing: '.04em' }}>{t.label}</span>
            </button>
          ))}

          <div style={{ height: 1, background: '#38332a', width: 44, margin: '5px 0' }} />

          <button onClick={insertImage} title="Insert image (I)"
            style={{ ...btnBase, width: 54, height: 54, background: 'transparent', color: '#8a7868' }}>
            <Icon name="image" size={22} sw={1.7} />
            <span style={{ fontSize: 8, fontFamily: 'var(--mono)' }}>Insert</span>
          </button>

          <div style={{ flex: 1 }} />

          <button title="Clear all"
            onClick={() => {
              if (!confirm('Clear the entire canvas?')) return;
              const ctx = drawRef.current.getContext('2d');
              ctx.clearRect(0, 0, SP_W, SP_H);
              setImgs([]); setSelId(null);
              pushUndo();
            }}
            style={{ ...btnBase, width: 54, height: 54, background: 'transparent', color: '#605040' }}>
            <Icon name="trash" size={20} sw={1.7} />
            <span style={{ fontSize: 8, fontFamily: 'var(--mono)' }}>Clear</span>
          </button>
        </div>

        {/* ── Canvas area ── */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: '#191714' }}
          onClick={() => setSelId(null)}>

          {/* Canvas wrapper — determines display size; all layers inside use position:absolute */}
          <div style={{ position: 'relative', lineHeight: 0, boxShadow: '0 10px 70px rgba(0,0,0,.8)', borderRadius: 3, overflow: 'visible', display: 'inline-block' }}>

            {/* Background canvas (white + grid) */}
            <canvas ref={bgRef} width={SP_W} height={SP_H}
              style={{ display: 'block', maxWidth: 'calc(100vw - 108px)', maxHeight: 'calc(100vh - 92px)', pointerEvents: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 3 }} />

            {/* Floating image overlays (between bg and draw canvas) */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: tool === 'move' ? 'auto' : 'none' }}>
              {imgs.map(img => (
                <SketchImage key={img.id} img={img} selected={selId === img.id}
                  canvasW={canvasDisplaySize.w} canvasH={canvasDisplaySize.h}
                  onSelect={() => setSelId(img.id)}
                  onChange={patch => setImgs(prev => prev.map(i => i.id === img.id ? { ...i, ...patch } : i))}
                  onDelete={() => { setImgs(prev => prev.filter(i => i.id !== img.id)); setSelId(null); }}
                />
              ))}
            </div>

            {/* Drawing canvas (topmost, transparent bg) */}
            <canvas ref={drawRef} width={SP_W} height={SP_H}
              style={{
                display: 'block',
                maxWidth: 'calc(100vw - 108px)',
                maxHeight: 'calc(100vh - 92px)',
                touchAction: 'none',
                cursor: tool === 'move' ? 'default' : 'crosshair',
                background: 'transparent',
                position: 'relative',
                borderRadius: 3,
                pointerEvents: drawPointerEvents,
              }}
              onPointerDown={onPtrDown}
              onPointerMove={onPtrMove}
              onPointerUp={onPtrUp}
              onPointerLeave={onPtrUp}
            />
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{ padding: '5px 12px', background: '#222019', borderTop: '1px solid #0c0b09', color: '#5a5040', fontFamily: 'var(--mono)', fontSize: 10, display: 'flex', gap: 16, flexShrink: 0 }}>
        <span>P pen · M marker · L line · R rect · E eraser · V move</span>
        <span>⌘Z undo · ⌘⇧Z redo</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Apple Pencil supported — pressure sensitive</span>
      </div>
    </div>
  );
}

window.SketchPad = SketchPad;
