# X2 — Engineering Design Specification

**Version:** 1.0 — proposed implementation baseline

**Status:** Ready for owner review; implementation not yet authorised

**Companion:** `PRD.md`

**Repository:** `joem1306/X2`

**Base URL:** `https://joem1306.github.io/X2/`

## 1. Architecture

A static, installable, offline-first PWA hosted on GitHub Pages. All business logic and sensitive data stay in the browser on the user's iPhone. No API, backend, server-side database, authentication, analytics or third-party runtime services.

**Recommended stack:** vanilla HTML, CSS and modern JavaScript (ES modules), IndexedDB for records, Web App Manifest and service worker for offline app-shell caching. Prefer no build step and no runtime CDN dependencies. Use a tiny, audited local helper only if necessary; document why. No SPA routing required: a single `index.html` application is sufficient.

**Data flow:** user interaction → input validation → domain model → IndexedDB transaction → UI render; export uses the same validated model. Static application files arrive from GitHub Pages; personal records never do.

## 2. Proposed repository layout

```text
/
  index.html
  manifest.webmanifest
  sw.js
  icons/
    icon-192.png
    icon-512.png
    apple-touch-icon.png
  css/
    app.css
    print.css
  js/
    app.js
    db.js
    model.js
    diary.js
    export-json.js
    export-pdf.js
    ui.js
  docs/
    PRD.md
    ENGINEERING_DESIGN.md
  README.md
```

Avoid injecting sensitive data into HTML attributes, URLs or logs. Use safe DOM APIs (`textContent`) for user notes rather than `innerHTML`.

## 3. GitHub Pages and path handling

- Publish from `main` root (or documented Pages Actions workflow if needed).
- All app-shell paths must resolve under `/X2/`. Use relative URLs consistently.
- Manifest example: `start_url: "/X2/"`, `scope: "/X2/"`, `display: "standalone"`, `name: "X2"`, `short_name: "X2"`, and correct icons.
- Register service worker with a URL under `/X2/sw.js` and scope `/X2/` (or equivalent correctly resolved relative paths).
- No history-mode routes requiring server rewrites. Use local UI state, not routes, for screens/dialogs.
- The GitHub Pages URL and repository are publicly readable. Do not include patient data or actual diary samples in commits or tests.

## 4. Data model

Store timestamps as unambiguous ISO 8601 instants (UTC) plus the originating IANA timezone or offset for accurate local display; keep session start **calendar date** as a local `YYYY-MM-DD` string. For export, include human-readable local date/time and timezone metadata as needed. Avoid sorting solely by formatted `HH:mm` strings.

