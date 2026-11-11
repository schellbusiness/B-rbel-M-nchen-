// Zentraler Zustand + Datenzugriff (Supabase oder Demo im Browser).
import {
  uid, todayISO, addDays, prepareUpload, isExternal, PHASES, useState, useEffect,
} from './lib.js';
import { SEED_ROOMS, SEED_CHECKLIST, SEED_CONTRACTS, DEMO_EXTRAS } from './seed.js';

const TABLES = ['members', 'rooms', 'items', 'expenses', 'tasks', 'contracts', 'boxes', 'files'];
const BUCKET = 'wohnung';
const CFG_KEY = 'wohnung-verbindung';
const MODE_KEY = 'wohnung-modus';
const DEMO_KEY = 'wohnung-demo-daten';
const DEMO_FILES_KEY = 'wohnung-demo-dateien';

export const state = {
  phase: 'boot', // boot | setup | login | denied | name | ready | error
  mode: null, // 'supabase' | 'demo'
  configSource: null, // 'datei' | 'browser'
  userId: null,
  email: null,
  settings: {},
  members: [], rooms: [], items: [], expenses: [], tasks: [], contracts: [], boxes: [], files: [],
  urls: {},
  sheet: null,
  confirm: null,
  toast: null,
  lightbox: null,
  error: null,
};

// ---------- Beobachter ----------

const listeners = new Set();
let version = 0;
export function emit() {
  version++;
  listeners.forEach((fn) => fn(version));
}
export function useStore() {
  const [, setV] = useState(version);
  const seen = version;
  useEffect(() => {
    const fn = (v) => setV(v);
    listeners.add(fn);
    if (version !== seen) setV(version); // Änderung zwischen Rendern und Anmelden verpasst
    return () => listeners.delete(fn);
  }, []);
  return state;
}
function setPhase(p) {
  state.phase = p;
  emit();
}

// ---------- Sortierung ----------

