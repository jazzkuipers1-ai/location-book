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
  async function uploadImage(blob, imageId) {
    const contentType = blob.type || 'image/jpeg';
    const path = 'images/' + imageId;
    const { error } = await sb.storage.from('project-images').upload(path, blob, { upsert: true, contentType });
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

  function getImageUrl(imageId) {
    return SUPABASE_URL + '/storage/v1/object/public/project-images/images/' + imageId;
  }

  /* ---- offline upload queue ---------------------------------------------- */
  const QUEUE_KEY = 'lb_upload_queue';

  function queueUpload(id) {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      if (!q.includes(id)) { q.push(id); localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }
    } catch (e) {}
  }

  // Sequential upload processor — one upload at a time, no connection flooding
  let _queueRunning = false;
  async function startQueue() {
    if (_queueRunning || !navigator.onLine) return;
    _queueRunning = true;
    try {
      while (true) {
        const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        if (!q.length) break;
        const id = q[0];
        try {
          const blob = await LB.db.getBlob(id);
          if (blob) await uploadImage(blob, id);
          // Success — remove from front of queue
          const curr = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
          const updated = curr.filter(i => i !== id);
          if (updated.length === 0) localStorage.removeItem(QUEUE_KEY);
          else localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
        } catch (e) {
          break; // offline or upload error — stop and retry on reconnect
        }
      }
    } finally {
      _queueRunning = false;
    }
  }

  async function flushUploadQueue() {
    startQueue();
  }

  // On reconnect: flush queued uploads and notify app to retry state save
  window.addEventListener('online', () => {
    startQueue();
    window.dispatchEvent(new CustomEvent('lb_reconnect'));
  });

  window.LB_SYNC = { CLIENT_ID, loadState, saveState, subscribe, loadProjects, createProject, updateProject, deleteProject, getProjectByCode, uploadImage, getImageUrl, queueUpload, startQueue, flushUploadQueue, publishShare, loadShare, getShareUrl, setProjectPassword, removeProjectPassword, getProjectPassword };
})();
