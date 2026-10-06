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
- `app.js`: all behaviour, wrapped in one IIFE.

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
2. PWA: manifest, simple volleyball icon (no logos/brands), service worker for offline (gyms have bad wifi).
3. French/English toggle: all UI text in one translations object; natural Canadian French.
4. Printable one-page recruiting profile (print stylesheet → PDF); backup export/import as a file.

## Testing

Open `index.html` in a browser. From Phase 2 on, the service worker needs
`http://localhost` or `https://` (e.g. `python3 -m http.server` in this folder).
