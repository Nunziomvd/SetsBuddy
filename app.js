'use strict';
/* SetsBuddy — workout + habit tracker. All data stays on the device (localStorage). */

const KEY = 'setsbuddy-v1';
const REST_DEFAULT = 90;
const DEFAULT_EXERCISES = [
  'Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Squat', 'Front Squat', 'Deadlift',
  'Romanian Deadlift', 'Barbell Row', 'Pull Up', 'Chin Up', 'Lat Pulldown', 'Seated Cable Row',
  'Dumbbell Curl', 'Tricep Pushdown', 'Lateral Raise', 'Leg Press', 'Leg Curl', 'Leg Extension',
  'Calf Raise', 'Hip Thrust', 'Lunge', 'Dip', 'Push Up', 'Plank'
];

/* ---------- state ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rx = (name, sets, reps, rest, notes = '') => ({ name, sets, reps, rest, notes });
const starterRoutines = () => [
  { id: uid(), name: 'Push', notes: 'Chest, shoulders, triceps', exercises: [
    rx('Bench Press', 4, '6-8', 150), rx('Overhead Press', 3, '8-10', 120),
    rx('Incline Dumbbell Press', 3, '10-12', 90), rx('Lateral Raise', 3, '12-15', 60), rx('Tricep Pushdown', 3, '12-15', 60)] },
  { id: uid(), name: 'Pull', notes: 'Back, biceps', exercises: [
    rx('Deadlift', 3, '5', 180), rx('Pull Up', 3, '6-10', 120), rx('Barbell Row', 3, '8-10', 120), rx('Dumbbell Curl', 3, '10-12', 60)] },
  { id: uid(), name: 'Legs', notes: 'Quads, hamstrings, glutes', exercises: [
    rx('Squat', 4, '5-8', 180), rx('Romanian Deadlift', 3, '8-10', 120), rx('Leg Press', 3, '10-12', 90),
    rx('Leg Curl', 3, '12', 60), rx('Calf Raise', 4, '12-15', 60)] }
];
const defaultState = () => ({
  version: 2,
  unit: 'lb',
  restDefault: REST_DEFAULT,
  workouts: [],      // finished, newest first
  active: null,      // workout in progress
  routines: starterRoutines(),
  plan: [null, null, null, null, null, null, null], // Mon..Sun: routineId | 'rest' | null
  trackers: [{ id: uid(), name: 'Body weight', unit: 'lb', entries: [] }]
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s === 'object') return Object.assign(defaultState(), s);
  } catch (e) { /* ignore */ }
  return defaultState();
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save on this device'); }
}

let tab = 'workout';
let editing = null;   // routine draft being edited
let progressEx = null;
const rest = { end: 0 };

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmtNum = n => { n = num(n); return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''); };
const fmtBig = n => Math.round(num(n)).toLocaleString();
const fmtDate = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const fmtShort = t => new Date(t).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
const fmtTime = t => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, '0')}`;
}
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const volume = w => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + num(s.weight) * num(s.reps), 0), 0);
const e1rm = s => num(s.weight) * (1 + num(s.reps) / 30); // Epley estimate

function previousSets(name) {
  const k = name.trim().toLowerCase();
  for (const w of state.workouts) {
    const ex = w.exercises.find(e => e.name.trim().toLowerCase() === k);
    if (ex) return ex.sets;
  }
  return [];
}
function exerciseNames() {
  const seen = new Map();
  for (const w of state.workouts) for (const e of w.exercises) {
    const k = e.name.trim().toLowerCase();
    if (!seen.has(k)) seen.set(k, e.name.trim());
  }
  return [...seen.values()];
}
function exerciseLibrary() {
  const names = exerciseNames();
  const have = new Set(names.map(n => n.toLowerCase()));
  return names.concat(DEFAULT_EXERCISES.filter(n => !have.has(n.toLowerCase())));
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------- icons ---------- */
const ICONS = {
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.7-7-6.6 0-3.1 2-5.4 3.6-7 .4 1.8 1.4 3 2.6 3.4C11 7.6 12.2 5 14.6 3c.2 3 1.6 4.6 2.9 6.3 1 1.3 1.5 2.8 1.5 4.9 0 4-3.1 6.8-7 6.8z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0V4zM8 6H4.5v1.5A3.5 3.5 0 008 11M16 6h3.5v1.5A3.5 3.5 0 0116 11M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z"/>',
  bell: '<path d="M12 3a6 6 0 00-6 6c0 4.5-2 6-2 6h16s-2-1.5-2-6a6 6 0 00-6-6zM10 19a2 2 0 004 0"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  chart: '<path d="M3.5 17.5l5.5-5.5 4 4 7.5-8"/><path d="M15 8h5.5v5.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  play: '<path d="M7 5v14l12-7z" fill="currentColor"/>'
};
const ic = (name, extra = '') => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${ICONS[name]}</svg>`;

