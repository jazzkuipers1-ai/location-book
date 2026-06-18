import { useState, useRef, useEffect, useMemo } from 'react';
import { CATS, CAT, Icon, IconBtn, Img, useDrop, filesToIds, uid } from './components';
import { delImage } from './db';
import { Annotator } from './Annotator';
import { CropModal } from './LocationFile';

function CatChip({ cat, onPick }: { cat: string; onPick?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const c = CAT[cat] || CAT.other;
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
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
              onClick={() => { onPick && onPick(o.id); setOpen(false); }}>
              <span className="tick" style={{ background: o.color }} />{o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function AdjThumb({ a, onPatch }: { a: any; onPatch: (p: any) => void }) {
  const [showCrop, setShowCrop] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const inputId = useRef('adj_' + Math.random().toString(36).slice(2)).current;
  const [drop, dropHandlers] = useDrop(async fl => {
    const ids = await filesToIds(fl);
    if (ids[0]) onPatch({ thumb: ids[0], thumbAnnotatedId: null, thumbStrokes: [] });
  });

  const displayId = a.thumbAnnotatedId || a.thumb;

  if (!a.thumb) {
    return (
      <label htmlFor={inputId}
        className={'adj-thumb drop' + (drop ? ' drag' : '')}
        title="Voeg referentiefoto toe"
        {...(dropHandlers as any)}>
        <Icon name="image" size={15} />
        <input id={inputId} type="file" accept="image/*" hidden onChange={async e => {
          if (e.target.files?.length) {
            const ids = await filesToIds(e.target.files);
            if (ids[0]) onPatch({ thumb: ids[0], thumbAnnotatedId: null, thumbStrokes: [] });
          }
          e.target.value = '';
        }} />
      </label>
    );
  }

  return (
    <>
      <div className="adj-thumb has-img" title="Referentiefoto">
        <Img imgId={displayId} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div className="adj-thumb-tools">
          <button type="button" title="Bijsnijden" onClick={() => setShowCrop(true)}><Icon name="crop" size={11} /></button>
          <button type="button" title="Tekenen" onClick={() => setShowDraw(true)}><Icon name="edit" size={11} /></button>
          <button type="button" title="Verwijderen" onClick={async () => {
            if (a.thumbAnnotatedId) await delImage(a.thumbAnnotatedId);
            await delImage(a.thumb);
            onPatch({ thumb: null, thumbAnnotatedId: null, thumbStrokes: [] });
          }}><Icon name="trash" size={11} /></button>
        </div>
      </div>
      {showCrop && (
        <CropModal imgId={a.thumb} onSave={async newId => {
          if (a.thumbAnnotatedId) await delImage(a.thumbAnnotatedId);
          await delImage(a.thumb);
          onPatch({ thumb: newId, thumbAnnotatedId: null, thumbStrokes: [] });
          setShowCrop(false);
        }} onClose={() => setShowCrop(false)} />
      )}
      {showDraw && (
        <Annotator originalId={a.thumb}
          init={{ strokes: a.thumbStrokes || [], note: '' }}
          onSave={r => {
            onPatch({ thumbAnnotatedId: r.annotatedId || null, thumbStrokes: r.strokes });
            setShowDraw(false);
          }}
          onClose={() => setShowDraw(false)} />
      )}
    </>
  );
}

function AdjRow({ a, onPatch, onDelete, dragHandlers, isDragging, isOver }: {
  a: any; onPatch: (p: any) => void; onDelete: () => void;
  dragHandlers: any; isDragging: boolean; isOver: boolean;
}) {
  return (
    <div className={'adj' + (a.done ? ' done' : '') + (isDragging ? ' adj-dragging' : '') + (isOver ? ' adj-over' : '')}
      {...dragHandlers}>
      <div className="adj-grip" title="Sleep om te herordenen" onMouseDown={e => e.currentTarget.closest<HTMLElement>('.adj')!.setAttribute('draggable', 'true')}
        onMouseUp={e => e.currentTarget.closest<HTMLElement>('.adj')!.setAttribute('draggable', 'false')}>
        <Icon name="grip2" size={14} />
      </div>
      <button type="button" className={'adj-check' + (a.done ? ' on' : '')}
        onClick={() => onPatch({ done: !a.done })} title="Mark done">
        <Icon name="check" size={13} sw={2.4} />
      </button>
      <CatChip cat={a.cat} onPick={cat => onPatch({ cat })} />
      <div className="adj-body">
        <div className="adj-text" contentEditable suppressContentEditableWarning data-ph="Describe the change…"
          onBlur={e => onPatch({ text: e.currentTarget.textContent?.trim() })}>{a.text}</div>
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
        <AdjThumb a={a} onPatch={onPatch} />
        <IconBtn name="trash" title="Delete" danger onClick={onDelete} />
      </div>
    </div>
  );
}

function AddComposer({ areas, onAdd }: { areas: string[]; onAdd: (a: any) => void }) {
  const [text, setText] = useState('');
  const [cat, setCat] = useState('paint');
  const [area, setArea] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onAdd({ id: uid(), cat, text: text.trim(), area: area.trim(), done: false, measure: '', thumb: null, thumbAnnotatedId: null, thumbStrokes: [] });
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

export function Adjustments({ loc, items, onChange }: { loc: any; items: any[]; onChange: (a: any[]) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const areas = useMemo(() => {
    const s = new Set<string>(loc.sets || []);
    items.forEach((i: any) => { if (i.area) s.add(i.area); });
    return [...s];
  }, [loc, items]);

  const patch = (id: string, p: any) => onChange(items.map(i => i.id === id ? { ...i, ...p } : i));
  const del = (id: string) => onChange(items.filter(i => i.id !== id));
  const add = (a: any) => onChange([...items, a]);

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...items];
    const fi = arr.findIndex(i => i.id === fromId);
    const ti = arr.findIndex(i => i.id === toId);
    if (fi < 0 || ti < 0) return;
    const [moved] = arr.splice(fi, 1);
    arr.splice(ti, 0, moved);
    onChange(arr);
  };

  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
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
            {list.map(a => (
              <AdjRow key={a.id} a={a}
                onPatch={p => patch(a.id, p)}
                onDelete={() => del(a.id)}
                isDragging={dragId === a.id}
                isOver={overId === a.id && dragId !== a.id}
                dragHandlers={{
                  onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = 'move'; setDragId(a.id); },
                  onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverId(a.id); },
                  onDragLeave: () => setOverId(null),
                  onDrop: (e: React.DragEvent) => { e.preventDefault(); if (dragId) reorder(dragId, a.id); setDragId(null); setOverId(null); },
                  onDragEnd: () => { setDragId(null); setOverId(null); },
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export { CatChip };
