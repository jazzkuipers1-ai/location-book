import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { buildModel, parseSchedule, parseScheduleV2 } from './parser';
import { LB_SEED } from './seed';
import { loadState, saveState, loadProjects, saveProjects, deleteProject, sbLoadProjects, sbCreateProject, sbUpdateProject, sbDeleteProject, sbLoadState, sbSaveState, sbPublishShare, sbLoadShare, getShareUrl } from './db';
import type { ProjectMeta } from './db';
import { Icon, IconBtn, useDrop, locName, uid } from './components';
import { Sidebar } from './Sidebar';
import { Board } from './Board';
import { LocationFile } from './LocationFile';
import { Deck } from './Deck';
import { Home } from './Home';
import { JoinModal, AccessCodeModal } from './Login';
import { TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor, useTweaks } from './TweaksPanel';
import { supabase, CLIENT_ID, isConfigured } from './supabase';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

async function parsePdfText(file: File): Promise<string> {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Group text items by Y position to reconstruct lines
    const byY: Record<number, string[]> = {};
    for (const item of content.items as any[]) {
      if (!('str' in item) || !item.str) continue;
      const y = Math.round(item.transform[5]);
      if (!byY[y]) byY[y] = [];
      byY[y].push(item.str);
    }
    // Sort Y descending (top of page first in PDF coords)
    const ys = Object.keys(byY).map(Number).sort((a, b) => b - a);
    for (const y of ys) {
      lines.push(byY[y].join(''));
    }
  }
  return lines.join('\n');
}

async function buildFromFile(file: File) {
  const text = await parsePdfText(file);
  let parsed = parseSchedule(text);
  // Fallback to column-per-line format if no scenes found
  if (!parsed.scenes.length) parsed = parseScheduleV2(text);
  const m: any = buildModel(parsed);
  m.scheduleName = (text.split(/\r?\n/).find((l: string) => l.trim()) || 'Shooting schedule').trim();
  if (!m.locations.length) throw new Error('No scenes found — is this a Fuzzlecheck schedule export?');
  return m;
}

export function defaultEdit() {
  return { address: '', access: '', prepDays: 0, wrapDays: 0, adjustments: [],
    galleries: { photos: [], sketches: [], measurements: [], designs: [], moodboard: [] }, notes: '', sceneOverrides: {} };
}

function demoEdits(model: any) {
  const find = (n: string) => model.locations.find((l: any) => l.name.toLowerCase() === n);
  const e: Record<string, any> = {};
  const lotte = find('house lotte');
  if (lotte) e[lotte.id] = { ...defaultEdit(),
    address: '14 Rue des Tilleuls, Le Puy-en-Velay',
    access: 'Courtyard parking for 2 vans · lift to 3rd floor · keys from concierge.',
    prepDays: 3, wrapDays: 1,
    adjustments: [
      { id: uid(), cat: 'remove', text: 'Clear all existing furniture, rugs and wall art', area: 'Living room', done: true, measure: '', thumb: null },
      { id: uid(), cat: 'paint', text: 'Repaint walls in warm putty grey (RAL 7044)', area: 'Living room', done: false, measure: '≈ 42 m²', thumb: null },
      { id: uid(), cat: 'electric', text: 'Swap ceiling pendant for period brass fixture', area: 'Living room', done: false, measure: '', thumb: null },
      { id: uid(), cat: 'build', text: 'Drill and mount curtain rail above the window', area: 'Living room', done: false, measure: '2.40 m wide', thumb: null },
      { id: uid(), cat: 'dress', text: 'Dress shelves with 1990s books & framed photos', area: 'Living room', done: false, measure: '', thumb: null },
      { id: uid(), cat: 'remove', text: 'Take down the modern roller blinds', area: 'Bedroom', done: false, measure: '', thumb: null },
      { id: uid(), cat: 'paint', text: 'Touch up skirting boards and door frame', area: 'Bedroom', done: false, measure: '', thumb: null },
      { id: uid(), cat: 'dress', text: 'Replace bedding with linen set + bedside lamp', area: 'Bedroom', done: false, measure: '', thumb: null },
    ] };
  return e;
}

// ---------- modals ----------

function ImportModal({ onClose, onApply, current }: any) {
  const [stage, setStage] = useState('idle');
  const [model, setModel] = useState<any>(null);
  const [err, setErr] = useState('');
  const inp = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file || file.type !== 'application/pdf') { setErr('Please choose a .pdf file.'); setStage('error'); return; }
    setStage('parsing'); setErr('');
    try { const m = await buildFromFile(file); setModel(m); setStage('done'); }
    catch (e: any) { setErr(e.message || String(e)); setStage('error'); }
  }
  const [drag, handlers] = useDrop((fl) => handleFile(fl[0]));

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="kicker">Fuzzlecheck → Locations</div><h3>Import shooting schedule</h3></div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          {stage !== 'done' && (
            <div className={'big-drop' + (drag ? ' drag' : '')} {...handlers} onClick={() => inp.current?.click()}>
              <div className="ic"><Icon name="upload" size={26} /></div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {stage === 'parsing' ? 'Reading schedule…' : 'Drop your .pdf export here'}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 5 }}>
                {stage === 'parsing' ? 'extracting scenes & grouping locations' : 'or click to browse'}
              </div>
              <input ref={inp} type="file" accept="application/pdf" hidden onChange={e => handleFile(e.target.files![0])} />
            </div>
          )}
          {stage === 'error' && <div className="parse-log" style={{ color: 'var(--accent)' }}>{err}</div>}
          {stage === 'done' && model && (
            <div>
              <div className="parse-log">
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--serif)', fontSize: 16 }}>{model.scheduleName}</div>
                {model.locations.length} locations · {model.sceneTotal} scenes · {model.days.filter((d: any) => !d.off).length} shoot days
                <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>{model.locations.slice(0, 8).map((l: any) => l.name).join(' · ')}{model.locations.length > 8 ? ' …' : ''}</div>
              </div>
              {current && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10 }}>Your existing adjustments & images are kept for any location that still appears.</div>}
            </div>
          )}
          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Parsed locally in your browser.</span>
            {stage === 'done'
              ? <button className="btn primary" onClick={() => onApply(model)}><Icon name="check" size={15} />Use this schedule</button>
              : <button className="btn" onClick={onClose}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Share viewer (read-only deck from a published share link) ------------
function ShareViewer() {
  const shareId = new URLSearchParams(window.location.search).get('share') || '';
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    sbLoadShare(shareId).then(d => { if (d) setData(d); else setErr(true); });
  }, [shareId]);
  if (err) return (
    <div className="empty" style={{ paddingTop: 120 }}>
      <div className="serif" style={{ marginBottom: 10 }}>Link niet gevonden</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Deze link bestaat niet of is verlopen.</div>
    </div>
  );
  if (!data) return <div className="empty" style={{ paddingTop: 120 }}><div className="serif">Laden…</div></div>;
  return <Deck entries={data.entries} scheduleName={data.scheduleName} opts={data.opts} onClose={() => {}} readonly />;
}