/* ---------- weekly plan & streaks ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dow = d => (new Date(d).getDay() + 6) % 7; // Monday = 0
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const planFor = d => {
  const p = (state.plan || [])[dow(d)];
  if (p === 'rest') return 'rest';
  return state.routines.find(r => r.id === p) || null;
};
const hasPlan = () => (state.plan || []).some(p => p && p !== 'rest' && state.routines.some(r => r.id === p));
const trainedDays = () => new Set(state.workouts.map(w => dayKey(w.start)));

function planStreak() {
  if (!hasPlan()) return null;
  const done = trainedDays();
  let d = startOfDay(Date.now()), streak = 0;
  const firstWorkout = state.workouts.length ? startOfDay(state.workouts[state.workouts.length - 1].start) : d;
  const p0 = planFor(d);
  if (p0 && p0 !== 'rest' && !done.has(dayKey(d))) d = addDays(d, -1); // today isn't over yet
  for (let i = 0; i < 730 && d >= firstWorkout; i++, d = addDays(d, -1)) {
    const p = planFor(d);
    if (!p || p === 'rest') continue;
    if (done.has(dayKey(d))) streak++; else break;
  }
  return streak;
}

function weekStreak() {
  const weeks = new Set(state.workouts.map(w => dayKey(addDays(startOfDay(w.start), -dow(w.start)))));
  let wk = addDays(startOfDay(Date.now()), -dow(Date.now())), n = 0;
  if (!weeks.has(dayKey(wk))) wk = addDays(wk, -7); // current week can still be saved
  while (weeks.has(dayKey(wk))) { n++; wk = addDays(wk, -7); }
  return n;
}

function todayCard() {
  const today = startOfDay(Date.now());
  const p = planFor(today);
  const done = trainedDays();
  const doneToday = done.has(dayKey(today));
  const ps = planStreak(), ws = weekStreak();
  const monday = addDays(today, -dow(today));
  const strip = DAYS.map((name, i) => {
    const d = addDays(monday, i), k = dayKey(d), pd = planFor(d);
    const isToday = k === dayKey(today), past = d < today;
    const first = state.workouts.length ? startOfDay(state.workouts[state.workouts.length - 1].start) : today;
    const status = done.has(k) ? 'done' : (pd && pd !== 'rest' && past && d >= first ? 'missed' : '');
    const label = pd === 'rest' ? 'Rest' : pd ? esc(pd.name) : '';
    return `<div class="day ${status} ${pd === 'rest' ? 'off' : ''} ${isToday ? 'today' : ''}"><span>${name[0]}</span>
      <b>${done.has(k) ? ic('check') : d.getDate()}</b><small>${label}</small></div>`;
  }).join('');
  let kick, head, sub, startBtn = '';
  if (doneToday) { kick = 'Today · done'; head = 'Session logged'; sub = 'Nice work. Recover well.'; }
  else if (p === 'rest') { kick = 'Today'; head = 'Rest day'; sub = 'Recovery is part of the plan. Train anyway if you like.'; }
  else if (p) {
    kick = `Today · ${p.exercises.length} exercises`; head = esc(p.name); sub = p.exercises.map(e => esc(e.name)).join(' · ');
    startBtn = `<button class="btn primary" data-act="startRoutine" data-id="${p.id}">${ic('play')} Start ${esc(p.name)}</button>`;
  } else if (hasPlan()) { kick = 'Today'; head = 'Open day'; sub = 'Nothing planned. Pick any routine below, or take it easy.'; }
  else { kick = 'Get started'; head = 'Plan your week'; sub = 'Assign routines to days for a daily pick and a streak.'; }
  return `
    <div class="card today-card">
      <div class="between" style="align-items:flex-start">
        <div><div class="hero-k">${kick}</div><div class="hero-t">${head}</div><div class="hero-s">${sub}</div></div>
        <button class="btn small" data-act="editPlan">${ic('edit')}${hasPlan() ? 'Week' : 'Set up'}</button>
      </div>
      ${startBtn}
      <div class="week">${strip}</div>
      <div class="streaks">
        ${ps !== null ? `<div class="streak">${ic('flame')}<div><b>${ps}</b><span>Session streak</span></div></div>` : ''}
        <div class="streak">${ic('cal')}<div><b>${ws}</b><span>Week streak</span></div></div>
      </div>
    </div>`;
}

function viewPlan() {
  const opts = cur => `<option value="" ${!cur ? 'selected' : ''}>— Nothing</option>
    <option value="rest" ${cur === 'rest' ? 'selected' : ''}>Rest day</option>
    ${state.routines.map(r => `<option value="${r.id}" ${cur === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}`;
  return `
    <p class="muted small" style="margin:0 4px 12px">Choose a routine for each day. Only days with a routine count toward your streak, so rest days never break it.</p>
    <div class="card">
      ${DAYS.map((d, i) => `
        <div class="plan-row">
          <span>${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]}</span>
          <select data-field="plan" data-i="${i}" aria-label="${d} plan">${opts((state.plan || [])[i])}</select>
        </div>`).join('')}
    </div>
    <button class="btn primary big" data-act="tab" data-tab="workout">Done</button>`;
}

function viewCalendar() {
  const WEEKS = 12;
  const today = startOfDay(Date.now());
  const start = addDays(today, -dow(today) - (WEEKS - 1) * 7);
  const done = trainedDays();
  const counts = {};
  state.workouts.forEach(w => { const k = dayKey(w.start); counts[k] = (counts[k] || 0) + 1; });
  const first = state.workouts.length ? startOfDay(state.workouts[state.workouts.length - 1].start) : today;
  let cells = '';
  for (let wk = 0; wk < WEEKS; wk++) for (let d = 0; d < 7; d++) {
    const day = addDays(start, wk * 7 + d), k = dayKey(day), pd = planFor(day);
    const cls = day > today ? 'future' : done.has(k) ? 'done'
      : (pd && pd !== 'rest' && day < today && day >= first ? 'missed' : '');
    cells += `<i class="${cls} ${k === dayKey(today) ? 'today' : ''}" style="grid-column:${wk + 2};grid-row:${d + 1}" title="${fmtDate(day)}${counts[k] ? ` · ${counts[k]} workout${counts[k] > 1 ? 's' : ''}` : ''}"></i>`;
  }
  const labels = DAYS.map((n, i) => `<span style="grid-column:1;grid-row:${i + 1}">${i % 2 === 0 ? n[0] : ''}</span>`).join('');
  return `
    <div class="card">
      <div class="between small" style="margin-bottom:12px"><span class="legend" style="margin:0">Last 12 weeks</span>
        <span class="legend"><i class="done"></i>trained ${hasPlan() ? '<i class="missed"></i>missed' : ''}</span></div>
      <div class="cal">${labels}${cells}</div>
    </div>`;
}

/* ---------- views ---------- */
function viewWorkout() {
  const w = state.active;
  if (!w) {
    const recent = [], seen = new Set();
    for (const x of state.workouts) {
      const k = x.name.toLowerCase();
      if (!seen.has(k)) { seen.add(k); recent.push(x); }
      if (recent.length >= 6) break;
    }
    const lastDone = id => state.workouts.find(x => x.routineId === id);
    return `
      ${todayCard()}
      <button class="btn big outline" data-act="start">${ic('plus')} Empty workout</button>
      <div class="section-head"><h2>Routines</h2><button class="btn ghost small" data-act="newRoutine">${ic('plus')} New</button></div>
      ${state.routines.length ? state.routines.map(r => {
        const last = lastDone(r.id);
        return `
        <div class="card routine">
          <h3>${esc(r.name)}</h3>
          <button class="icon" data-act="editRoutine" data-id="${r.id}" aria-label="Edit ${esc(r.name)}">${ic('edit')}</button>
          <div class="meta muted small">${r.exercises.length} exercises · ${r.exercises.reduce((a, e) => a + num(e.sets), 0)} sets${last ? ` · last ${fmtDate(last.start)}` : ''}</div>
          <div class="tags">${r.exercises.map(e => `<span class="tag">${esc(e.name)}</span>`).join('')}</div>
          <button class="btn go" data-act="startRoutine" data-id="${r.id}">${ic('play')} Start</button>
        </div>`;
      }).join('') : `<p class="muted small" style="margin:0 4px">Build a routine once, then start it with one tap.</p>`}
      ${recent.length ? `<h2>Repeat a past workout</h2>` + recent.map(x => `
        <button class="card row-btn" data-act="repeat" data-id="${x.id}">
          <strong>${esc(x.name)}</strong>
          <span class="muted">${x.exercises.map(e => esc(e.name)).join(' · ')}</span>
          <span class="muted">Last done ${fmtDate(x.start)}</span>
        </button>`).join('') : ''}`;
  }
  return `
    <div class="card">
      <input class="title-input" data-field="wname" value="${esc(w.name)}" placeholder="Workout name" aria-label="Workout name">
      <div class="between"><span class="muted small">Started ${fmtTime(w.start)}</span><span class="elapsed" id="elapsed">${fmtDur(Date.now() - w.start)}</span></div>
      <input data-field="wnotes" value="${esc(w.notes || '')}" placeholder="How did it feel? (notes)" aria-label="Workout notes" style="margin-top:8px">
    </div>
    ${w.exercises.map(exerciseCard).join('')}
    <div class="card add-ex">
      <input id="newEx" list="exlib" placeholder="Add exercise…" autocomplete="off" enterkeyhint="done" aria-label="Exercise name">
      <datalist id="exlib">${exerciseLibrary().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <button class="btn" data-act="addEx" aria-label="Add exercise">${ic('plus')}</button>
    </div>
    <div class="actions">
      <button class="btn ghost danger" data-act="discard">Discard</button>
      <button class="btn primary" data-act="finish">${ic('check')} Finish</button>
    </div>`;
}

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];
const restLabel = s => s ? fmtDur(s * 1000) : 'off';