const str = (v) => String(v ?? '');
const SORTS = {
  members: (a, b) => str(a.created_at).localeCompare(str(b.created_at)) || str(a.id).localeCompare(str(b.id)),
  rooms: (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || str(a.created_at).localeCompare(str(b.created_at)),
  items: (a, b) => str(b.created_at).localeCompare(str(a.created_at)),
  expenses: (a, b) => str(b.date).localeCompare(str(a.date)) || str(b.created_at).localeCompare(str(a.created_at)),
  tasks: (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || str(a.created_at).localeCompare(str(b.created_at)),
  contracts: (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || str(a.created_at).localeCompare(str(b.created_at)),
  boxes: (a, b) => (a.number ?? 0) - (b.number ?? 0),
  files: (a, b) => str(a.created_at).localeCompare(str(b.created_at)),
};
const sortRows = (t, rows) => [...rows].sort(SORTS[t]);

// ---------- Browser-Speicher (kann in privaten Fenstern fehlen) ----------

function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch { /* egal */ } }
function lsJSON(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch { return null; } }

// ---------- Verbindung (Supabase-Zugangsdaten) ----------

function storedConfig() {
  const c = lsJSON(CFG_KEY);
  return c && c.url && c.key ? c : null;
}

function getConfig() {
  const w = window.WOHNUNG_CONFIG || {};
  if (w.supabaseUrl && w.supabaseKey) {
    return { url: w.supabaseUrl.trim(), key: w.supabaseKey.trim(), source: 'datei' };
  }
  const c = storedConfig();
  return c ? { ...c, source: 'browser' } : null;
}

function readHashConfig() {
  const m = location.hash.match(/^#verbinden=([^&]+)/);
  if (!m) return;
  try {
    const json = JSON.parse(atob(decodeURIComponent(m[1])));
    if (json.u && json.k) lsSet(CFG_KEY, JSON.stringify({ url: json.u, key: json.k }));
  } catch (e) {
    console.warn('Verbindungslink ungültig', e);
  }
  history.replaceState(null, '', location.pathname + location.search);
}

export function connectLink() {
  const c = getConfig();
  if (!c) return null;
  const payload = encodeURIComponent(btoa(JSON.stringify({ u: c.url, k: c.key })));
  return `${location.origin}${location.pathname}#verbinden=${payload}`;
}

export function saveConnection(url, key) {
  const u = url.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^/]+$/.test(u)) return 'Die URL sollte so aussehen: https://abcdefgh.supabase.co';
  if (key.trim().length < 20) return 'Der Schlüssel ist zu kurz. Nimm den „anon“- bzw. „publishable“-Key.';
  lsSet(CFG_KEY, JSON.stringify({ url: u, key: key.trim() }));
  lsDel(MODE_KEY);
  location.reload();
  return null;
}

export function forgetConnection() {
  lsDel(CFG_KEY);
  location.reload();
}

// ---------- Supabase ----------

class SupabaseBackend {
  constructor(url, key) {
    this.sb = window.supabase.createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wohnung-anmeldung' },
    });
    this.channel = null;
  }
  async session() {
    const { data, error } = await this.sb.auth.getSession();
    if (error) throw error;
    return data.session;
  }
  onSignedOut(cb) {
    this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setTimeout(cb, 0);
    });
  }
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  }
  async changePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw error;
  }
  async signOut() {
    if (this.channel) await this.sb.removeChannel(this.channel);
    this.channel = null;
    await this.sb.auth.signOut();
  }
  async loadAll() {
    const results = await Promise.all([
      ...TABLES.map((t) => this.sb.from(t).select('*')),
      this.sb.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    const out = {};
    TABLES.forEach((t, i) => {
      if (results[i].error) throw results[i].error;
      out[t] = results[i].data || [];
    });
    const s = results[TABLES.length];
    if (s.error) throw s.error;
    out.settings = s.data || { id: 1 };
    return out;
  }
  async insert(table, rows) {
    const { error } = await this.sb.from(table).insert(rows);
    if (error) throw error;
  }
  async update(table, id, changes) {
    const { error } = await this.sb.from(table).update(changes).eq('id', id);
    if (error) throw error;
  }
  async remove(table, id) {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    if (error) throw error;
  }
  async claimSeed() {
    const { data, error } = await this.sb.from('settings')
      .update({ seeded_at: new Date().toISOString() })
      .eq('id', 1).is('seeded_at', null).select('id');
    if (error) throw error;
    return (data || []).length > 0;
  }
  async upload(path, blob, contentType) {
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, { contentType, upsert: false });
    if (error) throw error;
  }
  async urlsFor(paths) {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24);
    if (error) throw error;
    const out = {};
    for (const d of data || []) {
      const url = d.signedUrl || d.signedURL;
      if (url && d.path) out[d.path] = url;
    }
    return out;
  }
  async removeFiles(paths) {
    if (!paths.length) return;
    const { error } = await this.sb.storage.from(BUCKET).remove(paths);
    if (error) throw error;
  }
  subscribe(cb) {
    if (this.channel) return;
    this.channel = this.sb.channel('wohnung-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => cb())
      .subscribe();
  }
}

// ---------- Demo im Browser ----------

const DEMO_ME = 'demo-ich';
const DEMO_LISA = 'demo-lisa';

function freshDemo() {
  const db = { settings: { id: 1 } };
  TABLES.forEach((t) => { db[t] = []; });
  db.members = [
    { id: DEMO_ME, name: 'Ich', created_at: '2026-01-01T10:00:00.000Z' },
    { id: DEMO_LISA, name: 'Lisa', created_at: '2026-01-01T10:00:01.000Z' },
  ];
  return db;
}

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(blob);
});

