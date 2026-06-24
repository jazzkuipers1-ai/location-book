/* ShareView — public read-only viewer, styled to match the PDF deck export */

const SV_CAT_COLORS = {
  slate: '#6b7a8d', rust: '#9e3b2e', forest: '#3d6b4f', gold: '#a07020',
  ocean: '#2c5f8a', plum: '#6b3d7a', terra: '#8a5a35', steel: '#3d5a6b',
};

const ADJ_COLORS = {
  paint: '#b36a2a', remove: '#5a6f8a', dress: '#3d6b4f',
  build: '#8a7020', electric: '#2c5f8a', repair: '#6b3d7a', other: '#6b7a8d',
};
const ADJ_LABELS = { paint: 'Paint', remove: 'Remove', dress: 'Dress', build: 'Build', electric: 'Electric', repair: 'Repair', other: 'Other' };

function SV_Kicker({ children, color }) {
  return (
    <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: color || 'var(--ink-2)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function SV_Section({ title, count, color, children }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid ' + (color || '#d9d0bd'), paddingBottom: 10, marginBottom: 18 }}>
        {color && <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />}
        <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: color || 'var(--ink)' }}>{title}</span>
        {count != null && <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 2 }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function ShareView({ shareId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    LB_SYNC.loadShare(shareId).then(d => {
      if (d) setData(d);
      else setErr('Share link not found or expired.');
    }).catch(() => setErr('Failed to load. Check your internet connection.'));
  }, [shareId]);

  useEffect(() => {
    if (!lightbox) return;
    const h = e => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight') setLightbox(l => l && l.idx < l.images.length - 1 ? { ...l, idx: l.idx + 1 } : l);
      if (e.key === 'ArrowLeft')  setLightbox(l => l && l.idx > 0 ? { ...l, idx: l.idx - 1 } : l);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox]);

  if (err) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
        <div style={{ fontSize: 15, fontFamily: 'var(--mono)' }}>{err}</div>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>
    </div>
  );

  // Resolve gallery categories — use saved custom cats or fallback to 'photos'
  const galCats = data.galCategories && data.galCategories.length
    ? data.galCategories
    : [{ id: 'photos', label: 'Photos', colorId: 'slate' }];

  // Collect all images across all categories for lightbox
  const allImgs = [];
  galCats.forEach(cat => {
    const imgs = data.galleries && data.galleries[cat.id];
    if (imgs) imgs.forEach(it => allImgs.push({ ...it, catLabel: cat.label }));
  });

  function openLightbox(url) {
    const idx = allImgs.findIndex(i => i.url === url);
    setLightbox({ images: allImgs, idx: Math.max(0, idx) });
  }

  const adjByArea = {};
  (data.adjustments || []).forEach(adj => {
    const a = adj.area || 'General';
    (adjByArea[a] = adjByArea[a] || []).push(adj);
  });

  function fmtD(d) {
    if (!d) return '';
    const [dd, mm, yy] = d.split('/').map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', fontFamily: 'var(--ui)', color: 'var(--ink)' }}>

      {/* Cover banner */}
      {data.coverUrl && (
        <div style={{ width: '100%', height: 340, overflow: 'hidden', cursor: 'zoom-in' }}
          onClick={() => setLightbox({ images: [{ url: data.coverUrl }], idx: 0 })}>
          <img src={data.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Title bar */}
      <div style={{ background: 'var(--card)', borderBottom: '2px solid var(--ink)', padding: '20px 40px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          {data.scheduleName && <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 4 }}>{data.scheduleName}</div>}
          <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 600, lineHeight: 1, letterSpacing: '-.01em' }}>{data.name}</div>
        </div>
        <span style={{ flex: 1 }} />
        {(data.regions || []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.regions.map(r => (
              <span key={r} style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--card-2)', padding: '3px 10px', borderRadius: 99, border: '1px solid var(--line)' }}>{r}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 32px 80px' }}>

        {/* Stats row */}
        {(data.shootDates || data.address || data.access || data.sceneCount) && (
          <div style={{ display: 'flex', gap: 1, background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 40, flexWrap: 'wrap' }}>
            {[
              ['Scenes', data.sceneCount || 0],
              ['Shoot', (data.shootDates || []).length],
              ['Prep', data.prepDays || 0, data.prepTiming === 'before_shooting' ? 'before shooting' : data.prepTiming === 'after_wrap' ? 'after wrap' : null],
              ['Wrap', data.wrapDays || 0, data.wrapTiming === 'after_wrap' ? 'after wrap' : data.wrapTiming === 'before_shooting' ? 'before shooting' : null],
            ].map(([k, v, sub]) => (
              <div key={k} style={{ background: 'var(--card)', padding: '16px 24px', textAlign: 'center', flex: '1 1 100px', minWidth: 100 }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 34, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' }}>{v}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginTop: 6 }}>{k}</div>
                {sub && <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
              </div>
            ))}
            {data.address && (
              <div style={{ background: 'var(--card)', padding: '16px 24px', flex: '2 1 200px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 6 }}>Address</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{data.address}</div>
                {data.mapsUrl && <a href={data.mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', textDecoration: 'underline', marginTop: 6, display: 'inline-block' }}>Maps ↗</a>}
              </div>
            )}
            {data.access && (
              <div style={{ background: 'var(--card)', padding: '16px 24px', flex: '2 1 200px' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-2)', marginBottom: 6 }}>Access</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{data.access}</div>
              </div>
            )}
          </div>
        )}

        {/* Scenes */}
        {(data.scenes || []).length > 0 && (
          <SV_Section title="Scenes" count={data.scenes.length}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.scenes.map((sc, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '60px 64px 1fr', gap: 12, alignItems: 'center', padding: '10px 14px', background: 'var(--card)', borderRadius: 9, border: '1px solid var(--line)', fontSize: 13 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                    {sc.number || '—'}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                    {[sc.type, sc.tod].filter(Boolean).join('/')}
                  </div>
                  <div style={{ color: 'var(--ink)', lineHeight: 1.4 }}>{sc.synopsis || ''}</div>
                </div>
              ))}
            </div>
          </SV_Section>
        )}

        {/* Shoot days */}
        {(data.shootDates || []).length > 0 && (
          <SV_Section title="Shoot days" count={(data.shootDates || []).length + ' days'}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {data.shootDates.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', background: 'var(--card)', borderRadius: 10, padding: '12px 18px', border: '1px solid var(--line)', minWidth: 72 }}>
                  {d.dayNumber != null && <div style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{d.dayNumber}</div>}
                  {d.date && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)', marginTop: 4 }}>{fmtD(d.date)}</div>}
                </div>
              ))}
            </div>
          </SV_Section>
        )}

        {/* Adjustments */}
        {(data.adjustments || []).length > 0 && (
          <SV_Section title="Adjustments" count={(data.adjustments || []).length}>
            {Object.entries(adjByArea).map(([area, adjs]) => (
              <div key={area} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>{area}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {adjs.map(adj => (
                    <div key={adj.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '11px 14px', background: 'var(--card)', borderRadius: 9, border: '1px solid var(--line)', opacity: adj.done ? 0.5 : 1 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: ADJ_COLORS[adj.cat] || ADJ_COLORS.other, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600, color: ADJ_COLORS[adj.cat] || ADJ_COLORS.other, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                          {ADJ_LABELS[adj.cat] || adj.cat}{adj.done ? '  ·  Done' : ''}
                        </div>
                        <div style={{ fontSize: 13, textDecoration: adj.done ? 'line-through' : 'none', color: adj.done ? 'var(--ink-3)' : 'var(--ink)' }}>{adj.text}</div>
                        {adj.measure && <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{adj.measure}</div>}
                      </div>
                      {adj.thumbUrl && (
                        <img src={adj.thumbUrl} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 7, cursor: 'zoom-in', flexShrink: 0, border: '1px solid var(--line)' }}
                          onClick={() => setLightbox({ images: [{ url: adj.thumbUrl }], idx: 0 })} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </SV_Section>
        )}

        {/* Gallery sections — one per category with category color */}
        {galCats.map(cat => {
          const imgs = data.galleries && data.galleries[cat.id];
          if (!imgs || imgs.length === 0) return null;
          const color = SV_CAT_COLORS[cat.colorId] || SV_CAT_COLORS.slate;
          const cols = Math.min(imgs.length, 3);
          return (
            <SV_Section key={cat.id} title={cat.label} count={imgs.length + ' image' + (imgs.length !== 1 ? 's' : '')} color={color}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', 1fr)', gap: 14 }}>
                {imgs.map((it, i) => (
                  <div key={i} style={{ border: '2px solid ' + color, borderRadius: 12, overflow: 'hidden', background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ aspectRatio: '4/3', overflow: 'hidden', cursor: 'zoom-in', background: 'var(--card-2)' }}
                      onClick={() => openLightbox(it.url)}>
                      <img src={it.url} alt={it.cap || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    {(it.cap || it.note) && (
                      <div style={{ padding: '10px 13px', borderTop: '2px solid ' + color }}>
                        {it.cap && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{it.cap}</div>}
                        {it.note && <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink-2)', marginTop: it.cap ? 3 : 0, whiteSpace: 'pre-wrap' }}>{it.note}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SV_Section>
          );
        })}

        {/* Fixed sections — only shown when non-empty */}
        {[
          { id: 'sketches',     label: 'Sketches' },
          { id: 'measurements', label: 'Measurements' },
          { id: 'designs',      label: 'Designs' },
          { id: 'moodboard',    label: 'Moodboard' },
        ].map(sec => {
          const imgs = data.galleries && data.galleries[sec.id];
          if (!imgs || imgs.length === 0) return null;
          const cols = Math.min(imgs.length, 3);
          return (
            <SV_Section key={sec.id} title={sec.label} count={imgs.length + ' image' + (imgs.length !== 1 ? 's' : '')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + cols + ', 1fr)', gap: 14 }}>
                {imgs.map((it, i) => (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ aspectRatio: '4/3', overflow: 'hidden', cursor: 'zoom-in', background: 'var(--card-2)' }}
                      onClick={() => setLightbox({ images: imgs, idx: i })}>
                      <img src={it.url} alt={it.cap || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                    {(it.cap || it.note) && (
                      <div style={{ padding: '10px 13px', borderTop: '1px solid var(--line)' }}>
                        {it.cap && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>{it.cap}</div>}
                        {it.note && <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--ink-2)', marginTop: it.cap ? 3 : 0, whiteSpace: 'pre-wrap' }}>{it.note}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SV_Section>
          );
        })}

        {/* Notes */}
        {data.notes && data.notes.trim() && (
          <SV_Section title="Notes">
            <div style={{ background: 'var(--card)', borderRadius: 10, padding: '18px 20px', border: '1px solid var(--line)', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
              {data.notes}
            </div>
          </SV_Section>
        )}

        {/* Footer */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textAlign: 'center', paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          {data.scheduleName} — {data.name}
          {data.updatedAt ? '  ·  ' + new Date(data.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.93)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
            <img src={lightbox.images[lightbox.idx].url} alt=""
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
            {(lightbox.images[lightbox.idx].cap || lightbox.images[lightbox.idx].note) && (
              <div style={{ textAlign: 'center', maxWidth: 600 }}>
                {lightbox.images[lightbox.idx].cap && <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.9)', marginBottom: 4 }}>{lightbox.images[lightbox.idx].cap}</div>}
                {lightbox.images[lightbox.idx].note && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{lightbox.images[lightbox.idx].note}</div>}
              </div>
            )}
          </div>
          <button onClick={() => setLightbox(null)}
            style={{ position: 'fixed', top: 18, right: 18, background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          {lightbox.idx > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: l.idx - 1 })); }}
              style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 46, height: 46, cursor: 'pointer', color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          )}
          {lightbox.idx < lightbox.images.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: l.idx + 1 })); }}
              style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 99, width: 46, height: 46, cursor: 'pointer', color: '#fff', fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          )}
          {lightbox.images.length > 1 && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: 11, color: 'rgba(255,255,255,.45)' }}>
              {lightbox.idx + 1} / {lightbox.images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

window.ShareView = ShareView;
