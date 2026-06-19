/* PasswordModal — unlock and set-password flows for project protection */

async function hashPassword(pwd) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(pwd));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function PwdInput({ value, onChange, onKeyDown, placeholder, inputRef }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input ref={inputRef} type={show ? 'text' : 'password'} className="input" placeholder={placeholder}
        value={value} onChange={onChange} onKeyDown={onKeyDown}
        style={{ width: '100%', boxSizing: 'border-box', paddingRight: 36 }} />
      <button type="button" onClick={() => setShow(s => !s)}
        title={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'flex', alignItems: 'center' }}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  );
}

function UnlockModal({ projectName, onClose, onUnlock }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = useRef();

  useEffect(() => { setTimeout(() => inp.current && inp.current.focus(), 80); }, []);

  const attempt = async () => {
    if (!pwd || busy) return;
    setBusy(true);
    const hash = await hashPassword(pwd);
    const ok = onUnlock(hash);
    if (!ok) { setErr('Incorrect password'); setBusy(false); setPwd(''); setTimeout(() => inp.current && inp.current.focus(), 0); }
  };

  return (
    <div className="scrim">
      <div className="modal" style={{ width: 'min(360px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Protected project</div>
            <h3>{projectName}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Cancel" />
        </div>
        <div className="modal-b">
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 14 }}>
            Enter the password to open this project.
          </div>
          <PwdInput inputRef={inp} placeholder="Password" value={pwd}
            onChange={e => { setPwd(e.target.value); setErr(''); }}
            onKeyDown={e => e.key === 'Enter' && attempt()} />
          {err && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
          <div className="modal-foot">
            <span />
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={attempt} disabled={!pwd || busy}>
              <Icon name="check" size={15} />{busy ? 'Checking…' : 'Unlock'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetPasswordModal({ hasPassword, onClose, onSave }) {
  const [step, setStep] = useState(hasPassword ? 'verify' : 'new');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const inp = useRef();

  useEffect(() => { setTimeout(() => inp.current && inp.current.focus(), 80); }, [step]);

  const verifyCurrent = async () => {
    if (!current || busy) return;
    setBusy(true);
    const hash = await hashPassword(current);
    const ok = await onSave({ check: hash });
    setBusy(false);
    if (ok) { setStep('new'); setErr(''); }
    else { setErr('Incorrect current password'); setCurrent(''); }
  };

  const save = async () => {
    if (next !== confirm) { setErr('Passwords do not match'); return; }
    if (next.length < 4) { setErr('Password must be at least 4 characters'); return; }
    setBusy(true);
    const hash = await hashPassword(next);
    await onSave({ newHash: hash });
    setBusy(false);
  };

  const remove = async () => {
    if (!current || busy) return;
    setBusy(true);
    const hash = await hashPassword(current);
    const ok = await onSave({ check: hash, remove: true });
    setBusy(false);
    if (!ok) { setErr('Incorrect password'); setCurrent(''); }
  };

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(380px,96vw)' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="kicker">Project security</div>
            <h3>{hasPassword ? 'Change password' : 'Set password'}</h3>
          </div>
          <IconBtn name="x" onClick={onClose} title="Cancel" />
        </div>
        <div className="modal-b">
          {step === 'verify' && (
            <>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 14 }}>
                Enter the current password to continue.
              </div>
              <PwdInput inputRef={inp} placeholder="Current password" value={current}
                onChange={e => { setCurrent(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && verifyCurrent()} />
              {err && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
              <div className="modal-foot" style={{ marginTop: 16 }}>
                <button className="btn sm ghost" style={{ color: 'var(--ink-3)', marginRight: 'auto' }} onClick={() => { setErr(''); setStep('remove'); }}>
                  Remove password
                </button>
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn primary" onClick={verifyCurrent} disabled={!current || busy}>
                  {busy ? 'Checking…' : 'Continue'}
                </button>
              </div>
            </>
          )}

          {step === 'new' && (
            <>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 14 }}>
                Choose a password for this project. Anyone with the link will need it to open the project.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <PwdInput inputRef={inp} placeholder="New password" value={next}
                  onChange={e => { setNext(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && save()} />
                <PwdInput placeholder="Confirm password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setErr(''); }}
                  onKeyDown={e => e.key === 'Enter' && save()} />
              </div>
              {err && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
              <div className="modal-foot" style={{ marginTop: 16 }}>
                <span />
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn primary" onClick={save} disabled={!next || !confirm || busy}>
                  <Icon name="check" size={15} />{busy ? 'Saving…' : 'Set password'}
                </button>
              </div>
            </>
          )}

          {step === 'remove' && (
            <>
              <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 14 }}>
                Enter the current password to remove protection from this project.
              </div>
              <PwdInput inputRef={inp} placeholder="Current password" value={current}
                onChange={e => { setCurrent(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && remove()} />
              {err && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 6 }}>{err}</div>}
              <div className="modal-foot" style={{ marginTop: 16 }}>
                <span />
                <button className="btn" onClick={() => { setStep('verify'); setErr(''); setCurrent(''); }}>Back</button>
                <button className="btn primary" style={{ background: 'var(--ink-3)' }} onClick={remove} disabled={!current || busy}>
                  {busy ? 'Removing…' : 'Remove password'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.hashPassword = hashPassword;
window.UnlockModal = UnlockModal;
window.SetPasswordModal = SetPasswordModal;