class DemoBackend {
  constructor() {
    this.db = lsJSON(DEMO_KEY) || freshDemo();
    this.blobs = lsJSON(DEMO_FILES_KEY) || {};
  }
  persist() {
    if (!lsSet(DEMO_KEY, JSON.stringify(this.db))) throw new Error('Der Demo-Speicher im Browser ist voll.');
  }
  async session() { return { user: { id: DEMO_ME, email: 'demo' } }; }
  onSignedOut() {}
  async signOut() {}
  async loadAll() { return JSON.parse(JSON.stringify(this.db)); }
  async insert(table, rows) {
    this.db[table].push(...[].concat(rows).map((r) => ({ ...r })));
    this.persist();
  }
  async update(table, id, changes) {
    if (table === 'settings') Object.assign(this.db.settings, changes);
    else {
      const row = this.db[table].find((r) => r.id === id);
      if (row) Object.assign(row, changes);
    }
    this.persist();
  }
  async remove(table, id) {
    const db = this.db;
    db[table] = db[table].filter((r) => r.id !== id);
    if (table === 'rooms') {
      db.items = db.items.filter((r) => r.room_id !== id);
      db.files = db.files.filter((r) => r.room_id !== id);
      for (const t of ['expenses', 'tasks', 'boxes']) db[t].forEach((r) => { if (r.room_id === id) r.room_id = null; });
    }
    if (table === 'items') db.expenses.forEach((r) => { if (r.item_id === id) r.item_id = null; });
    this.persist();
  }
  async claimSeed() {
    if (this.db.settings.seeded_at) return false;
    this.db.settings.seeded_at = new Date().toISOString();
    this.persist();
    return true;
  }
  async upload(path, blob) {
    this.blobs[path] = await blobToDataURL(blob);
    if (!lsSet(DEMO_FILES_KEY, JSON.stringify(this.blobs))) {
      delete this.blobs[path];
      throw new Error('Der Demo-Speicher im Browser ist voll. Mit Supabase gibt es dieses Limit nicht.');
    }
  }
  async urlsFor(paths) {
    const out = {};
    paths.forEach((p) => { if (this.blobs[p]) out[p] = this.blobs[p]; });
    return out;
  }
  async removeFiles(paths) {
    paths.forEach((p) => delete this.blobs[p]);
    lsSet(DEMO_FILES_KEY, JSON.stringify(this.blobs));
  }
  subscribe(cb) {
    window.addEventListener('storage', (e) => {
      if (e.key === DEMO_KEY) {
        this.db = lsJSON(DEMO_KEY) || this.db;
        cb();
      }
    });
  }
}

// ---------- Start ----------

let backend = null;

export async function boot() {
  readHashConfig();
  const cfg = getConfig();
  if (!cfg) {
    if (lsGet(MODE_KEY) === 'demo') return startDemo();
    return setPhase('setup');
  }
  if (!window.supabase?.createClient) {
    state.error = 'Die Supabase-Bibliothek konnte nicht geladen werden. Lade die Seite neu.';
    return setPhase('error');
  }
  try {
    backend = new SupabaseBackend(cfg.url, cfg.key);
  } catch (e) {
    state.error = `Die Verbindungsdaten passen nicht: ${e.message}`;
    return setPhase('setup');
  }
  state.mode = 'supabase';
  state.configSource = cfg.source;
  backend.onSignedOut(() => {
    resetData();
    setPhase('login');
  });
  let session = null;
  try {
    session = await backend.session();
  } catch (e) {
    console.warn(e);
  }
  if (!session) return setPhase('login');
  return enter(session);
}

async function enter(session) {
  state.userId = session.user.id;
  state.email = session.user.email;
  try {
    await loadAll();
  } catch (e) {
    console.error(e);
    state.error = describeLoadError(e);
    return setPhase('error');
  }
  if (!state.members.some((m) => m.id === state.userId)) return setPhase('denied');
  try {
    if (await backend.claimSeed()) {
      await seed(state.mode === 'demo');
      await loadAll();
    }
  } catch (e) {
    console.warn('Startinhalte konnten nicht angelegt werden', e);
  }
  backend.subscribe(() => scheduleReload());
  return setPhase(me()?.name ? 'ready' : 'name');
}

