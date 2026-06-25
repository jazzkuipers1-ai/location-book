/* ShareModal — publish a location file as a public shareable link */

function ShareModal({ loc, edit, name, scheduleName, onClose, onShareIdSaved }) {
  const [stage, setStage] = useState('idle'); // idle | publishing | done | error
  const [progress, setProgress] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const existingShareId = edit && edit.shareId;

  // Collect every image ID referenced in the location edit
  function collectImageIds() {
    const ids = new Set();
    if (!edit) return [];
    if (edit.cover) ids.add(edit.cover);
    if (edit.galleries) {
      Object.values(edit.galleries).forEach(arr => {
        (arr || []).forEach(it => {
          if (it.id) ids.add(it.id);
          if (it.annotatedId) ids.add(it.annotatedId); // drawings overlay
        });
      });
    }
    if (edit.adjustments) {
      edit.adjustments.forEach(adj => { if (adj.thumb) ids.add(adj.thumb); });
    }
    return [...ids];
  }

  async function publish() {
    setStage('publishing');
    setProgress('Preparing…');
    try {
      const imageIds = collectImageIds();
      const urlMap = {};

      let uploaded = 0, missing = 0;
      for (let i = 0; i < imageIds.length; i++) {
        const id = imageIds[i];
        setProgress('Uploading image ' + (i + 1) + ' of ' + imageIds.length + '…');
        const blob = await LB.db.getBlob(id);
        if (!blob) { missing++; console.warn('[Share] no blob for', id); continue; }
        const url = await LB_SYNC.uploadImage(blob, id);
        urlMap[id] = url;
        uploaded++;
      }
      if (missing > 0) console.warn('[Share] ' + missing + ' images had no local blob and were skipped');

      setProgress('Publishing share…');

      const sid = existingShareId || ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

      // Build galleries with public URLs — prefer annotated (drawn-on) version over original
      const gals = {};
      if (edit && edit.galleries) {
        Object.entries(edit.galleries).forEach(([k, arr]) => {
          gals[k] = (arr || [])
            .map(it => ({
              cap: it.cap || '',
              note: it.note || '',
              url: (it.annotatedId && urlMap[it.annotatedId]) || urlMap[it.id] || null,
              originalUrl: urlMap[it.id] || null,
            }))
            .filter(it => it.url);
        });
      }

      // Build shoot days with overrides applied
      const shootDates = (loc && loc.shootDates || []).map(d => {
        const ov = (edit && edit.dayOverrides || {})[String(d.dayNumber)] || {};
        return {
          dayNumber: ov.dayNumber != null ? ov.dayNumber : d.dayNumber,
          date: ov.date || d.date || '',
        };
      });
      // Also include extra shoot days
      (edit && edit.extraShootDays || []).forEach(d => {
        shootDates.push({ dayNumber: null, date: d.date });
      });

      const shareData = {
        version: 1,
        name,
        scheduleName: scheduleName || '',
        address: (edit && edit.address) || '',
        mapsUrl: (edit && edit.mapsUrl) || '',
        access: (edit && edit.access) || '',
        shootDates,
        adjustments: (edit && edit.adjustments || []).map(adj => ({
          id: adj.id,
          cat: adj.cat,
          text: adj.text,
          area: adj.area || '',
          done: !!adj.done,
          measure: adj.measure || '',
          thumbUrl: adj.thumb ? (urlMap[adj.thumb] || null) : null,
        })),
        galleries: gals,
        galCategories: (edit && edit.galCategories) || null,
        coverUrl: edit && edit.cover ? (urlMap[edit.cover] || null) : null,
        notes: (edit && edit.notes) || '',
        regions: (loc && loc.regions) || [],
        sets: (loc && loc.sets) || [],
        sceneCount: (loc && loc.sceneCount) || 0,
        scenes: (() => {
          const sceneKey = s => s.manual ? ('m|' + s.id) : (s.number + '|' + (s.idx ?? ''));
          const removed = new Set((edit && edit.removedSceneKeys) || []);
          const base = (loc && loc.scenes || []).filter(s => !removed.has(sceneKey(s)));
          const extra = (edit && edit.extraScenes) || [];
          return [...base, ...extra].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
        })(),
        prepDays: (edit && edit.prepDays) || 0,
        prepTiming: (edit && edit.prepTiming) || null,
        wrapDays: (edit && edit.wrapDays) || 0,
        wrapTiming: (edit && edit.wrapTiming) || null,
        updatedAt: Date.now(),
      };

      await LB_SYNC.publishShare(sid, shareData);

      if (!existingShareId && onShareIdSaved) onShareIdSaved(sid);

      setShareUrl(LB_SYNC.getShareUrl(sid));
      setStage('done');
    } catch (e) {
      console.error('[Share] publish failed', e);
      setStage('error');
      setProgress(e.message || String(e));
    }
  }

  function copy(url) {
    navigator.clipboard.writeText(url || shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(480px, 96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Share location file</div>
            <h3>{name}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Close" />
        </div>
        <div className="modal-b">

          {stage === 'idle' && (<>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>
              Creates a public link anyone can open — photos, adjustments, shoot days and all.
              {existingShareId && ' You already have a share link — click below to update it with the latest data.'}
            </div>

            {existingShareId && (
              <div style={{ marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 5 }}>Current link</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={LB_SYNC.getShareUrl(existingShareId)}
                    style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card-2)', color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}
                    onClick={e => e.target.select()} />
                  <button className="btn sm" onClick={() => copy(LB_SYNC.getShareUrl(existingShareId))}>
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="modal-foot">
              <span />
              <button className="btn primary" onClick={publish}>
                <Icon name="arrow" size={14} />
                {existingShareId ? 'Update share link' : 'Create share link'}
              </button>
            </div>
          </>)}

          {stage === 'publishing' && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{progress}</div>
            </div>
          )}

          {stage === 'done' && (<>
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'color-mix(in srgb, var(--accent) 10%, var(--card))', borderRadius: 8 }}>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', marginBottom: 6 }}>Share link — always up to date</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input readOnly value={shareUrl}
                  style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'var(--mono)' }}
                  onClick={e => e.target.select()} />
                <button className="btn sm primary" onClick={() => copy()}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              Anyone with this link can view the location file. To update it later, open Share again and click "Update share link."
            </div>
            <div className="modal-foot">
              <span />
              <button className="btn" onClick={onClose}>Done</button>
            </div>
          </>)}

          {stage === 'error' && (<>
            <div style={{ padding: '12px 14px', background: 'color-mix(in srgb, var(--accent) 12%, var(--card))', borderRadius: 8, marginBottom: 16 }}>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--accent)' }}>Publish failed: {progress}</div>
            </div>
            <div className="modal-foot">
              <span />
              <button className="btn" onClick={() => { setStage('idle'); setProgress(''); }}>Try again</button>
            </div>
          </>)}

        </div>
      </div>
    </div>
  );
}

window.ShareModal = ShareModal;
