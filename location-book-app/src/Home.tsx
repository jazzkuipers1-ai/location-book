import { useState, useRef } from 'react';
import type { ProjectMeta } from './db';
import { Icon } from './components';
import { isConfigured } from './supabase';

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CodeBadge({ code, onCopy }: { code: string; onCopy: () => void }) {
  const [done, setDone] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setDone(true); setTimeout(() => setDone(false), 1800);
    onCopy();
  };
  return (
    <button onClick={copy} title="Kopieer toegangscode"
      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: '.1em', color: 'var(--ink-2)', cursor: 'pointer' }}>
      <Icon name={done ? 'check' : 'copy'} size={11} />{code}
    </button>
  );
}

function ProjectCard({ project, onOpen, onDelete }: { project: ProjectMeta; onOpen: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="card" style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'transform .15s, box-shadow .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(40,32,18,.06), 0 12px 36px rgba(40,32,18,.12)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}>
      <div style={{ height: 5, background: 'var(--accent)', opacity: .7 }} />
      <div style={{ padding: '18px 20px 16px' }} onClick={onOpen}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            {fmtDate(project.updatedAt)}
          </div>
          {isConfigured && project.accessCode && (
            <CodeBadge code={project.accessCode} onCopy={() => {}} />
          )}
        </div>
        <div className="serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.15, marginBottom: 4, color: 'var(--ink)' }}>
          {project.name}
        </div>
        {project.scheduleName && project.scheduleName !== project.name && (
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>{project.scheduleName}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {project.regions.slice(0, 3).map(r => (
            <span key={r} className="mono" style={{ fontSize: 10, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 20, padding: '2px 8px', color: 'var(--ink-2)' }}>{r}</span>
          ))}
          {project.regions.length > 3 && <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', padding: '2px 4px' }}>+{project.regions.length - 3} more</span>}
        </div>
        <div style={{ display: 'flex', gap: 18, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <div><div className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{project.locationCount}</div>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>locations</div></div>
          <div><div className="serif" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: 'var(--ink)' }}>{project.sceneCount}</div>
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 3 }}>scenes</div></div>
        </div>
      </div>
      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'flex-end' }}>
        {confirm ? (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Project verwijderen?</span>
            <button className="btn sm" style={{ color: 'var(--accent)' }} onClick={e => { e.stopPropagation(); onDelete(); }}>Verwijderen</button>
            <button className="btn sm" onClick={e => { e.stopPropagation(); setConfirm(false); }}>Annuleren</button>
          </span>
        ) : (
          <button className="btn sm ghost" style={{ color: 'var(--ink-3)' }} onClick={e => { e.stopPropagation(); setConfirm(true); }}>
            <Icon name="trash" size={13} />Verwijderen
          </button>
        )}
      </div>
    </div>
  );
}

export function Home({ projects, onOpen, onNew, onDelete, onJoin }: {
  projects: ProjectMeta[];
  onOpen: (id: string) => void;
  onNew: (file: File) => void;
  onDelete: (id: string) => void;
  onJoin?: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const inp = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) onNew(files[0]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ borderBottom: '1px solid var(--line)', padding: '0 48px', height: 54, display: 'flex', alignItems: 'center', gap: 14, background: 'var(--card)' }}>
        <span className="serif" style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span> Location Book
        </span>
        <span style={{ flex: 1 }} />
        {isConfigured && onJoin && (
          <button className="btn" onClick={onJoin}>
            <Icon name="layers" size={14} /> Deelnemen via code
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: '52px 48px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 42 }}>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>Art department · Location planning</div>
          <h1 className="serif" style={{ fontSize: 42, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-.025em', margin: 0, marginBottom: 14 }}>Projecten</h1>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0 }}>
            Importeer een Fuzzlecheck shooting schedule om een nieuw project aan te maken.
            {isConfigured && ' Of gebruik een code om deel te nemen aan een bestaand project.'}
          </p>
        </div>

        <div
          className={drag ? 'drag' : ''}
          style={{ border: `2px dashed ${drag ? 'var(--accent)' : 'var(--line-2)'}`, borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginBottom: 42, background: drag ? 'var(--accent-soft)' : 'var(--card)', transition: 'border-color .15s, background .15s', cursor: 'pointer' }}
          onClick={() => inp.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Icon name="upload" size={20} style={{ color: '#fff' }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Drop een Fuzzlecheck PDF voor een nieuw project</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>of klik om te bladeren</div>
          </div>
          <input ref={inp} type="file" accept="application/pdf" hidden onChange={e => handleFiles(e.target.files)} />
        </div>

        {projects.length > 0 && (
          <>
            <div className="mono" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 16 }}>
              {projects.length} project{projects.length !== 1 ? 'en' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).map(p => (
                <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} onDelete={() => onDelete(p.id)} />
              ))}
            </div>
          </>
        )}

        {projects.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-3)' }}>
            <div className="serif" style={{ fontSize: 18, marginBottom: 8 }}>Nog geen projecten</div>
            <div style={{ fontSize: 13 }}>Importeer een Fuzzlecheck PDF hierboven om te beginnen.</div>
            {isConfigured && onJoin && (
              <button className="btn" style={{ marginTop: 16 }} onClick={onJoin}>
                <Icon name="layers" size={14} /> Of deelnemen via code
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
