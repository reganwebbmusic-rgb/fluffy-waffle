# Code Review — Setlist Builder

Reviewed: `setlist-builder.html` (4,825 lines), `requests.html`, `index.html`, `sw.js`, `manifest.webmanifest`, `netlify/functions/*`, `DEPLOY-GUIDE.md`, `STORE-GUIDE.md` · live site: GitHub Pages (`reganwebbmusic-rgb.github.io/fluffy-waffle/`)

## Executive summary

A genuinely well-built vanilla-JS app: no framework, zero runtime deps, a sound data model (pool indices + remap-on-delete), safe DOM rendering (`textContent` everywhere — no XSS in the main app), debounced cloud sync, and a strong feature set (auto-fill, play mode, tuner, vocal range calculator, QR request page, gig archive).

However, there is **one critical bug that is breaking the app in production right now** (missing `firebase-config.js`), plus a handful of high/medium issues: a latent crash in the Requests tab, a dead feature on the current host (UG search), and a shared open Firebase database. Full details below, ordered by severity.

---

## Critical

### C1 — `firebase-config.js` is missing → app throws `ReferenceError` on load

- `setlist-builder.html:317` loads `<script src="firebase-config.js"></script>` and the code uses the global `FIREBASE_API_KEY` **unguarded** at `bootAuth()` (line 2346) and `cloudOn()` (line 2208).
- The file is **not in the repo** (verified: `git ls-files`) and **returns 404 on the live site** (verified by fetch).
- Because `FIREBASE_API_KEY` is never declared, `bootAuth()` throws `ReferenceError: FIREBASE_API_KEY is not defined` at startup → `render()` (line 4811) never runs and the auth screen never appears. Users see a static shell: the sign-in box stays hidden and there is no "Continue offline" path.
- Worse: anyone with a saved session (`sb2auth` in localStorage) hits the same `ReferenceError` from `cloudOn()` inside `save()` on **every** save — their app is completely broken.
- `DEPLOY-GUIDE.md` never mentions this file, so anyone following the guide ships a broken app.

**Fix:**
1. Make the reference safe — at the top of the main script, before first use:
   ```js
   var FIREBASE_API_KEY = (typeof window.FIREBASE_API_KEY !== "undefined") ? window.FIREBASE_API_KEY : "";
   ```
2. Commit a `firebase-config.js` **template** (empty key) so the repo is self-contained:
   ```js
   // Firebase Web API key — paste from Firebase Console → Project settings → Web API Key
   var FIREBASE_API_KEY = "";
   ```
3. Add a `.gitignore` for the *real* key file (e.g. `firebase-config.local.js` with a load-order fallback), or keep the key in the repo if you accept that GitHub Pages exposes it anyway (the key is public by nature on a static site — the RTDB rules are the real security boundary, see H4).
4. Document the step in DEPLOY-GUIDE.md (it currently lists the file tree without this file).

---

## High

### H1 — Requests tab crashes on any request without a `song` field

`renderRequests()` sorts open requests (lines 4088–4092):

```js
var d = requestFit(y.song, y.artist) - requestFit(x.song, x.artist);
```

