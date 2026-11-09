// Pure domain functions. Instants sort in UTC; original wall time is retained for travel.
export const SCHEMA_VERSION = 1;
export const MAX_EVENTS = 1000;
export const MAX_BACKUP_BYTES = 16_000_000;
export const DRINKS = { water: 'Eau', coffee: 'Café', tea: 'Thé', herbal: 'Tisane', other: 'Autre' };
export const URGENCIES = { normal: 'Normale', urgent: 'Envie pressante', very_urgent: 'Urgence importante' };
export const KINDS = { drink: 'Boisson', void: 'Miction', bedtime: 'Coucher', wake: 'Réveil final' };
export function emptyDiary() {
  return { format: 'x2-diary', schemaVersion: SCHEMA_VERSION, days: [1, 2, 3].map(slot => ({
    id: `day-${slot}`, slot, startDate: null, status: 'not_started', completedAt: null, events: [],
  })) };
}
const pad = n => String(n).padStart(2, '0');
export function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function today() { return localDateTime().slice(0, 10); }
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value && +value.slice(0, 4) >= 1900 && +value.slice(0, 4) <= 2199;
}
export function nextDate(value) {
  const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function validLocal(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && validDate(value.slice(0, 10)) && +value.slice(11, 13) < 24 && +value.slice(14) < 60;
}
export function offsetLabel(minutes) {
  return `UTC${minutes < 0 ? '−' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}
export function timestampOptions(value) {
  if (!validLocal(value)) return [];
  const d = new Date(value);
  if (!Number.isFinite(+d) || localDateTime(d) !== value) return []; // DST spring gap
  const candidates = [];
  // Accommodates repeated wall times, including half-hour DST transitions.
  for (let delta = -180; delta <= 180; delta += 15) {
    const candidate = new Date(+d + delta * 60_000);
    if (localDateTime(candidate) === value) candidates.push({
      occurredAt: candidate.toISOString(), localDateTime: value,
      offsetMinutes: -candidate.getTimezoneOffset(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
  }
  return candidates.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
export function parseLocalTimestamp(value, offset) {
  const options = timestampOptions(value);
  const choice = offset === undefined ? options[0] : options.find(t => t.offsetMinutes === offset);
  if (!choice) throw new Error('Cette heure locale n’existe pas ou est invalide. Vérifiez la date, l’heure et le changement d’heure.');
  return choice;
}
export function sortEvents(events) {
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}
export function getNightWindow(day) {
  const bed = day.events.find(e => e.kind === 'bedtime');
  const wake = day.events.find(e => e.kind === 'wake');
  if (!bed || !wake) return { state: 'incomplete' };
  if (bed.occurredAt >= wake.occurredAt) return { state: 'invalid' };
  return { state: 'valid', start: bed.occurredAt, end: wake.occurredAt };
}
export function classifyVoid(event, window, firstMorningId) {
  if (window.state !== 'valid') return 'indeterminate';
  if (event.id === firstMorningId) return 'first-morning';
  return event.occurredAt > window.start && event.occurredAt < window.end ? 'night' : 'day';
}
export function computeDayTotals(day) {
  const events = sortEvents(day.events);
  const window = getNightWindow(day);
  const voids = events.filter(e => e.kind === 'void');
  const morning = window.state === 'valid' ? voids.find(e => e.occurredAt >= window.end) : undefined;
  const classes = Object.fromEntries(voids.map(e => [e.id, classifyVoid(e, window, morning?.id)]));
  const nights = voids.filter(e => classes[e.id] === 'night');
  const sum = list => list.reduce((total, e) => total + e.volumeMl, 0);
  return {
    drinkVolume: sum(events.filter(e => e.kind === 'drink')), urineVolume: sum(voids), voidCount: voids.length,
    dayCount: window.state === 'valid' ? voids.length - nights.length : null,
    nightCount: window.state === 'valid' ? nights.length : null,
    nightVolume: window.state === 'valid' ? sum(nights) + (morning?.volumeMl || 0) : null,
    firstMorningId: morning?.id || null, morningMissing: window.state === 'valid' && !morning,
    window, classes,
  };
}
export function outsideSession(day, timestamp) {
  return !!day.startDate && (timestamp.localDateTime.slice(0, 10) < day.startDate || timestamp.localDateTime.slice(0, 10) > nextDate(day.startDate));
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function keys(value, allowed) { return Object.keys(value).every(k => allowed.includes(k)); }
const instant = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export function validateEvent(event) {
  const errors = [];
  if (!object(event)) return ['Événement invalide.'];
  if (!keys(event, ['id', 'kind', 'occurredAt', 'localDateTime', 'offsetMinutes', 'timeZone', 'volumeMl', 'drinkType', 'drinkLabel', 'urgency', 'remarks'])) errors.push('Champs inconnus dans un événement.');
  if (typeof event.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(event.id)) errors.push('Identifiant d’événement invalide.');
  if (!Object.hasOwn(KINDS, event.kind)) errors.push('Type d’événement invalide.');
  if (!instant(event.occurredAt) || !validLocal(event.localDateTime) || !Number.isInteger(event.offsetMinutes) || Math.abs(event.offsetMinutes) > 840) {
    errors.push('Horodatage invalide.');
  } else if (new Date(Date.parse(event.occurredAt) + event.offsetMinutes * 60_000).toISOString().slice(0, 16) !== event.localDateTime) errors.push('Date locale et instant incohérents.');
  if (typeof event.timeZone !== 'string' || event.timeZone.length > 80) errors.push('Fuseau horaire invalide.');
  else { try { new Intl.DateTimeFormat('fr', { timeZone: event.timeZone }); } catch { errors.push('Fuseau horaire inconnu.'); } }
  if (event.kind === 'drink' || event.kind === 'void') {
    if (!Number.isInteger(event.volumeMl) || event.volumeMl < 1 || event.volumeMl > 10_000) errors.push('Saisissez un volume entier de 1 à 10 000 ml.');
  } else if (event.volumeMl !== null) errors.push('Un repère de sommeil ne contient pas de volume.');
  if (event.kind === 'drink') {
    if (!Object.hasOwn(DRINKS, event.drinkType)) errors.push('Choisissez une boisson.');
  } else if (event.drinkType !== null || event.drinkLabel !== '') errors.push('Boisson inattendue.');
  if (typeof event.drinkLabel !== 'string' || event.drinkLabel.length > 80) errors.push('Le nom de boisson est limité à 80 caractères.');
  if (event.urgency !== null && (event.kind !== 'void' || !Object.hasOwn(URGENCIES, event.urgency))) errors.push('Urgence invalide.');
  if (typeof event.remarks !== 'string' || event.remarks.length > 500) errors.push('Les remarques sont limitées à 500 caractères.');
  return errors;
}
export function validateDay(day, slot) {
  if (!object(day)) return ['Journée invalide.'];
  const errors = [];
  if (!keys(day, ['id', 'slot', 'startDate', 'status', 'completedAt', 'events']) || day.id !== `day-${slot}` || day.slot !== slot) errors.push('Emplacement de journée invalide.');
  if (!['not_started', 'in_progress', 'completed'].includes(day.status)) errors.push('État de journée invalide.');
  if (day.startDate !== null && !validDate(day.startDate)) errors.push('Date de journée invalide.');
  if (day.status === 'not_started' && (day.startDate !== null || day.events?.length || day.completedAt !== null)) errors.push('Une journée non commencée doit être vide.');
  if (day.status !== 'not_started' && day.startDate === null) errors.push('Date de journée manquante.');
  if (day.status === 'completed' ? !instant(day.completedAt) : day.completedAt !== null) errors.push('Date de fin incohérente.');
  if (!Array.isArray(day.events) || day.events.length > MAX_EVENTS) return [...errors, 'Une journée est limitée à 1 000 événements.'];
  for (const event of day.events) errors.push(...validateEvent(event));
  for (const kind of ['bedtime', 'wake']) if (day.events.filter(e => e?.kind === kind).length > 1) errors.push('Un seul coucher et un seul réveil final par journée.');
  return errors;
}
export function validateBackup(data) {
  if (!object(data)) return ['Le fichier ne contient pas une sauvegarde X2.'];
  const errors = [];
  if (!keys(data, ['format', 'schemaVersion', 'exportedAt', 'days']) || data.format !== 'x2-diary' || data.schemaVersion !== SCHEMA_VERSION) errors.push('Format ou version de sauvegarde non pris en charge.');
  if (data.exportedAt !== undefined && !instant(data.exportedAt)) errors.push('Date de sauvegarde invalide.');
  if (!Array.isArray(data.days) || data.days.length !== 3) return [...errors, 'La sauvegarde doit contenir les trois journées.'];
  data.days.forEach((d, i) => errors.push(...validateDay(d, i + 1)));
  const dates = data.days.map(d => d?.startDate).filter(Boolean);
  if (new Set(dates).size !== dates.length) errors.push('Deux journées ne peuvent pas commencer à la même date.');
  const ids = data.days.flatMap(d => Array.isArray(d?.events) ? d.events.map(e => e?.id) : []);
  if (new Set(ids).size !== ids.length) errors.push('Des événements possèdent le même identifiant.');
  return [...new Set(errors)];
}
export function assertDiary(data) {
  const errors = validateBackup(data);
  if (errors.length) throw new Error(errors.join(' '));
  return { format: 'x2-diary', schemaVersion: SCHEMA_VERSION, days: structuredClone(data.days) };
}
export function serializeBackup(diary) {
  return JSON.stringify({ ...assertDiary(diary), exportedAt: new Date().toISOString() }, null, 2);
}
export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Le fichier dépasse la limite de 16 Mo.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Ce fichier n’est pas un document JSON valide.'); }
  return assertDiary(data);
}
export function setDayDate(diary, dayId, date) {
  if (!validDate(date)) throw new Error('Choisissez une date valide.');
  if (diary.days.some(d => d.id !== dayId && d.startDate === date)) throw new Error('Cette date est déjà attribuée à une autre journée.');
  const day = diary.days.find(d => d.id === dayId);
  if (!day) throw new Error('Journée inconnue.');
  if (day.status === 'completed') throw new Error('Rouvrez cette journée avant de corriger sa date.');
  day.startDate = date;
  if (day.status === 'not_started') day.status = 'in_progress';
}
export function setCompleted(day, complete) {
  if (!day.startDate) throw new Error('Commencez cette journée avant de la terminer.');
  day.status = complete ? 'completed' : 'in_progress';
  day.completedAt = complete ? new Date().toISOString() : null;
}
