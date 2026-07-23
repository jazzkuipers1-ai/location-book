/* ShareProjectModal — selecteer locaties en publiceer als één overzichtslink */

const CAL_COLORS_SHARE = ['#9e3b2e','#2c5f8a','#3d6b4f','#a07020','#7b4d9e','#c87040','#2a7a8a','#6b3d7a','#5a6b2a','#6b3b3b'];

function buildAgendaEvents(locations, edits) {
  const events = [];
  locations.forEach((loc, i) => {
    const edit = edits[loc.id] || {};
    const name = (edit.name || loc.name);
    const color = CAL_COLORS_SHARE[i % CAL_COLORS_SHARE.length];
    const removedDays = new Set((edit.removedShootDays || []).map(String));
    for (const d of loc.shootDates || []) {
      if (removedDays.has(String(d.dayNumber))) continue;
      const ov = (edit.dayOverrides || {})[String(d.dayNumber)] || {};
      const date = ov.date || d.date;
      if (date) events.push({ type: 'shoot', date, dayNum: ov.dayNumber != null ? ov.dayNumber : d.dayNumber, locName: name, color });
    }
    for (const d of edit.extraShootDays || []) {
      if (d.date) events.push({ type: 'shoot', date: d.date, dayNum: null, locName: name, color });
    }
    (edit.prepDates || []).forEach((date, j) => {
      if (date) events.push({ type: 'prep', date, idx: j + 1, total: edit.prepDays, locName: name, color });
    });
    (edit.wrapDates || []).forEach((date, j) => {
      if (date) events.push({ type: 'wrap', date, idx: j + 1, total: edit.wrapDays, locName: name, color });
    });
  });
  return events;
}

