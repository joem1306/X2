# X2 — Product Requirements Document (PRD)

**Version:** 1.0 — proposed implementation baseline

**Status:** Ready for owner review; not implementation authorisation

**Product:** X2, personal bladder diary (*calendrier mictionnel*)

**Target:** iPhone Safari / Home Screen Progressive Web App

**Language:** French (UI and medical PDF)

**Repository:** `joem1306/X2`

**Deployment:** `https://joem1306.github.io/X2/`

## 1. Purpose and scope

Provide a fast, private, offline-capable way to record drinks, urine output, and sleep markers across **exactly three selected recording days**, which may be non-consecutive, then produce one printable PDF closely matching the paper *calendrier mictionnel* supplied by the user.

This is a recording tool, **not** a diagnostic, clinical interpretation, or medical advice application. No health claims, alerts, recommendations, or medical scoring.

### Success criteria
- Record a drink or urination in a few taps, with current time prefilled and editable.
- Show **every event** in an immediately visible, correctly ordered chronological history.
- Keep three selected diary days independent of calendar continuity, including their following nights.
- Persist data after app closure and offline relaunch; provide user-controlled JSON backup/restore.
- Export one readable, accurate, three-day PDF with the familiar paper-form structure.
- Never send diary data to GitHub or any other endpoint.

## 2. Approved product decisions

| ID | Decision |
|---|---|
| PRD-01 | Record bedtime and final morning wake time; automatically classify overnight events. |
| PRD-02 | Urination: editable timestamp, required volume (ml), optional urgency and remarks. |
| PRD-03 | Drink: editable timestamp, drink type, required manually entered volume (ml); no preset volumes. |
| PRD-04 | New recording day defaults to today's date; date is editable. |
| PRD-05 | A day remains open until explicitly marked complete. |
| PRD-06 | Completed days can be reopened, corrected and completed again. |
| PRD-07 | One PDF covering all three selected days, consecutive or not. |
| PRD-08 | PDF closely follows the original French medical form. |
| PRD-09 | Simple local JSON backup and restore; no cloud backup or encryption. |
| PRD-10 | Immediate access, no PIN, login or extra authentication. |
| PRD-11 | Individual events and sleep markers editable/deletable with confirmation for deletion. |
| PRD-12 | Two sleep actions: « Je me couche » and « Je me réveille ». |
| PRD-13 | No statistics dashboard in V1; retain necessary totals in PDF. |
| PRD-14 | Complete chronological event history is essential, visible under the recording actions. |
| PRD-15 | Calm, minimalist, non-medical visual style, inspired by provided reference; lavender-blue and off-white. |

## 3. Users and primary workflow

Single user, one device. No account or multi-user support.

1. Open X2 on iPhone, choose or create **Jour 1**; app suggests current local date.
2. Tap **Boisson**, **Miction**, **Je me couche**, or **Je me réveille**.
3. App pre-populates actual local date/time; user may correct it.
4. Save; the event immediately appears in the chronological history below the actions.
5. Continue past midnight, including nighttime urination, until explicitly pressing **Terminer cette journée**.
6. Later start Jour 2 and Jour 3, with any gaps between dates.
7. Reopen a completed day to correct entries if needed.
8. Export a single three-day PDF for the doctor; optionally export/import a JSON backup.

## 4. Functional requirements

### 4.1 Three recording slots
- Show **Jour 1**, **Jour 2**, **Jour 3**, each with a calendar date and state: not started, in progress, completed.
- When first started, date defaults to current local date and is editable.
- Support non-consecutive dates; do not auto-create intervening days.
- Disallow accidentally assigning the same start date to two slots; explain the conflict.
- Only one recording slot is active for quick-entry at a time. Changing the selected slot must be explicit.
- A recording day is a **logical diary session**, not a midnight-to-midnight calendar day.
- User explicitly marks a day complete; no automatic midnight or wake-time completion.
- Completed days remain readable and may be reopened.
- Before deleting or resetting an entire day, require explicit confirmation. Do not include a prominent reset button on the main screen.

