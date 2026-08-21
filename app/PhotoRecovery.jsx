/* Photo Recovery Tool — bereikbaar via ?recover=<projectId>
   Toont foto's die in Supabase Storage staan maar niet meer in de project state zitten,
   en laat ze terugzetten naar een locatie+categorie. */

function PhotoRecovery({ projectId }) {
  const [status, setStatus] = React.useState('loading'); // loading | ready | saving | done | error
  const [msg, setMsg] = React.useState('Verbinding maken met Supabase…');
  const [orphans, setOrphans] = React.useState([]);
  const [locations, setLocations] = React.useState([]);
  const [currentState, setCurrentState] = React.useState(null);
  const [selected, setSelected] = React.useState({}); // { imgId: { locId, cat } }
  const [restored, setRestored] = React.useState(new Set());

  React.useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setMsg('Project state ophalen…');
      const projectState = await LB_SYNC.loadState(projectId);
      if (!projectState) {
        setMsg('Project niet gevonden. Controleer de project ID.');
        setStatus('error'); return;
      }

      setMsg('Alle foto\'s in storage ophalen…');
      const sb = window._sb_client;
      if (!sb) throw new Error('Supabase client niet beschikbaar');

      // List all files in images/ folder (paginated, max 1000 per call)
      let allFiles = [];
      let offset = 0;
      while (true) {
        const { data, error } = await sb.storage.from('project-images').list('images', {
          limit: 1000, offset, sortBy: { column: 'created_at', order: 'desc' }
        });
        if (error) throw error;
        if (!data || data.length === 0) break;
        allFiles = allFiles.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
      }

      setMsg('Verwijzingen vergelijken…');
      // Collect all referenced image IDs from the current project state
      const referenced = new Set();
      const edits = projectState.edits || {};
      for (const edit of Object.values(edits)) {
        if (edit.cover) referenced.add(edit.cover);
        const gal = edit.galleries || {};
        for (const items of Object.values(gal)) {
          for (const item of (items || [])) {
            if (item.id) referenced.add(item.id);
            if (item.thumb) referenced.add(item.thumb);
          }
        }
        // Also check adjustments
        for (const adj of (edit.adjustments || [])) {
          if (adj.thumb) referenced.add(adj.thumb);
        }
      }

      // Find orphan image files (in storage but not referenced in state)
      const imageFiles = allFiles.filter(f => f.name && f.name.startsWith('img_') && !f.name.endsWith('_thumb'));
      const orphanFiles = imageFiles.filter(f => !referenced.has(f.name));

      // Build location list from project state
      const model = projectState.model || {};
      const removed = new Set(projectState.removed || []);
      const locs = (model.locations || []).filter(l => !removed.has(l.id)).map(l => ({
        id: l.id,
        name: ((edits[l.id] || {}).name) || l.name || l.id,
      }));

      setCurrentState(projectState);
      setLocations(locs);
      setOrphans(orphanFiles);
      setStatus('ready');
      setMsg(orphanFiles.length === 0
        ? 'Geen verdwenen foto\'s gevonden — alles lijkt in orde.'
        : `${orphanFiles.length} foto${orphanFiles.length !== 1 ? '\'s' : ''} gevonden die niet meer gekoppeld zijn.`);
    } catch (e) {
      console.error('[Recovery]', e);
      setMsg('Fout: ' + e.message);
      setStatus('error');
    }
  }

  function setSelection(imgId, field, value) {
    setSelected(s => ({ ...s, [imgId]: { ...(s[imgId] || {}), [field]: value } }));
  }

  async function restoreSelected() {
    const toRestore = orphans.filter(f => {
      const sel = selected[f.name];
      return sel && sel.locId && sel.cat;
    });
    if (toRestore.length === 0) return;
    setStatus('saving');
    setMsg(`${toRestore.length} foto's terugzetten…`);

    try {
      let state = JSON.parse(JSON.stringify(currentState));
      const CATS = ['photos', 'sketches', 'measurements', 'designs', 'moodboard'];

      for (const f of toRestore) {
        const { locId, cat } = selected[f.name];
        if (!CATS.includes(cat)) continue;
        state.edits = state.edits || {};
        state.edits[locId] = state.edits[locId] || {
          galleries: { photos: [], sketches: [], measurements: [], designs: [], moodboard: [] },
          adjustments: [], notes: '', name: ''
        };
        state.edits[locId].galleries = state.edits[locId].galleries || {};
        state.edits[locId].galleries[cat] = state.edits[locId].galleries[cat] || [];
        // Don't add duplicate
        if (!state.edits[locId].galleries[cat].find(i => i.id === f.name)) {
          state.edits[locId].galleries[cat].push({ id: f.name, caption: '' });
        }
      }

      const savedAt = Date.now();
      await LB_SYNC.saveState(projectId, { ...state, _clientId: LB_SYNC.CLIENT_ID + '_recovery', _savedAt: savedAt });

      const restoredIds = new Set(toRestore.map(f => f.name));
      setRestored(r => new Set([...r, ...restoredIds]));
      setOrphans(o => o.filter(f => !restoredIds.has(f.name)));
      setSelected({});
      setStatus('ready');
      setMsg(`✓ ${toRestore.length} foto${toRestore.length !== 1 ? '\'s' : ''} teruggeplaatst. Herlaad de app om ze te zien.`);
    } catch (e) {
      console.error('[Recovery save]', e);
      setMsg('Opslaan mislukt: ' + e.message);
      setStatus('error');
    }
  }

  const SUPABASE_URL = 'https://jufhhmaavfolbyigdogv.supabase.co';
  const thumbUrl = id => SUPABASE_URL + '/storage/v1/render/image/public/project-images/images/' + id + '?width=200&quality=70&resize=contain';

  const pendingCount = orphans.filter(f => {
    const s = selected[f.name];
    return s && s.locId && s.cat;
  }).length;

  const CATS_LABELS = [
    ['photos', 'Foto\'s'],
    ['sketches', 'Schetsen'],
    ['measurements', 'Maten'],
    ['designs', 'Designs'],
    ['moodboard', 'Moodboard'],
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#e8e4dc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 32, height: 32, background: '#f59e0b22', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔍</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Foto's terughalen</div>
          <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace' }}>project: {projectId}</div>
        </div>
        <div style={{ flex: 1 }} />
        <a href={window.location.pathname} style={{ color: '#888', fontSize: 13, textDecoration: 'none' }}>← Terug naar app</a>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Status bar */}
        <div style={{ background: status === 'error' ? '#3b1a1a' : status === 'ready' && orphans.length === 0 ? '#1a2e1a' : '#1e2a1a', border: `1px solid ${status === 'error' ? '#7f1d1d' : '#2a3a20'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          {status === 'loading' && <div style={{ width: 14, height: 14, border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          {status === 'ready' && orphans.length === 0 && <span style={{ color: '#4ade80', fontSize: 16 }}>✓</span>}
          {status === 'error' && <span style={{ color: '#f87171', fontSize: 16 }}>✗</span>}
          {(status === 'ready' || status === 'saving' || status === 'done') && orphans.length > 0 && <span style={{ color: '#f59e0b', fontSize: 16 }}>⚠</span>}
          <span style={{ fontSize: 13, color: '#ccc' }}>{msg}</span>
        </div>

        {status === 'ready' && orphans.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
                  Selecteer voor elke foto een locatie en categorie, dan klik je op Terugzetten.
                </div>
                <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
                  {pendingCount} van {orphans.length} geselecteerd
                </div>
              </div>
              {pendingCount > 0 && (
                <button onClick={restoreSelected} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  ↩ {pendingCount} foto{pendingCount !== 1 ? '\'s' : ''} terugzetten
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {orphans.map(f => {
                const sel = selected[f.name] || {};
                const isReady = sel.locId && sel.cat;
                return (
                  <div key={f.name} style={{ background: '#1a1a1a', border: `1px solid ${isReady ? '#16a34a' : '#2a2a2a'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color .15s' }}>
                    <div style={{ height: 140, background: '#111', position: 'relative' }}>
                      <img
                        src={thumbUrl(f.name)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      {isReady && (
                        <div style={{ position: 'absolute', top: 6, right: 6, background: '#16a34a', color: '#fff', borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>✓ Klaar</div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 9.5, fontFamily: 'monospace', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <select
                        value={sel.locId || ''}
                        onChange={e => setSelection(f.name, 'locId', e.target.value)}
                        style={{ background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: '100%' }}
                      >
                        <option value="">— Kies locatie —</option>
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                      <select
                        value={sel.cat || ''}
                        onChange={e => setSelection(f.name, 'cat', e.target.value)}
                        style={{ background: '#111', color: '#ccc', border: '1px solid #333', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: '100%' }}
                      >
                        <option value="">— Kies categorie —</option>
                        {CATS_LABELS.map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {status === 'ready' && orphans.length === 0 && restored.size > 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4ade80' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{restored.size} foto{restored.size !== 1 ? '\'s' : ''} teruggeplaatst</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Herlaad de app om ze in de galerijen te zien.</div>
            <a href={window.location.pathname} style={{ background: '#16a34a', color: '#fff', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Naar de app →
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1a1a1a; }
      `}</style>
    </div>
  );
}

// Expose internal sb client for the recovery tool
(function() {
  const SUPABASE_URL = 'https://jufhhmaavfolbyigdogv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_J40bceJgtDjxEdtXhPterQ_mXommDVd';
  if (window.supabase && !window._sb_client) {
    window._sb_client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

window.PhotoRecovery = PhotoRecovery;
