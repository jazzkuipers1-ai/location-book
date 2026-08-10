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
      // Converteer HEIC naar JPEG als de browser het niet kan tonen
      if (blob.type === 'image/heic' || blob.type === 'image/heif' || blob.type === '') {
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
    // No local blob — fetch van Supabase en converteer indien HEIC
    if (window.LB_SYNC && window.LB_SYNC.getImageUrl) {
      const remoteUrl = window.LB_SYNC.getImageUrl(id);
      try {
        const resp = await fetch(remoteUrl);
        let blob = await resp.blob();
        if (window.heic2any && (blob.type === 'image/heic' || blob.type === 'image/heif' || /\.heic$/i.test(remoteUrl))) {
          const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 });
          blob = Array.isArray(converted) ? converted[0] : converted;
        }
        await replaceBlob(id, blob);
        const url = URL.createObjectURL(blob);
        _urls.set(id, url);
        return url;
      } catch(e) {
        _urls.set(id, remoteUrl);
        return remoteUrl;
      }
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
  LB.db = { putImage, replaceBlob, getBlob, getURL, delImage };

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
