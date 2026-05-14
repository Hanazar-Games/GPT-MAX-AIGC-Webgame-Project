import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA,
  activatePulse,
  clamp,
  createDailySeed,
  createRunSummary,
  createShareCode,
  createMission,
  createGameState,
  distanceSq,
  parseShareCode,
  startState,
  updateGame
} from "../src/core.js";

function playableState() {
  const state = createGameState({ seed: 42, difficulty: "standard" });
  startState(state);
  state.spawnTimer = 999;
  state.gateTimer = 999;
  return state;
}

test("clamp limits values inclusively", () => {
  assert.equal(clamp(-2, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(4, 0, 1), 1);
});

test("distanceSq returns squared distance", () => {
  assert.equal(distanceSq({ x: 0, y: 0 }, { x: 3, y: 4 }), 25);
});

test("daily seed is stable for the same calendar route", () => {
  const first = createDailySeed("2026-05-14");
  const second = createDailySeed("2026-05-14");
  const next = createDailySeed("2026-05-15");

  assert.equal(first.code, "20260514");
  assert.equal(first.seed, second.seed);
  assert.notEqual(first.seed, next.seed);
});

test("daily route uses the daily seed and code", () => {
  const daily = createDailySeed("2026-05-14");
  const state = createGameState({
    route: "daily",
    date: "2026-05-14"
  });

  assert.equal(state.route, "daily");
  assert.equal(state.routeCode, daily.code);
  assert.equal(state.seed, daily.seed);
});

test("run summaries produce compact deterministic share codes", () => {
  const state = createGameState({
    difficulty: "eclipse",
    route: "daily",
    routeCode: "20260514",
    seed: 7
  });
  state.status = "won";
  state.score = 1234.4;
  state.wave = 6;
  state.shield = 87.2;
  state.maxCombo = 2.34;
  state.stats.shards = 12;
  state.stats.gates = 3;
  state.stats.grazes = 5;
  state.stats.hazardsBroken = 2;
  state.stats.missions = 4;

  const summary = createRunSummary(state);

  assert.deepEqual(summary, {
    status: "won",
    routeCode: "20260514",
    difficulty: "eclipse",
    score: 1234,
    wave: 6,
    shield: 88,
    shards: 12,
    gates: 3,
    grazes: 5,
    breaks: 2,
    missions: 4,
    maxCombo: 2.3
  });
  assert.equal(
    createShareCode(summary),
    "LD|CLEAR|20260514|ECL|1234|W6|H88|S12|G3|R5|B2|M4|X2.3"
  );
  assert.deepEqual(parseShareCode(createShareCode(summary)), summary);
  assert.equal(parseShareCode("LD|CLEAR|bad"), null);
  assert.equal(parseShareCode("LD|CLEAR|RUN|NOPE|1234|W6|H88|S12|G3|R5|B2|M4|X2.3"), null);
});

test("collecting a shard increases score, combo, and overdrive", () => {
  const state = playableState();
  state.entities.push({
    id: "shard-test",
    type: "shard",
    x: state.player.x,
    y: state.player.y,
    vx: 0,
    vy: 0,
    r: 12,
    value: 10,
    age: 0,
    rotation: 0,
    spin: 0,
    color: "#e6b94f"
  });

  updateGame(state, {}, 0.016);

  assert.equal(state.entities.length, 0);
  assert.equal(state.score, 10);
  assert.equal(state.stats.shards, 1);
  assert.ok(state.combo > 1);
  assert.ok(state.overdrive > 0);
});

test("static damage lowers shield when the player is not dashing", () => {
  const state = playableState();
  state.combo = 3;
  state.entities.push({
    id: "static-test",
    type: "static",
    x: state.player.x,
    y: state.player.y,
    vx: 0,
    vy: 0,
    r: 20,
    damage: 20,
    age: 0,
    rotation: 0,
    spin: 0,
    color: "#e05f3f"
  });

  updateGame(state, {}, 0.016);

  assert.equal(state.entities.length, 0);
  assert.equal(state.shield, 80);
  assert.equal(state.combo, 1);
});

test("near misses on static hazards grant graze rewards once", () => {
  const state = playableState();
  state.entities.push({
    id: "graze-test",
    type: "static",
    x: state.player.x + state.player.r + 30,
    y: state.player.y,
    vx: 0,
    vy: 0,
    r: 20,
    damage: 20,
    grazed: false,
    age: 0,
    rotation: 0,
    spin: 0,
    color: "#e05f3f"
  });

  updateGame(state, {}, 0.016);
  const scoreAfterGraze = state.score;
  updateGame(state, {}, 0.016);

  assert.equal(state.entities.length, 1);
  assert.equal(state.stats.grazes, 1);
  assert.ok(scoreAfterGraze > 0);
  assert.equal(state.score, scoreAfterGraze);
  assert.equal(state.shield, 100);
});

test("dash breaks static hazards instead of damaging shield", () => {
  const state = playableState();
  state.entities.push({
    id: "static-test",
    type: "static",
    x: state.player.x,
    y: state.player.y,
    vx: 0,
    vy: 0,
    r: 20,
    damage: 20,
    age: 0,
    rotation: 0,
    spin: 0,
    color: "#e05f3f"
  });

  updateGame(state, { dash: true, axisX: 1, axisY: 0 }, 0.016);

  assert.equal(state.entities.length, 0);
  assert.equal(state.shield, 100);
  assert.equal(state.stats.hazardsBroken, 1);
  assert.ok(state.score > 0);
});

test("pulse clears only nearby static hazards", () => {
  const state = playableState();
  state.overdrive = 100;
  state.entities.push(
    {
      id: "near-static",
      type: "static",
      x: state.player.x + 20,
      y: state.player.y,
      vx: 0,
      vy: 0,
      r: 20,
      damage: 20,
      age: 0,
      rotation: 0,
      spin: 0,
      color: "#e05f3f"
    },
    {
      id: "far-static",
      type: "static",
      x: ARENA.width - 30,
      y: 30,
      vx: 0,
      vy: 0,
      r: 20,
      damage: 20,
      age: 0,
      rotation: 0,
      spin: 0,
      color: "#e05f3f"
    }
  );

  const cleared = activatePulse(state);

  assert.equal(cleared, 1);
  assert.equal(state.entities.length, 1);
  assert.equal(state.entities[0].id, "far-static");
  assert.equal(state.overdrive, 0);
});

test("missions track stat progress and grant rewards", () => {
  const state = playableState();
  state.mission = createMission(0, state.wave, state.stats);
  state.mission.target = 1;
  state.entities.push({
    id: "mission-shard",
    type: "shard",
    x: state.player.x,
    y: state.player.y,
    vx: 0,
    vy: 0,
    r: 12,
    value: 10,
    age: 0,
    rotation: 0,
    spin: 0,
    color: "#e6b94f"
  });

  updateGame(state, {}, 0.016);

  assert.equal(state.stats.missions, 1);
  assert.equal(state.mission.index, 1);
  assert.ok(state.score > 100);
  assert.ok(state.overdrive >= 18);
});

test("the route is won when elapsed time reaches the goal", () => {
  const state = playableState();
  state.goal = 0.02;

  updateGame(state, {}, 0.03);

  assert.equal(state.status, "won");
  assert.ok(state.score >= 500);
});