### 4.2 Entry: Boisson
- Required: event timestamp (local date and time), drink type, volume in ml.
- Type options: Eau, Café, Thé, Tisane, Autre. For Autre, optional free-text label.
- Current timestamp prefilled; user can edit date and time.
- Volume uses numeric input, **no quick-volume presets**; validate finite positive numeric values and a reasonable upper bound (e.g. 10,000 ml per event) as input validation, not medical advice.
- Save immediately to local storage; visible confirmation and history update.

### 4.3 Entry: Miction
- Required: event timestamp, urine volume in ml.
- Optional urgency: Normale, Envie pressante, Urgence importante, or **unset** (no assumption).
- Optional free-text remarks.
- Timestamp prefilled and editable; positive numeric volume validation as above.
- Save immediately to local storage and show in history.

### 4.4 Sleep markers
- **Je me couche** records bedtime; **Je me réveille** records **final** morning wake time.
- Both timestamps are editable. A night can cross midnight.
- Waking temporarily to urinate does **not** require tapping « Je me réveille ».
- Each recording day supports one principal bedtime/final-wake pair in V1. If the pair is missing or invalid, display an unobtrusive indication and avoid pretending nighttime calculations are definitive.
- Day/night classification is derived from these markers, never irreversibly stored as the source of truth.

### 4.5 Medical diary conventions and overnight boundary
- Events retain **full local calendar date and time**, not time-of-day alone; display and sort chronologically across midnight.
- Nighttime void **count**: urinations after bedtime and **before** final morning wake, excluding the first morning void after final awakening.
- **Nighttime urine volume** may include the first morning void according to common frequency-volume-chart conventions; clearly label the definition in the report. Because clinical templates differ, provide a transparent calculation and do not claim that the doctor's exact convention has been confirmed.
- For the first morning void, user may record it after waking, and it must not be counted as an awakening to urinate.
- Do not automatically classify every event at a fixed hour such as 22:00; use the user's sleep markers.
- A session's entries may fall on its start date and the following calendar date. When editing a timestamp that seems outside the session, warn and request confirmation rather than silently moving it to another day.
- If bedtime/wake time is incomplete, preserve all events and still allow PDF export, marking relevant overnight figures as unavailable rather than guessing.
- Daytime/nighttime counts and volumes must be independently testable and traceable to individual entries.

### 4.6 History (must-have)
- Full event history **directly below** the four action buttons, with no hidden events or truncation.
- Show actual date where needed, time, type, drink label or volume, urgency/remarks, and sleep markers.
- Ascending chronological order; stable ordering for identical timestamps.
- Edit each event; delete with confirmation; save changes immediately.
- History persists offline and after relaunch; completed days are viewable and become editable on reopening.
- Empty-state guidance when no events exist.

### 4.7 PDF export
- Export **one PDF** for all three selected days; ideally one clearly identified page per recording day, with overflow pages if necessary.
- Match the reference paper form's information hierarchy and headings: **Heure**, **Boisson (nature et volume)**, **Urines (ml)**, **Remarques**, **Total sur 24 heures**, **Nombre de mictions : le jour / la nuit**.
- Include selected calendar date, all chronological entries including after midnight, bedtime/final wake markers (as annotated rows or clearly labelled fields), and calculated daily totals.
- Do not fabricate entries or missing measurements. Distinguish unknown values from zero.
- Use readable French typography, A4 portrait print layout, adequate contrast and page breaks; retain a familiar paper-table appearance rather than copying handwriting.
- PDF generated **entirely on-device**; no server-side rendering or external PDF service.
- Export available after the three days are recorded; optionally allow a clearly labelled draft export before all days are complete.
- iPhone sharing/printing can use native Safari print-to-PDF/share workflow; explain any platform-specific steps.

