/* ShareProjectModal — publish all locations and create a project overview link */

function ShareProjectModal({ locations, edits, scheduleName, projectShareId, onClose, onDone }) {
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [copied, setCopied] = useState(false);

  function locName(loc) {
    const e = edits[loc.id] || {};
    return e.name || loc.name;
  }

  async function publishLocShare(loc, edit, name) {
    const ids = new Set();
    if (edit.cover) ids.add(edit.cover);
    Object.values(edit.galleries || {}).forEach(arr =>
      (arr || []).forEach(it => { if (it.id) ids.add(it.id); if (it.annotatedId) ids.add(it.annotatedId); })
    );
    (edit.adjustments || []).forEach(adj => { if (adj.thumb) ids.add(adj.thumb); });

    const urlMap = {};
    for (const id of [...ids]) {
      const blob = await LB.db.getBlob(id);
      urlMap[id] = blob ? await LB_SYNC.uploadImage(blob, id) : LB_SYNC.getImageUrl(id);
    }

    const sid = (edit.shareId) || ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

    const gals = {};
    Object.entries(edit.galleries || {}).forEach(([k, arr]) => {
      gals[k] = (arr || []).map(it => ({
        cap: it.cap || '', note: it.note || '',
        url: (it.annotatedId && urlMap[it.annotatedId]) || urlMap[it.id] || null,
        originalUrl: urlMap[it.id] || null,
      })).filter(it => it.url);
    });

    const removedShootDays = new Set((edit.removedShootDays || []).map(String));
    const shootDates = (loc.shootDates || [])
      .filter(d => !removedShootDays.has(String(d.dayNumber)))
      .map(d => {
        const ov = (edit.dayOverrides || {})[String(d.dayNumber)] || {};
        return { dayNumber: ov.dayNumber != null ? ov.dayNumber : d.dayNumber, date: ov.date || d.date || '' };
      });
    (edit.extraShootDays || []).forEach(d => shootDates.push({ dayNumber: null, date: d.date }));

    const sceneKey = s => s.manual ? ('m|' + s.id) : (s.number + '|' + (s.idx ?? ''));
    const removed = new Set(edit.removedSceneKeys || []);

    const shareData = {
      version: 1, name, scheduleName: scheduleName || '',
      address: edit.address || '', mapsUrl: edit.mapsUrl || '', access: edit.access || '',
      shootDates,
      adjustments: (edit.adjustments || []).map(adj => ({
        id: adj.id, cat: adj.cat, text: adj.text, area: adj.area || '',
        done: !!adj.done, measure: adj.measure || '',
        thumbUrl: adj.thumb ? (urlMap[adj.thumb] || null) : null,
      })),
      galleries: gals, galCategories: edit.galCategories || null,
      coverUrl: edit.cover ? (urlMap[edit.cover] || null) : null,
      notes: edit.notes || '', regions: loc.regions || [], sets: loc.sets || [],
      sceneCount: loc.sceneCount || 0,
      scenes: (() => {
        const base = (loc.scenes || []).filter(s => !removed.has(sceneKey(s)));
        return [...base, ...(edit.extraScenes || [])].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
      })(),
      prepDays: edit.prepDays || 0, prepTiming: edit.prepTiming || null,
      wrapDays: edit.wrapDays || 0, wrapTiming: edit.wrapTiming || null,
      updatedAt: Date.now(),
    };

    await LB_SYNC.publishShare(sid, shareData);
    return { sid, coverUrl: shareData.coverUrl };
  }

  async function publish() {
    setStage('publishing');
    const projId = projectShareId || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const newShareIds = {};
    const locEntries = [];

    for (let i = 0; i < locations.length; i++) {
      const loc = locations[i];
      const edit = edits[loc.id] || {};
      const name = locName(loc);
      setProgress((i + 1) + ' / ' + locations.length + ' — ' + name);
      try {
        const { sid, coverUrl } = await publishLocShare(loc, edit, name);
        newShareIds[loc.id] = sid;
        locEntries.push({ name, shareId: sid, coverUrl, regions: loc.regions || [], sceneCount: loc.sceneCount || 0 });
      } catch (e) {
        console.error('[ShareProject] failed for', loc.id, e);
        locEntries.push({ name, shareId: null, coverUrl: null, regions: loc.regions || [], sceneCount: loc.sceneCount || 0 });
      }
    }

    setProgress('Creating project overview…');
    const projData = { version: 1, name: scheduleName || 'Project', scheduleName, locations: locEntries, updatedAt: Date.now() };
    await LB_SYNC.publishProjectShare(projId, projData);

    onDone({ projectShareId: projId, shareIds: newShareIds });
    const url = LB_SYNC.getProjectShareUrl(projId);
    setProjectUrl(url);
    setStage('done');
  }

  function copy() {
    navigator.clipboard.writeText(projectUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(500px, 96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Share project</div>
            <h3>{scheduleName || 'All locations'}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">

          {stage === 'idle' && (<>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>
              Publiceert alle {locations.length} locatie{locations.length !== 1 ? 's' : ''} en maakt één overzichtslink.
              Kijkers zien alle locaties en kunnen er makkelijk tussen navigeren.
              {projectShareId && ' De bestaande link wordt bijgewerkt met de nieuwste data.'}
            </div>

            {projectShareId && (
              <div style={{ marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 5 }}>Huidige link</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={LB_SYNC.getProjectShareUrl(projectShareId)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-2)', color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}
                    onClick={e => e.target.select()} />
                  <button className="btn sm" onClick={() => { navigator.clipboard.writeText(LB_SYNC.getProjectShareUrl(projectShareId)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {locations.slice(0, 6).map(loc => (
                <div key={loc.id} style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', width: 30, textAlign: 'right', flexShrink: 0 }}>{loc.sceneCount}sc</span>
                  <span style={{ flex: 1 }}>{locName(loc)}</span>
                  {(edits[loc.id] || {}).shareId && <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--accent)' }}>✓ gepubliceerd</span>}
                </div>
              ))}
              {locations.length > 6 && (
                <div style={{ padding: '7px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                  + {locations.length - 6} meer…
                </div>
              )}
            </div>

            <div className="modal-foot">
              <span />
              <button className="btn primary" onClick={publish}>
                <Icon name="arrow" size={14} />
                {projectShareId ? 'Overzicht bijwerken' : 'Overzicht publiceren'}
              </button>
            </div>
          </>)}

          {stage === 'publishing' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>Publiceren…</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{progress}</div>
            </div>
          )}

          {stage === 'done' && (<>
            <div style={{ marginBottom: 14, padding: '14px 16px', background: 'color-mix(in srgb, var(--accent) 10%, var(--card))', borderRadius: 10 }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', marginBottom: 6 }}>Project overzichtslink</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input readOnly value={projectUrl}
                  style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'var(--mono)' }}
                  onClick={e => e.target.select()} />
                <button className="btn sm primary" onClick={copy}>
                  {copied ? '✓ Gekopieerd' : 'Kopieer'}
                </button>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Iedereen met deze link ziet het overzicht van alle locaties en kan er doorheen bladeren.
            </div>
            <div className="modal-foot">
              <span />
              <button className="btn" onClick={onClose}>Klaar</button>
            </div>
          </>)}

        </div>
      </div>
    </div>
  );
}

window.ShareProjectModal = ShareProjectModal;
