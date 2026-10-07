# Sideline Stats

A volleyball stat tracker for parents of club players (ages 15–18) in Ontario.
A parent taps buttons during a match to track one player's stats. The app builds
season stats, a trend chart, and a recruiting profile the family can send to
college coaches (OCAA, U Sports, NCAA).

The owner is a college student learning to code. Explain every change in plain
language: what changed, why, and which file it's in.

## Files

- `index.html`: page shell. Empty containers (`#app`, `#bar`, `#nav`, `#toast`) that the JS fills in.
- `style.css`: all styles. Colour tokens live on `:root`, with dark-mode overrides.
- `app.js`: all behaviour, wrapped in one IIFE. Registers the service worker at the bottom.
- `sw.js`: service worker for offline use. Precaches the files in `FILES`, then
  serves from cache and refreshes in the background (stale-while-revalidate).
  **If you add, remove or rename a file the app needs, add it to `FILES` and bump
  `VERSION`.** Editing an existing file needs no bump.
- `manifest.webmanifest`: name, colours and icons used when the app is installed.
- `icons/`: `icon.svg` (rounded) and `icon-maskable.svg` (full-bleed, ball inside the
  safe zone) are the sources. PNGs are rendered from them: icon-192/512 from
  `icon.svg`, icon-maskable-512 and apple-touch-icon (180) from `icon-maskable.svg`.
- `fonts/`: Barlow and Barlow Condensed (latin subset, woff2), bundled so the app works
  offline and makes no third-party requests. Licence in `fonts/OFL.txt` (keep it).

## How app.js works

- A single `state` object (`player`, `matches`, `activeId`, `tab`, `trend`) is saved
  to localStorage under the key `sideline-stats.v1` by `save()` after every change.
- `render()` rebuilds the whole screen from `state` with one of four view
  functions: `viewSetup`, `viewTrack`, `viewSeason`, `viewProfile`.
- Each tap is stored as `{k: statKey, s: setNumber, t: timestamp}` in a match's
  `log`. All numbers (kills, hitting %, pass rating…) are calculated from the logs
  by `counts()` and `metrics()`. Stored data stays raw, and stats are derived.
- All buttons use `data-act="action:arg"` and are handled by one click listener at
  the bottom of the file.
- Backup code = base64 of `{v:1, player, matches}`.

## Rules

- **Work in small phases.** Stop after each phase so the owner can test on their phone.
- **Commit after each phase** with a clear message.
- **Plain HTML, CSS and JavaScript only.** No frameworks, no build tools, no npm.
- **All data stays on the device** (localStorage). No accounts, no servers, no
  analytics, no collecting personal data. Many users are parents of minors.
  Avoid third-party requests that leak user info.
- **Never break existing saved data.** If the stored format changes, add a migration
  in `load()` that upgrades old data. Don't rename the storage key or existing
  fields without one. Old backup codes must keep restoring.
- Always escape user-entered text with `esc()` before putting it in HTML.

## Roadmap

1. ~~Split into index.html / style.css / app.js~~
2. ~~PWA: manifest, simple volleyball icon (no logos/brands), service worker for offline (gyms have bad wifi).~~
3. French/English toggle: all UI text in one translations object; natural Canadian French.
4. Printable one-page recruiting profile (print stylesheet → PDF); backup export/import as a file.

## Testing

Run `python3 -m http.server 8000` in this folder and open http://localhost:8000.
The service worker only runs on `https://` or `localhost`. On a phone over the local
network (http://192.168.x.x) the app works but offline mode and installing don't.
Use an https host to test those.

## Hosting

Live at https://adrianp-max.github.io/sideline-stats/ (GitHub Pages, repo
`AdrianP-Max/sideline-stats`, served from the `main` branch root).
**Every push to `main` publishes to real users within a minute or two**, so only
push after testing locally. Commits use the GitHub no-reply email. Never commit a
personal email address.

Note for users: on iPhone, the installed home-screen app has its own storage, separate
from Safari. Move data into it with a backup code (or backup file, Phase 4).