function describeLoadError(e) {
  const msg = e?.message || String(e);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return 'Keine Verbindung zur Datenbank. Prüfe deine Internetverbindung oder ob das Supabase-Projekt pausiert ist.';
  }
  if (e?.code === '42P01' || e?.code === 'PGRST205' || /does not exist|Could not find the table/i.test(msg)) {
    return 'Die Datenbank ist noch nicht eingerichtet. Führe das Skript supabase/setup.sql im SQL-Editor von Supabase aus.';
  }
  return `Die Daten konnten nicht geladen werden: ${msg}`;
}

async function startDemo() {
  backend = new DemoBackend();
  state.mode = 'demo';
  lsSet(MODE_KEY, 'demo');
  return enter(await backend.session());
}

export function tryDemo() {
  startDemo();
}

export function leaveDemo() {
  lsDel(MODE_KEY);
  lsDel(DEMO_KEY);
  lsDel(DEMO_FILES_KEY);
  location.reload();
}

function resetData() {
  TABLES.forEach((t) => { state[t] = []; });
  state.settings = {};
  state.urls = {};
  state.userId = null;
  state.email = null;
  state.sheet = null;
}

export async function signIn(email, password) {
  const session = await backend.signIn(email.trim(), password);
  await enter(session);
}

export async function changePassword(password) {
  try {
    await backend.changePassword(password);
    toast('Passwort geändert.');
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}

export async function signOut() {
  try {
    await backend.signOut();
  } catch (e) {
    console.warn(e);
  }
  resetData();
  setPhase('login');
}

// ---------- Startinhalte ----------

async function seed(withDemo) {
  const base = Date.now();
  const ts = (i) => new Date(base + i * 10).toISOString();
  const rooms = SEED_ROOMS.map((r, i) => ({ id: uid(), ...r, sort: i, created_at: ts(i) }));
  const tasks = [];
  let n = 0;
  for (const p of PHASES) {
    for (const title of SEED_CHECKLIST[p.key]) {
      tasks.push({ id: uid(), title, phase: p.key, sort: n, created_at: ts(n) });
      n++;
    }
  }
  const contracts = SEED_CONTRACTS.map((c, i) => ({ id: uid(), ...c, sort: i, created_at: ts(i) }));
  await backend.insert('rooms', rooms);
  await backend.insert('tasks', tasks);
  await backend.insert('contracts', contracts);
  if (withDemo) await seedDemo(rooms, tasks);
}

async function seedDemo(rooms, checklist) {
  const people = [DEMO_ME, DEMO_LISA];
  const today = todayISO();
  await backend.update('settings', 1, { move_date: addDays(today, 38), budget: 8000, address: 'München' });
  const items = DEMO_EXTRAS.items.map((x, i) => ({
    id: uid(), room_id: rooms[x.room].id, title: x.title, price: x.price, status: x.status,
    url: x.url || null, created_by: people[x.by], created_at: new Date(Date.now() - i * 3600e3).toISOString(),
  }));
  await backend.insert('items', items);
  const expenses = [];
  DEMO_EXTRAS.items.forEach((x, i) => {
    if (x.status === 'gekauft') {
      expenses.push({
        id: uid(), title: x.title, amount: x.price, paid_by: people[x.paidBy], room_id: items[i].room_id,
        item_id: items[i].id, date: addDays(today, -2), created_by: people[x.by], created_at: new Date().toISOString(),
      });
    }
  });
  DEMO_EXTRAS.expenses.forEach((x) => expenses.push({
    id: uid(), title: x.title, amount: x.amount, paid_by: people[x.paidBy],
    room_id: x.room != null ? rooms[x.room].id : null, category: x.category || null,
    date: addDays(today, -x.daysAgo), created_by: people[x.paidBy], created_at: new Date().toISOString(),
  }));
  await backend.insert('expenses', expenses);
  await backend.insert('tasks', DEMO_EXTRAS.todos.map((x, i) => ({
    id: uid(), title: x.title, assignee: x.assignee != null ? people[x.assignee] : null,
    due_date: addDays(today, x.inDays), room_id: x.room != null ? rooms[x.room].id : null,
    sort: 1000 + i, created_by: DEMO_ME, created_at: new Date().toISOString(),
  })));
  await backend.insert('boxes', DEMO_EXTRAS.boxes.map((x, i) => ({
    id: uid(), number: i + 1, room_id: rooms[x.room].id, contents: x.contents, fragile: !!x.fragile,
    unpacked: false, created_at: new Date().toISOString(),
  })));
  for (const t of checklist.slice(0, 3)) await backend.update('tasks', t.id, { done: true, done_at: new Date().toISOString() });
}

// ---------- Laden & Live-Aktualisierung ----------

let pending = 0;
let reloadTimer = null;
let urlsAt = 0;

async function loadAll() {
  const data = await backend.loadAll();
  TABLES.forEach((t) => { state[t] = sortRows(t, data[t] || []); });
  state.settings = data.settings || { id: 1 };
  await refreshUrls();
  emit();
}

async function refreshUrls() {
  if (Date.now() - urlsAt > 8 * 3600e3) {
    state.urls = {};
    urlsAt = Date.now();
  }
  const paths = new Set();
  state.files.forEach((f) => paths.add(f.path));
  state.items.forEach((i) => { if (i.image && !isExternal(i.image)) paths.add(i.image); });
  const missing = [...paths].filter((p) => !state.urls[p]);
  if (!missing.length) return;
  try {
    Object.assign(state.urls, await backend.urlsFor(missing));
  } catch (e) {
    console.warn('Bild-Links konnten nicht geladen werden', e);
  }
}

function scheduleReload(delay = 400) {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async () => {
    if (pending > 0) return scheduleReload(500);
    try {
      await loadAll();
    } catch (e) {
      console.warn('Aktualisieren fehlgeschlagen', e);
    }
    return null;
  }, delay);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.phase === 'ready') scheduleReload(50);
});
window.addEventListener('online', () => {
  if (state.phase === 'ready') scheduleReload(50);
});

