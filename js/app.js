import { emptyDiary, today, localDateTime, parseLocalTimestamp, timestampOptions, offsetLabel, KINDS, MAX_BACKUP_BYTES, validateEvent, assertDiary, serializeBackup, parseBackup, setDayDate, setCompleted, outsideSession, getNightWindow } from './model.js';
import { openDatabase, readDiary, writeDiary, readSelection, writeSelection, ConflictError } from './db.js';
import { renderTabs, renderHistory, formatDate, stateLabel } from './ui.js';
import { buildReport } from './export-pdf.js';
const $ = selector => document.querySelector(selector);
let diary = emptyDiary(), revision = 0, db, ready = false, busy = false, active = 'day-1';
let editing = null, eventKind, restoreCandidate, dirty = false, toastTimer, registration, requestedUpdate = false;
let channel;
try { channel = new BroadcastChannel('x2-changes'); } catch { /* Transactions still protect concurrent writes. */ }
const currentDay = () => diary.days.find(d => d.id === active);
function toast(text) { clearTimeout(toastTimer); $('#toast').textContent = text; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function inlineError(selector, error) { const node = $(selector); node.textContent = error?.message || String(error); node.hidden = false; }
function storageError(error) {
  $('#storage-error-text').textContent = `${error?.message || 'Le stockage local est indisponible.'} Aucun nouvel enregistrement n’a été confirmé. Si votre journal est visible, sauvegardez-le en JSON avant de réessayer. Le mode privé ou un espace insuffisant peut empêcher l’enregistrement.`;
  $('#storage-error').hidden = false;
}
function showDialog(id) { $(id).showModal(); }
function closeDialog(dialog) {
  if (busy) return;
  if ((dialog.id === 'event-dialog' || dialog.id === 'date-dialog') && dirty && !confirm('Fermer sans enregistrer vos modifications ?')) return;
  dialog.close(); dirty = false;
}
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => closeDialog(button.closest('dialog')));
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
function render() {
  $('#loading').hidden = true; $('#journal').hidden = !ready;
  if (!ready) return;
  const day = currentDay(), completed = day.status === 'completed';
  $('#journal').classList.toggle('started', !!day.startDate);
  renderTabs(diary, active, async id => {
    if (busy) return;
    try { await writeSelection(db, id); active = id; render(); }
    catch (error) { storageError(error); }
  });
  $('#day-state').textContent = stateLabel(day);
  $('#day-heading').textContent = `Jour ${day.slot}`;
  $('#day-date').textContent = day.startDate ? formatDate(day.startDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'La date sera celle de votre première saisie.';
  $('#date-button').textContent = day.startDate ? 'Corriger la date' : 'Choisir la date';
  $('#date-button').disabled = completed || busy;
  $('#day-guidance').textContent = completed ? 'Cette journée est terminée. Vous pouvez la rouvrir pour la corriger.' : 'Gardez ce jour sélectionné pendant la nuit et pour la première miction du matin.';
  for (const button of document.querySelectorAll('[data-kind]')) button.disabled = completed || busy;
  renderHistory(day, event => openEvent(event.kind, event));
  $('#complete-button').textContent = completed ? 'Rouvrir cette journée' : 'Terminer cette journée';
  $('#complete-button').disabled = !day.startDate || busy;
  $('#completion-note').textContent = completed ? 'Les saisies restent consultables et exportables.' : 'Rien ne se termine automatiquement, même après minuit.';
}
async function initialise() {
  try {
    if (!db) db = await openDatabase();
    ({ diary, revision } = await readDiary(db));
    if (!ready) active = await readSelection(db);
    ready = true; $('#storage-error').hidden = true;
    render();
  } catch (error) { $('#loading').hidden = true; storageError(error); }
}
$('#retry-storage').addEventListener('click', initialise);
// Every successful UI change follows transaction completion, never an optimistic save.
async function persist(next) {
  if (!ready || busy) throw new Error('Le stockage local n’est pas encore disponible.');
  busy = true; document.querySelectorAll('dialog button').forEach(b => b.disabled = true);
  try {
    const checked = assertDiary(next);
    const newRevision = await writeDiary(db, checked, revision);
    diary = checked; revision = newRevision;
    $('#storage-error').hidden = true;
    channel?.postMessage('changed'); // No diary content in inter-window messages.
  } catch (error) {
    if (error instanceof ConflictError) {
      ({ diary, revision } = await readDiary(db));
      toast(error.message);
    } else storageError(error);
    throw error;
  } finally {
    busy = false; document.querySelectorAll('dialog button').forEach(b => b.disabled = false); render();
  }
}
channel?.addEventListener('message', async () => {
  if (!ready || busy) return;
  if (document.querySelector('dialog[open]')) { toast('Une autre fenêtre a modifié le journal. Votre prochaine validation vérifiera les données récentes.'); return; }
  await initialise();
});
$('#options-button').addEventListener('click', () => { $('#restore-error').hidden = true; showDialog('#options-dialog'); });
$('#help-button').addEventListener('click', () => showDialog('#help-dialog'));
$('#persist-button').addEventListener('click', async () => {
  try {
    const supported = !!navigator.storage?.persist;
    const granted = supported && await navigator.storage.persist();
    $('#persist-status').textContent = granted ? 'La conservation a été accordée par le navigateur. Gardez malgré tout une sauvegarde.' : 'Ce navigateur ne garantit pas la conservation. Une sauvegarde JSON régulière reste nécessaire.';
  } catch { $('#persist-status').textContent = 'La demande n’a pas abouti. Conservez une sauvegarde JSON.'; }
});
function refreshOffsets() {
  const value = $('#event-time').value;
  const options = timestampOptions(value);
  const select = $('#event-offset'); select.replaceChildren();
  for (const option of options) {
    const node = document.createElement('option'); node.value = String(option.offsetMinutes); node.textContent = offsetLabel(option.offsetMinutes); select.append(node);
  }
  $('#offset-field').hidden = options.length < 2;
  if (editing && editing.localDateTime === value) {
    $('#time-zone-note').textContent = `Heure d’origine : ${editing.timeZone}, ${offsetLabel(editing.offsetMinutes)}. Modifier l’heure utilise le fuseau actuel de cet appareil.`;
    if (options.some(t => t.offsetMinutes === editing.offsetMinutes)) select.value = String(editing.offsetMinutes);
  } else $('#time-zone-note').textContent = `Heure locale de cet appareil : ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Vérifiez aussi la date après minuit.`;
}
function openEvent(kind, event = null) {
  if (!ready || busy || currentDay().status === 'completed') return;
  const existing = event || (['bedtime', 'wake'].includes(kind) ? currentDay().events.find(e => e.kind === kind) : null);
  editing = existing ? structuredClone(existing) : null; eventKind = kind;
  $('#event-form').reset(); $('#event-error').hidden = true;
  $('#event-title').textContent = `${editing ? 'Modifier · ' : ''}${kind === 'bedtime' ? 'Je me couche' : kind === 'wake' ? 'Je me réveille' : KINDS[kind]}`;
  $('#event-session').textContent = `Rattaché au jour ${currentDay().slot}${currentDay().startDate ? ` du ${formatDate(currentDay().startDate)}` : ' · la date de début sera celle d’aujourd’hui'}.`;
  $('#event-time').value = editing?.localDateTime || localDateTime();
  $('#drink-fields').hidden = kind !== 'drink'; $('#void-fields').hidden = kind !== 'void';
  $('#volume-field').hidden = !['drink', 'void'].includes(kind); $('#event-volume').required = ['drink', 'void'].includes(kind);
  $('#event-volume').disabled = !['drink', 'void'].includes(kind);
  $('#drink-type').disabled = kind !== 'drink';
  $('#event-urgency').disabled = kind !== 'void'; $('#event-remarks').disabled = kind !== 'void';
  $('#event-volume').value = editing?.volumeMl ?? '';
  $('#drink-type').value = editing?.drinkType || 'water'; $('#drink-label').value = editing?.drinkLabel || '';
  $('#other-field').hidden = $('#drink-type').value !== 'other';
  $('#event-urgency').value = editing?.urgency || ''; $('#event-remarks').value = editing?.remarks || '';
  $('#delete-event').hidden = !editing; $('#sleep-hint').hidden = !['bedtime', 'wake'].includes(kind);
  $('#sleep-hint').textContent = kind === 'wake' ? 'Indiquez votre réveil final du matin. Un lever temporaire pour uriner se note avec « Miction ». Pensez à saisir ensuite la première miction du matin dans ce même jour.' : 'Ce repère ouvre votre nuit. Les mictions suivantes seront nocturnes jusqu’au réveil final.';
  refreshOffsets(); dirty = false; showDialog('#event-dialog');
  $(['drink', 'void'].includes(kind) ? '#event-volume' : '#event-time').focus();
}
for (const button of document.querySelectorAll('[data-kind]')) button.addEventListener('click', () => openEvent(button.dataset.kind));
$('#event-time').addEventListener('input', refreshOffsets);
$('#drink-type').addEventListener('change', () => { $('#other-field').hidden = $('#drink-type').value !== 'other'; });
$('#event-form').addEventListener('input', () => { dirty = true; });
$('#event-form').addEventListener('change', () => { dirty = true; });
$('#event-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  try {
    const local = $('#event-time').value;
    // An unchanged timestamp keeps its original instant even after travel.
    const timestamp = editing?.localDateTime === local && ($('#offset-field').hidden || +$('#event-offset').value === editing.offsetMinutes)
      ? { occurredAt: editing.occurredAt, localDateTime: editing.localDateTime, timeZone: editing.timeZone, offsetMinutes: editing.offsetMinutes }
      : parseLocalTimestamp(local, $('#offset-field').hidden ? undefined : +$('#event-offset').value);
    const entry = {
      id: editing?.id || crypto.randomUUID(), kind: eventKind, ...timestamp,
      volumeMl: ['drink', 'void'].includes(eventKind) ? $('#event-volume').valueAsNumber : null,
      drinkType: eventKind === 'drink' ? $('#drink-type').value : null,
      drinkLabel: eventKind === 'drink' && $('#drink-type').value === 'other' ? $('#drink-label').value.trim() : '',
      urgency: eventKind === 'void' ? $('#event-urgency').value || null : null,
      remarks: eventKind === 'void' ? $('#event-remarks').value.trim() : '',
    };
    const errors = validateEvent(entry); if (errors.length) throw new Error(errors.join(' '));
    const next = structuredClone(diary), day = next.days.find(d => d.id === active);
    if (!day.startDate) setDayDate(next, active, today());
    if (outsideSession(day, entry) && !confirm(`Cet événement est daté du ${formatDate(local.slice(0, 10))}, hors du jour ${day.slot} et de son lendemain. Le conserver dans ce jour ?`)) return;
    if (day.status === 'completed') throw new Error('Cette journée a été terminée dans une autre fenêtre. Rouvrez-la avant de modifier les saisies.');
    if (editing && !day.events.some(e => e.id === editing.id)) throw new Error('Cet événement a été supprimé dans une autre fenêtre. Fermez cette saisie et vérifiez l’historique.');
    if (editing) day.events[day.events.findIndex(e => e.id === editing.id)] = entry;
    else day.events.push(entry);
    await persist(next); dirty = false; $('#event-dialog').close(); toast('Enregistré sur cet appareil.');
  } catch (error) { inlineError('#event-error', error); }
});
$('#delete-event').addEventListener('click', async () => {
  if (!editing || busy || !confirm('Supprimer définitivement cet événement ?')) return;
  try {
    const next = structuredClone(diary), day = next.days.find(d => d.id === active);
    if (day.status === 'completed') throw new Error('Rouvrez cette journée avant de supprimer une saisie.');
    if (!day.events.some(e => e.id === editing.id)) throw new Error('Cet événement a déjà été supprimé. Fermez cette fenêtre.');
    day.events = day.events.filter(e => e.id !== editing.id);
    await persist(next); dirty = false; $('#event-dialog').close(); toast('Événement supprimé.');
  } catch (error) { inlineError('#event-error', error); }
});
$('#date-button').addEventListener('click', () => {
  $('#day-date-input').value = currentDay().startDate || today(); $('#date-error').hidden = true;
  $('#date-preserve-note').hidden = !currentDay().events.length; dirty = false; showDialog('#date-dialog');
});
$('#date-form').addEventListener('input', () => { dirty = true; });
$('#date-form').addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  try {
    const next = structuredClone(diary); setDayDate(next, active, $('#day-date-input').value);
    if (currentDay().events.length && currentDay().startDate !== $('#day-date-input').value && !confirm('Corriger la date de début sans modifier les dates des événements ? Vous pourrez les corriger individuellement dans l’historique.')) return;
    await persist(next); dirty = false; $('#date-dialog').close(); toast('Date enregistrée.');
  } catch (error) { inlineError('#date-error', error); }
});
$('#complete-button').addEventListener('click', async () => {
  if (busy) return;
  const complete = currentDay().status !== 'completed';
  const warning = getNightWindow(currentDay()).state !== 'valid' ? ' Les repères de sommeil sont incomplets ou incohérents ; les calculs nocturnes resteront indisponibles.' : '';
  if (!confirm(complete ? `Terminer cette journée ?${warning} Vous pourrez la rouvrir pour la corriger.` : 'Rouvrir cette journée pour modifier les saisies ?')) return;
  try {
    const next = structuredClone(diary); setCompleted(next.days.find(d => d.id === active), complete);
    await persist(next); toast(complete ? 'Journée terminée.' : 'Journée rouverte.');
  } catch (error) { storageError(error); }
});
function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
$('#backup-button').addEventListener('click', () => {
  if (!ready) return toast('Le journal doit être chargé pour être sauvegardé.');
  if (!confirm('La sauvegarde JSON contient vos données de santé en clair. Choisissez un emplacement sûr dans Fichiers. Un dossier iCloud peut se synchroniser selon vos réglages. Continuer ?')) return;
  try { download(serializeBackup(diary), `X2-sauvegarde-${today()}.json`, 'application/json;charset=utf-8'); toast('Sauvegarde préparée. Vérifiez sa présence dans Fichiers.'); }
  catch (error) { inlineError('#restore-error', error); }
});
function clearRestore() { restoreCandidate = null; $('#restore-preview').hidden = true; $('#restore-file').value = ''; }
$('#restore-button').addEventListener('click', () => { clearRestore(); $('#restore-error').hidden = true; $('#restore-file').click(); });
$('#restore-file').addEventListener('change', async () => {
  const file = $('#restore-file').files[0]; if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('Le fichier dépasse la limite de 16 Mo.');
    restoreCandidate = parseBackup(await file.text());
    const counts = restoreCandidate.days.map(d => `Jour ${d.slot} : ${d.startDate ? formatDate(d.startDate) : 'non commencé'}, ${d.events.length} événement(s)`);
    $('#restore-summary').textContent = counts.join(' · '); $('#restore-preview').hidden = false; $('#restore-error').hidden = true;
  } catch (error) { clearRestore(); inlineError('#restore-error', error); }
});
$('#cancel-restore').addEventListener('click', clearRestore);
$('#confirm-restore').addEventListener('click', async () => {
  if (!restoreCandidate || busy || !confirm('Remplacer définitivement toutes les données actuelles par cette sauvegarde ? Pensez à sauvegarder le journal actuel avant de continuer.')) return;
  try { await persist(restoreCandidate); clearRestore(); $('#options-dialog').close(); toast('Les trois journées ont été restaurées.'); }
  catch (error) { inlineError('#restore-error', error); }
});
$('#report-button').addEventListener('click', () => {
  if (!ready) return toast('Le journal doit être chargé pour créer le rapport.');
  $('#report-preview').replaceChildren(buildReport(diary)); $('#print-report').replaceChildren(buildReport(diary));
  $('#report-state').textContent = diary.days.every(d => d.status === 'completed') ? 'Trois journées terminées. Vérifiez le rapport avant de le partager.' : 'Rapport provisoire : certaines journées ne sont pas terminées ou n’ont pas commencé.';
  $('#options-dialog').close(); showDialog('#report-dialog');
});
$('#print-button').addEventListener('click', () => {
  try { window.print(); } catch { toast('L’impression n’a pas démarré. Réessayez dans Safari. Votre journal est conservé.'); }
});
window.addEventListener('beforeprint', () => { if (ready) $('#print-report').replaceChildren(buildReport(diary)); });
window.addEventListener('afterprint', () => toast('Votre journal est conservé. Vérifiez le PDF dans Fichiers.'));
async function updateOfflineStatus() {
  if (!('serviceWorker' in navigator)) { $('#offline-status').textContent = 'Mode hors ligne indisponible dans ce navigateur.'; return; }
  if (navigator.serviceWorker.controller) $('#offline-status').textContent = navigator.onLine ? 'Disponible hors ligne' : 'Hors ligne · journal disponible';
  else $('#offline-status').textContent = 'Préparation du mode hors ligne… Gardez la connexion.';
}
function watchWorker(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) $('#update-banner').hidden = false;
    if (worker.state === 'redundant' && !navigator.serviceWorker.controller) {
      $('#offline-status').textContent = 'Mode hors ligne non prêt. Reconnectez-vous puis rechargez pour réessayer la mise en cache.';
      return;
    }
    updateOfflineStatus();
  });
}
$('#update-button').addEventListener('click', () => {
  if (busy || document.querySelector('dialog[open]')) { toast('Fermez la fenêtre en cours après avoir enregistré avant la mise à jour.'); return; }
  if (!registration?.waiting) { $('#update-banner').hidden = true; return; }
  requestedUpdate = true;
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
});
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(reg => {
    registration = reg;
    if (reg.waiting) $('#update-banner').hidden = false;
    watchWorker(reg.installing);
    reg.addEventListener('updatefound', () => watchWorker(reg.installing));
    updateOfflineStatus();
  }).catch(() => { $('#offline-status').textContent = 'Mise en cache non terminée. Reconnectez-vous et rechargez pour préparer le mode hors ligne.'; });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const isUpdate = hadController; hadController = true;
    updateOfflineStatus();
    if (requestedUpdate && !busy && !dirty && !document.querySelector('dialog[open]')) { location.reload(); return; }
    // Never reload automatically: another tab may activate an update while a form is open.
    if (isUpdate && registration?.active && ready) toast('Version prête. Vous pouvez recharger après avoir enregistré vos saisies.');
  });
}
window.addEventListener('online', updateOfflineStatus); window.addEventListener('offline', updateOfflineStatus);
await initialise();
