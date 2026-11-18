'use strict';
/* SetsBuddy cloud sync (Supabase). One JSON snapshot per user; devices merge it with their local data.
 *
 * Merge rules (deterministic, so every device converges on the same result):
 *  - Anything deleted on any device is remembered in `deleted` (id -> time) and stays deleted everywhere.
 *  - Workouts, routines, trackers and tracker entries are combined by id. When both sides have the same
 *    routine/tracker, the more recently edited one wins (updatedAt); entries keep the latest value (t).
 *  - Settings (unit, default rest, weekly plan) come from whichever device changed them last (settingsAt).
 *  - Custom exercise names are combined.
 *  - Identical routines/trackers created separately on two devices (e.g. the starter Push/Pull/Legs and
 *    Body weight) are collapsed into one, keeping the smaller id; the other id is recorded in `aliases`.
 *  - The workout in progress (`active`) never leaves the device.
 */

function sbMergeStates(local, remote) {
  const maxMap = (x = {}, y = {}) => {
    const out = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v || 0);
    return out;
  };
  const deleted = maxMap(local.deleted, remote.deleted);
  const aliases = { ...(remote.aliases || {}), ...(local.aliases || {}) };
  const alive = x => x && !deleted[x.id];

  const byId = (a = [], b = [], pick = (x) => x) => {
    const map = new Map(), order = [];
    for (const x of a) { if (!map.has(x.id)) order.push(x.id); map.set(x.id, x); }
    for (const y of b) {
      if (map.has(y.id)) map.set(y.id, pick(map.get(y.id), y));
      else { order.push(y.id); map.set(y.id, y); }
    }
    return order.map(id => map.get(id));
  };
  const newer = (x, y) => ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);

  // workouts: finished sessions, combined and newest first
  const workouts = byId(local.workouts, remote.workouts, (x, y) => (y.routineId && !x.routineId ? y : x))
    .filter(alive).sort((p, q) => q.start - p.start);

  // routines
  let routines = byId(local.routines, remote.routines, newer).filter(alive);

  // trackers (entries merged inside)
  let trackers = byId(local.trackers, remote.trackers, (x, y) => {
    const meta = newer(x, y);
    const entries = byId(x.entries, y.entries, (e, f) => ((f.t || 0) > (e.t || 0) ? f : e));
    return { ...meta, entries };
  }).filter(alive).map(t => ({ ...t, entries: (t.entries || []).filter(alive) }));

  // collapse duplicates created independently on two devices
  const collapse = (list, sig, combine) => {
    const keep = new Map();
    for (const item of list) {
      const s = sig(item), other = keep.get(s);
      if (!other) { keep.set(s, item); continue; }
      const [winner, loser] = other.id < item.id ? [other, item] : [item, other];
      keep.set(s, combine ? combine(winner, loser) : winner);
      deleted[loser.id] = Math.max(deleted[loser.id] || 0, 1); // tombstone (time 1 = merge artifact)
      aliases[loser.id] = winner.id;
    }
    return list.filter(x => !deleted[x.id]).map(x => keep.get(sig(x)).id === x.id ? keep.get(sig(x)) : x);
  };
  routines = collapse(routines, r => `${r.name.trim().toLowerCase()}|${JSON.stringify(r.exercises.map(e => [e.name, e.sets, e.reps, e.rest]))}`);
  trackers = collapse(trackers, t => `${t.name.trim().toLowerCase()}|${(t.unit || '').trim().toLowerCase()}`,
    (w, l) => ({ ...w, entries: byId(w.entries, l.entries) }));

  const resolve = id => { let seen = 0; while (id && aliases[id] && seen++ < 20) id = aliases[id]; return id; };

  // settings: last writer wins
  const S = (remote.settingsAt || 0) > (local.settingsAt || 0) ? remote : local;
  const plan = (S.plan || local.plan || []).map(p => (p && p !== 'rest' ? resolve(p) : p));
  workouts.forEach(w => { if (w.routineId) w.routineId = resolve(w.routineId); });

  const custom = [];
  for (const n of [...(local.customExercises || []), ...(remote.customExercises || [])]) {
    if (!custom.some(c => c.toLowerCase() === n.toLowerCase())) custom.push(n);
  }

  return {
    ...local,
    unit: S.unit ?? local.unit,
    restDefault: S.restDefault ?? local.restDefault,
    plan,
    settingsAt: Math.max(local.settingsAt || 0, remote.settingsAt || 0),
    customExercises: custom,
    routines, workouts, trackers, deleted, aliases,
    active: local.active
  };
}

const sbShareable = s => { const { active, ...rest } = s; return rest; };