function ExportModal({ model, edits, removed, preselect, defaultCover, publishedShares, onClose, onExport, onPublish }: any) {
  const visible = model.locations.filter((l: any) => !removed.includes(l.id));
  const regionOrder = model.regions || [];
  const groups: Record<string, any[]> = {};
  visible.forEach((l: any) => { const r = l.regions[0] || 'Other'; (groups[r] = groups[r] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const [sel, setSel] = useState(() => new Set(preselect && preselect.length ? preselect : visible.map((l: any) => l.id)));
  const [inc, setInc] = useState({ toc: true, cover: !!defaultCover, scenes: false, photos: true, sketches: true, measurements: true, designs: true, moodboard: true });
  const tog = (k: string) => setInc(s => ({ ...s, [k]: !(s as any)[k] }));
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleRegion = (locs: any[]) => {
    const all = locs.every((l: any) => sel.has(l.id));
    setSel(s => { const n = new Set(s); locs.forEach((l: any) => all ? n.delete(l.id) : n.add(l.id)); return n; });
  };
  const count = sel.size;
  const allOn = count === visible.length;
  const doExport = () => {
    const entries = visible.filter((l: any) => sel.has(l.id)).map((l: any) => ({ loc: l, edit: edits[l.id] || defaultEdit(), name: locName(l, edits) }));
    if (entries.length) onExport(entries, { overview: true, ...inc });
  };

  // Publish state
  const [publishing, setPublishing] = useState<string | null>(null); // share id being updated, or 'new'
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishLabel, setPublishLabel] = useState('');

  const doPublish = async (existingId?: string) => {
    setPublishing(existingId || 'new');
    setPublishedUrl(null);
    const entries = visible.filter((l: any) => sel.has(l.id)).map((l: any) => ({ loc: l, edit: edits[l.id] || defaultEdit(), name: locName(l, edits) }));
    if (!entries.length) { setPublishing(null); return; }
    const id = await onPublish(entries, { overview: true, ...inc }, existingId, publishLabel || model.scheduleName);
    if (id) { setPublishedUrl(getShareUrl(id)); }
    setPublishing(null);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const shares: any[] = publishedShares || [];

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(600px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="kicker">Choose what to export</div><h3>Export location decks</h3></div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          <div className="inc-row">
            <span className="kicker" style={{ marginRight: 2 }}>Include in each deck</span>
            {[['toc', 'Inhoudspagina'], ['cover', 'Cover page'], ['scenes', 'Scene breakdown page'], ['photos', 'Photos'], ['sketches', 'Sketches'], ['measurements', 'Measurements'], ['designs', 'Designs'], ['moodboard', 'Moodboard']].map(([k, l]) => (
              <button key={k} type="button" className={'inc-chip' + ((inc as any)[k] ? ' on' : '')} onClick={() => tog(k)}>
                <span className="chk-mini">{(inc as any)[k] && <Icon name="check" size={11} sw={2.8} />}</span>{l}
              </button>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '8px 0 4px' }}>Every deck leads with the adjustments overview — which already includes the scene list, areas/sets, shoot days, access &amp; notes. The scene breakdown page is an optional extra full list.</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>Pick whole countries or individual locations.</span>
            <button className="btn sm ghost" onClick={() => setSel(allOn ? new Set() : new Set(visible.map((l: any) => l.id)))}>
              {allOn ? 'Clear all' : 'Select all'}</button>
          </div>
          <div className="exp-list">
            {keys.map(region => {
              const locs = groups[region];
              const on = locs.filter((l: any) => sel.has(l.id)).length;
              const state = on === 0 ? '' : on === locs.length ? ' on' : ' partial';
              return (
                <div className="exp-region" key={region}>
                  <div className="exp-region-h" onClick={() => toggleRegion(locs)}>
                    <span className={'chk' + state}><Icon name={state === ' partial' ? 'list' : 'check'} size={12} sw={2.4} /></span>
                    <span className="rn">{region}</span>
                    <span className="rc">{on}/{locs.length}</span>
                  </div>
                  {locs.map((l: any) => (
                    <div className="exp-row" key={l.id} onClick={() => toggle(l.id)}>
                      <span className={'chk' + (sel.has(l.id) ? ' on' : '')}><Icon name="check" size={12} sw={2.4} /></span>
                      <span className="nm">{locName(l, edits)}</span>
                      <span className="sc">{l.sceneCount} sc · {(edits[l.id] && edits[l.id].adjustments || []).length} adj</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Publish as link section */}
          {isConfigured && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Icon name="mappin" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>Publiceer als deelbare link</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input className="input" placeholder="Label (bijv. Week 1 locaties Croatia)…" value={publishLabel}
                  onChange={e => setPublishLabel(e.target.value)}
                  style={{ flex: 1, fontSize: 13 }} />
                <button className="btn sm primary" disabled={!count || publishing === 'new'} onClick={() => doPublish()}>
                  <Icon name="upload" size={13} />{publishing === 'new' ? 'Publiceren…' : 'Nieuwe link'}
                </button>
              </div>
              {publishedUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                  <Icon name="check" size={14} style={{ color: 'var(--good)', flexShrink: 0 }} />
                  <span className="mono" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink-2)' }}>{publishedUrl}</span>
                  <button className="btn sm" onClick={() => copyUrl(publishedUrl)}><Icon name={copied ? 'check' : 'copy'} size={13} />{copied ? 'Gekopieerd' : 'Kopieer'}</button>
                </div>
              )}
              {shares.length > 0 && (
                <div>
                  <div className="kicker" style={{ marginBottom: 6, fontSize: 10 }}>Eerder gepubliceerd</div>
                  {shares.map((sh: any) => (
                    <div key={sh.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sh.label || sh.id}</div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{new Date(sh.publishedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <button className="btn sm ghost" onClick={() => copyUrl(getShareUrl(sh.id))} title="Kopieer link"><Icon name="copy" size={13} /></button>
                      <button className="btn sm" disabled={!count || publishing === sh.id} onClick={() => doPublish(sh.id)} title="Bijwerken met huidige selectie">
                        <Icon name="upload" size={13} />{publishing === sh.id ? 'Bijwerken…' : 'Bijwerken'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{count} location{count !== 1 ? 's' : ''} selected</span>
            <button className="btn primary" disabled={!count} onClick={doExport}><Icon name="download" size={15} />Export {count} deck{count !== 1 ? 's' : ''}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function combineLoc(w: any, l: any) {
  const scenes = [...w.scenes, ...l.scenes].sort((a: any, b: any) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx);
  const dayNums = [...new Set([...w.dayNums, ...l.dayNums])].sort((a: any, b: any) => a - b);
  const sdMap: Record<number, any> = {}; [...w.shootDates, ...l.shootDates].forEach((d: any) => { sdMap[d.dayNumber] = d; });
  const shootDates = Object.values(sdMap).sort((a: any, b: any) => a.dayNumber - b.dayNumber);
  return { ...w, scenes, dayNums, shootDates, sceneCount: scenes.length,
    regions: [...new Set([...w.regions, ...l.regions])], sets: [...new Set([...w.sets, ...l.sets])] };
}
function combineEdit(w: any, l: any, name: string) {
  const g = (k: string) => [...((w.galleries && w.galleries[k]) || []), ...((l.galleries && l.galleries[k]) || [])];
  return {
    name, address: w.address || l.address || '', access: w.access || l.access || '',
    prepDays: Math.max(w.prepDays || 0, l.prepDays || 0), wrapDays: Math.max(w.wrapDays || 0, l.wrapDays || 0),
    adjustments: [...(w.adjustments || []), ...(l.adjustments || [])],
    galleries: { photos: g('photos'), sketches: g('sketches'), measurements: g('measurements'), designs: g('designs'), moodboard: g('moodboard') },
    cover: w.cover || l.cover || null, notes: [w.notes, l.notes].filter(Boolean).join('\n'),
  };
}
const normName = (x: string) => (x || '').replace(/['']/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();

function CombineModal({ model, edits, removed, baseId, onClose, onConfirm }: any) {
  const base = model.locations.find((l: any) => l.id === baseId);
  const baseName = base ? locName(base, edits) : '';
  const others = model.locations.filter((l: any) => l.id !== baseId && !removed.includes(l.id));
  const regionOrder = model.regions || [];
  const [sel, setSel] = useState(new Set<string>());
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = others.filter((l: any) => !ql || locName(l, edits).toLowerCase().includes(ql));
  const groups: Record<string, any[]> = {};
  list.forEach((l: any) => { const r = l.regions[0] || 'Other'; (groups[r] = groups[r] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const count = sel.size;

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(560px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="kicker">Combine locations</div><h3>Merge into "{baseName}"</h3></div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Pick the location(s) that are actually the <b>same place</b> as "{baseName}". Their scenes, adjustments, photos, prep/wrap and notes all fold into "{baseName}". You can undo right after.
          </div>
          <div className="search" style={{ margin: '12px 0 6px' }}>
            <Icon name="search" size={15} />
            <input placeholder="Search locations…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="exp-list">
            {keys.map(region => (
              <div className="exp-region" key={region}>
                <div className="exp-region-h" style={{ cursor: 'default' }}>
                  <span className="rn" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink-2)' }}>{region}</span>
                </div>
                {groups[region].map((l: any) => (
                  <div className="exp-row" key={l.id} onClick={() => toggle(l.id)}>
                    <span className={'chk' + (sel.has(l.id) ? ' on' : '')}><Icon name="check" size={12} sw={2.4} /></span>
                    <span className="nm">{locName(l, edits)}</span>
                    <span className="sc">{l.sceneCount} sc · {(edits[l.id] && edits[l.id].adjustments || []).length} adj</span>
                  </div>
                ))}
              </div>
            ))}
            {list.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No other locations.</div>}
          </div>
          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{count} selected</span>
            <button className="btn primary" disabled={!count} onClick={() => onConfirm([...sel])}><Icon name="layers" size={15} />Combine {count || ''} into "{baseName}"</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- per-project app ----------

const TWEAK_DEFAULTS = { theme: 'paper', accent: '#9e3b2e', navSort: 'region', sceneView: 'day', deckCover: false };

function ProjectApp({ projectId, projectMeta, onGoHome, onProjectUpdated }: { projectId: string; projectMeta?: ProjectMeta; onGoHome: () => void; onProjectUpdated: (meta: Partial<ProjectMeta>) => void }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setState] = useState<any>(() => {
    const saved = loadState(projectId);
    if (saved && saved.model) return { removed: [], ...saved };
    // demo state only for the built-in seed project
    if (projectId === 'demo') {
      const model: any = buildModel(LB_SEED as any);
      model.scheduleName = 'The Camino';
      const edits = demoEdits(model);
      const active = model.locations.find((l: any) => /house lotte/i.test(l.name)) || model.locations[0];
      return { model, edits, removed: [], activeId: active ? active.id : null, scheduleName: model.scheduleName };
    }
    return null;
  });

  const [view, setView] = useState('board');
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [combineBase, setCombineBase] = useState<string | null>(null);
  const [deck, setDeck] = useState<any>(null);
  const [toast, setToast] = useState<any>(null);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-soft', 'color-mix(in srgb, ' + t.accent + ' 16%, var(--card))');
  }, [t.accent]);

  // On first load: push local state + project meta to Supabase if not there yet
  useEffect(() => {
    if (!isConfigured || !state) return;
    sbLoadState(projectId).then(remote => {
      if (!remote && state.model) {
        const { activeId: _a, ...sharedState } = state;
        sbSaveState(projectId, { ...sharedState, _clientId: CLIENT_ID, _savedAt: Date.now() })
          .then(() => console.log('[LB] initial state pushed to Supabase'))
          .catch(e => console.warn('[LB] initial push failed', e));
      }
    });
    // Also ensure the project row exists in the projects table (so join-by-code works)
    if (projectMeta && projectMeta.accessCode) {
      supabase.from('projects').select('id').eq('id', projectId).maybeSingle().then(({ data }) => {
        if (!data) {
          sbCreateProject(projectMeta)
            .then(() => console.log('[LB] project row upserted to Supabase'))
            .catch((e: any) => console.warn('[LB] project upsert failed', e));
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isRemoteSave = useRef(false);
  const isFirstStateRender = useRef(true);
  useEffect(() => {
    if (!state) return;

    const fromRemote = applyingRemote.current;
    applyingRemote.current = false;

    // On first render the state comes from localStorage (potentially stale).
    // Never push it to Supabase — instead fetch from Supabase and apply if newer.
    // This prevents Device B opening the app from overwriting Device A's recent uploads.
    if (isFirstStateRender.current) {
      isFirstStateRender.current = false;
      saveState(state, projectId); // keep local cache fresh
      if (isConfigured) {
        sbLoadState(projectId).then(remote => {
          if (remote && remote._savedAt && remote._savedAt > lastSeenSavedAt.current) {
            applyingRemote.current = true;
            setState((cur: any) => {
              if (!cur) return remote;
              return { ...remote, _clientId: undefined, _savedAt: undefined, activeId: cur.activeId };
            });
            lastSeenSavedAt.current = remote._savedAt;
          }
        }).catch(() => {});
      }
      return;
    }

    if (!fromRemote) lastLocalEditAt.current = Date.now();
    isRemoteSave.current = fromRemote;
    clearTimeout(saveTimer.current as any);
    saveTimer.current = setTimeout(() => {
      // Always cache locally (so refresh restores latest state)
      saveState(state, projectId);
      // Only push to Supabase for LOCAL changes — remote applies must not be re-broadcast
      // with a newer timestamp, as that would overwrite the original sender's subsequent edits.
      if (isConfigured && !isRemoteSave.current) {
        const { activeId: _activeId, ...sharedState } = state;
        const savedAt = Date.now();
        lastSeenSavedAt.current = savedAt;
        const stateWithClient = { ...sharedState, _clientId: CLIENT_ID, _savedAt: savedAt };
        sbSaveState(projectId, stateWithClient).catch(e => console.warn('[LB] Supabase save failed', e));
        sbUpdateProject(projectId, {
          scheduleName: state.model?.scheduleName || '',
          locationCount: (state.model?.locations || []).filter((l: any) => !(state.removed || []).includes(l.id)).length,
          sceneCount: state.model?.sceneTotal || 0,
          regions: [...new Set((state.model?.locations || []).flatMap((l: any) => l.regions))] as string[],
          updatedAt: Date.now(),
        }).catch(() => {});
      }
      // Update local project meta
      onProjectUpdated({
        scheduleName: state.model?.scheduleName || '',
        locationCount: (state.model?.locations || []).filter((l: any) => !(state.removed || []).includes(l.id)).length,
        sceneCount: state.model?.sceneTotal || 0,
        regions: [...new Set((state.model?.locations || []).flatMap((l: any) => l.regions))] as string[],
        updatedAt: Date.now(),
      });
    }, 250);
  }, [state]);

  // Heartbeat: force-save to Supabase every 5 s so no local edits are ever lost
  const stateRef = useRef<any>(null);
  useEffect(() => { stateRef.current = state; }, [state]);
  const lastHeartbeatSave = useRef<number>(0);
  useEffect(() => {
    if (!isConfigured) return;
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s || isFirstStateRender.current) return;
      // Only push if we made a local edit more recently than the last heartbeat
      if (lastLocalEditAt.current <= lastHeartbeatSave.current) return;
      lastHeartbeatSave.current = Date.now();
      const { activeId: _a, ...shared } = s;
      const savedAt = Date.now();
      lastSeenSavedAt.current = savedAt;
      saveState(s, projectId);
      sbSaveState(projectId, { ...shared, _clientId: CLIENT_ID, _savedAt: savedAt })
        .catch(e => console.warn('[LB] Heartbeat save failed', e));
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Realtime + polling sync — receive changes from collaborators
  const lastSeenSavedAt = useRef<number>((() => {
    const saved = loadState(projectId);
    return (saved && saved._savedAt) ? saved._savedAt : 0;
  })());
  const lastLocalEditAt = useRef<number>(0);
  const applyingRemote = useRef(false); // flag so save effect doesn't treat remote applies as local edits

  const applyRemoteState = useCallback((incoming: any) => {
    if (!incoming) return;
    if (incoming._clientId === CLIENT_ID) return; // our own echo
    if (incoming._savedAt && incoming._savedAt <= lastSeenSavedAt.current) return; // already seen or older
    if (Date.now() - lastLocalEditAt.current < 10000) return; // local edits have 10s priority
    if (incoming._savedAt) lastSeenSavedAt.current = incoming._savedAt;
    applyingRemote.current = true;
    setState((cur: any) => {
      if (!cur) return incoming;
      return { ...incoming, _clientId: undefined, _savedAt: undefined, activeId: cur.activeId };
    });
  }, []);

  useEffect(() => {
    if (!isConfigured || !projectId) return;

    // Realtime via postgres_changes
    const channel = supabase
      .channel('project_state:' + projectId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_state', filter: `project_id=eq.${projectId}` },
        (payload: any) => applyRemoteState(payload.new?.state)
      )
      .subscribe((status: string) => {
        console.log('[LB] realtime status:', status);
      });

    // Polling fallback every 4s — catches updates if realtime misses them
    const poll = setInterval(async () => {
      const remote = await sbLoadState(projectId);
      if (remote) applyRemoteState(remote);
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [projectId, applyRemoteState]);

  useEffect(() => { if (!toast) return; const k = setTimeout(() => setToast(null), 4000); return () => clearTimeout(k); }, [toast]);

  if (!state) return (
    <div className="empty">
      <div className="serif">Something went wrong loading this project.</div>
      <button className="btn" onClick={onGoHome} style={{ marginTop: 12 }}>← Back to projects</button>
    </div>
  );

  const model = state.model;
  const removed = state.removed || [];
  const visibleLocs = model.locations.filter((l: any) => !removed.includes(l.id));
  const activeLoc = visibleLocs.find((l: any) => l.id === state.activeId) || visibleLocs[0];
  const edit = activeLoc ? (state.edits[activeLoc.id] || defaultEdit()) : defaultEdit();

  // Undo / redo — max 10 steps each
  const historyStack = useRef<any[]>([]);
  const futureStack = useRef<any[]>([]);
  const [histLen, setHistLen] = useState(0);
  const [futLen, setFutLen] = useState(0);

  const setStateWithHistory = useCallback((updater: any) => {
    setState((prev: any) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      historyStack.current = [...historyStack.current.slice(-9), prev];
      futureStack.current = [];
      setHistLen(historyStack.current.length);
      setFutLen(0);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (!historyStack.current.length) return;
    const prev = historyStack.current[historyStack.current.length - 1];
    historyStack.current = historyStack.current.slice(0, -1);
    setState((cur: any) => {
      futureStack.current = [cur, ...futureStack.current.slice(0, 9)];
      setHistLen(historyStack.current.length);
      setFutLen(futureStack.current.length);
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    if (!futureStack.current.length) return;
    const next = futureStack.current[0];
    futureStack.current = futureStack.current.slice(1);
    setState((cur: any) => {
      historyStack.current = [...historyStack.current.slice(-9), cur];
      setHistLen(historyStack.current.length);
      setFutLen(futureStack.current.length);
      return next;
    });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo]);

  const patchById = useCallback((id: string, p: any) => setStateWithHistory((s: any) => {
    const cur = s.edits[id] || defaultEdit();
    return { ...s, edits: { ...s.edits, [id]: { ...cur, ...p } } };
  }), [setStateWithHistory]);
  const patchActive = useCallback((p: any) => { if (activeLoc) patchById(activeLoc.id, p); }, [activeLoc, patchById]);

  // When a shoot day's date changes, propagate to all locations that share that day number
  // with the same original date (i.e. don't overwrite locations that already had a different date).
  const patchDayDateGlobal = useCallback((dayNum: string, origDate: string | null, newDate: string) => {
    setState((s: any) => {
      const locations: any[] = s.model?.locations || [];
      const newEdits = { ...s.edits };
      for (const loc of locations) {
        const hasDayNum = loc.shootDates?.some((d: any) => String(d.dayNumber) === dayNum);
        if (!hasDayNum) continue;
        const locEdit = s.edits[loc.id] || defaultEdit();
        const dayOvs = locEdit.dayOverrides || {};
        const effectiveDate = (dayOvs[dayNum] || {}).date ?? (loc.shootDates.find((d: any) => String(d.dayNumber) === dayNum)?.date ?? null);
        // Only update if the current date matches the one we're changing from
        if (effectiveDate !== origDate) continue;
        newEdits[loc.id] = { ...locEdit, dayOverrides: { ...dayOvs, [dayNum]: { ...(dayOvs[dayNum] || {}), date: newDate } } };
      }
      return { ...s, edits: newEdits };
    });
  }, []);

  const openLoc = (id: string) => { setState((s: any) => ({ ...s, activeId: id })); setView('file'); };
  const renameLoc = (id: string, name: string) => setState((s: any) => {
    const edits0 = { ...s.edits, [id]: { ...(s.edits[id] || defaultEdit()), name } };
    const target = s.model.locations.find((l: any) => l.id !== id && !(s.removed || []).includes(l.id) && normName(locName(l, s.edits)) === normName(name));
    if (!target) return { ...s, edits: edits0 };
    const a = s.model.locations.find((l: any) => l.id === id), b = target;
    const winner = a.sceneCount >= b.sceneCount ? a : b;
    const loser = winner === a ? b : a;
    const merged = combineLoc(winner, loser);
    let locations = s.model.locations.filter((l: any) => l.id !== loser.id).map((l: any) => l.id === winner.id ? merged : l);
    locations = [...locations].sort((x: any, y: any) => y.sceneCount - x.sceneCount);
    const edits = { ...edits0, [winner.id]: combineEdit(edits0[winner.id] || defaultEdit(), edits0[loser.id] || defaultEdit(), name) };
    delete edits[loser.id];
    const prev = { model: s.model, edits: s.edits, removed: s.removed, activeId: s.activeId };
    setTimeout(() => setToast({ msg: 'Combined into "' + name + '"', undo: () => setState((p: any) => ({ ...p, ...prev })) }), 0);
    return { ...s, model: { ...s.model, locations }, edits, removed: (s.removed || []).filter((x: any) => x !== loser.id),
      activeId: (s.activeId === loser.id || s.activeId === id) ? winner.id : s.activeId };
  });
  const removeLoc = (id: string) => {
    setState((s: any) => ({ ...s, removed: [...(s.removed || []), id] }));
    const nm = locName(model.locations.find((l: any) => l.id === id), state.edits);
    setToast({ msg: 'Removed "' + nm + '"', undo: () => setState((s: any) => ({ ...s, removed: (s.removed || []).filter((x: any) => x !== id) })) });
    if (state.activeId === id) setView('board');
  };
  const restoreLoc = (id: string) => setState((s: any) => ({ ...s, removed: (s.removed || []).filter((x: any) => x !== id) }));

  const mergeLocations = (baseId: string, otherIds: string[]) => {
    const others = (otherIds || []).filter(x => x !== baseId);
    if (!others.length) return;
    setState((s: any) => {
      const base = s.model.locations.find((l: any) => l.id === baseId);
      if (!base) return s;
      const prev = { model: s.model, edits: s.edits, removed: s.removed, activeId: s.activeId };
      const baseName = locName(base, s.edits);
      let merged = base;
      const edits = { ...s.edits };
      others.forEach((oid: string) => {
        const loser = s.model.locations.find((l: any) => l.id === oid);
        if (!loser) return;
        merged = combineLoc(merged, loser);
        edits[baseId] = combineEdit(edits[baseId] || defaultEdit(), edits[oid] || defaultEdit(), baseName);
        delete edits[oid];
      });
      let locations = s.model.locations.filter((l: any) => !others.includes(l.id)).map((l: any) => l.id === baseId ? merged : l);
      locations = [...locations].sort((x: any, y: any) => y.sceneCount - x.sceneCount);
      setTimeout(() => setToast({ msg: 'Combined ' + others.length + ' location' + (others.length !== 1 ? 's' : '') + ' into "' + baseName + '"', undo: () => setState((p: any) => ({ ...p, ...prev })) }), 0);
      return { ...s, model: { ...s.model, locations }, edits, removed: (s.removed || []).filter((x: any) => !others.includes(x)), activeId: baseId };
    });
  };

  const duplicateLoc = (id: string) => {
    setState((s: any) => {
      const orig = s.model.locations.find((l: any) => l.id === id);
      if (!orig) return s;
      const origEdit = s.edits[id] || defaultEdit();
      const origName = locName(orig, s.edits);
      const newId = id + '_copy_' + Date.now();
      const newLoc = { ...orig, id: newId };
      const newEdit = { ...origEdit, name: 'Copy of ' + origName };
      const locations = [...s.model.locations, newLoc];
      setTimeout(() => setToast({ msg: 'Duplicated "' + origName + '"' }), 0);
      return { ...s, model: { ...s.model, locations }, edits: { ...s.edits, [newId]: newEdit }, activeId: newId };
    });
    setView('file');
  };

  const applyImport = useCallback((m: any) => {
    setState((s: any) => ({ ...s, model: m, scheduleName: m.scheduleName, removed: [], activeId: m.locations[0] ? m.locations[0].id : null }));
    setShowImport(false); setView('board');
    setToast({ msg: 'Imported ' + m.locations.length + ' locations from ' + m.scheduleName });
  }, []);

  const quickExport = () => {
    if (activeLoc) setDeck({ entries: [{ loc: activeLoc, edit, name: locName(activeLoc, state.edits) }], opts: { cover: t.deckCover, overview: true, scenes: false, photos: true, sketches: true, measurements: true, designs: true, moodboard: true } });
  };

  const panelEl = () => (
    <TweaksPanel>
      <TweakSection label="Appearance" />
      <TweakRadio label="Theme" value={t.theme} options={['paper', 'blueprint', 'studio']} onChange={v => setTweak('theme', v)} />
      <TweakColor label="Accent" value={t.accent} options={['#9e3b2e', '#4f6f3f', '#2f5d8c', '#9a6a17', '#7a4a5e']} onChange={v => setTweak('accent', v)} />
      <TweakSection label="Navigation" />
      <TweakRadio label="Sort locations" value={t.navSort} options={['region', 'count', 'a–z']} onChange={v => setTweak('navSort', v)} />
      <TweakSection label="Location file" />
      <TweakRadio label="Scenes" value={t.sceneView} options={['by day', 'flat']} onChange={v => setTweak('sceneView', v)} />
      <TweakSection label="Export deck" />
      <TweakToggle label="Add cover page" value={t.deckCover} onChange={v => setTweak('deckCover', v)} />
    </TweaksPanel>
  );

  if (deck) return (<>
    <Deck entries={deck.entries} scheduleName={model.scheduleName} opts={deck.opts} onClose={() => setDeck(null)} />
    {panelEl()}
  </>);

  const handlePublishShare = async (entries: any[], opts: any, existingId?: string, label?: string) => {
    const id = existingId || generateAccessCode();
    const ok = await sbPublishShare(id, { version: 1, scheduleName: model.scheduleName, publishedAt: Date.now(), label, opts, entries });
    if (ok) {
      setState((s: any) => {
        const existing = (s.publishedShares || []).filter((sh: any) => sh.id !== id);
        return { ...s, publishedShares: [...existing, { id, label: label || model.scheduleName, publishedAt: Date.now() }] };
      });
      return id as string;
    }
    return null;
  };

  const closeSide = () => setSideOpen(false);

  return (
    <div className="app">
      {sideOpen && <div className="side-scrim" onClick={closeSide} />}
      <Sidebar model={model} edits={state.edits} activeId={activeLoc ? activeLoc.id : null} navSort={t.navSort}
        view={view} onOverview={() => { setView('board'); closeSide(); }} removed={removed} onRestore={restoreLoc}
        onSelect={(id: string) => { openLoc(id); closeSide(); }} onImport={() => { setShowImport(true); closeSide(); }} onExport={() => { setShowExport(true); closeSide(); }}
        onGoHome={onGoHome} className={sideOpen ? 'open' : ''} />
      <main className="main">
        {view === 'board' ? (
          <Board model={model} edits={state.edits} removed={removed} onOpen={openLoc}
            onPatchLoc={patchById} onRename={renameLoc} onRemove={removeLoc} onCombine={(id: string) => setCombineBase(id)} onDuplicate={duplicateLoc}
            onCombineDrop={(src: string, tgt: string) => mergeLocations(tgt, [src])} onExport={() => setShowExport(true)}
            onOpenSidebar={() => setSideOpen(true)} />
        ) : activeLoc ? (
          <>
            <div className="topbar">
              <button className="btn sm ghost hamburger-btn" onClick={() => setSideOpen(s => !s)} style={{ padding: '5px 7px' }} title="Menu">
                <Icon name="menu" size={18} />
              </button>
              <div className="crumbs">
                <span style={{ cursor: 'pointer' }} onClick={() => setView('board')}><Icon name="grid" size={13} /></span>
                <span style={{ cursor: 'pointer' }} onClick={() => setView('board')}>{model.scheduleName}</span>
                <Icon name="chevron" size={12} /><span style={{ color: 'var(--ink)' }}>{locName(activeLoc, state.edits)}</span>
              </div>
              <span className="sp" />
              <button className="btn sm" onClick={undo} title="Undo (⌘Z)" disabled={histLen === 0} style={{ opacity: histLen ? 1 : 0.35 }}><Icon name="undo" size={14} /></button>
              <button className="btn sm" onClick={redo} title="Redo (⌘⇧Z)" disabled={futLen === 0} style={{ opacity: futLen ? 1 : 0.35 }}><Icon name="redo" size={14} /></button>
              <button className="btn sm" onClick={() => setShowExport(true)}><Icon name="layers" size={14} />Export…</button>
              <button className="btn sm primary" onClick={quickExport}><Icon name="page" size={14} />Export this deck</button>
            </div>
            <LocationFile loc={activeLoc} edit={edit} name={locName(activeLoc, state.edits)} onPatch={patchActive}
              onRename={(n: string) => renameLoc(activeLoc.id, n)} onRemove={() => removeLoc(activeLoc.id)} onCombine={() => setCombineBase(activeLoc.id)}
              onDuplicate={() => duplicateLoc(activeLoc.id)}
              onDayDateGlobal={patchDayDateGlobal}
              sceneView={t.sceneView} onExport={quickExport} />
          </>
        ) : (
          <div className="empty"><div className="serif">No locations</div>
            <button className="btn primary" onClick={() => setShowImport(true)} style={{ marginTop: 12 }}>Import a Fuzzlecheck PDF</button></div>
        )}
      </main>
      {showImport && <ImportModal current={!!model} onClose={() => setShowImport(false)} onApply={applyImport} />}
      {showExport && <ExportModal model={model} edits={state.edits} removed={removed}
        preselect={activeLoc && view === 'file' ? [activeLoc.id] : null} defaultCover={t.deckCover}
        publishedShares={state.publishedShares || []}
        onClose={() => setShowExport(false)}
        onExport={(e: any, opts: any) => { setDeck({ entries: e, opts }); setShowExport(false); }}
        onPublish={handlePublishShare}
      />}
      {combineBase && <CombineModal model={model} edits={state.edits} removed={removed} baseId={combineBase}
        onClose={() => setCombineBase(null)} onConfirm={(ids: string[]) => { mergeLocations(combineBase, ids); setCombineBase(null); }} />}
      {toast && <div className="toast"><span>{toast.msg}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}</div>}
      {panelEl()}
    </div>
  );
}

// ---------- root: home ↔ project routing ----------

function generateAccessCode(): string {
  const words = ['DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA', 'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO', 'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY', 'YANKEE', 'ZULU'];
  const n = Math.floor(1000 + Math.random() * 9000);
  return words[Math.floor(Math.random() * words.length)] + '-' + n;
}

function AppInner() {
  const [projects, setProjects] = useState<ProjectMeta[]>(() => {
    const list = loadProjects();
    if (list.length === 0) {
      const legacy = loadState();
      if (legacy && legacy.model) {
        const id = 'demo';
        saveState(legacy, id);
        const meta: ProjectMeta = {
          id,
          name: legacy.model.scheduleName || 'The Camino',
          scheduleName: legacy.model.scheduleName || 'The Camino',
          locationCount: (legacy.model.locations || []).length,
          sceneCount: legacy.model.sceneTotal || 0,
          regions: [...new Set((legacy.model.locations || []).flatMap((l: any) => l.regions))] as string[],
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        saveProjects([meta]);
        return [meta];
      }
    }
    return list;
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [newProjectCode, setNewProjectCode] = useState<{ code: string; name: string } | null>(null);

  // Load projects from Supabase on mount (merges with local list)
  useEffect(() => {
    if (!isConfigured) return;
    sbLoadProjects().then(remote => {
      if (!remote) return;
      setProjects(prev => {
        const localIds = new Set(prev.map(p => p.id));
        const merged = [...prev];
        for (const r of remote) {
          if (!localIds.has(r.id)) merged.push(r);
          else {
            const idx = merged.findIndex(p => p.id === r.id);
            if (idx >= 0 && r.updatedAt > merged[idx].updatedAt) merged[idx] = r;
          }
        }
        saveProjects(merged);
        return merged;
      });
    });
  }, []);

  const handleNewProject = async (file: File) => {
    setImporting(true); setImportErr('');
    try {
      const m = await buildFromFile(file);
      const id = 'proj_' + Date.now().toString(36);
      const accessCode = generateAccessCode();
      const initialState = { model: m, edits: {}, removed: [], activeId: m.locations[0]?.id || null, scheduleName: m.scheduleName };
      saveState(initialState, id);
      const meta: ProjectMeta = {
        id, accessCode,
        name: m.scheduleName,
        scheduleName: m.scheduleName,
        locationCount: m.locations.length,
        sceneCount: m.sceneTotal,
        regions: [...new Set(m.locations.flatMap((l: any) => l.regions))] as string[],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      if (isConfigured) {
        await sbCreateProject(meta);
        await sbSaveState(id, initialState);
      }
      const newList = [...projects, meta];
      saveProjects(newList);
      setProjects(newList);
      setActiveProjectId(id);
      if (isConfigured) setNewProjectCode({ code: accessCode, name: m.scheduleName });
    } catch (e: any) {
      setImportErr(e.message || String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleJoin = async (project: ProjectMeta) => {
    setShowJoin(false);
    // Load state from Supabase and cache locally
    const remoteState = await sbLoadState(project.id);
    if (remoteState) saveState(remoteState, project.id);
    // Add to local project list if not already there
    setProjects(prev => {
      if (prev.find(p => p.id === project.id)) return prev;
      const next = [...prev, project];
      saveProjects(next);
      return next;
    });
    setActiveProjectId(project.id);
  };

  const handleDeleteProject = async (id: string) => {
    if (isConfigured) sbDeleteProject(id).catch(() => {});
    deleteProject(id);
    setProjects(projects.filter(p => p.id !== id));
  };

  const handleProjectUpdated = (id: string, patch: Partial<ProjectMeta>) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      saveProjects(next);
      return next;
    });
  };

  if (activeProjectId) {
    return (
      <>
        <ProjectApp
          key={activeProjectId}
          projectId={activeProjectId}
          projectMeta={projects.find(p => p.id === activeProjectId)}
          onGoHome={() => setActiveProjectId(null)}
          onProjectUpdated={(patch) => handleProjectUpdated(activeProjectId, patch)}
        />
        {newProjectCode && (
          <AccessCodeModal code={newProjectCode.code} projectName={newProjectCode.name} onClose={() => setNewProjectCode(null)} />
        )}
      </>
    );
  }

  return (
    <>
      <Home
        projects={projects}
        onOpen={id => {
          // If joining from Supabase, pre-load latest state
          if (isConfigured) {
            sbLoadState(id).then(s => { if (s) saveState(s, id); });
          }
          setActiveProjectId(id);
        }}
        onNew={handleNewProject}
        onDelete={handleDeleteProject}
        onJoin={() => setShowJoin(true)}
      />
      {showJoin && <JoinModal onJoin={handleJoin} onClose={() => setShowJoin(false)} />}
      {newProjectCode && (
        <AccessCodeModal code={newProjectCode.code} projectName={newProjectCode.name} onClose={() => setNewProjectCode(null)} />
      )}
      {importing && (
        <div className="scrim">
          <div className="modal" style={{ textAlign: 'center', padding: 40 }}>
            <div className="mono" style={{ color: 'var(--ink-2)', fontSize: 13 }}>Parsing schedule…</div>
          </div>
        </div>
      )}
      {importErr && (
        <div className="scrim" onMouseDown={() => setImportErr('')}>
          <div className="modal">
            <div className="modal-h"><h3>Could not import</h3></div>
            <div className="modal-b">
              <div style={{ color: 'var(--accent)', fontSize: 13 }}>{importErr}</div>
              <div className="modal-foot"><button className="btn" onClick={() => setImportErr('')}>Close</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function App() {
  const shareId = new URLSearchParams(window.location.search).get('share');
  if (shareId) return <ShareViewer />;
  return <AppInner />;
}
