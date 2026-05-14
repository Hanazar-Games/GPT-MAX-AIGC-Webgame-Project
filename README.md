# Lumen Drift

`hanazarochikawa` baseline for the GPT-MAX-AIGC-Webgame-Project repository.

Lumen Drift is a zero-dependency Canvas webgame about holding a signal route open for 90 seconds. It has keyboard, pointer, and touch input; score and run-history persistence; daily seeded routes; compact share-code copy and decode; rotating objectives; near-miss graze scoring; difficulty modes; deterministic gameplay logic; offline app-shell caching; and a GitHub Pages deployment workflow.

## Run

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Daily routes and difficulty can be opened directly with query params, for example `http://localhost:4173/?route=daily&mode=eclipse`.

Completed and failed routes emit compact result codes. Paste a result code into the Result Code panel to inspect route, difficulty, score, wave, shield, and max combo.

If Node/npm is installed, `npm start` runs the same static server command.

## Test

```sh
python3 tools/verify_static.py
python3 tools/smoke_http.py
npm run lint
npm test
```

The static and HTTP verification scripts only need Python. The JavaScript checks use Node 22 in CI.

## Controls

- Move: WASD, arrow keys, pointer, or touch.
- Dash: Space.
- Pulse: E, Shift, or the Pulse button when overdrive is full.
- Pause: P or the Pause button.

## Project Layout

- `docs/DESIGN.md` captures the game design pillars and roadmap.
- `index.html` hosts the game shell.
- `ops/RUNBOOK.md` captures the local operating state and release flow.
- `src/core.js` contains deterministic gameplay rules.
- `src/game.js` handles rendering, input, audio, and HUD sync.
- `src/styles.css` defines the responsive interface.
- `sw.js` caches the app shell for offline play after first load.
- `tests/gameplay.test.mjs` covers collision, scoring, pulse, and win logic.
- `tools/verify_static.py` checks static wiring without Node.
- `tools/smoke_http.py` verifies the app shell through a local HTTP server.
- `.github/workflows/ci.yml` runs verification and publishes GitHub Pages.
