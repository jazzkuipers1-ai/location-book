/* App root — state, persistence, live Fuzzlecheck PDF import, routing. */

function defaultEdit() {
  return { address: '', access: '', prepDays: 0, wrapDays: 0, adjustments: [],
    galleries: { photos: [], sketches: [], measurements: [], designs: [], moodboard: [] }, notes: '' };
}

/* a single richly-filled demo location so the priority feature is visible at first run */
function demoEdits(model) {
  const find = n => model.locations.find(l => l.name.toLowerCase() === n);
  const e = {};
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

async function parsePdfText(file) {
  if (!window.pdfjsLib) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await window.pdfjsLib.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Use pdfjs hasEOL flag to reconstruct lines
    let line = '';
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    text += lines.join('\n') + '\n';
  }
  return text;
}

function buildFromText(text) {
  const parsed = LB.parseSchedule(text);
  const model = LB.buildModel(parsed);
  const firstLine = (text.split(/\r?\n/).find(l => l.trim()) || 'Shooting schedule').trim();
  model.scheduleName = firstLine;
  return model;
}

function ImportModal({ onClose, onApply, current, title }) {
  const [stage, setStage] = useState('idle'); // idle | parsing | done | error
  const [model, setModel] = useState(null);
  const [err, setErr] = useState('');
  const inp = useRef();

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') { setErr('Please choose a .pdf file.'); setStage('error'); return; }
    setStage('parsing'); setErr('');
    try {
      const text = await parsePdfText(file);
      const m = buildFromText(text);
      if (!m.locations.length) throw new Error('No scenes found. First 300 chars: ' + text.slice(0, 300).replace(/\n/g, '↵'));
      setModel(m); setStage('done');
    } catch (e) { setErr(e.message || String(e)); setStage('error'); }
  }
  const [drag, handlers] = useDrop(fl => handleFile(fl[0]));

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Fuzzlecheck → Locations</div>
            <h3>{title || 'Import shooting schedule'}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          {stage !== 'done' && (
            <div className={'big-drop' + (drag ? ' drag' : '')} {...handlers} onClick={() => inp.current.click()}>
              <div className="ic"><Icon name="upload" size={26} /></div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {stage === 'parsing' ? 'Reading schedule…' : 'Drop your .pdf export here'}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 5 }}>
                {stage === 'parsing' ? 'extracting scenes & grouping locations' : 'or click to browse'}
              </div>
              <input ref={inp} type="file" accept="application/pdf" hidden
                onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}
          {stage === 'error' && <div className="parse-log" style={{ color: 'var(--accent)' }}>{err}</div>}
          {stage === 'done' && model && (
            <div>
              <div className="parse-log">
                <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6, fontFamily: 'var(--serif)', fontSize: 16 }}>{model.scheduleName}</div>
                {model.locations.length} locations · {model.sceneTotal} scenes · {model.days.filter(d => !d.off).length} shoot days
                <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>{model.locations.slice(0, 8).map(l => l.name).join(' · ')}{model.locations.length > 8 ? ' …' : ''}</div>
              </div>
              {current && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 10 }}>This will replace the current schedule. Use "Update schedule" from the sidebar to compare changes first.</div>}
            </div>
          )}
          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Parsed locally in your browser.</span>
            {stage === 'done'
              ? <button className="btn primary" onClick={() => onApply(model)}><Icon name="check" size={15} />{current ? 'Review changes…' : 'Use this schedule'}</button>
              : <button className="btn" onClick={onClose}>Cancel</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "accent": "#9e3b2e",
  "navSort": "region",
  "sceneView": "day",
  "deckCover": false
}/*EDITMODE-END*/;