function viewRoutineEdit() {
  const r = editing;
  const isNew = !state.routines.some(x => x.id === r.id);
  return `
    <div class="card">
      <input class="title-input" data-field="r" data-key="name" value="${esc(r.name)}" placeholder="Routine name (e.g. Upper A)" aria-label="Routine name">
      <input data-field="r" data-key="notes" value="${esc(r.notes)}" placeholder="Notes (optional)" aria-label="Routine notes" style="margin-top:6px">
    </div>
    ${r.exercises.map((e, i) => `
      <div class="card">
        <div class="ex-head">
          <input list="exlib" data-field="rex" data-i="${i}" data-key="name" value="${esc(e.name)}" placeholder="Exercise" aria-label="Exercise ${i + 1} name">
          <div class="ex-tools">
            <button class="icon" data-act="rMove" data-i="${i}" data-d="-1" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>${ic('up')}</button>
            <button class="icon" data-act="rMove" data-i="${i}" data-d="1" aria-label="Move down" ${i === r.exercises.length - 1 ? 'disabled' : ''}>${ic('down')}</button>
            <button class="icon" data-act="rRmEx" data-i="${i}" aria-label="Remove exercise">${ic('x')}</button>
          </div>
        </div>
        <div class="rgrid">
          <label>Sets<input inputmode="numeric" data-field="rex" data-i="${i}" data-key="sets" value="${esc(e.sets)}"></label>
          <label>Reps<input data-field="rex" data-i="${i}" data-key="reps" value="${esc(e.reps)}" placeholder="8-12"></label>
          <label>Rest<select data-field="rex" data-i="${i}" data-key="rest">
            ${REST_OPTIONS.map(s => `<option value="${s}" ${num(e.rest) === s ? 'selected' : ''}>${restLabel(s)}</option>`).join('')}
          </select></label>
        </div>
        <input data-field="rex" data-i="${i}" data-key="notes" value="${esc(e.notes)}" placeholder="Notes: tempo, cues, machine setting…" aria-label="Exercise notes" style="margin-top:8px">
      </div>`).join('')}
    <datalist id="exlib">${exerciseLibrary().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <button class="btn outline" style="width:100%;margin-bottom:12px" data-act="rAddEx">${ic('plus')} Add exercise</button>
    <div class="actions">
      <button class="btn ghost" data-act="cancelRoutine">Cancel</button>
      <button class="btn primary" data-act="saveRoutine">Save routine</button>
    </div>
    ${isNew ? '' : `<button class="btn ghost danger" style="width:100%;margin-top:16px" data-act="delRoutine">Delete routine</button>`}`;
}

