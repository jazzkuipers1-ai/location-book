/* Home — project overview page */

function fmtTs(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProjectCard({ project, onOpen, onDelete, onRename }) {
  const locked = !!project.passwordHash;
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const commitRename = () => {
    setEditing(false);
    if (draft.trim() && onRename) onRename(draft.trim());
  };
  return (
    <div className="card" style={{ borderRadius: 14, overflow: 'hidden', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(40,32,18,.06), 0 12px 36px rgba(40,32,18,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
      <div style={{ height: 5, background: 'var(--accent)', opacity: .7 }} />
      <div style={{ padding: '18px 20px 16px', cursor: 'pointer' }} onClick={!editing ? onOpen : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {fmtTs(project.updatedAt)}
            {locked && <span title="Password protected" style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center' }}><Icon name="lock" size={11} /></span>}
          </div>
        </div>
        <div className="serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginBottom: 4, color: 'var(--ink)' }}>
          {editing ? (
            <input autoFocus value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraft(project.name); } }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1.5px solid var(--accent)', outline: 'none', fontSize: 'inherit', fontFamily: 'var(--serif)', fontWeight: 600, color: 'inherit', padding: '0 2px' }} />
          ) : project.name}
        </div>
        {project.scheduleName && project.scheduleName !== project.name && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>{project.scheduleName}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {(project.regions || []).slice(0, 3).map(r => (
            <span key={r} className="mono" style={{ fontSize: 10, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 20, padding: '2px 8px', color: 'var(--ink-2)' }}>{r}</span>
          ))}
          {(project.regions || []).length > 3 && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', padding: '2px 4px' }}>+{project.regions.length - 3} more</span>}
        </div>
        <div style={{ display: 'flex', gap: 18, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{project.locationCount}</div>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>locations</div>
          </div>
          <div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' }}>{project.sceneCount}</div>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>scenes</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn sm ghost" style={{ color: 'var(--ink-3)' }} onClick={e => { e.stopPropagation(); setDraft(project.name); setEditing(true); }}>
          <Icon name="edit" size={13} />Rename
        </button>
        {confirm ? (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Delete project?</span>
            <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={e => { e.stopPropagation(); onDelete(); }}>Delete</button>
            <button className="btn sm" onClick={e => { e.stopPropagation(); setConfirm(false); }}>Cancel</button>
          </span>
        ) : (
          <button className="btn sm ghost" style={{ color: 'var(--ink-3)' }} onClick={e => { e.stopPropagation(); setConfirm(true); }}>
            <Icon name="trash" size={13} />Delete
          </button>
        )}
      </div>
    </div>
  );
}

function LB_Home({ projects, importing, importErr, onOpen, onNew, onDelete, onRename }) {
  const [drag, setDrag] = useState(false);
  const inp = useRef(null);

  const handleFiles = files => { if (files && files[0]) onNew(files[0]); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '0 48px', height: 54, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--card)' }}>
        <span className="serif" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span> Location Book
        </span>
      </div>

      <div style={{ flex: 1, padding: '52px 48px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 42 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Art department · Location planning</div>
          <h1 className="serif" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-.025em', margin: 0, marginBottom: 14 }}>Projects</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0 }}>
            Import a Fuzzlecheck shooting schedule to create a new project.
          </p>
        </div>

        <div
          style={{ border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-2)'}`, borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginBottom: 42, background: drag ? 'var(--accent-soft)' : 'var(--card)', transition: 'border-color .15s, background .15s', cursor: importing ? 'wait' : 'pointer' }}
          onClick={() => { if (!importing) inp.current.click(); }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Icon name="upload" size={20} style={{ color: '#fff' }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {importing ? 'Reading schedule…' : 'Drop a Fuzzlecheck PDF to create a new project'}
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {importing ? 'extracting scenes & grouping locations' : 'or click to browse'}
            </div>
          </div>
          <input ref={inp} type="file" accept="application/pdf" hidden onChange={e => handleFiles(e.target.files)} />
        </div>

        {importErr && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, color: 'var(--accent)', fontSize: 13 }}>
            {importErr}
          </div>
        )}

        {projects.length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 16 }}>
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).map(p => (
                <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} onDelete={() => onDelete(p.id)} onRename={name => onRename && onRename(p.id, name)} />
              ))}
            </div>
          </>
        )}

        {projects.length === 0 && !importing && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
            <div className="serif" style={{ fontSize: 18, marginBottom: 8 }}>No projects yet</div>
            <div style={{ fontSize: 13 }}>Import a Fuzzlecheck PDF above to get started.</div>
          </div>
        )}
      </div>
    </div>
  );
}

window.LB_Home = LB_Home;
