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
    const blob = await getBlob(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _urls.set(id, url);
    return url;
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
  LB.db = { putImage, getBlob, getURL, delImage };

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