function exerciseCard(ex, i) {
  const prev = previousSets(ex.name);
  const doneCount = ex.sets.filter(s => s.done).length;
  const chips = [
    `<span class="chip ${doneCount === ex.sets.length ? 'v' : ''}">${doneCount}/${ex.sets.length} sets</span>`,
    ex.target ? `<span class="chip">${esc(ex.target)} reps</span>` : '',
    `<span class="chip">Rest ${restLabel(restFor(ex))}</span>`
  ].join('');
  return `
    <div class="card ex">
      <div class="ex-head">
        <div style="flex:1"><h3>${esc(ex.name)}</h3><div class="chips">${chips}</div>
          ${ex.notes ? `<div class="note">${esc(ex.notes)}</div>` : ''}</div>
        <button class="icon" data-act="rmEx" data-ex="${i}" aria-label="Remove ${esc(ex.name)}">${ic('x')}</button>
      </div>
      <div class="sets">
        <div class="set hdr"><span>Set</span><span>Previous</span><span>${esc(state.unit)}</span><span>Reps</span><span></span></div>
        ${ex.sets.map((s, j) => {
          const p = prev[j];
          return `
          <div class="set ${s.done ? 'done' : ''}">
            <span class="n">${j + 1}</span>
            <span class="prev">${p ? `${fmtNum(p.weight)}×${fmtNum(p.reps)}` : '—'}</span>
            <input inputmode="decimal" data-field="set" data-ex="${i}" data-set="${j}" data-key="weight"
              value="${esc(s.weight)}" placeholder="${p ? esc(fmtNum(p.weight)) : ''}" aria-label="Set ${j + 1} weight">
            <input inputmode="numeric" data-field="set" data-ex="${i}" data-set="${j}" data-key="reps"
              value="${esc(s.reps)}" placeholder="${p ? esc(fmtNum(p.reps)) : esc(targetReps(ex) || '')}" aria-label="Set ${j + 1} reps">
            <button class="check" data-act="toggleSet" data-ex="${i}" data-set="${j}" aria-label="Mark set ${j + 1} done">${ic('check')}</button>
          </div>`;
        }).join('')}
      </div>
      <div class="ex-foot">
        <button class="btn small" data-act="addSet" data-ex="${i}">${ic('plus')} Set</button>
        ${ex.sets.length > 1 ? `<button class="btn ghost small" data-act="rmSet" data-ex="${i}">Remove last</button>` : ''}
      </div>
    </div>`;
}

function viewHistory() {
  if (!state.workouts.length) return `<section class="empty">${ic('cal')}<p>Finished workouts show up here.</p></section>`;
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisWeek = state.workouts.filter(w => w.start >= weekStart).length;
  const thisMonth = state.workouts.filter(w => w.start >= monthStart).length;
  return `
    <div class="stats">
      <div class="stat v"><b>${thisWeek}</b><span>This week</span></div>
      <div class="stat"><b>${thisMonth}</b><span>This month</span></div>
      <div class="stat"><b>${state.workouts.length}</b><span>All time</span></div>
    </div>
    ${viewCalendar()}
    ${state.workouts.map(w => `
      <div class="card">
        <h3>${esc(w.name)}</h3>
        <div class="hist-meta"><span>${fmtDate(w.start)}</span><span>${fmtDur(w.end - w.start)}</span><span>${fmtBig(volume(w))} ${esc(state.unit)}</span></div>
        ${w.prs && w.prs.length ? `<div class="pr"><span class="badge">${ic('trophy', 'style="width:12px;height:12px;stroke-width:2.5"')}PR</span>${w.prs.map(esc).join(' · ')}</div>` : ''}
        <ul class="summary">
          ${w.exercises.map(e => `<li><span>${esc(e.name)}</span><span class="muted">${e.sets.map(s => `${fmtNum(s.weight)}×${fmtNum(s.reps)}`).join(', ')}</span></li>`).join('')}
        </ul>
        ${w.notes ? `<div class="note small">${esc(w.notes)}</div>` : ''}
        <div class="ex-foot">
          <button class="btn ghost small" data-act="repeat" data-id="${w.id}">Repeat</button>
          ${w.routineId && state.routines.some(r => r.id === w.routineId) ? '' : `<button class="btn ghost small" data-act="saveAsRoutine" data-id="${w.id}">Save as routine</button>`}
          <button class="btn ghost small danger" data-act="delW" data-id="${w.id}">Delete</button>
        </div>
      </div>`).join('')}`;
}

