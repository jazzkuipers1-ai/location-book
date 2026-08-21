/* Storage: IndexedDB for image blobs + localStorage for structured state.
   Attaches LB.db and LB.state to window.LB.                               */
(function () {
  "use strict";
  const LB = window.LB = window.LB || {};

  // ------------------------------ image store (IndexedDB) ----------------
  const DB_NAME = 'lb_images', STORE = 'imgs';
  let _db = null;
  function open() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }
  const _urls = new Map();
  async function putImage(blob) {
    const db = await open();
    const id = 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    // Queue for sequential background upload — prevents flooding the connection
    if (window.LB_SYNC) {
      if (window.LB_SYNC.queueUpload) window.LB_SYNC.queueUpload(id);
      if (window.LB_SYNC.startQueue) window.LB_SYNC.startQueue();
    }
    return id;
  }
  async function getBlob(id) {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }
  async function getURL(id) {
    if (_urls.has(id)) return _urls.get(id);
    let blob = await getBlob(id);
    if (blob) {
      // Converteer HEIC naar JPEG — alleen op browsers zonder native HEIC-ondersteuning
      const nativeHEIC = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) && navigator.userAgent.includes('Mac'));
      if (!nativeHEIC && (blob.type === 'image/heic' || blob.type === 'image/heif')) {
        try {
          if (window.heic2any) {
            const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 });
            blob = Array.isArray(converted) ? converted[0] : converted;
            await replaceBlob(id, blob);
          }
        } catch(e) { /* niet converteerbaar, toon toch */ }
      }
      const url = URL.createObjectURL(blob);
      _urls.set(id, url);
      return url;
    }
    // No local blob — fall back to Supabase public URL (uploaded by another device)
    // Don't cache this URL — it may 404 if upload is still pending; let callers retry
    if (window.LB_SYNC && window.LB_SYNC.getImageUrl) {
      return window.LB_SYNC.getImageUrl(id);
    }
    return null;
  }
  async function replaceBlob(id, blob) {
    // Overwrite an existing image with a new blob, keeping the same ID
    if (_urls.has(id)) { URL.revokeObjectURL(_urls.get(id)); _urls.delete(id); }
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    // Notify any Img component currently showing this id to reload its URL
    window.dispatchEvent(new CustomEvent('lb_blob_updated', { detail: id }));
  }

  async function delImage(id) {
    if (_urls.has(id)) { URL.revokeObjectURL(_urls.get(id)); _urls.delete(id); }
    const db = await open();
    return new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = res; tx.onerror = res;
    });
  }
  function cacheURL(id, url) { _urls.set(id, url); }

  const THUMB_PX = 400;
  function makeThumbBlob(blob) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const burl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(burl);
        let w = img.naturalWidth, h = img.naturalHeight;
        if (w >= h) { h = Math.round(h * THUMB_PX / w); w = THUMB_PX; }
        else         { w = Math.round(w * THUMB_PX / h); h = THUMB_PX; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('thumb failed')), 'image/jpeg', 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(burl); reject(new Error('decode failed')); };
      img.src = burl;
    });
  }

  async function putThumb(id, blob) {
    const thumbId = id + '_thumb';
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, thumbId);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
  }

  async function getThumbnailURL(id) {
    const thumbId = id + '_thumb';
    if (_urls.has(thumbId)) return _urls.get(thumbId);
    let blob = await getBlob(thumbId);
    if (!blob) {
      const full = await getBlob(id);
      if (!full) {
        // Remote image — use Supabase image transform for a small resized version
        if (window.LB_SYNC && window.LB_SYNC.getImageUrl) {
          const base = window.LB_SYNC.getImageUrl(id);
          // Supabase render endpoint serves resized JPEG without downloading full image
          const thumbUrl = base
            .replace('/object/public/', '/render/image/public/')
            + '?width=400&quality=70&resize=contain';
          return thumbUrl;
        }
        return getURL(id);
      }
      try {
        blob = await makeThumbBlob(full);
        // Store thumb in background — don't await so the URL is returned immediately
        putThumb(id, blob).catch(() => {});
      } catch(e) { return getURL(id); }
    }
    const url = URL.createObjectURL(blob);
    _urls.set(thumbId, url);
    return url;
  }

  async function getAllBlobIds() {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).getAllKeys();
      r.onsuccess = () => res((r.result || []).filter(k => !k.endsWith('_thumb')));
      r.onerror = () => rej(r.error);
    });
  }

  LB.db = { putImage, replaceBlob, getBlob, getAllBlobIds, getURL, getThumbnailURL, putThumb, makeThumbBlob, delImage, cacheURL };

  // ------------------------------ structured state (localStorage) --------
  const KEY = 'lb_state_v2';
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) {}
    return null;
  }
  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { console.warn('state save failed', e); return false; }
  }
  function clear() { localStorage.removeItem(KEY); }
  LB.state = { load, save, clear, KEY };
})();