Suggested logical schema:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-11-09T11:00:00.000Z",
  "timezone": "Europe/Paris",
  "days": [
    {
      "id": "day-1",
      "slot": 1,
      "startDate": "2026-11-09",
      "status": "in_progress",
      "events": [
        {
          "id": "event-uuid",
          "kind": "drink",
          "occurredAt": "2026-11-09T07:30:00.000Z",
          "drinkType": "coffee",
          "drinkLabel": null,
          "volumeMl": 150,
          "urgency": null,
          "remarks": ""
        }
      ],
      "bedtimeAt": null,
      "finalWakeAt": null,
      "completedAt": null
    }
  ]
}
```

This is a **shape illustration only**: the sample UTC timestamp is not intended to represent the displayed local clock time. Tests must verify correct timezone conversion. Production storage may normalise events into separate IndexedDB object stores for efficient queries.

Rules:
- Exactly three stable slot IDs (1, 2, 3); not all must be populated.
- Event `kind`: `drink` or `void`; bedtime/wake can be distinct timestamp fields, but must be rendered as events in history.
- `volumeMl`: positive finite number, no silently coerced invalid values. Store ml as integer if input is integer-only.
- Urgency enum: `normal`, `urgent`, `very_urgent`, or `null`.
- Stable event UUID; `createdAt` and `updatedAt` optional for auditing edits.
- Every write in a transaction; IndexedDB schema migrations versioned.
- Never put diary data in localStorage solely for convenience; use IndexedDB as the authoritative source.

## 5. Domain and calculation rules

Implement **pure, unit-testable functions** separate from UI:
- `sortEvents(events)` by UTC instant, then stable ID/insertion order.
- `getNightWindow(day)` returns valid bedtime/final-wake interval, or an explicit incomplete/invalid result.
- `classifyVoid(event, nightWindow)` returns daytime, nocturnal-awakening, first-morning-void, or indeterminate as appropriate.
- `computeDayTotals(day)` returns drink total, urine total, daytime/nighttime void counts, and overnight volume with explicit definition/limitations.
- `validateEvent`, `validateDay`, `validateBackup` return structured errors.

**Overnight boundary:** bedtime may be on session date and final wake on the next date. Store and compare full timestamps. A void after bedtime and before final wake is counted as nocturnal. The first void after final awakening is **not** a nocturnal awakening; the PDF should clearly distinguish the volume convention from the nocturnal count. If including first morning void in overnight urine volume, label the calculation and include it exactly once. Do not derive first morning void solely from a fixed clock hour.

**Missing sleep markers:** never invent bedtime or wake times. Counts that require missing markers should be marked unavailable, while total void volume remains calculable.

**Session attribution:** each event has an explicit day-slot association. No implicit reassignment at midnight. Warn when an edited timestamp is outside the expected session interval. Prevent accidental duplicate slot dates.

**Timezone/DST:** use `Intl.DateTimeFormat` and robust local datetime parsing. Include tests around DST changes and UTC/local conversion; never derive local dates by slicing `toISOString()`.

## 6. Persistence, backup and privacy

- IndexedDB database `x2-diary`, schema v1; store day slots and event records.
- Writes must complete before displaying success; surface errors (including storage quota errors).
- Ask for persistent storage via `navigator.storage.persist()` if supported, but do not rely on it or promise that iOS will honour it.
- JSON export is user-triggered, plain text UTF-8, versioned and self-contained. Suggested filename `X2-sauvegarde-YYYY-MM-DD.json`.
- JSON import: parse locally; check file size limit, schema version, types, unique IDs, three-slot maximum, valid dates, finite positive volumes, allowed enums and cross-references. Show preview and explicit overwrite confirmation. Use one atomic IndexedDB transaction to replace data.
- Treat JSON as sensitive plaintext. iCloud Drive or other Files destinations may sync **if the user chooses them**; the app does not control that.
- No outbound fetch/XHR/WebSocket/beacon carrying records. No external runtime scripts, CSS, fonts, trackers, CDNs, error-reporting SDKs or embedded third-party widgets.
- Set a restrictive Content Security Policy compatible with static hosting where practical; avoid inline scripts and unsafe dynamic HTML. No sensitive data in URL, history, console or cache.
- Do not claim browser local storage is encrypted by the application. No PIN or app-layer encryption in V1.

## 7. Service worker and offline strategy

- Cache only versioned **static app-shell assets** (`index.html`, CSS, JS, manifest, icons) in Cache Storage.
- **Never** cache exported JSON, generated PDF, user entries or URLs containing personal content.
- Precache the app shell on service-worker install. Serve navigation to `/X2/` from cache when offline; fall back to network when appropriate.
- Use an explicit cache version; delete obsolete static caches on activation.
- Update safely: notify the user that a new version is ready, and avoid forced reload while an entry is being edited. Preserve IndexedDB through updates.
- Ensure the first online load installs/caches the app before claiming offline readiness.
- Avoid caching untrusted external resources.
- Test in Safari and **installed Home Screen mode**, as storage and lifecycle behaviour can differ.

## 8. UI implementation

- Mobile-first, single-column; off-white background, white surfaces, restrained lavender-blue accents, small unobtrusive icons, readable text and generous whitespace.
- Header: X2 + active day/date/status; selector for Jour 1/2/3.
- Four primary controls: Boisson, Miction, Je me couche, Je me réveille.
- Full history directly beneath actions, with chronological grouping across midnight and edit/delete affordances.
- Use native form controls for number, date and time input; current timestamp prefilled but user-editable.
- Use semantic HTML, labels, focus management, error messaging and minimum ~44px touch targets.
- Do not add charts, a stats dashboard, splash marketing, medical illustrations or unnecessary animations.
- UI language: French; code and internal docs may be English.

## 9. PDF generation

**Preferred no-dependency approach:** create a print-specific HTML report from locally stored data, then invoke `window.print()`; on iPhone, Safari's native print/share interface can produce a PDF. Label this action **« Exporter / imprimer le PDF »** and provide concise instructions if needed. Confirm real iPhone behaviour; do not promise silent one-tap PDF download where Safari does not support it.

If actual direct PDF-file generation is required after device testing, use a bundled, audited, offline-capable client-side library (no CDN) and document the trade-off. No remote PDF service.

- A4 portrait `@page`, print CSS, strong table layout and readable fonts.
- One section per selected day; paginate gracefully if long history.
- Original-form columns: Heure | Boisson (nature et volume) | Urines (ml) | Remarques.
- Rows sorted chronologically, including after midnight; add day/date labels where needed.
- Footer: totals and day/night void counts; sleep markers and definition notes.
- No blank or fabricated measurements; display missing data as blank or “non renseigné”.
- User-provided original form image is a **visual reference**, not an asset to publish containing personal medical details. Do not commit it unless explicitly reviewed and sanitised.

## 10. Error states and recovery

- IndexedDB unavailable/quota exceeded: block false-success state; explain in French and encourage export of existing data where possible.
- Storage cleared: display empty state, offer JSON restore; never suggest data can be recovered automatically.
- Invalid JSON: descriptive non-destructive error.
- Partial/incomplete sleep interval: preserve history, label classifications indeterminate.
- Invalid time or volume: inline error; no silent correction.
- Service worker update: avoid interrupting unsaved forms; offer reload once safe.
- PDF unsupported/print cancelled: retain all diary data and offer retry.

## 11. Testing and quality gates

### Unit tests
- Validation for required and optional fields, boundary values, invalid types.
- Chronological sort across midnight and identical timestamps.
- Non-consecutive day slots and manual completion/reopening.
- Bedtime 22:15, void 03:10, final wake 06:50, morning void 07:00: nocturnal void count = 1; morning void excluded from count.
- Incomplete sleep markers; morning volume inclusion policy; no double counting.
- Timezone and DST boundary cases.
- JSON round-trip and rejection of corrupt/malicious input without overwriting data.

### Browser / device tests
- GitHub Pages URL `/X2/` loads without 404 asset failures.
- Install to iPhone Home Screen; cold launch offline after initial cache.
- Add/edit/delete events offline; relaunch retains records.
- Day switching and non-consecutive dates; after-midnight history.
- Service-worker update preserves records and avoids mid-edit interruption.
- PDF print/export visually matches the provided form and contains correct data.
- JSON export to Files and import on iPhone.
- Safari privacy/network inspection: no medical data leaves device.
- Narrow screen, enlarged text, VoiceOver/basic keyboard support.

### Deployment gates
1. Code review of network calls, service worker and privacy assumptions.
2. Automated checks and local browser smoke tests pass.
3. Publish only static code/assets to public GitHub Pages.
4. Real iPhone acceptance tests pass **before** entering personal medical information.
5. Save a JSON backup during the three-day recording period.

## 12. Codex implementation plan (after approval)

1. Add both approved specifications under `docs/` and establish tests.
2. Implement domain model, IndexedDB storage and unit tests.
3. Implement minimalist French forms and complete history.
4. Implement sleep markers, day lifecycle and calculation logic.
5. Implement JSON backup/restore with validation and atomic import.
6. Implement printable A4 three-day report and verify with reference form.
7. Add manifest, icons, service worker and offline/update handling.
8. Validate GitHub Pages base path and deploy via PR; run iPhone checklist.

**Codex instruction:** Do not begin coding until the owner explicitly approves the PRD and engineering specification. Do not commit real health data or the user's paper diary image to the public repository.