### 4.8 JSON backup and restore
- Export a human-readable `.json` file containing all slots, timestamps, events, notes and schema version.
- Backup contains sensitive personal health data **in plaintext**; show a concise warning before saving/sharing.
- Import via local file picker, validate structure/version/types and reject malformed or unsupported files without modifying current data.
- Show a preview/summary and request explicit confirmation before replacing existing records.
- Import must be atomic: either all valid data is restored or none is changed.
- Do not automatically upload, sync, or email backups.

### 4.9 Privacy and accessibility
- No account, PIN, analytics, advertisements, tracking, external fonts, telemetry or third-party SDKs.
- No medical information in URLs, query strings, network requests, Git commits, console logs, crash reports or service-worker caches.
- All personal records stored locally on the device. Public GitHub repository contains code and generic assets **only**.
- Explain that IndexedDB is not guaranteed permanent and that Files/iCloud backup destinations are user-controlled; do not promise absolute privacy from anyone with access to an unlocked phone.
- Touch targets at least ~44 × 44 CSS px, keyboard-accessible forms, clear labels, usable contrast, text scaling and visible focus.

## 5. Information architecture and UI

Single-screen-first, mobile-first layout:
1. Small **X2** header and selected recording-day/date/status selector.
2. Four primary actions: **Boisson**, **Miction**, **Je me couche**, **Je me réveille**.
3. **Historique** list immediately below; editable rows.
4. Low-emphasis day completion/reopening control.
5. Secondary menu for **Exporter PDF**, **Sauvegarder JSON**, **Restaurer JSON**, and brief privacy/offline information.

Visual direction: light off-white canvas, white cards, soft lavender-blue accent, fine dividers, subtle radius/shadows, generous whitespace, restrained icons, no medical imagery, no dashboard charts, no dramatic alerts. Adapt the uploaded finance-app reference for iPhone rather than reproducing its desktop layout. Keep interface copy in French.

## 6. Out of scope for V1

Accounts, cloud sync, backend, clinician portal, diagnosis, reminders, push notifications, HealthKit, graphs, statistics dashboard, PIN/encryption, predefined volume buttons, multilingual UI, multiple patient profiles, and any automatic medical interpretation.

## 7. Acceptance criteria

1. Create three recording slots with dates 9 Nov, 12 Nov and 18 Nov without generating intervening dates.
2. Starting a slot defaults to today's local date; changing it does not erase events.
3. Save drink with manually typed 175 ml; no preset button appears.
4. Save urine volume with urgency blank; blank remains blank after reload/export.
5. Bedtime 22:15, overnight void 03:10, final wake 06:50, first morning void 07:00: overnight count is 1; morning void is not counted as nocturnal awakening.
6. History shows every event in true chronological order across midnight; edited timestamps reorder correctly.
7. Closing and relaunching the Home Screen app offline preserves events.
8. Complete a day, reopen it, edit/delete an entry, then complete it again.
9. PDF includes all three days, full event rows and accurate totals in the familiar French paper layout; no data leaves device.
10. Export JSON, import it on a clean browser profile, and recover identical events; malformed import leaves existing data untouched.
11. Network inspection finds no transmission of diary content; GitHub repository contains no personal records.
12. PWA installs from `/X2/`, works offline after initial cache, and handles updates without discarding data.
13. UI remains legible and usable on a narrow iPhone viewport and with enlarged text.

## 8. Open verification items before real medical use

- Confirm with the doctor whether the first morning void should be included in overnight **volume**, and whether the provided paper form expects a particular 24-hour window. The application should disclose its chosen calculation, not silently impose it.
- Verify PDF against the supplied reference image visually and check all three days on an actual iPhone.
- Verify iPhone storage persistence, backup/restore and offline relaunch before recording real data.

**Implementation gate:** Owner reviews/approves this PRD and Engineering Design before Codex modifies app files.