function ExportModal({ model, edits, removed, preselect, defaultCover, onClose, onExport }) {
  const visible = model.locations.filter(l => !removed.includes(l.id));
  const regionOrder = model.regions || [];
  const groups = {};
  visible.forEach(l => { const r = l.regions[0] || 'Other'; (groups[r] = groups[r] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const [sel, setSel] = useState(() => new Set(preselect && preselect.length ? preselect : visible.map(l => l.id)));
  const [inc, setInc] = useState({ cover: !!defaultCover, scenes: false, photos: true, sketches: true, measurements: true, designs: true, moodboard: true });
  const tog = k => setInc(s => ({ ...s, [k]: !s[k] }));
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleRegion = locs => {
    const all = locs.every(l => sel.has(l.id));
    setSel(s => { const n = new Set(s); locs.forEach(l => all ? n.delete(l.id) : n.add(l.id)); return n; });
  };
  const count = sel.size;
  const allOn = count === visible.length;
  const doExport = () => {
    const entries = visible.filter(l => sel.has(l.id)).map(l => ({ loc: l, edit: edits[l.id] || defaultEdit(), name: locName(l, edits) }));
    if (entries.length) onExport(entries, { overview: true, ...inc });
  };

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
            {[['cover', 'Cover page'], ['scenes', 'Scene breakdown page'], ['photos', 'Photos'], ['sketches', 'Sketches'], ['measurements', 'Measurements'], ['designs', 'Designs'], ['moodboard', 'Moodboard']].map(([k, l]) => (
              <button key={k} type="button" className={'inc-chip' + (inc[k] ? ' on' : '')} onClick={() => tog(k)}>
                <span className="chk-mini">{inc[k] && <Icon name="check" size={11} sw={2.8} />}</span>{l}
              </button>
            ))}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '8px 0 4px' }}>Every deck leads with the adjustments overview — which already includes the scene list, areas/sets, shoot days, access &amp; notes. The scene breakdown page is an optional extra full list.</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>Pick whole countries or individual locations.</span>
            <button className="btn sm ghost" onClick={() => setSel(allOn ? new Set() : new Set(visible.map(l => l.id)))}>
              {allOn ? 'Clear all' : 'Select all'}</button>
          </div>
          <div className="exp-list">
            {keys.map(region => {
              const locs = groups[region];
              const on = locs.filter(l => sel.has(l.id)).length;
              const state = on === 0 ? '' : on === locs.length ? ' on' : ' partial';
              return (
                <div className="exp-region" key={region}>
                  <div className="exp-region-h" onClick={() => toggleRegion(locs)}>
                    <span className={'chk' + state}><Icon name={state === ' partial' ? 'list' : 'check'} size={12} sw={2.4} /></span>
                    <span className="rn">{region}</span>
                    <span className="rc">{on}/{locs.length}</span>
                  </div>
                  {locs.map(l => (
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
          <div className="modal-foot">
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{count} location{count !== 1 ? 's' : ''} selected</span>
            <button className="btn primary" disabled={!count} onClick={doExport}><Icon name="download" size={15} />Export {count} deck{count !== 1 ? 's' : ''}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function combineLoc(w, l) {
  const scenes = [...w.scenes, ...l.scenes].sort((a, b) => (a.dayNumber || 99) - (b.dayNumber || 99) || a.idx - b.idx);
  const dayNums = [...new Set([...w.dayNums, ...l.dayNums])].sort((a, b) => a - b);
  const sdMap = {}; [...w.shootDates, ...l.shootDates].forEach(d => { sdMap[d.dayNumber] = d; });
  const shootDates = Object.values(sdMap).sort((a, b) => a.dayNumber - b.dayNumber);
  return { ...w, scenes, dayNums, shootDates, sceneCount: scenes.length,
    regions: [...new Set([...w.regions, ...l.regions])], sets: [...new Set([...w.sets, ...l.sets])] };
}
function combineEdit(w, l, name) {
  const g = k => [...((w.galleries && w.galleries[k]) || []), ...((l.galleries && l.galleries[k]) || [])];
  return {
    name,
    address: w.address || l.address || '',
    access: w.access || l.access || '',
    prepDays: Math.max(w.prepDays || 0, l.prepDays || 0),
    wrapDays: Math.max(w.wrapDays || 0, l.wrapDays || 0),
    adjustments: [...(w.adjustments || []), ...(l.adjustments || [])],
    galleries: { photos: g('photos'), sketches: g('sketches'), measurements: g('measurements'), designs: g('designs'), moodboard: g('moodboard') },
    cover: w.cover || l.cover || null,
    notes: [w.notes, l.notes].filter(Boolean).join('\n'),
  };
}
const normName = x => (x || '').replace(/[\u2018\u2019]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();

function CombineModal({ model, edits, removed, baseId, onClose, onConfirm }) {
  const base = model.locations.find(l => l.id === baseId);
  const baseName = base ? locName(base, edits) : '';
  const others = model.locations.filter(l => l.id !== baseId && !removed.includes(l.id));
  const regionOrder = model.regions || [];
  const [sel, setSel] = useState(new Set());
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = others.filter(l => !ql || locName(l, edits).toLowerCase().includes(ql));
  const groups = {};
  list.forEach(l => { const r = l.regions[0] || 'Other'; (groups[r] = groups[r] || []).push(l); });
  const keys = Object.keys(groups).sort((a, b) => {
    const ia = regionOrder.indexOf(a), ib = regionOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const count = sel.size;

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(560px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><div className="kicker">Combine locations</div><h3>Merge into “{baseName}”</h3></div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            Pick the location(s) that are actually the <b>same place</b> as “{baseName}”. Their scenes, adjustments, photos, prep/wrap and notes all fold into “{baseName}”. You can undo right after.
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
                {groups[region].map(l => (
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
            <button className="btn primary" disabled={!count} onClick={() => onConfirm([...sel])}><Icon name="layers" size={15} />Combine {count || ''} into “{baseName}”</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- per-project localStorage helpers ----------------------------------- */
const LS_PROJECTS = 'lb_projects_v1';
function loadProjectList() {
  try { const s = JSON.parse(localStorage.getItem(LS_PROJECTS)); return Array.isArray(s) ? s : []; } catch (e) { return []; }
}
function saveProjectList(list) {
  try { localStorage.setItem(LS_PROJECTS, JSON.stringify(list)); } catch (e) {}
}
function loadProjectState(projectId) {
  try { const s = JSON.parse(localStorage.getItem('lb_state_v2_' + projectId)); return s && s.model ? s : null; } catch (e) { return null; }
}
function saveProjectState(projectId, state) {
  try { localStorage.setItem('lb_state_v2_' + projectId, JSON.stringify(state)); } catch (e) {}
}

function isUnlocked(projectId, hash) {
  return !!hash && sessionStorage.getItem('lb_unlocked_' + projectId) === hash;
}

function ProjectApp({ projectId, onGoHome, onProjectUpdated, projectPasswordHash, onSetPassword }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [state, setState] = useState(() => {
    const saved = loadProjectState(projectId);
    if (saved) return { removed: [], ...saved };
    // Legacy migration: first-ever project may live in old flat key
    const legacy = LB.state.load();
    if (legacy && legacy.model) { saveProjectState(projectId, legacy); return { removed: [], ...legacy }; }
    const model = LB.buildModel(window.LB_SEED);
    model.scheduleName = 'The Camino';
    const edits = demoEdits(model);
    const active = model.locations.find(l => /house lotte/i.test(l.name)) || model.locations[0];
    return { model, edits, removed: [], activeId: active ? active.id : null, scheduleName: model.scheduleName };
  });
  const [view, setView] = useState('board');
  const [remoteHash, setRemoteHash] = useState(projectPasswordHash || null);

  useEffect(() => {
    LB_SYNC.getProjectPassword(projectId).then(hash => {
      if (hash) setRemoteHash(hash);
    }).catch(() => {});
  }, []);

  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showUpdateSchedule, setShowUpdateSchedule] = useState(false);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [mobileTab, setMobileTab] = useState('board'); // 'board' | 'list' | 'file'
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [combineBase, setCombineBase] = useState(null);
  const [diffPending, setDiffPending] = useState(null); // { newModel }
  const [deck, setDeck] = useState(null); // { entries, opts }
  const [toast, setToast] = useState(null);
  const [compressProgress, setCompressProgress] = useState(null); // null | { done, total }

  const handleCompressPhotos = useCallback(async () => {
    if (compressProgress) return; // already running
    setCompressProgress({ done: 0, total: 1 });
    await compressExistingPhotos(stateRef.current, (done, total) => {
      setCompressProgress({ done, total });
    });
    setCompressProgress(null);
    setToast('Foto\'s gecomprimeerd ✓');
    setTimeout(() => setToast(null), 3000);
  }, [compressProgress]);

  useEffect(() => { document.documentElement.dataset.theme = t.theme; }, [t.theme]);
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty('--accent', t.accent);
    r.setProperty('--accent-soft', 'color-mix(in srgb, ' + t.accent + ' 16%, var(--card))');
  }, [t.accent]);

  const history = useRef([]);   // past states (oldest first)
  const future = useRef([]);    // undone states (most-recently-undone first)
  const skipHistory = useRef(false); // set true for undo/redo to avoid double-push

  // Wrap setState so every real change pushes to history
  const setStateWithHistory = useCallback(updater => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistory.current) {
        history.current = [...history.current.slice(-9), prev];
        future.current = [];
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (!history.current.length) return;
    const prev = history.current[history.current.length - 1];
    history.current = history.current.slice(0, -1);
    setState(cur => { future.current = [cur, ...future.current.slice(0, 9)]; return prev; });
  }, []);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current[0];
    future.current = future.current.slice(1);
    setState(cur => { history.current = [...history.current.slice(-9), cur]; return next; });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const h = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [undo, redo]);

  // ---- Offline status ------------------------------------------------------
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // ---- Supabase sync -------------------------------------------------------
  const isFirstStateRender = useRef(true);
  const applyingRemote = useRef(false);
  const lastLocalEditAt = useRef(0);
  const lastSeenSavedAt = useRef((() => {
    const s = loadProjectState(projectId); return (s && s._savedAt) ? s._savedAt : 0;
  })());
  const lastHeartbeatSave = useRef(0);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const applyRemoteState = useCallback(incoming => {
    if (!incoming) return;
    if (incoming._clientId === LB_SYNC.CLIENT_ID) return; // our own echo
    if (incoming._savedAt && incoming._savedAt <= lastSeenSavedAt.current) return;
    if (Date.now() - lastLocalEditAt.current < 10000) return; // local edits have 10s priority
    if (incoming._savedAt) lastSeenSavedAt.current = incoming._savedAt;
    applyingRemote.current = true;
    setState(cur => ({ ...incoming, _clientId: undefined, _savedAt: undefined, activeId: cur ? cur.activeId : incoming.activeId }));
  }, []);

  const saveTimer = useRef();
  useEffect(() => {
    const fromRemote = applyingRemote.current;
    applyingRemote.current = false;

    if (isFirstStateRender.current) {
      isFirstStateRender.current = false;
      saveProjectState(projectId, state);
      LB_SYNC.loadState(projectId).then(remote => {
        if (remote && remote._savedAt && remote._savedAt > lastSeenSavedAt.current) {
          applyingRemote.current = true;
          setState(cur => ({ ...remote, _clientId: undefined, _savedAt: undefined, activeId: cur ? cur.activeId : remote.activeId }));
          lastSeenSavedAt.current = remote._savedAt;
        }
      }).catch(() => {});
      return;
    }

    if (!fromRemote) lastLocalEditAt.current = Date.now();
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveProjectState(projectId, state);
      if (!fromRemote) {
        const { activeId: _a, ...shared } = state;
        const savedAt = Date.now();
        lastSeenSavedAt.current = savedAt;
        LB_SYNC.saveState(projectId, { ...shared, _clientId: LB_SYNC.CLIENT_ID, _savedAt: savedAt })
          .catch(e => console.warn('[LB] Supabase save failed', e));
        if (onProjectUpdated) onProjectUpdated({
          scheduleName: state.model && state.model.scheduleName || '',
          locationCount: (state.model && state.model.locations || []).filter(l => !(state.removed || []).includes(l.id)).length,
          sceneCount: state.model && state.model.sceneTotal || 0,
          regions: [...new Set((state.model && state.model.locations || []).flatMap(l => l.regions))],
          updatedAt: Date.now(),
        });
      }
    }, 250);
  }, [state]);

  // Heartbeat: force-save every 5s if there are unsaved local edits
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (!s || isFirstStateRender.current) return;
      if (lastLocalEditAt.current <= lastHeartbeatSave.current) return;
      lastHeartbeatSave.current = Date.now();
      saveProjectState(projectId, s);
      const { activeId: _a, ...shared } = s;
      const savedAt = Date.now();
      lastSeenSavedAt.current = savedAt;
      LB_SYNC.saveState(projectId, { ...shared, _clientId: LB_SYNC.CLIENT_ID, _savedAt: savedAt })
        .catch(e => console.warn('[LB] Heartbeat save failed', e));
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  // On reconnect: push current state to Supabase immediately
  useEffect(() => {
    const handle = () => {
      const s = stateRef.current;
      if (!s || isFirstStateRender.current) return;
      const { activeId: _a, ...shared } = s;
      const savedAt = Date.now();
      lastSeenSavedAt.current = savedAt;
      LB_SYNC.saveState(projectId, { ...shared, _clientId: LB_SYNC.CLIENT_ID, _savedAt: savedAt }).catch(() => {});
    };
    window.addEventListener('lb_reconnect', handle);
    return () => window.removeEventListener('lb_reconnect', handle);
  }, [projectId]);

  // Realtime subscription + polling fallback
  useEffect(() => {
    const unsub = LB_SYNC.subscribe(projectId, applyRemoteState);
    const poll = setInterval(async () => {
      try {
        const remote = await LB_SYNC.loadState(projectId);
        if (remote) applyRemoteState(remote);
      } catch (e) {}
    }, 4000);
    return () => { unsub(); clearInterval(poll); };
  }, [projectId, applyRemoteState]);
  // ---- end Supabase sync ---------------------------------------------------

  useEffect(() => { if (!toast) return; const k = setTimeout(() => setToast(null), 4000); return () => clearTimeout(k); }, [toast]);

  const model = state.model;
  const removed = state.removed || [];
  const visibleLocs = model.locations.filter(l => !removed.includes(l.id));
  const activeLoc = visibleLocs.find(l => l.id === state.activeId) || visibleLocs[0];
  const edit = activeLoc ? (state.edits[activeLoc.id] || defaultEdit()) : defaultEdit();

  const patchById = useCallback((id, p) => setStateWithHistory(s => {
    const cur = s.edits[id] || defaultEdit();
    // p can be a plain object or a function (edit) => patch — use function form to avoid stale closures
    const patch = typeof p === 'function' ? p(cur) : p;
    return { ...s, edits: { ...s.edits, [id]: { ...cur, ...patch } } };
  }), [setStateWithHistory]);
  const patchActive = useCallback(p => { if (activeLoc) patchById(activeLoc.id, p); }, [activeLoc, patchById]);

  const openLoc = id => { setState(s => ({ ...s, activeId: id })); setView('file'); setMobileTab('file'); };
  const renameLoc = (id, name) => setState(s => {
    const edits0 = { ...s.edits, [id]: { ...(s.edits[id] || defaultEdit()), name } };
    const target = s.model.locations.find(l => l.id !== id && !(s.removed || []).includes(l.id) && normName(locName(l, s.edits)) === normName(name));
    if (!target) return { ...s, edits: edits0 };
    // collision → combine the two locations
    const a = s.model.locations.find(l => l.id === id), b = target;
    const winner = a.sceneCount >= b.sceneCount ? a : b;
    const loser = winner === a ? b : a;
    const merged = combineLoc(winner, loser);
    let locations = s.model.locations.filter(l => l.id !== loser.id).map(l => l.id === winner.id ? merged : l);
    locations = [...locations].sort((x, y) => y.sceneCount - x.sceneCount);
    const edits = { ...edits0, [winner.id]: combineEdit(edits0[winner.id] || defaultEdit(), edits0[loser.id] || defaultEdit(), name) };
    delete edits[loser.id];
    const prev = { model: s.model, edits: s.edits, removed: s.removed, activeId: s.activeId };
    setTimeout(() => setToast({ msg: 'Combined into “' + name + '”', undo: () => setState(p => ({ ...p, ...prev })) }), 0);
    return { ...s, model: { ...s.model, locations }, edits, removed: (s.removed || []).filter(x => x !== loser.id),
      activeId: (s.activeId === loser.id || s.activeId === id) ? winner.id : s.activeId };
  });
  const removeLoc = id => {
    setState(s => ({ ...s, removed: [...(s.removed || []), id] }));
    const nm = locName(model.locations.find(l => l.id === id), state.edits);
    setToast({ msg: 'Removed “' + nm + '”', undo: () => setState(s => ({ ...s, removed: (s.removed || []).filter(x => x !== id) })) });
    if (state.activeId === id) setView('board');
  };
  const restoreLoc = id => setState(s => ({ ...s, removed: (s.removed || []).filter(x => x !== id) }));
  const addManualLoc = loc => {
    setState(s => {
      const locations = [...s.model.locations, loc].sort((a, b) => b.sceneCount - a.sceneCount);
      return { ...s, model: { ...s.model, locations }, activeId: loc.id };
    });
    setView('file');
  };

  const mergeLocations = (baseId, otherIds) => {
    const others = (otherIds || []).filter(x => x !== baseId);
    if (!others.length) return;
    setState(s => {
      const base = s.model.locations.find(l => l.id === baseId);
      if (!base) return s;
      const prev = { model: s.model, edits: s.edits, removed: s.removed, activeId: s.activeId };
      const baseName = locName(base, s.edits);
      let merged = base;
      const edits = { ...s.edits };
      others.forEach(oid => {
        const loser = s.model.locations.find(l => l.id === oid);
        if (!loser) return;
        merged = combineLoc(merged, loser);
        edits[baseId] = combineEdit(edits[baseId] || defaultEdit(), edits[oid] || defaultEdit(), baseName);
        delete edits[oid];
      });
      let locations = s.model.locations.filter(l => !others.includes(l.id)).map(l => l.id === baseId ? merged : l);
      locations = [...locations].sort((x, y) => y.sceneCount - x.sceneCount);
      setTimeout(() => setToast({ msg: 'Combined ' + others.length + ' location' + (others.length !== 1 ? 's' : '') + ' into “' + baseName + '”', undo: () => setState(p => ({ ...p, ...prev })) }), 0);
      return { ...s, model: { ...s.model, locations }, edits, removed: (s.removed || []).filter(x => !others.includes(x)), activeId: baseId };
    });
  };
  const openCombine = id => setCombineBase(id);

  const applyImport = useCallback(m => {
    setShowImport(false);
    setState(s => ({ ...s, model: m, scheduleName: m.scheduleName, removed: [], activeId: m.locations[0] ? m.locations[0].id : null }));
    setView('board');
    setToast({ msg: 'Imported ' + m.locations.length + ' locations from ' + m.scheduleName });
  }, []);

  const applyUpdateSchedule = useCallback(m => {
    setShowUpdateSchedule(false);
    setDiffPending({ newModel: m });
  }, []);

  const quickExport = () => { if (activeLoc) setDeck({ entries: [{ loc: activeLoc, edit, name: locName(activeLoc, state.edits) }], opts: { cover: t.deckCover, overview: true, scenes: false, photos: true, sketches: true, measurements: true, designs: true, moodboard: true } }); };

  if (deck) {
    return (<>
      <Deck entries={deck.entries} scheduleName={model.scheduleName} opts={deck.opts} onClose={() => setDeck(null)} />
      {panelEl(t, setTweak)}
    </>);
  }

  const mobileTabs = [
    { id: 'board', icon: 'grid', label: 'Overview' },
    { id: 'list', icon: 'list', label: 'Locations' },
    { id: 'file', icon: 'page', label: activeLoc ? locName(activeLoc, state.edits).split(' ')[0] : 'File' },
    { id: 'export', icon: 'download', label: 'Export' },
  ];

  const handleMobileTab = tab => {
    if (tab === 'export') { setShowExport(true); return; }
    setMobileTab(tab);
    if (tab === 'board') setView('board');
    if (tab === 'file' && activeLoc) setView('file');
  };

  return (
    <div className={'app' + (sideCollapsed ? ' side-collapsed' : '')}>
      {/* Floating toggle shown when sidebar is collapsed */}
      <button className="side-toggle" onClick={() => setSideCollapsed(false)} title="Show sidebar">
        <Icon name="list" size={16} />
      </button>

      {/* Desktop sidebar */}
      <Sidebar model={model} edits={state.edits} activeId={activeLoc ? activeLoc.id : null} navSort={t.navSort}
        view={view} onOverview={() => setView('board')} removed={removed} onRestore={restoreLoc}
        onSelect={openLoc} onImport={() => setShowImport(true)} onUpdateSchedule={() => setShowUpdateSchedule(true)} onExport={() => setShowExport(true)} onPatchLoc={patchById}
        hasPassword={!!remoteHash} onSetPassword={() => setShowSetPassword(true)}
        onCollapse={() => setSideCollapsed(true)}
        onCompressPhotos={handleCompressPhotos}
        onRenameSchedule={name => setState(s => ({ ...s, model: { ...s.model, scheduleName: name }, scheduleName: name }))}
        onGoHome={onGoHome} />

      {/* Mobile locations drawer */}
      {mobileTab === 'list' && (
        <div className="mobile-drawer">
          <div className="side-head">
            <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {onGoHome && <button type="button" onClick={onGoHome} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', marginLeft: -4 }}><Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)' }} /></button>}
              <span className="dot" /><b style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 19 }}>Locations</b>
            </div>
            <div className="sched-name" style={{ marginTop: 9, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="film" size={13} />{model.scheduleName}
            </div>
          </div>
          <div className="search" style={{ margin: '12px 14px 6px', position: 'relative' }}>
            <Icon name="search" size={15} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
            <input placeholder="Search locations…" style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 7, fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '6px 10px 12px' }}>
            {model.locations.filter(l => !removed.includes(l.id)).map(l => (
              <button key={l.id} className={'loc-item' + (activeLoc && l.id === activeLoc.id ? ' active' : '')}
                onClick={() => { openLoc(l.id); }}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: '1px solid transparent', borderRadius: 9, padding: '10px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <div className={'loc-thumb' + (state.edits[l.id] && state.edits[l.id].cover ? '' : ' ph')} style={{ width: 42, height: 42, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'var(--card-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
                  {state.edits[l.id] && state.edits[l.id].cover ? <Img imgId={state.edits[l.id].cover} /> : <Icon name="image" size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: activeLoc && l.id === activeLoc.id ? 'var(--accent)' : 'inherit' }}>{locName(l, state.edits)}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{l.sceneCount} scenes · {l.dayNums.length} days</div>
                </div>
                <Icon name="chevron" size={14} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn block sm" onClick={() => setShowUpdateSchedule(true)}><Icon name="reset" size={14} />Update schedule…</button>
            <button className="btn block sm ghost" onClick={() => setShowImport(true)}><Icon name="upload" size={14} />Import schedule</button>
          </div>
        </div>
      )}

      <main className="main">
        {(view === 'board' && mobileTab !== 'list') ? (
          <Board model={model} edits={state.edits} removed={removed} onOpen={openLoc}
            onPatchLoc={patchById} onRename={renameLoc} onRemove={removeLoc} onCombine={openCombine}
            onCombineDrop={(src, tgt) => mergeLocations(tgt, [src])} onExport={() => setShowExport(true)}
            onAddLocation={() => setShowAddLocation(true)} />
        ) : (activeLoc && mobileTab !== 'list') ? (
          <>
            <div className="topbar">
              <div className="crumbs">
                {onGoHome && <span style={{ cursor: 'pointer', color: 'var(--ink-3)', marginRight: 2 }} onClick={onGoHome} title="All projects"><Icon name="grid" size={13} /></span>}
                {onGoHome && <Icon name="chevron" size={12} />}
                <span style={{ cursor: 'pointer' }} onClick={() => setView('board')}>{model.scheduleName}</span>
                <Icon name="chevron" size={12} /><span style={{ color: 'var(--ink)' }}>{locName(activeLoc, state.edits)}</span>
              </div>
              <span className="sp" />
              <button className="btn sm topbar-desktop-only" onClick={undo} style={{ opacity: history.current.length ? 1 : 0.35 }}><Icon name="undo" size={14} /></button>
              <button className="btn sm topbar-desktop-only" onClick={redo} style={{ opacity: future.current.length ? 1 : 0.35 }}><Icon name="redo" size={14} /></button>
              {compressProgress && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)', background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 99, padding: '3px 12px', flexShrink: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, animation: 'pulse 1s infinite' }} />
                  Comprimeren {compressProgress.done}/{compressProgress.total}
                </span>
              )}
              {!isOnline && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--mono)', fontSize: 10.5, color: '#c87040', background: 'color-mix(in srgb, #c87040 12%, var(--card))', border: '1px solid color-mix(in srgb, #c87040 30%, transparent)', borderRadius: 99, padding: '3px 10px', flexShrink: 0 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c87040', flexShrink: 0 }} />
                  Offline · opgeslagen lokaal
                </span>
              )}
              <button className="btn sm topbar-desktop-only" onClick={() => setShowShare(true)}><Icon name="arrow" size={14} />Share…</button>
              <button className="btn sm topbar-desktop-only" onClick={() => setShowExport(true)}><Icon name="layers" size={14} />Export…</button>
              <button className="btn sm primary topbar-desktop-only" onClick={quickExport}><Icon name="page" size={14} />Export this deck</button>
              <button className="btn sm primary" style={{ display: 'none' }} onClick={quickExport}
                ref={el => { if (el) el.style.display = window.innerWidth <= 768 ? 'inline-flex' : 'none'; }}>
                <Icon name="page" size={14} />Deck
              </button>
            </div>
            <LocationFile loc={activeLoc} edit={edit} name={locName(activeLoc, state.edits)} onPatch={patchActive}
              onRename={n => renameLoc(activeLoc.id, n)} onRemove={() => removeLoc(activeLoc.id)} onCombine={() => openCombine(activeLoc.id)}
              sceneView={t.sceneView} onExport={quickExport} />
          </>
        ) : mobileTab !== 'list' ? (
          <div className="empty"><div className="serif">No locations</div>
            <button className="btn primary" onClick={() => setShowImport(true)} style={{ marginTop: 12 }}>Import a Fuzzlecheck PDF</button></div>
        ) : null}
      </main>

      {/* Mobile bottom nav */}
      <MobileNav tabs={mobileTabs} active={mobileTab} onSelect={handleMobileTab} />
      {showAddLocation && <AddLocationModal onClose={() => setShowAddLocation(false)} onAdd={addManualLoc} />}
      {showImport && <ImportModal current={false} onClose={() => setShowImport(false)} onApply={applyImport} />}
      {showUpdateSchedule && <ImportModal current={true} title="Update shooting schedule" onClose={() => setShowUpdateSchedule(false)} onApply={applyUpdateSchedule} />}
      {showExport && <ExportModal model={model} edits={state.edits} removed={removed}
        preselect={activeLoc && view === 'file' ? [activeLoc.id] : null} defaultCover={t.deckCover}
        onClose={() => setShowExport(false)} onExport={(e, opts) => { setDeck({ entries: e, opts }); setShowExport(false); }} />}
      {combineBase && <CombineModal model={model} edits={state.edits} removed={removed} baseId={combineBase}
        onClose={() => setCombineBase(null)} onConfirm={ids => { mergeLocations(combineBase, ids); setCombineBase(null); }} />}
      {showShare && activeLoc && <ShareModal loc={activeLoc} edit={edit} name={locName(activeLoc, state.edits)} scheduleName={model.scheduleName}
        onClose={() => setShowShare(false)}
        onShareIdSaved={sid => patchActive({ shareId: sid })} />}
      {showSetPassword && <SetPasswordModal
        hasPassword={!!remoteHash}
        onClose={() => setShowSetPassword(false)}
        onSave={async action => {
          if (action.check) {
            const matches = action.check === remoteHash;
            if (!matches) return false;
            if (action.remove) {
              await LB_SYNC.removeProjectPassword(projectId);
              setRemoteHash(null);
              sessionStorage.removeItem('lb_unlocked_' + projectId);
              setShowSetPassword(false);
              return true;
            }
            return true;
          }
          if (action.newHash !== undefined) {
            await LB_SYNC.setProjectPassword(projectId, action.newHash);
            setRemoteHash(action.newHash);
            sessionStorage.setItem('lb_unlocked_' + projectId, action.newHash);
            setShowSetPassword(false);
            return true;
          }
        }}
      />}
      {diffPending && <ScheduleDiffModal
        oldModel={state.model}
        newModel={diffPending.newModel}
        edits={state.edits}
        removed={state.removed || []}
        onClose={() => setDiffPending(null)}
        onApply={result => {
          setStateWithHistory(s => ({ ...s, ...result }));
          setDiffPending(null);
          setView('board');
          const n = result.model.locations.length;
          setToast({ msg: 'Schedule updated · ' + n + ' location' + (n !== 1 ? 's' : '') });
        }}
      />}
      {toast && <div className="toast"><span>{toast.msg}</span>{toast.undo && <button onClick={() => { toast.undo(); setToast(null); }}>Undo</button>}</div>}
      {panelEl(t, setTweak)}
    </div>
  );
}

function panelEl(t, setTweak) {
  return (
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
}

function HomeRouter() {
  const [projects, setProjects] = useState(() => {
    const list = loadProjectList();
    // Legacy migration: if no projects but there's an old flat state, create a project for it
    if (list.length === 0) {
      const legacy = LB.state.load();
      if (legacy && legacy.model) {
        const id = 'proj_legacy';
        saveProjectState(id, legacy);
        const meta = {
          id, name: legacy.model.scheduleName || 'My Project',
          scheduleName: legacy.model.scheduleName || '',
          locationCount: (legacy.model.locations || []).length,
          sceneCount: legacy.model.sceneTotal || 0,
          regions: [...new Set((legacy.model.locations || []).flatMap(l => l.regions))],
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        saveProjectList([meta]);
        return [meta];
      }
    }
    return list;
  });
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [pendingUnlock, setPendingUnlock] = useState(null); // { id, name, hash }
  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState('');

  // Load projects from Supabase on mount
  useEffect(() => {
    LB_SYNC.loadProjects().then(remote => {
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
        saveProjectList(merged);
        return merged;
      });
    }).catch(() => {});
  }, []);

  const handleNewProject = async file => {
    setImporting(true); setImportErr('');
    try {
      const text = await parsePdfText(file);
      const m = buildFromText(text);
      if (!m.locations.length) throw new Error('No scenes found — is this a Fuzzlecheck schedule export?');
      const id = 'proj_' + Date.now().toString(36);
      const initialState = { model: m, edits: {}, removed: [], activeId: m.locations[0] ? m.locations[0].id : null };
      saveProjectState(id, initialState);
      const meta = {
        id, name: m.scheduleName,
        scheduleName: m.scheduleName,
        locationCount: m.locations.length,
        sceneCount: m.sceneTotal,
        regions: [...new Set(m.locations.flatMap(l => l.regions))],
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      LB_SYNC.createProject(meta).catch(() => {});
      LB_SYNC.saveState(id, { ...initialState, _clientId: LB_SYNC.CLIENT_ID, _savedAt: Date.now() }).catch(() => {});
      const newList = [...projects, meta];
      saveProjectList(newList);
      setProjects(newList);
      setActiveProjectId(id);
    } catch (e) {
      setImportErr(e.message || String(e));
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteProject = id => {
    LB_SYNC.deleteProject(id).catch(() => {});
    const newList = projects.filter(p => p.id !== id);
    saveProjectList(newList);
    setProjects(newList);
  };

  const handleProjectUpdated = (id, patch) => {
    setProjects(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...patch } : p);
      saveProjectList(next);
      return next;
    });
    LB_SYNC.updateProject(id, patch).catch(() => {});
  };

  const handleOpen = async id => {
    const proj = projects.find(p => p.id === id);
    const hash = await LB_SYNC.getProjectPassword(id).catch(() => null);
    if (hash) {
      const cached = sessionStorage.getItem('lb_unlocked_' + id);
      if (cached === hash) { setActiveProjectId(id); return; }
      setPendingUnlock({ id, name: proj ? proj.name : 'Project', hash });
    } else {
      setActiveProjectId(id);
    }
  };

  const handleUnlock = hash => {
    if (!pendingUnlock) return false;
    if (hash === pendingUnlock.hash) {
      sessionStorage.setItem('lb_unlocked_' + pendingUnlock.id, hash);
      setActiveProjectId(pendingUnlock.id);
      setPendingUnlock(null);
      return true;
    }
    return false;
  };

  const handleSetPassword = async (id, action) => {
    const proj = projects.find(p => p.id === id);
    if (action.check) {
      const matches = action.check === (proj && proj.passwordHash);
      if (!matches) return false;
      if (action.remove) {
        handleProjectUpdated(id, { passwordHash: null });
        sessionStorage.removeItem('lb_unlocked_' + id);
        return true;
      }
      return true;
    }
    if (action.newHash !== undefined) {
      handleProjectUpdated(id, { passwordHash: action.newHash });
      sessionStorage.setItem('lb_unlocked_' + id, action.newHash);
      return true;
    }
  };

  if (activeProjectId) {
    return (<>
      <ProjectApp
        key={activeProjectId}
        projectId={activeProjectId}
        onGoHome={() => setActiveProjectId(null)}
        onProjectUpdated={patch => handleProjectUpdated(activeProjectId, patch)}
        projectPasswordHash={(projects.find(p => p.id === activeProjectId) || {}).passwordHash}
        onSetPassword={null}
      />
    </>);
  }

  return (<>
    <LB_Home
      projects={projects}
      importing={importing}
      importErr={importErr}
      onOpen={handleOpen}
      onNew={handleNewProject}
      onDelete={handleDeleteProject}
      onRename={(id, name) => { handleProjectUpdated(id, { name }); }}
    />
    {pendingUnlock && <UnlockModal
      projectName={pendingUnlock.name}
      onClose={() => setPendingUnlock(null)}
      onUnlock={handleUnlock}
    />}
  </>);
}

function App() {
  const shareId = new URLSearchParams(window.location.search).get('share');
  if (shareId) return <ShareView shareId={shareId} />;
  return <HomeRouter />;
}

window.LB_App = App;