function lineChart(points, { height = 150, label = v => fmtNum(v) } = {}) {
  if (points.length === 0) return '';
  const W = 320, H = height, pl = 34, pr = 10, pt = 10, pb = 22;
  const ys = points.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1; min -= pad; max += pad;
  const x = i => points.length === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (points.length - 1);
  const y = v => pt + (H - pt - pb) * (1 - (v - min) / (max - min));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const ticks = [min + pad, (min + max) / 2, max - pad];
  const xLabels = points.length > 1 ? [0, points.length - 1] : [0];
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">
      <defs><linearGradient id="cfill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient></defs>
      ${ticks.map(t => `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke-dasharray="2 3"/>
        <text x="${pl - 6}" y="${y(t) + 3}" text-anchor="end">${label(t)}</text>`).join('')}
      ${points.length > 1 ? `<path d="${path} L${x(points.length - 1).toFixed(1)},${H - pb} L${x(0).toFixed(1)},${H - pb} Z" fill="url(#cfill)"/>` : ''}
      <path d="${path}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="${i === points.length - 1 ? 5 : 3}" fill="${i === points.length - 1 ? 'currentColor' : 'var(--surface)'}" stroke="currentColor" stroke-width="2"/>`).join('')}
      ${xLabels.map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 && points.length > 1 ? 'start' : 'end'}">${fmtShort(points[i].t)}</text>`).join('')}
    </svg>`;
}

function viewProgress() {
  const names = exerciseNames();
  if (!names.length) return `<section class="empty">${ic('chart')}<p>Log a workout to see your progress per exercise.</p></section>`;
  if (!progressEx || !names.includes(progressEx)) progressEx = names[0];
  const k = progressEx.toLowerCase();
  const sessions = [];
  for (const w of [...state.workouts].reverse()) {
    const ex = w.exercises.find(e => e.name.trim().toLowerCase() === k);
    if (!ex || !ex.sets.length) continue;
    const best = ex.sets.reduce((a, s) => (num(s.weight) > num(a.weight) ? s : a), ex.sets[0]);
    sessions.push({
      t: w.start, best,
      top: num(best.weight),
      e1rm: Math.max(...ex.sets.map(e1rm)),
      vol: ex.sets.reduce((a, s) => a + num(s.weight) * num(s.reps), 0),
      sets: ex.sets
    });
  }
  const pr = Math.max(...sessions.map(s => s.top));
  const prE = Math.max(...sessions.map(s => s.e1rm));
  return `
    <select data-field="progEx" aria-label="Exercise">${names.map(n => `<option ${n === progressEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    <div class="stats" style="margin-top:12px">
      <div class="stat v"><b>${fmtNum(pr)}</b><span>Top ${esc(state.unit)}</span></div>
      <div class="stat"><b>${fmtNum(Math.round(prE))}</b><span>Est. 1-rep max</span></div>
      <div class="stat"><b>${sessions.length}</b><span>Sessions</span></div>
    </div>
    <div class="card">
      <div class="legend" style="margin-bottom:12px">Estimated 1-rep max</div>
      ${lineChart(sessions.map(s => ({ t: s.t, y: Math.round(s.e1rm) })), { label: v => Math.round(v) })}
    </div>
    <h2>Recent sessions</h2>
    ${sessions.slice(-10).reverse().map(s => `
      <div class="card">
        <div class="between"><h3 style="font-size:18px">${fmtDate(s.t)}</h3><span class="legend">${fmtBig(s.vol)} ${esc(state.unit)}</span></div>
        <div class="chips" style="margin-top:10px">${s.sets.map(x => `<span class="chip ${x === s.best ? 'v' : ''}">${fmtNum(x.weight)} × ${fmtNum(x.reps)}</span>`).join('')}</div>
      </div>`).join('')}`;
}

function viewTrackers() {
  return `
    <p class="muted small" style="margin:0 4px 12px">Track anything daily: body weight, water, sleep, steps, habits.</p>
    ${state.trackers.map(t => {
      const entries = [...t.entries].sort((a, b) => a.t - b.t);
      const last = entries[entries.length - 1];
      return `
      <div class="card">
        <div class="tracker-top">
          <div><div class="hero-k">${esc(t.name)}</div>
            <div class="big-val">${last ? fmtNum(last.v) : '—'}<small>${esc(t.unit)}</small></div>
            <div class="muted small">${last ? `Latest · ${fmtDate(last.t)}` : 'No entries yet'}</div></div>
          <button class="icon" data-act="delT" data-id="${t.id}" aria-label="Delete tracker ${esc(t.name)}">${ic('x')}</button>
        </div>
        ${entries.length > 1 ? lineChart(entries.slice(-30).map(e => ({ t: e.t, y: e.v })), { height: 110 }) : ''}
        <div class="tracker-log">
          <input id="tv-${t.id}" inputmode="decimal" placeholder="Today's ${esc(t.unit || 'value')}" aria-label="Value for ${esc(t.name)}" data-enter="logT" data-id="${t.id}">
          <button class="btn primary" data-act="logT" data-id="${t.id}">Log</button>
        </div>
        ${entries.length ? `<ul class="entries">${entries.slice(-5).reverse().map(e => `
          <li><span>${fmtDate(e.t)}</span><span>${fmtNum(e.v)} ${esc(t.unit)}
            <button class="icon" data-act="delE" data-id="${t.id}" data-eid="${e.id}" aria-label="Delete entry">${ic('x')}</button></span></li>`).join('')}</ul>` : ''}
      </div>`;
    }).join('')}
    <div class="card">
      <h3 style="margin-bottom:12px">New tracker</h3>
      <div class="form-row">
        <input id="ntName" placeholder="Name (e.g. Water)">
        <input id="ntUnit" placeholder="Unit (e.g. cups)" data-enter="addT">
      </div>
      <button class="btn outline" style="margin-top:10px;width:100%" data-act="addT">${ic('plus')} Add tracker</button>
    </div>
    <h2>Settings & backup</h2>
    <div class="card">
      <div class="between setting" style="padding-top:0">
        <span>Weight unit</span>
        <div class="seg">
          <button class="${state.unit === 'lb' ? 'on' : ''}" data-act="unit" data-u="lb">lb</button>
          <button class="${state.unit === 'kg' ? 'on' : ''}" data-act="unit" data-u="kg">kg</button>
        </div>
      </div>
      <div class="between setting">
        <span>Default rest</span>
        <select data-field="restDefault" aria-label="Default rest time" style="width:auto">
          ${REST_OPTIONS.filter(Boolean).map(s => `<option value="${s}" ${num(state.restDefault) === s ? 'selected' : ''}>${restLabel(s)}</option>`).join('')}
        </select>
      </div>
      <p class="muted small">Data is stored only on this device. Export a backup now and then.</p>
      <div class="form-row">
        <button class="btn" data-act="export">Export backup</button>
        <label class="btn" style="text-align:center">Import backup<input type="file" accept="application/json,.json" data-field="import" hidden></label>
      </div>
    </div>`;
}

const VIEWS = { workout: viewWorkout, history: viewHistory, progress: viewProgress, trackers: viewTrackers };
VIEWS.routine = viewRoutineEdit;
VIEWS.plan = viewPlan;
const TITLES = { workout: 'Train', history: 'History', progress: 'Progress', trackers: 'Track', routine: 'Routine', plan: 'Your week' };

function render() {
  const navTab = tab === 'routine' || tab === 'plan' ? 'workout' : tab;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === navTab));
  const live = tab === 'workout' && state.active;
  $('#kicker').textContent = live ? '● Live session' : new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  $('#title').textContent = live ? 'In session' : TITLES[tab];
  $('#view').innerHTML = VIEWS[tab]();
}

