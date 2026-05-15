# Lumen Drift Design Notes

## Core Promise

Lumen Drift is a compact survival arcade game where the player keeps a signal route alive for 90 seconds. The game should feel readable in the first five seconds and expressive after repeated runs.

## Player Verbs

- Drift through falling signal traffic.
- Collect shards and charges to build score, shield, and overdrive.
- Dash through static hazards when timing is clean.
- Graze static hazards for high-risk overdrive and combo gain.
- Pulse to clear nearby static hazards when overdrive is full.
- Complete rotating objectives for route rewards.
- Copy a compact result code after each completed or failed route.
- Decode a compact result code to inspect another run.
- Share a result deep link for direct run inspection.
- Switch to a low-intensity visual mode without changing scoring or route logic.

## Modes

- `Run`: fresh random seed every launch.
- `Daily`: deterministic route based on the local calendar day.
- Difficulty changes spawn pressure, hazard density, speed, and damage.

## Scoring Shape

Score is intentionally layered:

- basic collection gives dependable progress;
- gate crossing rewards positioning;
- dash breaks reward commitment;
- graze scoring rewards mastery;
- objectives create short-term routing pressure;
- the final clear bonus rewards survival and shield retention.

## Interface Principles

- Keep the first screen as the playable surface, not a landing page.
- Use dense telemetry, because this is an arcade tool the player repeatedly scans.
- Avoid instructional copy during play; feedback should come from HUD state, color, and the signal log.
- Preserve keyboard, pointer, and touch support.
- Treat calm visuals as a first-class accessibility option, not a separate difficulty.

## Near-Term Roadmap

- Add a richer end-of-run breakdown.
- Add browser-level visual regression checks once a reliable browser runner is available in the environment.
- Push to GitHub Pages once GitHub credentials are available on this machine.