// ---------- Ändern ----------

export function errorText(e) {
  const m = e?.message || e?.error_description || String(e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung. Bitte gleich nochmal versuchen.';
  if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/Email not confirmed/i.test(m)) return 'Die E-Mail-Adresse ist noch nicht bestätigt.';
  return `Das hat nicht geklappt: ${m}`;
}

function fail(e) {
  console.error(e);
  toast(errorText(e), 'error');
}

const WITH_AUTHOR = ['items', 'expenses', 'tasks', 'files'];

export async function add(table, row) {
  const full = { id: uid(), created_at: new Date().toISOString(), ...row };
  if (WITH_AUTHOR.includes(table) && full.created_by === undefined) full.created_by = state.userId;
  state[table] = sortRows(table, [...state[table], full]);
  emit();
  pending++;
  try {
    await backend.insert(table, full);
    return full;
  } catch (e) {
    state[table] = state[table].filter((r) => r.id !== full.id);
    emit();
    fail(e);
    return null;
  } finally {
    pending--;
  }
}

export async function patch(table, id, changes) {
  const before = state[table].find((r) => r.id === id);
  if (!before) return false;
  state[table] = sortRows(table, state[table].map((r) => (r.id === id ? { ...r, ...changes } : r)));
  emit();
  pending++;
  try {
    await backend.update(table, id, changes);
    return true;
  } catch (e) {
    state[table] = sortRows(table, state[table].map((r) => (r.id === id ? before : r)));
    emit();
    fail(e);
    return false;
  } finally {
    pending--;
  }
}

export async function remove(table, id) {
  const before = state[table];
  state[table] = before.filter((r) => r.id !== id);
  emit();
  pending++;
  try {
    await backend.remove(table, id);
    return true;
  } catch (e) {
    state[table] = before;
    emit();
    fail(e);
    return false;
  } finally {
    pending--;
  }
}

