import { computeDayTotals, sortEvents, URGENCIES, offsetLabel, outsideSession } from './model.js';
import { el, formatDate, drinkLabel, phaseLabel, stateLabel } from './ui.js';
export function reportRows(day) {
  const totals = computeDayTotals(day);
  return sortEvents(day.events).map(event => {
    const notes = [];
    if (event.kind === 'void') {
      notes.push(phaseLabel(totals.classes[event.id]));
      if (event.urgency !== null) notes.push(URGENCIES[event.urgency]);
      if (event.remarks) notes.push(event.remarks);
    }
    if (event.kind === 'bedtime') notes.push('Coucher');
    if (event.kind === 'wake') notes.push('Réveil final');
    if (outsideSession(day, event)) notes.push('Hors de la période attendue : vérifier la date.');
    return [
      `${event.localDateTime.slice(11)}\n${formatDate(event.localDateTime.slice(0, 10), { day: '2-digit', month: '2-digit', year: 'numeric' })}\n${offsetLabel(event.offsetMinutes)}`,
      event.kind === 'drink' ? `${drinkLabel(event)}\n${event.volumeMl} ml` : '',
      event.kind === 'void' ? String(event.volumeMl) : '',
      notes.join(' · '),
    ];
  });
}
function summaryLine(container, label, value) {
  const row = el('div', 'report-total'); row.append(el('span', '', label), el('strong', '', value)); container.append(row);
}
export function buildReport(diary) {
  const root = el('div', 'report-document');
  for (const day of diary.days) {
    const totals = computeDayTotals(day), page = el('section', 'report-page');
    page.append(el('p', 'report-kicker', 'X2 · CALENDRIER MICTIONNEL'), el('h2', '', `Jour ${day.slot} — ${day.startDate ? formatDate(day.startDate) : 'Non commencé'}`));
    page.append(el('p', 'report-status', `État : ${stateLabel(day)}${day.status !== 'completed' ? ' · RAPPORT PROVISOIRE' : ''}`));
    const table = el('table', 'report-table');
    const caption = el('caption', 'sr-only', `Relevé chronologique du jour ${day.slot}`); table.append(caption);
    const head = el('thead'), header = el('tr');
    for (const label of ['Heure', 'Boisson (nature et volume)', 'Urines (ml)', 'Remarques']) { const th = el('th', '', label); th.scope = 'col'; header.append(th); }
    head.append(header); table.append(head);
    const body = el('tbody');
    for (const cells of reportRows(day)) { const row = el('tr'); cells.forEach(text => row.append(el('td', '', text))); body.append(row); }
    if (!day.events.length) { const row = el('tr'), cell = el('td', '', 'Aucun événement renseigné.'); cell.colSpan = 4; row.append(cell); body.append(row); }
    table.append(body); page.append(table);
    const summary = el('div', 'report-summary'); summary.append(el('h3', '', 'Total sur 24 heures'));
    const hasDrink = day.events.some(e => e.kind === 'drink'), hasVoid = totals.voidCount > 0;
    summaryLine(summary, 'Boissons', hasDrink ? `${totals.drinkVolume} ml` : 'Non renseigné');
    summaryLine(summary, 'Urines — total de la période saisie', hasVoid ? `${totals.urineVolume} ml` : 'Non renseigné');
    summaryLine(summary, 'Nombre de mictions : le jour / la nuit', totals.nightCount === null ? 'Indisponible' : `${totals.dayCount} / ${totals.nightCount}`);
    summaryLine(summary, 'Volume urinaire nocturne, première miction du matin incluse', totals.nightVolume === null ? 'Indisponible' : `${totals.nightVolume} ml${totals.morningMissing ? ' (provisoire)' : ''}`);
    page.append(summary);
    const definitions = el('div', 'report-definitions');
    definitions.append(el('p', '', 'Période : journée sélectionnée et nuit suivante, jusqu’à la première miction après le réveil final. « Total sur 24 heures » reprend les saisies rattachées à cette journée ; une durée exacte de 24 h n’est pas garantie.'));
    definitions.append(el('p', '', 'Nuit : mictions strictement après le coucher et avant le réveil final. Le volume nocturne inclut la première miction à partir du réveil ; celle-ci est comptée avec les mictions du jour, jamais comme lever nocturne. Convention à confirmer avec votre médecin.'));
    if (totals.window.state !== 'valid') definitions.append(el('p', 'report-warning', 'Repères de sommeil manquants ou incohérents : les nombres jour/nuit et le volume nocturne sont indisponibles. Le total des volumes saisis reste calculable.'));
    else if (totals.morningMissing) definitions.append(el('p', 'report-warning', 'Première miction du matin non renseignée : volume nocturne provisoire.'));
    const zones = [...new Set(day.events.map(e => e.timeZone))];
    definitions.append(el('p', '', `Les heures sont celles de la saisie d’origine${zones.length ? ` (${zones.join(', ')})` : ''}. L’écart UTC accompagne chaque ligne, y compris lors d’un changement d’heure.`));
    page.append(definitions); root.append(page);
  }
  return root;
}