/* ---------- client ---------- */
const Sync = (() => {
  const cfg = window.SETSBUDDY_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseKey);
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  let client = null, user = null, status = configured ? 'starting' : 'off', lastSync = 0, error = '';
  let timer = null, busy = false, again = false;

  const loadLib = () => new Promise((resolve, reject) => {
    if (window.supabase) return resolve();
    const s = document.createElement('script');
    s.src = LIB; s.onload = resolve; s.onerror = () => reject(new Error('Could not load sync library (offline?)'));
    document.head.appendChild(s);
  });

  async function init() {
    if (!configured) return;
    try {
      await loadLib();
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'setsbuddy-auth' }
      });
      const { data } = await client.auth.getSession();
      user = data.session?.user || null;
      status = user ? 'idle' : 'signedout';
      client.auth.onAuthStateChange((_event, session) => {
        const before = user?.id;
        user = session?.user || null;
        status = user ? (status === 'signedout' ? 'idle' : status) : 'signedout';
        if (user && user.id !== before) now();
        refresh();
      });
      refresh();
      if (user) now();
    } catch (e) {
      status = 'error'; error = e.message; refresh();
    }
  }

  async function now() {
    if (!client || !user) return;
    if (busy) { again = true; return; }
    busy = true; status = 'syncing'; refresh();
    try {
      const { data, error: e1 } = await client.from('snapshots').select('data').eq('user_id', user.id).maybeSingle();
      if (e1) throw e1;
      const remote = data?.data || null;
      const merged = remote ? sbMergeStates(state, remote) : state;
      const localChanged = JSON.stringify(sbShareable(merged)) !== JSON.stringify(sbShareable(state));
      if (localChanged) {
        state = merged;
        persist();
        // don't yank the screen out from under someone typing
        const typing = document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
        if (!typing && typeof picker !== 'undefined' && !picker) render();
      }
      if (!remote || JSON.stringify(sbShareable(merged)) !== JSON.stringify(remote)) {
        const { error: e2 } = await client.from('snapshots')
          .upsert({ user_id: user.id, data: sbShareable(merged), updated_at: new Date().toISOString() });
        if (e2) throw e2;
      }
      status = 'synced'; lastSync = Date.now(); error = '';
    } catch (e) {
      status = 'error'; error = e.message || String(e);
    } finally {
      busy = false; refresh();
      if (again) { again = false; schedule(500); }
    }
  }

  function schedule(ms = 2000) {
    if (!client || !user) return;
    clearTimeout(timer); timer = setTimeout(now, ms);
  }

  async function signIn(email, password) {
    const { error: e } = await client.auth.signInWithPassword({ email, password });
    if (e) throw e;
  }
  async function signUp(email, password) {
    const { data, error: e } = await client.auth.signUp({ email, password });
    if (e) throw e;
    return !!data.session; // false = email confirmation required
  }
  async function signOut() { await client.auth.signOut(); status = 'signedout'; refresh(); }

  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function cardHTML() {
    if (!configured) return `<div class="card" id="syncCard"><div class="hero-k">Cloud sync</div>
      <p class="muted small" style="margin:8px 0 0">Not set up yet. Each device keeps its own data until sync is connected.</p></div>`;
    if (status === 'starting') return `<div class="card" id="syncCard"><div class="hero-k">Cloud sync</div><p class="muted small">Connecting…</p></div>`;
    if (!user) return `
      <div class="card" id="syncCard">
        <div class="hero-k">Cloud sync</div>
        <p class="muted small" style="margin:8px 0 12px">Sign in on every device with the same account to keep them in sync.</p>
        ${status === 'error' ? `<p class="small" style="color:var(--danger);margin:0 0 10px">${esc(error)}</p>` : ''}
        <div class="stack">
          <input id="syEmail" type="email" autocomplete="email" inputmode="email" placeholder="Email" aria-label="Email">
          <input id="syPass" type="password" autocomplete="current-password" placeholder="Password (6+ characters)" aria-label="Password" data-enter="syncSignIn">
        </div>
        <div class="form-row" style="margin-top:10px">
          <button class="btn primary" data-act="syncSignIn">Sign in</button>
          <button class="btn" data-act="syncSignUp">Create account</button>
        </div>
      </div>`;
    const label = status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Sync problem' : lastSync ? `Synced ${ago(lastSync)}` : 'Signed in';
    return `
      <div class="card" id="syncCard">
        <div class="between">
          <div><div class="hero-k">Cloud sync</div>
            <div style="margin-top:6px;font-weight:700"><span class="sync-dot ${status}"></span>${label}</div>
            <div class="muted small">${esc(user.email || '')}</div></div>
          <button class="btn small" data-act="syncNow" ${status === 'syncing' ? 'disabled' : ''}>Sync now</button>
        </div>
        ${status === 'error' ? `<p class="small" style="color:var(--danger);margin:10px 0 0">${esc(error)}</p>` : ''}
        <button class="btn ghost small" style="margin-top:10px" data-act="syncSignOut">Sign out</button>
      </div>`;
  }

  function refresh() {
    const el = document.getElementById('syncCard');
    if (!el || el.contains(document.activeElement)) return;
    el.outerHTML = cardHTML();
  }

  // keep devices fresh
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
  window.addEventListener('online', () => schedule(300));
  setInterval(() => { if (document.visibilityState === 'visible') schedule(0); }, 60000);
  setInterval(() => { if (lastSync) refresh(); }, 30000);

  return { init, now, schedule, signIn, signUp, signOut, cardHTML, get user() { return user; }, configured };
})();

Sync.init();