`requestFit()` (line 3533) starts with `song.toLowerCase()` — if a request has no `song` (the app's own "more songs" / charged-request type, handled everywhere else via `r.type !== "song"` and `r.charge`), this **throws**, the Requests tab fails to render, and the 5-second polling loop re-throws forever.

**Fix:** guard in the comparator and in `requestFit`:
```js
var d = ((y.song ? requestFit(y.song, y.artist) : -1) - (x.song ? requestFit(x.song, x.artist) : -1));
```
(or return 0 in `requestFit` when `!song`). Also guard `gigStats`/`topRequests` against missing fields the same way.

### H2 — Ultimate Guitar search is dead on the current host

`ugSearchOnline()` (line 3521) fetches `/.netlify/functions/ug-search` — a Netlify serverless function. The app is deployed on **GitHub Pages**, which has no serverless functions → every search fails with "Online search unavailable". The audience-request flow works (it goes straight to Firebase), so the app is in an inconsistent half-working state.

**Fix options:**
- Move hosting to Netlify (the DEPLOY-GUIDE assumes this) — then both features work; or
- Accept GH Pages and drop/relabel the UG search UI; or
- Implement search client-side via a CORS-enabled endpoint (fragile, rate-limited by UG).

### H3 — Charged-request payment flows assume a DB that doesn't exist here

The code (and STORE-GUIDE) references a `capacitor/` scaffold and a paid-requests page that are **not in this repo**. `STORE-GUIDE.md` tells the reader to copy `capacitor/www/...` — that folder doesn't exist. Either add the scaffold or trim the guide to match reality.

### H4 — Shared, effectively open Firebase database

`REQUESTS_DB_URL = "https://toolgig-663e4-default-rtdb.firebaseio.com"` (line 2191) is hardcoded in `setlist-builder.html` **and** `requests.html:44`. `requests.html` POSTs to `/requests.json` with **no auth**; offline-mode `syncSongbook()` PUTs to a **shared `/songbook.json`** (line 4019) — every offline user overwrites the same key. And if RTDB rules are open (they must be, for unauthenticated POSTs to work), anyone can read/spam/delete all requests, and the UID exposed in request-page URLs (`?m=<uid>`) could let strangers touch other musicians' `/users/<uid>` data if those paths aren't rule-protected.

**Fix:**
- Tighten RTDB rules, e.g.:
  ```json
  {
    "rules": {
      "requests": { ".read": true, ".write": true },   // public request inbox (spam risk — see below)
      "songbook":  { ".read": true, ".write": false }, // only written server-side/authed
      "users": {
        "$uid": { ".read": "$uid === auth.uid", ".write": "$uid === auth.uid" }
      }
    }
  }
  ```
- Add payload validation/sanitization server-side (the Netlify function already trims/slices — keep that; Firebase direct-write path has none).
- Consider rate-limiting or a per-gig request code to stop spam.
- Note: the Firebase **Web API key itself is not a secret** on a static site — the rules are the real boundary, so make them correct.

---

## Medium

### M1 — Weak backup-import validation

`importFile` handler (line 4779) only checks `if (!st.songs || !st.sets)` — truthiness, not types. A syntactically-valid JSON backup with `songs` as an object (or missing arrays) passes, then `s.songs.filter` / `.length` throws and the app is left broken after a "successful" import.

**Fix:** validate `Array.isArray(st.songs) && Array.isArray(st.sets)` (and `st.sets.A/B` shapes), and keep the pre-import state untouched on failure (import into a copy, apply only on success).

### M2 — 5-second polling runs forever

`setInterval(loadRequests, 5000)` (line 4812) polls unconditionally — even when the Requests tab is never opened and even when signed out (each poll just rewrites `reqNote`). On a phone at a gig this keeps the network and JS timer alive all night.

**Fix:** start/stop the interval based on state — only poll when `HOSTED && me && !me.offline`, and/or only while the Requests tab is active (restart on tab switch; poll at least once when the tab opens).

### M3 — Dead service worker + false "works offline" claims

`sw.js` exists in the repo and on the live site, but the app **never registers it** — it actively unregisters all service workers on every load (lines 4816–4822, added because stale SW caching caused version problems). Yet `DEPLOY-GUIDE.md` (line 24) and `STORE-GUIDE.md` (line 35) claim the app "works offline". It doesn't.

**Fix (pick one):**
- Remove `sw.js` and the unregister script, and fix the docs; or
- Do it properly: versioned cache name (`setbook-v2`), register in the page, and make the update flow explicit (new SW activates and clears old caches — the `activate` handler already does). The manifest is fine either way.

### M4 — Self-XSS in the stage-sign window

`showStageSign()` (lines 3796–3810) builds an HTML string with `stageLabel()` and URLs interpolated unescaped, then `w.document.write(html)`. A stage name containing markup would execute in that popup. It's self-XSS (your own account input), but it's trivial to fix: build the popup with `document.createElement`/`textContent`, or write to a Blob URL / `iframe.srcdoc` instead of `document.write`.

### M5 — Cloud sync failures are silent

`pushCloud()` / `pullCloud()` end in `.catch(function () {})`. The "Save to cloud" / "Get from cloud" buttons give zero feedback when the PUT/GET fails (offline, token expired, rules misconfigured). Add a visible success/failure message (there's already `authErr()` plumbing).

---

## Low / maintainability

| # | Finding | Location |
|---|---------|----------|
| L1 | Magic numbers: `POOL = 30`, `i < 12` loops in `clearBlock`/`autoFill`/`handleRequest`, `/30` in the add-button label, 12-entry `SET_A_LEN`/`SET_B_LEN`. Changing set length silently breaks loops. Centralize as constants. | lines 320–324, 3228, 3245, 3981 |
| L2 | Single 475 KB HTML file: ~1,780-line `CATALOG` + big embedded `CHORDBOOK` make diffs/reviews painful and the first paint heavier. Move data to a separate `catalog.js`/`chordbook.js` (with cache-busting version param). | lines 354–2131 |
| L3 | Play-mode timer uses `setInterval` — browsers throttle background tabs, so the countdown drifts if the screen locks mid-gig. Use a timestamp-based elapsed calculation. | line 3337 |
| L4 | `seenReqs`/`tracked`/`songStats`/`gigArchive` grow unbounded in localStorage (per-request IDs, per-song keys). Prune occasionally (e.g. cap stats at N entries). | lines 2371, 3576, 3268, 3672 |
| L5 | `showStageSign` and `copyText` use legacy `document.write` / `window.prompt` fallbacks — work, but replaceable. | 3796, 3906 |
| L6 | Duplicate songs (same name+artist) in the pool collide in `songStats`/`statKey` — play counts merge. Consider a stable song ID instead of name|artist keys. | 3270 |
| L7 | Accessibility: energy dots are non-focusable `<span>`s (no keyboard path, no aria labels); focus styles absent. Low priority for a personal gig tool, worth doing if you ship to app stores. | 2392, 2419 |
| L8 | `£` hardcoded throughout (gig report, payments). Fine for UK; note it if you ever sell abroad. | 3694, 3707 |
| L9 | Repo hygiene: single "Add files via upload" commit, no `.gitignore`, `capacitor/` referenced but absent, docs describe Netlify while the site is on GH Pages. Bring docs and repo in line with reality. | — |
| L10 | `starts()` computes set start times inside `renderSet` on every render — trivial, but could be memoized. | 2872 |

---

## What's working well

- **Vanilla JS, zero dependencies** — fast, no supply-chain surface, works on old phones.
- **Safe DOM rendering** — user-supplied data goes through `textContent` everywhere in the main app (the stage-sign popup is the one exception, M4).
- **Sound data model** — pool indices with remap-on-delete; migration paths for old save shapes (v1 flat sets → two blocks).
- **Auto-fill logic is decent** — energy matching + purpose-keyword scoring, never overwrites manual picks, respects Retire/Learning status.
- **Debounced cloud push** (800 ms) — no write-per-keystroke to the DB.
- **Nice feature depth** — play mode with metronome count-in, chromatic tuner (autocorrelation pitch detection), vocal range calculator, gig clock, QR request page, tip jar, gig archive and shareable setlist card.
- Good offline-first posture for the core use (pool/sets live in localStorage; chord sheets embedded).

---

## Suggested fix order

1. **C1** — firebase-config guard + template + guide update (production is broken *right now*).
2. **H1** — guard `requestFit`/sort (latent crash).
3. **M2 + M3** — stop needless polling; decide SW story and fix docs.
4. **H4** — Firebase RTDB rules + payload validation.
5. **M1, M5, M4** — import validation, sync feedback, stage-sign XSS.
6. **H2/H3** — hosting decision (Netlify vs GH Pages) and repo/guide consistency.
7. Then the L-series maintainability pass at your leisure.

---

## Fix status (applied in this working copy)

| Item | Status | What changed |
|------|--------|--------------|
| C1 | ✅ Fixed | Safe `FIREBASE_API_KEY` fallback (`window.FIREBASE_API_KEY || ""`), `firebase-config.js` template committed, `.gitignore` added, DEPLOY-GUIDE "v2 setup" section added |
| H1 | ✅ Fixed | `requestFit()` returns 0 for missing song — sort/popup can't throw |
| H2 | ✅ Degraded | UG search box only shows when serverless functions exist (`HAS_FUNCTIONS`); on GitHub Pages an honest note replaces the dead search. Live UG search still requires Netlify (skipped per request) |
| H3 | ✅ Docs fixed | STORE-GUIDE notes the `capacitor/` scaffold isn't in this repo |
| H4 | ✅ Partial | Removed shared open `/songbook.json` write (nothing read it); `requests.html` caps payloads (80/80/200); **rules must be applied in Firebase Console** — see `FIREBASE-RULES.md` |
| M1 | ✅ Fixed | Strict shape checks + per-song sanitization + block normalization on import |
| M2 | ✅ Fixed | Polling pauses when the page is hidden |
| M3 | ✅ Fixed | `sw.js` rewritten (network-first pages, cache-first assets, versioned `setbook-v2` cache); app now registers it instead of unregistering |
| M4 | ✅ Fixed | Stage-sign popup built via DOM + `textContent` — no `document.write`, no interpolation |
| M5 | ✅ Fixed | Save/Get cloud buttons show green success / red failure banners; autosave stays silent |
| L1 | ✅ Partial | `SET_SLOTS` constant added; `POOL` used in the add-button label. Remaining L-items deferred |

**Still on you (can't be done from the code):** paste your real Firebase Web API key into `firebase-config.js` and deploy; apply the RTDB rules in the Firebase Console; and optionally host on Netlify to re-enable live UG search.