/* ---------- rest timer ---------- */
function startRest(sec) { if (!sec) return; rest.end = Date.now() + sec * 1000; rest.total = sec * 1000; tick(); }
const restFor = ex => (ex.rest !== undefined && ex.rest !== '' ? num(ex.rest) : num(state.restDefault) || REST_DEFAULT);
const targetReps = ex => { const n = parseInt(ex.target, 10); return Number.isFinite(n) ? String(n) : ''; };
function tick() {
  const el = $('#elapsed');
  if (el && state.active) el.textContent = fmtDur(Date.now() - state.active.start);
  const bar = $('#rest');
  if (!rest.end) { bar.classList.add('hidden'); return; }
  const left = rest.end - Date.now();
  if (left <= 0) {
    rest.end = 0; bar.classList.add('hidden');
    toast('Rest done · Next set');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    return;
  }
  bar.classList.remove('hidden');
  if (left > rest.total) rest.total = left;
  $('#restBar').style.width = `${(left / rest.total) * 100}%`;
  $('#restTime').textContent = fmtDur(left + 999);
}
setInterval(tick, 1000);

/* ---------- actions ---------- */
const newWorkout = (name = 'Workout') => ({ id: uid(), name, start: Date.now(), exercises: [] });
const blankSet = (from) => ({ weight: from?.weight ?? '', reps: from?.reps ?? '', done: false });

function addExercise() {
  const input = $('#newEx');
  const name = input && input.value.trim();
  if (!name) { input && input.focus(); return; }
  const prev = previousSets(name);
  const count = prev.length || 3;
  state.active.exercises.push({ name, sets: Array.from({ length: count }, () => blankSet()) });
  save(); render();
  const next = $('#newEx'); if (next) next.scrollIntoView({ block: 'center' });
}

const carryMeta = e => ({ name: e.name, target: e.target || '', rest: e.rest, notes: e.notes || '' });

