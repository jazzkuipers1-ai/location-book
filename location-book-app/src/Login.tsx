import { useState } from 'react';
import { Icon } from './components';
import { sbGetProjectByCode } from './db';
import type { ProjectMeta } from './db';

export function JoinModal({ onJoin, onClose }: { onJoin: (project: ProjectMeta) => void; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true); setErr('');
    const project = await sbGetProjectByCode(code.trim());
    setBusy(false);
    if (!project) { setErr('Geen project gevonden met deze code.'); return; }
    onJoin(project);
  };

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(420px, 96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="kicker">Samenwerken</div>
            <h3>Deelnemen via code</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-b">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 18 }}>
            Voer de projectcode in die je van de projecteigenaar hebt gekregen.
          </p>
          <input
            className="input"
            placeholder="Bijv. CROATIA-2026"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoFocus
            style={{ fontFamily: 'var(--mono)', letterSpacing: '.12em', fontSize: 15, textTransform: 'uppercase' }}
          />
          {err && <div style={{ color: 'var(--accent)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Annuleren</button>
          <button className="btn primary" onClick={submit} disabled={busy || !code.trim()}>
            {busy ? 'Zoeken…' : 'Deelnemen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccessCodeModal({ code, projectName, onClose }: { code: string; projectName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(420px, 96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="kicker">Project aangemaakt</div>
            <h3>Deel deze code</h3>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-b">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 18 }}>
            Stuur deze code naar collega's zodat zij kunnen meewerken aan <strong>{projectName}</strong>.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1, background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10,
              padding: '14px 18px', fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700,
              letterSpacing: '.18em', textAlign: 'center', color: 'var(--accent)',
            }}>{code}</div>
            <button className="btn" onClick={copy} style={{ flexShrink: 0 }}>
              {copied ? <><Icon name="check" size={14} /> Gekopieerd</> : <><Icon name="copy" size={14} /> Kopieer</>}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 14 }}>
            Je kunt de code later altijd terugvinden via het ⋯ menu van het project.
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={onClose}>Aan de slag</button>
        </div>
      </div>
    </div>
  );
}
