/* Image annotator — draw on photos (finger / Apple Pencil) + per-picture note.
   Strokes are stored normalised (0..1) for re-editing; a flattened PNG is baked
   for crisp display & PDF export.                                              */

const PEN_COLORS = ['#e5484d', '#f5a623', '#ffffff', '#1a1a1a', '#2f7d4f', '#2f6df0'];
const PEN_SIZES = [{ k: 'S', w: 3 }, { k: 'M', w: 6 }, { k: 'L', w: 11 }];

async function bakeAnnotation(imgEl, strokes) {
  const W = imgEl.naturalWidth, H = imgEl.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, W, H);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.color; ctx.lineWidth = Math.max(1, s.w * W);
    ctx.beginPath();
    s.pts.forEach((p, i) => { const x = p[0] * W, y = p[1] * H; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  return LB.db.putImage(blob);
}

function Annotator({ originalId, init, onSave, onClose }) {
  const [strokes, setStrokes] = useState((init && init.strokes) || []);
  const [note, setNote] = useState((init && init.note) || '');
  const [color, setColor] = useState('#e5484d');
  const [size, setSize] = useState(6);
  const [url, setUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef(); const canRef = useRef();
  const cur = useRef(null);

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
    const all = cur.current ? strokes.concat([cur.current]) : strokes;
    for (const s of all) {
      ctx.strokeStyle = s.color; ctx.lineWidth = Math.max(1, s.w * w);
      ctx.beginPath();
      s.pts.forEach((p, i) => { const x = p[0] * w, y = p[1] * h; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => { redraw(); }, [redraw, url]);
  useEffect(() => {
    const on = () => redraw(); window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [redraw]);

  const pt = e => {
    const r = canRef.current.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const down = e => {
    e.preventDefault(); canRef.current.setPointerCapture(e.pointerId);
    const w = imgRef.current.clientWidth || 1;
    cur.current = { color, w: size / w, pts: [pt(e)] };
    redraw();
  };
  const move = e => { if (!cur.current) return; e.preventDefault(); cur.current.pts.push(pt(e)); redraw(); };
  const up = () => { if (!cur.current) return; const s = cur.current; cur.current = null; if (s.pts.length) setStrokes(p => [...p, s]); };

  const undo = () => setStrokes(p => p.slice(0, -1));
  const clear = () => setStrokes([]);

  async function save() {
    setSaving(true);
    let annotatedId = null;
    try { if (strokes.length && imgRef.current) annotatedId = await bakeAnnotation(imgRef.current, strokes); }
    catch (e) { console.warn('bake failed', e); }
    onSave({ strokes, note, annotatedId });
  }

  return (
    <div className="scrim" style={{ alignItems: 'stretch' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="annot">
        <div className="annot-stage">
          <div className="annot-imgwrap">
            {url && <img ref={imgRef} src={url} alt="" className="annot-img" onLoad={redraw} draggable="false" />}
            <canvas ref={canRef} className="annot-canvas"
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </div>
        </div>
        <div className="annot-side">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="kicker">Mark up photo</div>
            <IconBtn name="x" onClick={onClose} title="Close" />
          </div>
          <div className="annot-tools">
            <div className="kicker" style={{ marginBottom: 8 }}>Pen</div>
            <div className="swatches">
              {PEN_COLORS.map(c => (
                <button key={c} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <div className="sizes">
              {PEN_SIZES.map(s => (
                <button key={s.k} className={'sizebtn' + (size === s.w ? ' on' : '')} onClick={() => setSize(s.w)}>
                  <span style={{ width: s.w + 2, height: s.w + 2, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn sm" onClick={undo} disabled={!strokes.length}><Icon name="reset" size={14} />Undo</button>
              <button className="btn sm" onClick={clear} disabled={!strokes.length}><Icon name="trash" size={14} />Clear</button>
            </div>
          </div>
          <div className="field" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label>Note</label>
            <textarea className="input" style={{ flex: 1, minHeight: 90 }} placeholder="Notes about this photo…"
              value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn block" onClick={onClose}>Cancel</button>
            <button className="btn block primary" onClick={save} disabled={saving}><Icon name="check" size={15} />{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const shownId = item => (item.annotatedId || item.id);

window.Annotator = Annotator;
window.shownId = shownId;
