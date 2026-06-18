/* Adjustments — the heart of the app. Room-grouped, category-coded checklist. */

function CatChip({ cat, onPick, compact }) {
  const [open, setOpen] = useState(false);
  const c = CAT[cat] || CAT.other;
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <span style={{ position: 'relative' }} ref={ref}>
      <button type="button" className="adj-cat" onClick={() => onPick && setOpen(o => !o)}
        style={{ borderColor: 'color-mix(in srgb,' + c.color + ' 40%, var(--line))', cursor: onPick ? 'pointer' : 'default' }}>
        <span className="tick" style={{ background: c.color }} />{c.label}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--card)', border: '1px solid var(--line-2)', borderRadius: 9, padding: 5, boxShadow: 'var(--shadow)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 130 }}>
          {CATS.map(o => (
            <button key={o.id} type="button" className="cat-opt" style={{ border: 'none', justifyContent: 'flex-start' }}
              onClick={() => { onPick(o.id); setOpen(false); }}>
              <span className="tick" style={{ background: o.color }} />{o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function AdjThumb({ id, onSet, onClear }) {
  const [drag, handlers] = useDrop(async fl => { const ids = await filesToIds(fl); if (ids[0]) onSet(ids[0]); });
  const inp = useRef();
  return (
    <div className={'adj-thumb' + (id ? '' : ' drop') + (drag ? ' drag' : '')} {...handlers}
      title={id ? 'Replace / remove reference' : 'Add a reference photo'}
      onClick={() => { if (id) onClear(); else inp.current.click(); }}>
      {id ? <Img imgId={id} /> : <Icon name="image" size={15} />}
      <input ref={inp} type="file" accept="image/*" hidden onChange={async e => {
        const ids = await filesToIds(e.target.files); if (ids[0]) onSet(ids[0]); e.target.value = '';
      }} />
    </div>
  );
}

function AdjRow({ a, onPatch, onDelete }) {
  return (
    <div className={'adj' + (a.done ? ' done' : '')}>
      <button type="button" className={'adj-check' + (a.done ? ' on' : '')}
        onClick={() => onPatch({ done: !a.done })} title="Mark done">
        <Icon name="check" size={13} sw={2.4} />
      </button>
      <CatChip cat={a.cat} onPick={cat => onPatch({ cat })} />
      <div className="adj-body">
        <div className="adj-text" contentEditable suppressContentEditableWarning data-ph="Describe the change…"
          onBlur={e => onPatch({ text: e.currentTarget.textContent.trim() })}>{a.text}</div>
        <div className="adj-sub">
          <span className="adj-meas"><Icon name="ruler" size={12} />
            <input placeholder="measurement" defaultValue={a.measure || ''}
              onBlur={e => onPatch({ measure: e.target.value })} />
          </span>
          <span className="adj-meas"><Icon name="pin" size={12} />
            <input placeholder="area / room" defaultValue={a.area || ''} style={{ width: 110 }}
              onBlur={e => onPatch({ area: e.target.value.trim() })} />
          </span>
        </div>
      </div>
      <div className="adj-tools">
        <AdjThumb id={a.thumb} onSet={id => onPatch({ thumb: id })} onClear={() => onPatch({ thumb: null })} />
        <IconBtn name="trash" title="Delete" danger onClick={onDelete} />
      </div>
    </div>
  );
}

function AddComposer({ areas, onAdd }) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState('paint');
  const [area, setArea] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ id: uid(), cat, text: text.trim(), area: area.trim(), done: false, measure: '', thumb: null });
    setText(''); 
  };
  return (
    <div className="card" style={{ padding: 12, marginBottom: 16 }}>
      <div className="adj-add">
        <div className="cat-picker">
          {CATS.map(c => (
            <button key={c.id} type="button" className={'cat-opt' + (cat === c.id ? ' sel' : '')} onClick={() => setCat(c.id)}>
              <span className="tick" style={{ background: c.color }} />{c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input className="input" placeholder="e.g. Paint the back wall warm grey · take out all furniture · drill for curtain rail…"
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} style={{ flex: 1 }} />
        <input className="input" list="area-list" placeholder="area" value={area}
          onChange={e => setArea(e.target.value)} style={{ width: 150 }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }} />
        <datalist id="area-list">{areas.map(a => <option key={a} value={a} />)}</datalist>
        <button className="btn primary" type="button" onClick={submit}><Icon name="plus" size={15} />Add</button>
      </div>
    </div>
  );
}

function Adjustments({ loc, items, onChange }) {
  const areas = useMemo(() => {
    const s = new Set(loc.sets || []);
    items.forEach(i => { if (i.area) s.add(i.area); });
    return [...s];
  }, [loc, items]);

  const patch = (id, p) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));
  const del = id => onChange(items.filter(i => i.id !== id));
  const add = a => onChange([...items, a]);

  // group by area
  const groups = useMemo(() => {
    const g = {};
    items.forEach(i => { const k = i.area || 'General'; (g[k] = g[k] || []).push(i); });
    return Object.entries(g).sort((a, b) => a[0] === 'General' ? 1 : b[0] === 'General' ? -1 : a[0].localeCompare(b[0]));
  }, [items]);

  const done = items.filter(i => i.done).length;
  const byCat = CATS.map(c => ({ ...c, n: items.filter(i => i.cat === c.id).length })).filter(c => c.n);

  return (
    <div>
      {items.length > 0 && (
        <div className="adj-summary">
          <div>
            <div className="big">{items.length}</div>
            <div className="lbl">change{items.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="vln" />
          <div>
            <div className="big">{groups.length}</div>
            <div className="lbl">area{groups.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="vln" />
          <div className="progress-wrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', marginBottom: 7 }}>
              <span>{byCat.map(c => c.label + ' ' + c.n).join('  ·  ')}</span>
              <span>{done}/{items.length} done</span>
            </div>
            <div className="progress-track">
              {byCat.map(c => <div key={c.id} className="seg" style={{ width: (c.n / items.length * 100) + '%', background: c.color, opacity: .85 }} />)}
            </div>
          </div>
        </div>
      )}

      <AddComposer areas={areas} onAdd={add} />

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No adjustments yet — add the first change above.
        </div>
      ) : groups.map(([area, list]) => (
        <div className="adj-room" key={area}>
          <div className="adj-room-h">
            <Icon name="pin" size={13} style={{ color: 'var(--ink-2)' }} />
            <span className="rn">{area}</span>
            <span className="rc">{list.filter(i => i.done).length}/{list.length}</span>
            <span className="ln" />
          </div>
          <div className="adj-list">
            {list.map(a => <AdjRow key={a.id} a={a} onPatch={p => patch(a.id, p)} onDelete={() => del(a.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Adjustments, CatChip });