export async function saveSettings(changes) {
  const before = state.settings;
  state.settings = { ...before, ...changes };
  emit();
  pending++;
  try {
    await backend.update('settings', 1, changes);
    return true;
  } catch (e) {
    state.settings = before;
    emit();
    fail(e);
    return false;
  } finally {
    pending--;
  }
}

export async function saveMyName(name) {
  const ok = await patch('members', state.userId, { name: name.trim() });
  if (ok && state.phase === 'name') setPhase('ready');
  return ok;
}

// ---------- Dateien ----------

async function putFile(file, folder, maxDim) {
  const prep = await prepareUpload(file, maxDim);
  const path = `${folder}/${uid()}.${prep.ext}`;
  pending++;
  try {
    await backend.upload(path, prep.blob, prep.type);
  } catch (e) {
    fail(e);
    return null;
  } finally {
    pending--;
  }
  state.urls[path] = URL.createObjectURL(prep.blob);
  return { path, name: prep.name, content_type: prep.type };
}

export async function uploadFile(file, { kind, room_id = null }) {
  const stored = await putFile(file, kind, kind === 'grundriss' ? 3200 : 2000);
  if (!stored) return null;
  return add('files', { kind, room_id, ...stored });
}

export async function uploadItemImage(file) {
  const stored = await putFile(file, 'sachen', 1400);
  return stored ? stored.path : null;
}

export function discardFiles(paths) {
  const own = paths.filter((p) => p && !isExternal(p));
  if (own.length) backend.removeFiles(own).catch((e) => console.warn('Datei nicht gelöscht', e));
}

export async function deleteFile(file) {
  if (await remove('files', file.id)) discardFiles([file.path]);
}

export async function deleteItem(item) {
  state.expenses = state.expenses.map((x) => (x.item_id === item.id ? { ...x, item_id: null } : x));
  if (await remove('items', item.id)) discardFiles([item.image]);
}

export async function deleteRoom(room) {
  const items = state.items.filter((i) => i.room_id === room.id);
  const files = state.files.filter((f) => f.room_id === room.id);
  const paths = [...files.map((f) => f.path), ...items.map((i) => i.image)];
  state.items = state.items.filter((i) => i.room_id !== room.id);
  state.files = state.files.filter((f) => f.room_id !== room.id);
  for (const t of ['expenses', 'tasks', 'boxes']) {
    state[t] = state[t].map((r) => (r.room_id === room.id ? { ...r, room_id: null } : r));
  }
  if (await remove('rooms', room.id)) discardFiles(paths);
  else scheduleReload(0);
}

// ---------- Oberfläche: Dialoge, Hinweise ----------

export function openSheet(renderFn) {
  state.sheet = renderFn;
  emit();
}
export function closeSheet() {
  state.sheet = null;
  emit();
}

let toastTimer = null;
export function toast(text, kind = 'info') {
  state.toast = { text, kind, id: Date.now() };
  emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    emit();
  }, kind === 'error' ? 5000 : 2600);
}

export function confirmDialog(opts) {
  return new Promise((resolve) => {
    state.confirm = {
      ...opts,
      resolve: (v) => {
        state.confirm = null;
        emit();
        resolve(v);
      },
    };
    emit();
  });
}

export function openLightbox(file) {
  state.lightbox = file;
  emit();
}
export function closeLightbox() {
  state.lightbox = null;
  emit();
}

// ---------- Abfragen ----------

export const me = () => state.members.find((m) => m.id === state.userId);
export const memberIndex = (id) => state.members.findIndex((m) => m.id === id);
export function memberName(id, fallback = 'Jemand') {
  const m = state.members.find((x) => x.id === id);
  if (!m) return fallback;
  return m.name || (m.id === state.userId ? 'Ich' : fallback);
}
export const roomById = (id) => state.rooms.find((r) => r.id === id);
export const urlFor = (path) => (isExternal(path) ? path : state.urls[path] || null);