function startFromRoutine(r) {
  if (state.active && !confirm('Replace the workout in progress?')) return;
  state.active = Object.assign(newWorkout(r.name), { routineId: r.id, notes: '' });
  state.active.exercises = r.exercises.map(e => ({
    name: e.name, target: e.reps, rest: num(e.rest), notes: e.notes || '',
    sets: Array.from({ length: Math.max(1, num(e.sets)) }, () => blankSet())
  }));
  tab = 'workout'; save(); render(); window.scrollTo(0, 0);
}

function findPRs(w) {
  const prs = [];
  for (const e of w.exercises) {
    const k = e.name.trim().toLowerCase();
    let oldW = -1, oldE = -1;
    for (const past of state.workouts) for (const pe of past.exercises) {
      if (pe.name.trim().toLowerCase() !== k) continue;
      for (const s of pe.sets) { oldW = Math.max(oldW, num(s.weight)); oldE = Math.max(oldE, e1rm(s)); }
    }
    if (oldW < 0) continue; // first time doing it, nothing to beat
    const newW = Math.max(...e.sets.map(s => num(s.weight)));
    const newE = Math.max(...e.sets.map(e1rm));
    if (newW > oldW) prs.push(`${e.name} ${fmtNum(newW)} ${state.unit}`);
    else if (newE > oldE + 0.01) prs.push(`${e.name} est. 1RM ${Math.round(newE)}`);
  }
  return prs;
}

const blankRoutine = () => ({ id: uid(), name: '', notes: '', exercises: [rx('', 3, '8-12', num(state.restDefault) || REST_DEFAULT)] });
const openEditor = r => { editing = r; tab = 'routine'; render(); window.scrollTo(0, 0); };

function logTracker(id) {
  const t = state.trackers.find(x => x.id === id);
  const input = $(`#tv-${id}`);
  const raw = input.value.trim();
  if (raw === '' || !Number.isFinite(parseFloat(raw))) { input.focus(); return; }
  const today = dayKey(Date.now());
  const existing = t.entries.find(e => dayKey(e.t) === today);
  if (existing) { existing.v = parseFloat(raw); existing.t = Date.now(); }
  else t.entries.push({ id: uid(), t: Date.now(), v: parseFloat(raw) });
  save(); render(); toast(`${t.name} logged`);
}

function addTracker() {
  const name = $('#ntName').value.trim();
  if (!name) { $('#ntName').focus(); return; }
  state.trackers.push({ id: uid(), name, unit: $('#ntUnit').value.trim(), entries: [] });
  save(); render(); toast('Tracker added');
}

