/* Storage: Supabase Storage for images + Supabase DB for state.
   Falls back to IndexedDB / localStorage when Supabase is not configured. */

import { supabase, isConfigured } from './supabase';

// ------------------------------ image store --------------------------------
const BUCKET = 'project-images';
const _urlCache = new Map<string, string>();

function imgId(): string {
  return 'img_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// --- IndexedDB fallback (used when Supabase not configured) ---
const IDB_NAME = 'lb_images', IDB_STORE = 'imgs';
let _idb: IDBDatabase | null = null;
function openIDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (_idb) return res(_idb);
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => { _idb = req.result; res(_idb); };
    req.onerror = () => rej(req.error);
  });
}
async function idbPut(id: string, blob: Blob) {
  const db = await openIDB();
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, id);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function idbGet(id: string): Promise<Blob | null> {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const r = tx.objectStore(IDB_STORE).get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}
async function idbDel(id: string) {
  const db = await openIDB();
  return new Promise<void>(res => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = () => res(); tx.onerror = () => res();
  });
}

// --- Public image API ---
export async function putImage(blob: Blob): Promise<string> {
  const id = imgId();
  if (!isConfigured) {
    await idbPut(id, blob);
    return id;
  }
  const contentType = blob.type || 'image/jpeg';
  console.log('[LB] uploading image', id, contentType, blob.size, 'bytes');
  const { data, error } = await supabase.storage.from(BUCKET).upload(id, blob, { upsert: true, contentType });
  if (error) {
    console.error('[LB] image upload FAILED:', error.message, error);
    await idbPut(id, blob); // fallback locally so the uploader still sees it
  } else {
    console.log('[LB] image upload OK:', data?.path);
  }
  return id;
}

export async function getURL(id: string): Promise<string | null> {
  if (!id) return null;
  if (_urlCache.has(id)) return _urlCache.get(id)!;

  if (!isConfigured) {
    const blob = await idbGet(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    _urlCache.set(id, url);
    return url;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(id);
  if (data?.publicUrl) {
    _urlCache.set(id, data.publicUrl);
    return data.publicUrl;
  }
  return null;
}

export async function getBlob(id: string): Promise<Blob | null> {
  if (!isConfigured) return idbGet(id);
  const { data, error } = await supabase.storage.from(BUCKET).download(id);
  if (error || !data) return null;
  return data;
}

export async function delImage(id: string): Promise<void> {
  if (_urlCache.has(id)) {
    const u = _urlCache.get(id)!;
    if (u.startsWith('blob:')) URL.revokeObjectURL(u);
    _urlCache.delete(id);
  }
  if (!isConfigured) { await idbDel(id); return; }
  await supabase.storage.from(BUCKET).remove([id]);
  await idbDel(id); // clean up any local fallback copy too
}

export const db = { putImage, getBlob, getURL, delImage };

// ------------------------------ shared deck links --------------------------

export async function sbPublishShare(shareId: string, data: any): Promise<boolean> {
  if (!isConfigured) return false;
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const { error } = await supabase.storage.from(BUCKET).upload(`shares/${shareId}.json`, blob, { upsert: true, contentType: 'application/json' });
  if (error) console.error('[LB] share upload failed', error);
  return !error;
}

export async function sbLoadShare(shareId: string): Promise<any | null> {
  if (!isConfigured) return null;
  const { data, error } = await supabase.storage.from(BUCKET).download(`shares/${shareId}.json`);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()); } catch { return null; }
}

export function getShareUrl(shareId: string): string {
  return window.location.origin + '/?share=' + shareId;
}

// ------------------------------ structured state ---------------------------

export interface ProjectMeta {
  id: string;
  name: string;
  scheduleName: string;
  locationCount: number;
  sceneCount: number;
  regions: string[];
  updatedAt: number;
  createdAt: number;
  accessCode?: string;
}

// localStorage fallback keys
const LS_STATE = 'lb_state_v2';
const LS_PROJECTS = 'lb_projects_v1';
export const STATE_KEY = LS_STATE;

