/* Supabase sync helpers — multi-project, attached to window.LB_SYNC */
(function () {
  const SUPABASE_URL = 'https://jufhhmaavfolbyigdogv.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_J40bceJgtDjxEdtXhPterQ_mXommDVd';

  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const CLIENT_ID = Math.random().toString(36).slice(2);

  /* ---- project state ---------------------------------------------------- */
  async function loadState(projectId) {
    const { data, error } = await sb.from('project_state').select('state').eq('project_id', projectId).maybeSingle();
    if (error) throw error;
    return data ? data.state : null;
  }

  async function saveState(projectId, state) {
    const { error } = await sb.from('project_state').upsert(
      { project_id: projectId, state, updated_at: new Date().toISOString() },
      { onConflict: 'project_id' }
    );
    if (error) throw error;
  }

  function subscribe(projectId, onUpdate) {
    const channel = sb
      .channel('project_state:' + projectId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'project_state',
        filter: 'project_id=eq.' + projectId,
      }, payload => onUpdate(payload.new && payload.new.state))
      .subscribe();
    return () => sb.removeChannel(channel);
  }

  /* ---- project list ----------------------------------------------------- */
  async function loadProjects() {
    const { data, error } = await sb.from('projects').select('*').order('updated_at', { ascending: false });
    if (error || !data) return null;
    return data.map(r => ({
      id: r.id, name: r.name,
      scheduleName: r.schedule_name || '',
      locationCount: r.location_count || 0,
      sceneCount: r.scene_count || 0,
      regions: r.regions || [],
      accessCode: r.access_code,
      passwordHash: r.password_hash || null,
      updatedAt: new Date(r.updated_at).getTime(),
      createdAt: new Date(r.created_at).getTime(),
    }));
  }

  async function createProject(meta) {
    const { error } = await sb.from('projects').insert({
      id: meta.id, name: meta.name,
      schedule_name: meta.scheduleName,
      access_code: meta.accessCode || '',
      location_count: meta.locationCount,
      scene_count: meta.sceneCount,
      regions: meta.regions,
      user_id: meta.userId || null,
    });
    return !error;
  }

  async function updateProject(id, patch) {
    const { error } = await sb.from('projects').update({
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.scheduleName !== undefined && { schedule_name: patch.scheduleName }),
      ...(patch.locationCount !== undefined && { location_count: patch.locationCount }),
      ...(patch.sceneCount !== undefined && { scene_count: patch.sceneCount }),
      ...(patch.regions !== undefined && { regions: patch.regions }),
      ...(patch.passwordHash !== undefined && { password_hash: patch.passwordHash }),
      ...(patch.accessCode !== undefined && { access_code: patch.accessCode }),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    return !error;
  }

  async function deleteProject(id) {
    await sb.from('project_state').delete().eq('project_id', id);
    const { error } = await sb.from('projects').delete().eq('id', id);
    return !error;
  }

  async function getProjectByCode(code) {
    const { data, error } = await sb.from('projects').select('*').eq('access_code', code.trim().toUpperCase()).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id, name: data.name,
      scheduleName: data.schedule_name || '',
      locationCount: data.location_count || 0,
      sceneCount: data.scene_count || 0,
      regions: data.regions || [],
      accessCode: data.access_code,
      updatedAt: new Date(data.updated_at).getTime(),
      createdAt: new Date(data.created_at).getTime(),
    };
  }

  /* ---- project password -------------------------------------------------- */
  async function setProjectPassword(projectId, hash) {
    const blob = new Blob([JSON.stringify({ hash })], { type: 'application/json' });
    const path = 'passwords/' + projectId + '.json';
    const { error } = await sb.storage.from('project-images').upload(path, blob, { upsert: true, contentType: 'application/json' });
    if (error) throw error;
  }

  async function removeProjectPassword(projectId) {
    await sb.storage.from('project-images').remove(['passwords/' + projectId + '.json']);
  }

  async function getProjectPassword(projectId) {
    const url = SUPABASE_URL + '/storage/v1/object/public/project-images/passwords/' + projectId + '.json?t=' + Date.now();
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.hash || null;
    } catch (e) { return null; }
  }

  /* ---- storage: images --------------------------------------------------- */

  // Convert HEIC/HEIF to JPEG via canvas — works on iOS because browser decodes HEIC natively.
  // This ensures photos uploaded to Supabase are always JPEG, displayable in all browsers.
  function heicToJpeg(blob) {
    return new Promise((res, rej) => {
      const img = new Image();
      const burl = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(burl);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(b => b ? res(b) : rej(new Error('convert failed')), 'image/jpeg', 0.88);
      };
      img.onerror = () => { URL.revokeObjectURL(burl); rej(new Error('decode failed')); };
      img.src = burl;
    });
  }

  async function uploadImage(blob, imageId) {
    let uploadBlob = blob;
    // Always convert HEIC/HEIF to JPEG before upload — Supabase serves to all browsers including Chrome
    if (blob.type === 'image/heic' || blob.type === 'image/heif') {
      try { uploadBlob = await heicToJpeg(blob); } catch(e) { /* upload original as fallback */ }
    }
    const contentType = uploadBlob.type || 'image/jpeg';
    const path = 'images/' + imageId;
    const { error } = await sb.storage.from('project-images').upload(path, uploadBlob, { upsert: true, contentType });
    if (error) throw error;
    const { data } = sb.storage.from('project-images').getPublicUrl(path);
    return data.publicUrl;
  }

  /* ---- storage: share JSON ----------------------------------------------- */
  async function publishShare(shareId, shareData) {
    const json = JSON.stringify(shareData);
    const blob = new Blob([json], { type: 'application/json' });
    const path = 'shares/' + shareId + '.json';
    const { error } = await sb.storage.from('project-images').upload(path, blob, { upsert: true, contentType: 'application/json' });
    if (error) throw error;
  }

  async function loadShare(shareId) {
    // Use public URL so no auth needed — works for unauthenticated viewers too
    const url = SUPABASE_URL + '/storage/v1/object/public/project-images/shares/' + shareId + '.json?t=' + Date.now();
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function getShareUrl(shareId) {
    return window.location.origin + window.location.pathname + '?share=' + shareId;
  }

  async function publishProjectShare(projId, projData) {
    const blob = new Blob([JSON.stringify(projData)], { type: 'application/json' });
    const path = 'shares/proj_' + projId + '.json';
    const { error } = await sb.storage.from('project-images').upload(path, blob, { upsert: true, contentType: 'application/json' });
    if (error) throw error;
  }

  async function loadProjectShare(projId) {
    const url = SUPABASE_URL + '/storage/v1/object/public/project-images/shares/proj_' + projId + '.json?t=' + Date.now();
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  function getProjectShareUrl(projId) {
    return window.location.origin + window.location.pathname + '?project=' + projId;
  }

  function getImageUrl(imageId) {
    return SUPABASE_URL + '/storage/v1/object/public/project-images/images/' + imageId;
  }

  /* ---- offline upload queue ---------------------------------------------- */
  const QUEUE_KEY = 'lb_upload_queue';
  const UPLOADED_KEY = 'lb_uploaded_ids'; // IDs confirmed uploaded to Supabase

  function markUploaded(id) {
    try {
      const uploaded = JSON.parse(localStorage.getItem(UPLOADED_KEY) || '[]');
      if (!uploaded.includes(id)) { uploaded.push(id); localStorage.setItem(UPLOADED_KEY, JSON.stringify(uploaded)); }
    } catch(e) {}
  }
  function isUploaded(id) {
    try { return JSON.parse(localStorage.getItem(UPLOADED_KEY) || '[]').includes(id); } catch(e) { return false; }
  }

  function queueUpload(id) {
    try {
      if (isUploaded(id)) return; // already uploaded — skip
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if (!q.includes(id)) { q.push(id); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
      window.dispatchEvent(new CustomEvent('lb_upload_state'));
    } catch (e) {}
  }

  // Sequential upload processor — one at a time, skips permanently failed items
  let _queueRunning = false;
  async function startQueue() {
    if (_queueRunning || !navigator.onLine) return;
    _queueRunning = true;
    try {
      while (true) {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (!q.length) break;
        const id = q[0];
        const removeFromQueue = () => {
          const curr = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
          const updated = curr.filter(i => i !== id);
          if (updated.length === 0) localStorage.removeItem(QUEUE_KEY);
          else localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('lb_upload_state'));
        };
        try {
          const blob = await LB.db.getBlob(id);
          if (!blob) { removeFromQueue(); continue; } // no local copy, skip
          await uploadImage(blob, id);
          markUploaded(id);
          removeFromQueue();
          window.dispatchEvent(new CustomEvent('lb_blob_updated', { detail: id }));
        } catch (e) {
          // Network/upload error — move to end of queue and stop for now (retry on reconnect)
          removeFromQueue();
          queueUpload(id);
          break;
        }
      }
    } finally {
      _queueRunning = false;
    }
  }

  async function flushUploadQueue() { startQueue(); }

  window.addEventListener('online', () => {
    startQueue();
    window.dispatchEvent(new CustomEvent('lb_reconnect'));
  });

  // On startup: queue any local blobs not yet uploaded to Supabase
  async function scanAndQueueAll() {
    try {
      const allIds = await LB.db.getAllBlobIds();
      for (const id of allIds) {
        if (!isUploaded(id)) queueUpload(id);
      }
    } catch (e) {}
    startQueue();
  }

  if (navigator.onLine) setTimeout(scanAndQueueAll, 2000);
  else window.addEventListener('online', scanAndQueueAll, { once: true });

  /* ---- auth ---------------------------------------------------------------- */
  async function signUp(email, password) {
    return await sb.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    return await sb.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    return await sb.auth.signOut();
  }

  async function getSession() {
    return await sb.auth.getSession();
  }

  function onAuthChange(callback) {
    return sb.auth.onAuthStateChange(callback);
  }

  async function publishAgendaShare(agendaId, data) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const path = 'shares/agenda_' + agendaId + '.json';
    const { error } = await sb.storage.from('project-images').upload(path, blob, { upsert: true, contentType: 'application/json' });
    if (error) throw error;
  }

  async function loadAgendaShare(agendaId) {
    const url = SUPABASE_URL + '/storage/v1/object/public/project-images/shares/agenda_' + agendaId + '.json?t=' + Date.now();
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  function getAgendaShareUrl(agendaId) {
    return window.location.origin + window.location.pathname + '?agenda=' + agendaId;
  }

  /* ---- presence --------------------------------------------------------- */
  const PRESENCE_COLORS = ['#e07b54','#5b8dd9','#6bbf7a','#c97cb8','#e0b84a','#5bbfbf','#d96b6b','#8b7fd4'];
  const PRESENCE_NAMES = ['Kat','Hond','Vos','Beer','Uil','Haas','Wolf','Eland'];

  function getOrCreateDisplayName() {
    let stored = localStorage.getItem('lb_display_name');
    if (stored) return stored;
    const idx = Math.floor(Math.random() * PRESENCE_NAMES.length);
    const name = PRESENCE_NAMES[idx];
    localStorage.setItem('lb_display_name', name);
    return name;
  }

  function getOrCreateDisplayColor() {
    let stored = localStorage.getItem('lb_display_color');
    if (stored) return stored;
    const idx = Math.floor(Math.random() * PRESENCE_COLORS.length);
    const color = PRESENCE_COLORS[idx];
    localStorage.setItem('lb_display_color', color);
    return color;
  }

  let presenceChannel = null;

  function subscribePresence(projectId, onPresenceChange) {
    if (presenceChannel) { sb.removeChannel(presenceChannel); presenceChannel = null; }
    const name = getOrCreateDisplayName();
    const color = getOrCreateDisplayColor();
    const ch = sb.channel('presence:' + projectId, { config: { presence: { key: CLIENT_ID } } });
    ch.on('presence', { event: 'sync' }, () => {
      const raw = ch.presenceState();
      const others = Object.entries(raw)
        .filter(([key]) => key !== CLIENT_ID)
        .map(([, metas]) => metas[0])
        .filter(Boolean);
      onPresenceChange(others);
    });
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ name, color, clientId: CLIENT_ID });
      }
    });
    presenceChannel = ch;
    return { name, color, unsubscribe: () => { sb.removeChannel(ch); presenceChannel = null; } };
  }

  window.LB_SYNC = { CLIENT_ID, loadState, saveState, subscribe, loadProjects, createProject, updateProject, deleteProject, getProjectByCode, uploadImage, getImageUrl, queueUpload, startQueue, flushUploadQueue, publishShare, loadShare, getShareUrl, publishProjectShare, loadProjectShare, getProjectShareUrl, publishAgendaShare, loadAgendaShare, getAgendaShareUrl, setProjectPassword, removeProjectPassword, getProjectPassword, signUp, signIn, signOut, getSession, onAuthChange, subscribePresence };
})();