const actions = {
  tab: el => { tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  start: () => { state.active = newWorkout(); save(); render(); setTimeout(() => $('#newEx')?.focus(), 50); },
  repeat: el => {
    if (state.active && !confirm('Replace the workout in progress?')) return;
    const src = state.workouts.find(w => w.id === el.dataset.id);
    state.active = Object.assign(newWorkout(src.name), { routineId: src.routineId, notes: '' });
    state.active.exercises = src.exercises.map(e => ({ ...carryMeta(e), sets: e.sets.map(() => blankSet()) }));
    tab = 'workout'; save(); render(); window.scrollTo(0, 0);
  },
  startRoutine: el => startFromRoutine(state.routines.find(r => r.id === el.dataset.id)),
  editPlan: () => { tab = 'plan'; render(); window.scrollTo(0, 0); },
  newRoutine: () => openEditor(blankRoutine()),
  editRoutine: el => openEditor(JSON.parse(JSON.stringify(state.routines.find(r => r.id === el.dataset.id)))),
  saveAsRoutine: el => {
    const w = state.workouts.find(x => x.id === el.dataset.id);
    openEditor({
      id: uid(), name: w.name, notes: '', fromWorkout: w.id,
      exercises: w.exercises.map(e => rx(e.name, e.sets.length, e.target || fmtNum(e.sets[0].reps), e.rest ?? state.restDefault, e.notes || ''))
    });
  },
  rAddEx: () => {
    const last = editing.exercises[editing.exercises.length - 1];
    editing.exercises.push(rx('', last ? last.sets : 3, last ? last.reps : '8-12', last ? last.rest : state.restDefault));
    render();
    const inputs = document.querySelectorAll('[data-field=rex][data-key=name]');
    inputs[inputs.length - 1]?.focus();
  },
  rRmEx: el => { editing.exercises.splice(+el.dataset.i, 1); render(); },
  rMove: el => {
    const i = +el.dataset.i, j = i + +el.dataset.d, ex = editing.exercises;
    if (j < 0 || j >= ex.length) return;
    [ex[i], ex[j]] = [ex[j], ex[i]]; render();
  },
  cancelRoutine: () => { editing = null; tab = 'workout'; render(); },
  saveRoutine: () => {
    const r = editing;
    r.name = r.name.trim();
    if (!r.name) { toast('Give the routine a name'); $('[data-field=r][data-key=name]').focus(); return; }
    r.exercises = r.exercises
      .filter(e => e.name.trim())
      .map(e => rx(e.name.trim(), Math.min(20, Math.max(1, parseInt(e.sets, 10) || 1)), String(e.reps).trim(), num(e.rest), e.notes.trim()));
    if (!r.exercises.length) { toast('Add at least one exercise'); return; }
    const { fromWorkout, ...clean } = r;
    if (fromWorkout) { const w = state.workouts.find(x => x.id === fromWorkout); if (w) w.routineId = clean.id; }
    const i = state.routines.findIndex(x => x.id === clean.id);
    if (i >= 0) state.routines[i] = clean; else state.routines.push(clean);
    editing = null; tab = 'workout'; save(); render(); toast('Routine saved');
  },
  delRoutine: () => {
    if (!confirm(`Delete the "${editing.name || 'untitled'}" routine? Past workouts stay in History.`)) return;
    state.routines = state.routines.filter(r => r.id !== editing.id);
    editing = null; tab = 'workout'; save(); render();
  },
  addEx: addExercise,
  rmEx: el => {
    const ex = state.active.exercises[+el.dataset.ex];
    if (ex.sets.some(s => s.done) && !confirm(`Remove ${ex.name}?`)) return;
    state.active.exercises.splice(+el.dataset.ex, 1); save(); render();
  },
  addSet: el => {
    const sets = state.active.exercises[+el.dataset.ex].sets;
    sets.push(blankSet(sets[sets.length - 1])); save(); render();
  },
  rmSet: el => { state.active.exercises[+el.dataset.ex].sets.pop(); save(); render(); },
  toggleSet: el => {
    const ex = state.active.exercises[+el.dataset.ex];
    const j = +el.dataset.set, s = ex.sets[j];
    if (!s.done) {
      const p = previousSets(ex.name)[j];
      if (s.weight === '' && p) s.weight = String(p.weight);
      if (s.reps === '') s.reps = p ? String(p.reps) : targetReps(ex);
      if (s.reps === '') { toast('Enter reps first'); return; }
      s.done = true; startRest(restFor(ex));
    } else s.done = false;
    save(); render();
  },
  finish: () => {
    const w = state.active;
    w.exercises = w.exercises
      .map(e => ({ ...carryMeta(e), sets: e.sets.filter(s => s.done || (s.reps !== '' && s.weight !== '')).map(({ weight, reps }) => ({ weight, reps })) }))
      .filter(e => e.sets.length);
    if (!w.exercises.length) {
      if (confirm('No sets logged. Discard this workout?')) { state.active = null; save(); render(); }
      return;
    }
    w.name = w.name.trim() || 'Workout';
    w.notes = (w.notes || '').trim();
    w.end = Date.now();
    w.prs = findPRs(w);
    state.workouts.unshift(w); state.active = null; rest.end = 0;
    save(); tab = 'history'; render(); window.scrollTo(0, 0);
    toast(w.prs.length ? `New PR · ${w.prs[0]}${w.prs.length > 1 ? ` +${w.prs.length - 1}` : ''}` : `Saved · ${fmtBig(volume(w))} ${state.unit} lifted`);
  },
  discard: () => { if (confirm('Discard this workout?')) { state.active = null; rest.end = 0; save(); render(); } },
  delW: el => {
    if (!confirm('Delete this workout from history?')) return;
    state.workouts = state.workouts.filter(w => w.id !== el.dataset.id); save(); render();
  },
  restAdj: el => { rest.end = Math.max(Date.now() + 1000, rest.end + +el.dataset.sec * 1000); tick(); },
  restSkip: () => { rest.end = 0; tick(); },
  logT: el => logTracker(el.dataset.id),
  addT: addTracker,
  delT: el => {
    const t = state.trackers.find(x => x.id === el.dataset.id);
    if (!confirm(`Delete the "${t.name}" tracker and all its entries?`)) return;
    state.trackers = state.trackers.filter(x => x.id !== t.id); save(); render();
  },
  delE: el => {
    const t = state.trackers.find(x => x.id === el.dataset.id);
    t.entries = t.entries.filter(e => e.id !== el.dataset.eid); save(); render();
  },
  unit: el => { state.unit = el.dataset.u; save(); render(); },
  export: () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `setsbuddy-backup-${dayKey(Date.now())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field === 'wname') { state.active.name = el.value; save(); }
  if (el.dataset.field === 'wnotes') { state.active.notes = el.value; save(); }
  if (el.dataset.field === 'r') editing[el.dataset.key] = el.value;
  if (el.dataset.field === 'rex') editing.exercises[+el.dataset.i][el.dataset.key] = el.value;
  if (el.dataset.field === 'set') {
    state.active.exercises[+el.dataset.ex].sets[+el.dataset.set][el.dataset.key] = el.value.trim();
    save();
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.field === 'progEx') { progressEx = el.value; render(); }
  if (el.dataset.field === 'plan') {
    if (!Array.isArray(state.plan)) state.plan = [null, null, null, null, null, null, null];
    state.plan[+el.dataset.i] = el.value || null; save();
  }
  if (el.dataset.field === 'restDefault') { state.restDefault = num(el.value); save(); toast(`Default rest ${restLabel(state.restDefault)}`); }
  if (el.dataset.field === 'import' && el.files[0]) {
    el.files[0].text().then(txt => {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.workouts) || !Array.isArray(data.trackers)) throw new Error('bad file');
      if (!confirm('Replace all current data with this backup?')) return;
      state = Object.assign(defaultState(), data); save(); render(); toast('Backup restored');
    }).catch(() => toast('That file is not a SetsBuddy backup'));
  }
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'newEx') { e.preventDefault(); addExercise(); }
  const act = e.target.dataset.enter;
  if (act) { e.preventDefault(); actions[act](e.target); }
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
