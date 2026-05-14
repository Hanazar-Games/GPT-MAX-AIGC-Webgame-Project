# Lumen Drift

`hanazarochikawa` baseline for the GPT-MAX-AIGC-Webgame-Project repository.

Lumen Drift is a zero-dependency Canvas webgame about holding a signal route open for 90 seconds. It has keyboard, pointer, and touch input; score persistence; difficulty modes; deterministic gameplay logic; and a GitHub Pages deployment workflow.

## Run

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

If Node/npm is installed, `npm start` runs the same static server command.

## Test

```sh
npm run lint
npm test
```

The test scripts use Node 22 in CI.

## Controls

- Move: WASD, arrow keys, pointer, or touch.
- Dash: Space.
- Pulse: E, Shift, or the Pulse button when overdrive is full.
- Pause: P or the Pause button.

## Project Layout

- `index.html` hosts the game shell.
- `src/core.js` contains deterministic gameplay rules.
- `src/game.js` handles rendering, input, audio, and HUD sync.
- `src/styles.css` defines the responsive interface.
- `tests/gameplay.test.mjs` covers collision, scoring, pulse, and win logic.
- `.github/workflows/ci.yml` runs verification and publishes GitHub Pages.
