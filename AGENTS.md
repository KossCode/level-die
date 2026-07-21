# LEVEL LIE

A "trickster" mobile 2D platformer (in the spirit of *Level Devil*) built as a static
Progressive Web App. Pure vanilla JavaScript + HTML5 canvas — no framework, no build
step, no backend, no database, no package manager.

## Cursor Cloud specific instructions

### What this is / how it runs
- Entirely client-side static files. Entry point is `index.html`, which loads
  `js/levels.js`, `js/engine.js`, `js/game.js` and `css/style.css`.
- There are no dependencies to install and nothing to build. The only "service" is a
  static HTTP server serving the repo root. It must be served over HTTP (not opened as
  `file://`) because the service worker requires an HTTP origin.
- Run it (per `README.md`): `python3 -m http.server 8080`, then open `http://localhost:8080`.
- There is no lint, test, or build tooling in this repo (no `package.json`, no CI,
  no test runner). "Running the app" = serving it statically and opening it in a browser.

### Non-obvious caveats
- Service worker (`sw.js`) caches assets. It uses a **network-first** strategy for
  `.js`/`.css`/`.html`, so a normal reload picks up code edits — but if you ever see
  stale behavior, do a hard reload (Ctrl+Shift+R) or bump the `?v=N` query strings in
  `index.html` / the `CACHE` name in `sw.js`.
- Controls: on-screen buttons `◀ ▶` and `прыг` (jump), plus keyboard for desktop
  testing — `ArrowLeft`/`A` = left, `ArrowRight`/`D` = right, `ArrowUp`/`W`/`Space` = jump.
  Click the canvas first to give it keyboard focus.
- The UI text is in Russian (e.g. `ИГРАТЬ` = Play, `смертей` = deaths).
- Known pre-existing game-logic bug (NOT an environment problem): on Level 1, after the
  first (fake-door) death the player respawns on top of the freshly spawned spike, which
  causes a rapid repeated death loop. Do not "fix" this as part of environment work.