// --- Local state (always kept as cache for offline / non-Supabase mode) ---
export function loadState(projectId?: string): any {
  const key = projectId ? 'lb_state_v2_' + projectId : LS_STATE;
  try { const s = JSON.parse(localStorage.getItem(key) || 'null'); if (s && typeof s === 'object') return s; } catch {}
  return null;
}
export function saveState(state: any, projectId?: string): boolean {
  const key = projectId ? 'lb_state_v2_' + projectId : LS_STATE;
  try { localStorage.setItem(key, JSON.stringify(state)); return true; }
  catch (e) { console.warn('state save failed', e); return false; }
}
export function clearState(projectId?: string) {
  const key = projectId ? 'lb_state_v2_' + projectId : LS_STATE;
  localStorage.removeItem(key);
}

// --- Project list (localStorage, kept in sync with Supabase) ---
export function loadProjects(): ProjectMeta[] {
  try { const s = JSON.parse(localStorage.getItem(LS_PROJECTS) || 'null'); if (Array.isArray(s)) return s; } catch {}
  return [];
}
export function saveProjects(list: ProjectMeta[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(list));
}
export function deleteProject(id: string) {
  clearState(id);
  saveProjects(loadProjects().filter(p => p.id !== id));
}

// ------------------------------ Supabase sync ------------------------------

export async function sbLoadProjects(): Promise<ProjectMeta[] | null> {
  if (!isConfigured) return null;
  const { data, error } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
  if (error || !data) return null;
  return data.map((r: any) => ({
    id: r.id,
    name: r.name,
    scheduleName: r.schedule_name || '',
    locationCount: r.location_count || 0,
    sceneCount: r.scene_count || 0,
    regions: r.regions || [],
    accessCode: r.access_code,
    updatedAt: new Date(r.updated_at).getTime(),
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function sbCreateProject(meta: ProjectMeta): Promise<boolean> {
  if (!isConfigured) return false;
  const { error } = await supabase.from('projects').insert({
    id: meta.id,
    name: meta.name,
    schedule_name: meta.scheduleName,
    access_code: meta.accessCode || '',
    location_count: meta.locationCount,
    scene_count: meta.sceneCount,
    regions: meta.regions,
  });
  return !error;
}

export async function sbUpdateProject(id: string, patch: Partial<ProjectMeta>): Promise<boolean> {
  if (!isConfigured) return false;
  const { error } = await supabase.from('projects').update({
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.scheduleName !== undefined && { schedule_name: patch.scheduleName }),
    ...(patch.locationCount !== undefined && { location_count: patch.locationCount }),
    ...(patch.sceneCount !== undefined && { scene_count: patch.sceneCount }),
    ...(patch.regions !== undefined && { regions: patch.regions }),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  return !error;
}

export async function sbDeleteProject(id: string): Promise<boolean> {
  if (!isConfigured) return false;
  const { error } = await supabase.from('projects').delete().eq('id', id);
  return !error;
}

export async function sbLoadState(projectId: string): Promise<any | null> {
  if (!isConfigured) return null;
  const { data, error } = await supabase.from('project_state').select('state').eq('project_id', projectId).maybeSingle();
  if (error || !data) return null;
  return data.state;
}

export async function sbSaveState(projectId: string, state: any): Promise<boolean> {
  if (!isConfigured) return false;
  const { error } = await supabase.from('project_state').upsert({ project_id: projectId, state, updated_at: new Date().toISOString() });
  return !error;
}

export async function sbGetProjectByCode(code: string): Promise<ProjectMeta | null> {
  if (!isConfigured) return null;
  const { data, error } = await supabase.from('projects').select('*').eq('access_code', code.trim().toUpperCase()).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    scheduleName: data.schedule_name || '',
    locationCount: data.location_count || 0,
    sceneCount: data.scene_count || 0,
    regions: data.regions || [],
    accessCode: data.access_code,
    updatedAt: new Date(data.updated_at).getTime(),
    createdAt: new Date(data.created_at).getTime(),
  };
}
