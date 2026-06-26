/* AddLocationModal — add a location manually or by uploading a scene screenshot.
   Screenshot mode calls the Anthropic Messages API (key stored in localStorage). */

const ANTHROPIC_KEY_STORE = 'lb_anthropic_key';

function buildManualLocation(name, scenes) {
  const id = 'manual_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  return {
    id,
    name: name.trim(),
    regions: [],
    sets: [],
    dayNums: [],
    shootDates: [],
    sceneCount: scenes.length,
    scenes: scenes.map((s, i) => ({
      number: s.number || '',
      int_ext: s.intExt || 'EXT',
      day_night: s.dayNight || 'DAY',
      location: name.trim(),
      synopsis: s.synopsis || '',
      dayNumber: s.dayNumber || null,
      pages: s.pages || '',
      cast: [],
      extras: 0,
      season: null,
      segments: [name.trim()],
      idx: i,
    })),
  };
}

function SceneRow({ scene, onChange, onRemove, idx }) {
  const s = scene;
  const set = (k, v) => onChange({ ...s, [k]: v });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 90px 70px 60px 90px 1fr 32px', gap: 5, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
      <input className="input" placeholder="4.56" value={s.number} onChange={e => set('number', e.target.value)}
        style={{ fontSize: 12, padding: '4px 6px', fontFamily: 'var(--mono)' }} />
      <select className="input" value={s.intExt} onChange={e => set('intExt', e.target.value)}
        style={{ fontSize: 11, padding: '4px 5px' }}>
        <option value="EXT">EXT</option>
        <option value="INT">INT</option>
        <option value="INT/EXT">INT/EXT</option>
      </select>
      <select className="input" value={s.dayNight} onChange={e => set('dayNight', e.target.value)}
        style={{ fontSize: 11, padding: '4px 5px' }}>
        <option value="DAY">DAY</option>
        <option value="NIG">NIGHT</option>
        <option value="DAWN">DAWN</option>
        <option value="DUSK">DUSK</option>
      </select>
      <input className="input" placeholder="12" type="number" value={s.dayNumber || ''} onChange={e => set('dayNumber', e.target.value ? parseInt(e.target.value) : null)}
        style={{ fontSize: 12, padding: '4px 6px', fontFamily: 'var(--mono)' }} />
      <input className="input" placeholder="3/8" value={s.pages} onChange={e => set('pages', e.target.value)}
        style={{ fontSize: 12, padding: '4px 6px', fontFamily: 'var(--mono)' }} />
      <input className="input" placeholder="Synopsis…" value={s.synopsis} onChange={e => set('synopsis', e.target.value)}
        style={{ fontSize: 12, padding: '4px 6px' }} />
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, display: 'flex', alignItems: 'center' }}>
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}

function emptyScene() {
  return { number: '', intExt: 'EXT', dayNight: 'DAY', dayNumber: null, pages: '', synopsis: '' };
}

