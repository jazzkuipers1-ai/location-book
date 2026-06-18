/* ShareView — public read-only viewer for a shared location file */

function ShareView({ shareId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null); // { images: [...], idx: 0 }

  useEffect(() => {
    LB_SYNC.loadShare(shareId).then(d => {
      if (d) setData(d);
      else setErr('Share link not found or expired.');
    }).catch(() => setErr('Failed to load. Check your internet connection.'));
  }, [shareId]);

  // Keyboard nav for lightbox
  useEffect(() => {
    if (!lightbox) return;
    const h = e => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(l => l && l.idx < l.images.length - 1 ? { ...l, idx: l.idx + 1 } : l);
      if (e.key === 'ArrowLeft') setLightbox(l => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox]);

  if (err) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', color: 'var(--ink-2)', background: 'var(--page)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
        <div style={{ fontSize: 15 }}>{err}</div>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', color: 'var(--ink-3)', background: 'var(--page)' }}>
      <div className="mono" style={{ fontSize: 13 }}>Loading…</div>
    </div>
  );

  const CAT_COLORS = {
    paint: 'oklch(0.62 0.12 40)', remove: 'oklch(0.56 0.04 250)', dress: 'oklch(0.56 0.09 150)',
    build: 'oklch(0.64 0.10 70)', electric: 'oklch(0.58 0.10 245)', repair: 'oklch(0.55 0.08 330)',
    other: 'oklch(0.60 0.02 90)',
  };
  const CAT_LABELS = { paint: 'Paint', remove: 'Remove', dress: 'Dress', build: 'Build', electric: 'Electric', repair: 'Repair', other: 'Other' };

  function fmtD(d) {
    if (!d) return '';
    const [dd, mm, yy] = d.split('/').map(Number);
    const dt = new Date(yy, mm - 1, dd);
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Gather all photos for lightbox
  function allGalleryImages() {
    const out = [];
    if (!data.galleries) return out;
    Object.entries(data.galleries).forEach(([k, arr]) => {
      (arr || []).forEach(it => { if (it.url) out.push({ url: it.url, cap: it.cap, section: k }); });
    });
    return out;
  }

  const SECTION_LABELS = { photos: 'Photos', sketches: 'Sketches', measurements: 'Measurements', designs: 'Designs', moodboard: 'Moodboard' };
  const galKeys = ['photos', 'sketches', 'measurements', 'designs', 'moodboard'];

  const allImgs = allGalleryImages();

  function openLightbox(url) {
    const idx = allImgs.findIndex(i => i.url === url);
    setLightbox({ images: allImgs, idx: Math.max(0, idx) });
  }

  const adjByArea = {};
  (data.adjustments || []).forEach(adj => {
    const a = adj.area || 'General';
    (adjByArea[a] = adjByArea[a] || []).push(adj);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--page)', fontFamily: 'var(--sans)', color: 'var(--ink)' }}>

      {/* Header */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', padding: '18px 32px', display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{data.name}</div>
        {data.scheduleName && <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.05em' }}>{data.scheduleName}</div>}
        {(data.regions || []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {data.regions.map(r => (
              <span key={r} style={{ fontSize: 10.5, background: 'var(--card-2)', padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)' }} className="mono">{r}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* Cover */}
        {data.coverUrl && (
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 32, cursor: 'zoom-in', maxHeight: 380 }}
            onClick={() => setLightbox({ images: [{ url: data.coverUrl }], idx: 0 })}>
            <img src={data.coverUrl} alt="" style={{ width: '100%', height: 380, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        {/* Meta row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>

          {/* Shoot days */}
          {(data.shootDates || []).length > 0 && (
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Shoot days</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.shootDates.map((d, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'var(--card-2)', borderRadius: 8, padding: '8px 12px', minWidth: 64 }}>
                    {d.dayNumber != null && <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
                      {d.dayNumber}
                    </div>}
                    {d.date && <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 2 }}>{fmtD(d.date)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Address */}
          {data.address && (
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Address</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{data.address}</div>
              {data.mapsUrl && (
                <a href={data.mapsUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
                  Maps ↗
                </a>
              )}
            </div>
          )}

          {/* Access */}
          {data.access && (
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Access</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{data.access}</div>
            </div>
          )}

          {/* Stats */}
          {(data.sceneCount > 0 || (data.sets || []).length > 0) && (
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Details</div>
              {data.sceneCount > 0 && <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 4 }}>{data.sceneCount} scenes</div>}
              {(data.sets || []).length > 0 && <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{data.sets.join(', ')}</div>}
            </div>
          )}
        </div>

        {/* Adjustments */}
        {(data.adjustments || []).length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Adjustments</div>
            {Object.entries(adjByArea).map(([area, adjs]) => (
              <div key={area} style={{ marginBottom: 16 }}>
                <div className="mono" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>{area}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adjs.map(adj => (
                    <div key={adj.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', opacity: adj.done ? 0.55 : 1 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[adj.cat] || CAT_COLORS.other, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="mono" style={{ fontSize: 9.5, color: CAT_COLORS[adj.cat] || CAT_COLORS.other, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                            {CAT_LABELS[adj.cat] || adj.cat}
                          </span>
                          {adj.done && <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Done</span>}
                        </div>
                        <div style={{ fontSize: 13, marginTop: 2, textDecoration: adj.done ? 'line-through' : 'none', color: adj.done ? 'var(--ink-3)' : 'var(--ink)' }}>{adj.text}</div>
                        {adj.measure && <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{adj.measure}</div>}
                      </div>
                      {adj.thumbUrl && (
                        <img src={adj.thumbUrl} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in', flexShrink: 0 }}
                          onClick={() => setLightbox({ images: [{ url: adj.thumbUrl }], idx: 0 })} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gallery sections */}
        {galKeys.map(k => {
          const imgs = data.galleries && data.galleries[k];
          if (!imgs || imgs.length === 0) return null;
          return (
            <div key={k} style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>{SECTION_LABELS[k] || k}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                {imgs.map((it, i) => (
                  <div key={i} style={{ borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', aspectRatio: '4/3', background: 'var(--card-2)', border: '1px solid var(--border)' }}
                    onClick={() => openLightbox(it.url)}>
                    <img src={it.url} alt={it.cap || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Notes */}
        {data.notes && (
          <div style={{ marginBottom: 32, padding: '18px 20px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Notes</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{data.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 24, borderTop: '1px solid var(--border)' }}>
          {data.updatedAt ? 'Last updated ' + new Date(data.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <img
            src={lightbox.images[lightbox.idx].url}
            alt=""
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 6 }}
            onClick={e => e.stopPropagation()}
          />
          {/* Close */}
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 38, height: 38, cursor: 'pointer', color: '#fff', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          {/* Prev */}
          {lightbox.idx > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: l.idx - 1 })); }}
              style={{ position: 'fixed', left: 18, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', color: '#fff', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          )}
          {/* Next */}
          {lightbox.idx < lightbox.images.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: l.idx + 1 })); }}
              style={{ position: 'fixed', right: 18, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 44, height: 44, cursor: 'pointer', color: '#fff', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          )}
          {/* Counter */}
          {lightbox.images.length > 1 && (
            <div className="mono" style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.5)', fontSize: 11 }}>
              {lightbox.idx + 1} / {lightbox.images.length}
            </div>
          )}
          {/* Caption */}
          {lightbox.images[lightbox.idx].cap && (
            <div style={{ position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.7)', fontSize: 13, maxWidth: '80vw', textAlign: 'center' }}>
              {lightbox.images[lightbox.idx].cap}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.ShareView = ShareView;