function ShareProjectModal({ locations, edits, scheduleName, projectShareId, projectShareSelection, onClose, onDone }) {
  // Default: previously selected, or all if first time
  const defaultSel = projectShareSelection
    ? new Set(projectShareSelection)
    : new Set(locations.map(l => l.id));

  const [selected, setSelected] = useState(defaultSel);
  const [includeAgenda, setIncludeAgenda] = useState(true);
  const [stage, setStage] = useState('idle');
  const [progress, setProgress] = useState('');
  const [projectUrl, setProjectUrl] = useState(projectShareId ? LB_SYNC.getProjectShareUrl(projectShareId) : '');
  const [copied, setCopied] = useState(false);

  function locName(loc) {
    return (edits[loc.id] || {}).name || loc.name;
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === locations.length) setSelected(new Set());
    else setSelected(new Set(locations.map(l => l.id)));
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

    const sid = edit.shareId || ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

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
      prepDays: edit.prepDays || 0, prepTiming: edit.prepTiming || null, prepDates: edit.prepDates || [],
      wrapDays: edit.wrapDays || 0, wrapTiming: edit.wrapTiming || null, wrapDates: edit.wrapDates || [],
      updatedAt: Date.now(),
    };

    await LB_SYNC.publishShare(sid, shareData);
    return { sid, coverUrl: shareData.coverUrl };
  }

  async function publish() {
    setStage('publishing');
    const projId = projectShareId || ('p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    const newShareIds = {};
    // Build result map keyed by loc.id so we can sort back at the end
    const resultMap = {};
    const toPublish = locations.filter(l => selected.has(l.id));
    const needsPublish = toPublish.filter(l => !(edits[l.id] || {}).shareId);

    // Already-published: include instantly without re-uploading
    for (const loc of toPublish) {
      const edit = edits[loc.id] || {};
      if (edit.shareId) {
        const coverUrl = edit.cover ? LB_SYNC.getImageUrl(edit.cover) : null;
        resultMap[loc.id] = { name: locName(loc), shareId: edit.shareId, coverUrl, regions: loc.regions || [], sceneCount: loc.sceneCount || 0 };
      }
    }

    // New locations: publish (upload images + create share JSON)
    for (let i = 0; i < needsPublish.length; i++) {
      const loc = needsPublish[i];
      const edit = edits[loc.id] || {};
      const name = locName(loc);
      setProgress('Publiceren ' + (i + 1) + ' / ' + needsPublish.length + ' — ' + name);
      try {
        const { sid, coverUrl } = await publishLocShare(loc, edit, name);
        newShareIds[loc.id] = sid;
        resultMap[loc.id] = { name, shareId: sid, coverUrl, regions: loc.regions || [], sceneCount: loc.sceneCount || 0 };
      } catch (e) {
        console.error('[ShareProject] failed for', loc.id, e);
      }
    }

    setProgress('Overzicht bijwerken…');
    const locEntries = toPublish.map(l => resultMap[l.id]).filter(Boolean);
    const agendaEvents = includeAgenda ? buildAgendaEvents(toPublish, edits) : null;
    const projData = {
      version: 1, name: scheduleName || 'Project', scheduleName,
      locations: locEntries, updatedAt: Date.now(),
      ...(agendaEvents ? { agenda: { events: agendaEvents } } : {}),
    };
    await LB_SYNC.publishProjectShare(projId, projData);

    onDone({ projectShareId: projId, shareIds: newShareIds, projectShareSelection: [...selected] });
    setProjectUrl(LB_SYNC.getProjectShareUrl(projId));
    setStage('done');
  }

  function copy() {
    navigator.clipboard.writeText(projectUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const selCount = selected.size;
  const allChecked = selCount === locations.length;
  const someChecked = selCount > 0 && selCount < locations.length;

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(520px, 96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Share project</div>
            <h3>{scheduleName || 'Alle locaties'}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Sluiten" />
        </div>
        <div className="modal-b">

          {stage === 'idle' && (<>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 14 }}>
              Selecteer welke locaties je wilt delen. Kijkers zien alleen de geselecteerde locaties.
              {projectShareId && ' De bestaande link blijft hetzelfde — kijkers zien de update automatisch.'}
            </div>

            {/* Select all */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--line)', marginBottom: 2 }}>
              <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                {selCount === 0 ? 'Niets geselecteerd' : selCount === locations.length ? 'Alles geselecteerd' : selCount + ' van ' + locations.length + ' geselecteerd'}
              </span>
            </div>

            {/* Location list */}
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, maxHeight: 320, overflowY: 'auto' }}>
              {locations.map(loc => {
                const edit = edits[loc.id] || {};
                const isChecked = selected.has(loc.id);
                return (
                  <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isChecked ? 'var(--card)' : 'var(--card-2)', transition: 'background .1s' }}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(loc.id)}
                      style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--accent)' }} />
                    {edit.cover
                      ? <Img imgId={edit.cover} style={{ width: 36, height: 36, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: 36, height: 36, borderRadius: 5, background: 'var(--line)', flexShrink: 0 }} />
                    }
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{locName(loc)}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{loc.sceneCount} sc</span>
                    {edit.shareId && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--accent)', flexShrink: 0 }}>✓</span>}
                  </label>
                );
              })}
            </div>

            {/* Agenda toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--line)', marginBottom: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeAgenda} onChange={e => setIncludeAgenda(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: 'var(--accent)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Agenda opnemen</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
                  Voeg een kalender toe met alle shoot-, prep- en wrap-data aan de gedeelde link
                </div>
              </div>
            </label>

            {projectShareId && (
              <div style={{ marginBottom: 14 }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 5 }}>Huidige link</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={LB_SYNC.getProjectShareUrl(projectShareId)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-2)', color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}
                    onClick={e => e.target.select()} />
                  <button className="btn sm" onClick={() => { navigator.clipboard.writeText(LB_SYNC.getProjectShareUrl(projectShareId)); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? '✓' : 'Kopieer'}
                  </button>
                </div>
              </div>
            )}

            <div className="modal-foot">
              <span />
              <button className="btn primary" onClick={publish} disabled={selCount === 0} style={{ opacity: selCount === 0 ? .5 : 1 }}>
                <Icon name="arrow" size={14} />
                {projectShareId ? 'Overzicht bijwerken' : 'Overzicht publiceren'} ({selCount})
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
              Iedereen met deze link ziet {selCount} locatie{selCount !== 1 ? 's' : ''}. Je kunt de selectie later aanpassen — de link blijft hetzelfde.
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
