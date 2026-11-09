// Synthetic fixtures only. No personal records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDiary, setDayDate, setCompleted, parseLocalTimestamp, timestampOptions, localDateTime, nextDate, validDate, validateEvent, validateBackup, parseBackup, serializeBackup, sortEvents, computeDayTotals, outsideSession } from '../js/model.js';
process.env.TZ = 'Europe/Paris';
export function entry(id, kind, local, volumeMl = null) {
  return { id, kind, ...parseLocalTimestamp(local), volumeMl,
    drinkType: kind === 'drink' ? 'water' : null, drinkLabel: '', urgency: null, remarks: '' };
}
function nightDiary() {
  const data = emptyDiary(); setDayDate(data, 'day-1', '2040-11-09');
  data.days[0].events = [
    entry('bed', 'bedtime', '2040-11-09T22:15'), entry('night', 'void', '2040-11-10T03:10', 120),
    entry('wake', 'wake', '2040-11-10T06:50'), entry('morning', 'void', '2040-11-10T07:00', 230),
    entry('day', 'void', '2040-11-09T14:00', 180), entry('drink', 'drink', '2040-11-09T12:00', 175),
  ]; return data;
}
test('three independent, non-consecutive dates; duplicate dates rejected', () => {
  const data = emptyDiary();
  [9,12,18].forEach((date,i) => setDayDate(data, `day-${i+1}`, `2040-11-${date}`.replace('-9','-09')));
  assert.deepEqual(data.days.map(d => d.startDate), ['2040-11-09','2040-11-12','2040-11-18']);
  assert.throws(() => setDayDate(data, 'day-2', '2040-11-09'), /déjà/);
  assert.deepEqual(validateBackup(data), []);
});
test('manual completion, reopening and date correction preserve events', () => {
  const data = nightDiary(), original = structuredClone(data.days[0].events);
  setCompleted(data.days[0], true); assert.equal(data.days[0].status, 'completed');
  assert.ok(data.days[0].completedAt); setCompleted(data.days[0], false);
  assert.equal(data.days[0].completedAt, null); setDayDate(data, 'day-1', '2040-11-08');
  assert.deepEqual(data.days[0].events, original);
  assert.equal(outsideSession(data.days[0], original[1]), true);
});
test('overnight count excludes first morning; night volume includes it once', () => {
  const totals = computeDayTotals(nightDiary().days[0]);
  assert.equal(totals.nightCount, 1); assert.equal(totals.dayCount, 2);
  assert.equal(totals.nightVolume, 350); assert.equal(totals.urineVolume, 530); assert.equal(totals.drinkVolume, 175);
  assert.equal(totals.classes.morning, 'first-morning'); assert.equal(totals.classes.night, 'night');
});
test('boundaries: bedtime is day; wake instant is first morning; later void is day', () => {
  const day = nightDiary().days[0];
  day.events.push(entry('bed-edge', 'void', '2040-11-09T22:15', 50), entry('wake-edge', 'void', '2040-11-10T06:50', 70));
  const totals = computeDayTotals(day);
  assert.equal(totals.classes['bed-edge'], 'day'); assert.equal(totals.classes['wake-edge'], 'first-morning');
  assert.equal(totals.classes.morning, 'day'); assert.equal(totals.nightVolume, 190);
});
test('missing or reversed sleep markers yield unavailable counts, not guessed zeros', () => {
  const day = nightDiary().days[0]; day.events = day.events.filter(e => e.kind !== 'wake');
  assert.equal(computeDayTotals(day).nightCount, null); assert.equal(computeDayTotals(day).urineVolume, 530);
  day.events.push(entry('bad-wake', 'wake', '2040-11-09T06:00'));
  assert.equal(computeDayTotals(day).window.state, 'invalid'); assert.equal(computeDayTotals(day).nightVolume, null);
});
test('missing morning urine explicitly provisional; later edit recalculates', () => {
  const day = nightDiary().days[0]; day.events = day.events.filter(e => e.id !== 'morning');
  assert.equal(computeDayTotals(day).morningMissing, true);
  assert.equal(computeDayTotals(day).nightVolume, 120);
  day.events = day.events.map(e => e.id === 'night' ? entry('night', 'void', '2040-11-09T20:00', 120) : e);
  assert.equal(computeDayTotals(day).nightCount, 0);
});
test('full instant ordering, stable ties and editing across midnight', () => {
  const events = [entry('z', 'void', '2040-11-10T00:10', 1), entry('b', 'void', '2040-11-09T23:50', 1), entry('a', 'void', '2040-11-09T23:50', 1)];
  assert.deepEqual(sortEvents(events).map(e => e.id), ['a','b','z']);
  events[0] = entry('z', 'void', '2040-11-09T22:00', 1);
  assert.deepEqual(sortEvents(events).map(e => e.id), ['z','a','b']);
});
test('timestamps retain UTC and local offset; local calendar is not UTC date', () => {
  const t = parseLocalTimestamp('2040-11-09T00:15');
  assert.equal(t.occurredAt, '2040-11-08T23:15:00.000Z'); assert.equal(t.offsetMinutes, 60);
  assert.equal(localDateTime(new Date(t.occurredAt)), '2040-11-09T00:15');
  assert.equal(nextDate('2040-02-28'), '2040-02-29'); assert.equal(validDate('2041-02-29'), false);
});
test('DST: spring gap rejected, autumn repeated hour selectable and distinct', () => {
  assert.throws(() => parseLocalTimestamp('2026-03-29T02:30'), /n’existe pas/);
  const options = timestampOptions('2026-10-25T02:30'); assert.equal(options.length, 2);
  assert.deepEqual(options.map(t => t.offsetMinutes), [120,60]);
  assert.notEqual(parseLocalTimestamp('2026-10-25T02:30',120).occurredAt, parseLocalTimestamp('2026-10-25T02:30',60).occurredAt);
});
test('positive integer volumes; optional urgency stays null', () => {
  const valid = entry('v', 'void', '2040-11-09T12:00', 175);
  assert.deepEqual(validateEvent(valid), []);
  for (const volumeMl of [0,-1,1.5,10001,NaN,Infinity,'175',null]) assert.ok(validateEvent({ ...valid, volumeMl }).length);
  assert.deepEqual(validateEvent({ ...valid, volumeMl:10000 }), []);
  assert.ok(validateEvent({ ...valid, urgency:'invented' }).length);
});
test('backup round-trip contains every field and does not invent urgency', () => {
  const original = nightDiary(); original.days[0].events[1].remarks = '<script>test</script>\nÉté & café';
  assert.deepEqual(parseBackup(serializeBackup(original)), original);
  assert.equal(parseBackup(serializeBackup(original)).days[0].events[1].urgency, null);
});
test('malformed/oversized/unsupported and malicious backups rejected without mutation', () => {
  const data = nightDiary(), before = JSON.stringify(data);
  for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...data, schemaVersion:2 }), '{"__proto__":{"bad":true}}']) assert.throws(() => parseBackup(text));
  assert.throws(() => parseBackup(' '.repeat(16_000_001)), /16 Mo/);
  const duplicate = structuredClone(data); duplicate.days[1].startDate = '2040-11-12'; duplicate.days[1].status='in_progress'; duplicate.days[1].events=[data.days[0].events[0]];
  assert.ok(validateBackup(duplicate).some(e => e.includes('identifiant')));
  const wrongTime = structuredClone(data); wrongTime.days[0].events[0].offsetMinutes=0;
  assert.ok(validateBackup(wrongTime).length);
  const missing = structuredClone(data); delete missing.days[0].events[0].urgency; assert.ok(validateBackup(missing).length);
  const duplicateSleep = structuredClone(data); duplicateSleep.days[0].events.push({ ...duplicateSleep.days[0].events[0], id:'another' }); assert.ok(validateBackup(duplicateSleep).length);
  assert.equal(JSON.stringify(data), before);
});
