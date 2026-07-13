/* Auth — login / register screen */

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [verifyPending, setVerifyPending] = useState(false);

  const switchMode = m => { setMode(m); setErr(''); };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      if (mode === 'register') {
        const { data, error } = await LB_SYNC.signUp(email.trim(), password);
        if (error) throw error;
        if (data.session) {
          onAuth(data.user);
        } else {
          setVerifyPending(true);
        }
      } else {
        const { data, error } = await LB_SYNC.signIn(email.trim(), password);
        if (error) throw error;
        onAuth(data.user);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 'min(400px, 92vw)' }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>
            <span className="serif" style={{ fontSize: 18, fontWeight: 600 }}>Location Book</span>
          </div>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Art Department · Location Planning
          </div>
        </div>

        {verifyPending ? (
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 10 }}>📬</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Check your email</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.7 }}>
              We sent a confirmation link to<br /><b>{email}</b>.<br />
              Click the link to activate your account.
            </div>
            <button className="btn" style={{ marginTop: 20 }} onClick={() => { setVerifyPending(false); switchMode('login'); }}>
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 28 }}>
            <div className="mono" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 22, color: 'var(--ink-2)' }}>
              {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
            </div>

            <div style={{ marginBottom: 13 }}>
              <label className="mono" style={{ display: 'block', fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 5, letterSpacing: '.1em', textTransform: 'uppercase' }}>Email</label>
              <input className="input" type="email" required autoFocus
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@studio.com"
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="mono" style={{ display: 'block', fontSize: 9.5, color: 'var(--ink-3)', marginBottom: 5, letterSpacing: '.1em', textTransform: 'uppercase' }}>Password</label>
              <input className="input" type="password" required minLength={6}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'}
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            {err && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 14, lineHeight: 1.5 }}>
                {err}
              </div>
            )}

            <button className="btn primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Create account')}
            </button>

            <div className="mono" style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: 'var(--ink-3)' }}>
              {mode === 'login' ? (<>
                No account?{' '}
                <button type="button" onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, textDecoration: 'underline', padding: 0 }}>
                  Create one
                </button>
              </>) : (<>
                Already have an account?{' '}
                <button type="button" onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11, textDecoration: 'underline', padding: 0 }}>
                  Sign in
                </button>
              </>)}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

window.AuthScreen = AuthScreen;
