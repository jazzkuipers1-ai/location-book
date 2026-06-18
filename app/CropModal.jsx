/* CropModal — wraps Cropper.js, resolves with a cropped blob saved to IndexedDB */

function CropModal({ imgId, onDone, onClose }) {
  const [url, setUrl] = useState(null);
  const imgRef = useRef(null);
  const cropperRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Load the original image URL from IndexedDB
  useEffect(() => {
    let live = true;
    LB.db.getURL(imgId).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [imgId]);

  // Init Cropper.js once the <img> is in the DOM and the URL is loaded
  useEffect(() => {
    if (!url || !imgRef.current) return;
    const cropper = new Cropper(imgRef.current, {
      viewMode: 1,
      autoCropArea: 1,
      movable: true,
      zoomable: true,
      rotatable: false,
      scalable: false,
    });
    cropperRef.current = cropper;
    return () => { cropper.destroy(); cropperRef.current = null; };
  }, [url]);

  const apply = async () => {
    if (!cropperRef.current) return;
    setSaving(true);
    try {
      const canvas = cropperRef.current.getCroppedCanvas({ maxWidth: 2400, maxHeight: 2400 });
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      const newId = await LB.db.putImage(blob);
      onDone(newId);
    } catch (e) {
      console.warn('Crop failed', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(760px, 96vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div className="kicker">Edit image</div><h3>Crop</h3></div>
          <IconBtn name="x" onClick={onClose} title="Cancel" />
        </div>
        <div className="modal-b" style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ maxHeight: '60vh', overflow: 'hidden', background: '#000', borderRadius: 8 }}>
            {url
              ? <img ref={imgRef} src={url} style={{ display: 'block', maxWidth: '100%', maxHeight: '60vh' }} />
              : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading…</div>
            }
          </div>
          <div className="modal-foot" style={{ marginTop: 16 }}>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Drag to move · scroll to zoom · drag corners to resize</span>
            <button className="btn primary" onClick={apply} disabled={saving || !url}>
              {saving ? 'Saving…' : 'Apply crop'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CropModal = CropModal;
