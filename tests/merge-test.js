// Run: node tests/merge-test.js sync.js
// Simulates two devices syncing through one cloud snapshot, using the real merge function from sync.js.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const fnSrc = src.slice(src.indexOf('function sbMergeStates'), src.indexOf('/* ---------- client'));
const { sbMergeStates, sbShareable } = new Function(fnSrc + '; return { sbMergeStates, sbShareable };')();
const clone = x => JSON.parse(JSON.stringify(x));
let failures = 0;
const check = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failures++; };

const rx = (name, sets, reps, rest) => ({ name, sets, reps, rest, notes: '' });
const starters = p => [
  { id: p + 'push', name: 'Push', notes: '', exercises: [rx('Bench Press', 4, '6-8', 150)] },
  { id: p + 'pull', name: 'Pull', notes: '', exercises: [rx('Deadlift', 3, '5', 180)] },
];
const device = p => ({
  unit: 'lb', restDefault: 90, plan: [p + 'push', 'rest', p + 'pull', null, null, null, null],
  workouts: [], active: null, routines: starters(p), customExercises: [],
  trackers: [{ id: p + 'bw', name: 'Body weight', unit: 'lb', entries: [] }]
});

let cloud = null;
const sync = dev => {
  const merged = cloud ? sbMergeStates(dev, cloud) : dev;
  cloud = clone(sbShareable(merged));
  return merged;
};

let A = device('a'), B = device('b');
A.workouts.push({ id: 'w1', name: 'Push', routineId: 'apush', start: 1000, end: 2000, exercises: [] });
A.trackers[0].entries.push({ id: 'e1', t: 1000, v: 182 });
B.workouts.push({ id: 'w2', name: 'Pull', routineId: 'bpull', start: 3000, end: 4000, exercises: [] });
B.customExercises.push('Zercher Squat');
B.active = { id: 'live', exercises: [] };

A = sync(A); B = sync(B); A = sync(A); B = sync(B);
const same = (x, y) => JSON.stringify(sbShareable(x)) === JSON.stringify(sbShareable(y));

check('both devices converge to identical data', same(A, B));
check('starter routines are not duplicated', A.routines.length === 2);
check('Body weight tracker is not duplicated', A.trackers.length === 1);
check('tracker entry from A survives the collapse', A.trackers[0].entries.some(e => e.id === 'e1'));
check('workouts from both devices kept', A.workouts.map(w => w.id).join() === 'w2,w1');
check('newest workout listed first', A.workouts[0].start === 3000);
check('workout routine ids point at surviving routines', A.workouts.every(w => A.routines.some(r => r.id === w.routineId)));
check('weekly plan points at surviving routines', A.plan.filter(p => p && p !== 'rest').every(id => A.routines.some(r => r.id === id)));
check('custom exercise reached device A', A.customExercises.includes('Zercher Squat'));
check('live workout stays on its own device', B.active && B.active.id === 'live' && !A.active && !('active' in cloud));

// stability: syncing again changes nothing
const before = JSON.stringify(cloud);
A = sync(A); B = sync(B);
check('repeat syncs are stable', JSON.stringify(cloud) === before);

// delete on A propagates to B
A.workouts = A.workouts.filter(w => w.id !== 'w2'); A.deleted = { ...A.deleted, w2: 5000 };
A = sync(A); B = sync(B);
check('deleting a workout on one device removes it on the other', !B.workouts.some(w => w.id === 'w2'));

// settings: later change wins
B.unit = 'kg'; B.settingsAt = 9000;
B = sync(B); A = sync(A);
check('newer unit setting wins on other device', A.unit === 'kg');
A.restDefault = 120; A.settingsAt = 9500;
A = sync(A); B = sync(B);
check('then a newer change from A wins back', B.restDefault === 120 && B.unit === 'kg');

// routine edit: newer updatedAt wins
const rid = A.routines[0].id;
B.routines = B.routines.map(r => r.id === rid ? { ...r, name: 'Push Day', updatedAt: 10000 } : r);
B = sync(B); A = sync(A);
check('edited routine name reaches other device', A.routines.find(r => r.id === rid).name === 'Push Day');

// tracker entry updated the same day: latest value wins
const tid = A.trackers[0].id;
B.trackers[0].entries = B.trackers[0].entries.map(e => e.id === 'e1' ? { ...e, v: 181.4, t: 11000 } : e);
B = sync(B); A = sync(A);
check('re-logged tracker value updates other device', A.trackers.find(t => t.id === tid).entries.find(e => e.id === 'e1').v === 181.4);

// offline edits on both, then both sync
A.workouts.push({ id: 'w3', start: 12000, end: 13000, exercises: [] });
B.workouts.push({ id: 'w4', start: 12500, end: 13500, exercises: [] });
A = sync(A); B = sync(B); A = sync(A);
check('edits made offline on both devices are combined', same(A, B) && ['w3', 'w4'].every(id => A.workouts.some(w => w.id === id)));

console.log(failures ? `\n${failures} FAILED` : '\nAll merge tests passed');
process.exit(failures ? 1 : 0);
