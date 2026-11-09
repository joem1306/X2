import { KINDS, DRINKS, URGENCIES, sortEvents, computeDayTotals, offsetLabel } from './model.js';
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function formatDate(date, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return date ? new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) : 'Date à choisir';
}
export const stateLabel = day => ({ not_started: 'À commencer', in_progress: 'En cours', completed: 'Terminée' })[day.status];
export function drinkLabel(event) { return event.drinkType === 'other' && event.drinkLabel ? event.drinkLabel : DRINKS[event.drinkType]; }
export const phaseLabel = phase => ({ night: 'Nuit', day: 'Jour', 'first-morning': 'Première miction du matin', indeterminate: 'Période non déterminée' })[phase];
function editIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-edit'); svg.append(use); svg.setAttribute('aria-hidden', 'true');
  return svg;
}
export function renderTabs(diary, active, onSelect) {
  const nav = document.querySelector('#day-tabs'); nav.replaceChildren();
  for (const day of diary.days) {
    const button = el('button', 'day-tab'); button.type = 'button'; button.setAttribute('aria-current', String(day.id === active));
    button.append(el('strong', '', `Jour ${day.slot}`), el('span', 'tab-date', day.startDate ? formatDate(day.startDate, { day: 'numeric', month: 'short' }) : 'À votre rythme'));
    const state = el('span', 'tab-state'); state.append(el('span', 'tab-dot'), document.createTextNode(stateLabel(day))); button.append(state);
    button.addEventListener('click', () => onSelect(day.id)); nav.append(button);
  }
}
export function renderHistory(day, onEdit) {
  const host = document.querySelector('#history'); host.replaceChildren();
  const totals = computeDayTotals(day);
  document.querySelector('#event-count').textContent = `${day.events.length} événement${day.events.length === 1 ? '' : 's'}`;
  document.querySelector('#night-note').textContent = totals.window.state === 'invalid' ? 'Le réveil final doit suivre le coucher. Corrigez un repère pour déterminer la nuit.' : totals.window.state === 'incomplete' ? 'Ajoutez le coucher et le réveil final pour distinguer le jour et la nuit.' : 'La nuit suit vos repères de sommeil, même après minuit.';
  if (!day.events.length) {
    const empty = el('div', 'empty-state'); empty.append(el('h3', '', 'Votre journée commence ici.'), el('p', '', 'Une boisson, une miction… Chaque saisie trouvera sa place dans cet historique.'));
    host.append(empty); return;
  }
  let date = '', list;
  for (const event of sortEvents(day.events)) {
    const eventDate = event.localDateTime.slice(0, 10);
    if (date !== eventDate) {
      date = eventDate; host.append(el('h3', 'history-date', formatDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })));
      list = el('ol', 'history-list'); host.append(list);
    }
    const row = el('li', 'history-row');
    const clock = el('time', 'event-clock', event.localDateTime.slice(11));
    const main = el('div', 'event-main');
    main.append(el('h3', '', event.kind === 'drink' ? `${drinkLabel(event)} · ${event.volumeMl} ml` : event.kind === 'void' ? `Miction · ${event.volumeMl} ml` : KINDS[event.kind]));
    if (event.kind === 'void') {
      main.append(el('p', 'event-tag', phaseLabel(totals.classes[event.id])));
      if (event.urgency !== null) main.append(el('p', '', URGENCIES[event.urgency]));
      if (event.remarks) main.append(el('p', '', event.remarks));
    }
    const offset = el('p', 'event-zone', `${offsetLabel(event.offsetMinutes)} · ${event.timeZone}`);
    // Original offset is visible in the editor; history stays compact unless offsets vary.
    if (new Set(day.events.map(e => e.offsetMinutes)).size > 1) main.append(offset);
    const edit = el('button', 'event-edit'); edit.type = 'button'; edit.setAttribute('aria-label', `Modifier ${KINDS[event.kind].toLowerCase()}`); edit.append(editIcon());
    edit.disabled = day.status === 'completed'; edit.addEventListener('click', () => onEdit(event));
    row.append(clock, main, edit); list.append(row);
  }
}