function AddLocationModal({ onClose, onAdd }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'screenshot'
  const [name, setName] = useState('');
  const [scenes, setScenes] = useState([emptyScene()]);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(ANTHROPIC_KEY_STORE) || '');
  const [parsing, setParsing] = useState(false);
  const [parseErr, setParseErr] = useState('');
  const [parsed, setParsed] = useState(null); // result from Claude
  const fileRef = useRef();

  const updateScene = (i, s) => setScenes(prev => prev.map((x, j) => j === i ? s : x));
  const removeScene = i => setScenes(prev => prev.filter((_, j) => j !== i));
  const addScene = () => setScenes(prev => [...prev, emptyScene()]);

  const handleImg = e => {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
    setParsed(null);
    setParseErr('');
  };

  const parseScreenshot = async () => {
    if (!imgFile) return;
    const key = apiKey.trim();
    if (!key) { setParseErr('Vul een Anthropic API key in.'); return; }
    localStorage.setItem(ANTHROPIC_KEY_STORE, key);

    setParsing(true);
    setParseErr('');
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(imgFile);
      });

      const resp = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: imgFile.type || 'image/png', data: b64 },
              },
              {
                type: 'text',
                text: `This is a stripboard or shooting schedule screenshot. Extract all scene information and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "locationName": "name of the location shown",
  "scenes": [
    {
      "number": "4.56",
      "intExt": "EXT",
      "dayNight": "NIG",
      "dayNumber": 12,
      "pages": "1/8",
      "synopsis": "Emil drives through the village."
    }
  ]
}

Rules:
- intExt must be "INT", "EXT", or "INT/EXT"
- dayNight must be "DAY", "NIG", "DAWN", or "DUSK"
- dayNumber is the shoot day number (integer), or null if not visible
- pages is the page count string (e.g. "1/8", "3/8", "1"), or "" if not visible
- Extract every scene row visible in the image`,
              },
            ],
          }],
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || 'API error ' + resp.status);
      }

      const data = await resp.json();
      const text = data.content[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const result = JSON.parse(jsonMatch[0]);

      setName(result.locationName || '');
      setScenes((result.scenes || []).map(s => ({
        number: s.number || '',
        intExt: s.intExt || 'EXT',
        dayNight: s.dayNight || 'DAY',
        dayNumber: s.dayNumber || null,
        pages: s.pages || '',
        synopsis: s.synopsis || '',
      })));
      setParsed(result);
      setMode('manual');
    } catch (e) {
      setParseErr(e.message || String(e));
    } finally {
      setParsing(false);
    }
  };

  const canSave = name.trim() && scenes.some(s => s.number || s.synopsis);

  const save = () => {
    if (!canSave) return;
    const loc = buildManualLocation(name, scenes);
    onAdd(loc);
    onClose();
  };

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(780px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div className="kicker">Add location</div>
            <h3>New location</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--card-2)', borderRadius: 8, border: '1px solid var(--line)', overflow: 'hidden' }}>
              {[['manual', 'Manual'], ['screenshot', 'Screenshot']].map(([k, l]) => (
                <button key={k} onClick={() => setMode(k)}
                  style={{ padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--mono)',
                    background: mode === k ? 'var(--accent)' : 'transparent',
                    color: mode === k ? '#fff' : 'var(--ink-2)' }}>
                  {l}
                </button>
              ))}
            </div>
            <IconBtn name="x" onClick={onClose} title="Close" />
          </div>
        </div>

        <div className="modal-b" style={{ overflowY: 'auto', flex: 1 }}>
          {mode === 'screenshot' && (
            <div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 12, lineHeight: 1.6 }}>
                Upload een screenshot van de scenes op deze locatie. Claude leest de data automatisch uit.
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Anthropic API key</label>
                <input className="input" type="password" placeholder="sk-ant-…"
                  value={apiKey} onChange={e => setApiKey(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 12 }} />
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                  Wordt lokaal opgeslagen. Haal hem op via <b>console.anthropic.com</b>.
                </div>
              </div>

              <div
                onClick={() => fileRef.current.click()}
                style={{ border: '2px dashed var(--line)', borderRadius: 10, padding: 24, textAlign: 'center', cursor: 'pointer', marginBottom: 12,
                  background: imgPreview ? 'transparent' : 'var(--card-2)' }}>
                {imgPreview
                  ? <img src={imgPreview} style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 6, objectFit: 'contain' }} />
                  : <div>
                      <Icon name="image" size={28} style={{ color: 'var(--ink-3)', marginBottom: 8 }} />
                      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>Klik om een screenshot te kiezen</div>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImg} />

              {parseErr && <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)', marginBottom: 10 }}>{parseErr}</div>}

              <button className="btn primary block" onClick={parseScreenshot} disabled={!imgFile || parsing}>
                {parsing ? 'Bezig met uitlezen…' : 'Lees scenes uit screenshot'}
              </button>

              {parsed && (
                <div className="mono" style={{ fontSize: 11, color: 'var(--green, #2e7d32)', marginTop: 10 }}>
                  ✓ {scenes.length} scenes gevonden voor "{name}" — controleer hieronder en sla op.
                </div>
              )}
            </div>
          )}

          {(mode === 'manual' || parsed) && (
            <div style={{ marginTop: mode === 'screenshot' && parsed ? 20 : 0 }}>
              <div style={{ marginBottom: 14 }}>
                <label className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', display: 'block', marginBottom: 5 }}>Locatienaam</label>
                <input className="input" placeholder="Village square / Kosinj" value={name} onChange={e => setName(e.target.value)}
                  style={{ width: '100%', fontSize: 14, fontWeight: 600 }} />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 90px 70px 60px 90px 1fr 32px', gap: 5, marginBottom: 4 }}>
                  {['Scene', 'INT/EXT', 'Dag/Nacht', 'Shoot day', 'Pagina\'s', 'Synopsis', ''].map((h, i) => (
                    <div key={i} className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {scenes.map((s, i) => (
                  <SceneRow key={i} idx={i} scene={s}
                    onChange={s => updateScene(i, s)}
                    onRemove={() => removeScene(i)} />
                ))}
              </div>

              <button className="btn sm" onClick={addScene} style={{ marginTop: 8 }}>
                <Icon name="plus" size={13} /> Scene toevoegen
              </button>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ flexShrink: 0 }}>
          <span />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Annuleren</button>
            <button className="btn primary" disabled={!canSave} onClick={save}>
              <Icon name="plus" size={14} /> Locatie toevoegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.AddLocationModal = AddLocationModal;
