export const ARENA = Object.freeze({
  width: 1000,
  height: 640
});

export const GOAL_SECONDS = 90;
export const PLAYER_RADIUS = 18;

export const DIFFICULTIES = Object.freeze({
  soft: Object.freeze({
    label: "Soft",
    hazardChance: 0.32,
    spawnScale: 1.12,
    damageScale: 0.82,
    speedScale: 0.9
  }),
  standard: Object.freeze({
    label: "Standard",
    hazardChance: 0.4,
    spawnScale: 1,
    damageScale: 1,
    speedScale: 1
  }),
  eclipse: Object.freeze({
    label: "Eclipse",
    hazardChance: 0.5,
    spawnScale: 0.86,
    damageScale: 1.2,
    speedScale: 1.12
  })
});

const ENTITY_LIMIT = 90;
const PARTICLE_LIMIT = 160;
const GRAZE_MARGIN = 34;
const MISSION_DEFS = Object.freeze([
  Object.freeze({
    stat: "shards",
    label: (target) => `Link ${target} shards`,
    target: (index, wave) => 5 + Math.floor(index * 0.8) + Math.floor(wave * 0.5),
    reward: 110
  }),
  Object.freeze({
    stat: "grazes",
    label: (target) => `Graze ${target} static`,
    target: (index, wave) => 4 + Math.floor(index * 0.7) + Math.floor(wave * 0.4),
    reward: 125
  }),
  Object.freeze({
    stat: "gates",
    label: (target) => `Cross ${target} gates`,
    target: (index, wave) => 1 + Math.floor((index + wave) / 4),
    reward: 160
  }),
  Object.freeze({
    stat: "hazardsBroken",
    label: (target) => `Break ${target} static`,
    target: (index, wave) => 2 + Math.floor((index + wave) / 3),
    reward: 140
  })
]);
const DEFAULT_INPUT = Object.freeze({
  axisX: 0,
  axisY: 0,
  pointer: null,
  dash: false,
  pulse: false
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createRng(seed = Date.now()) {
  let value = seed >>> 0;

  return function rng() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDailySeed(date = new Date()) {
  const day =
    typeof date === "string"
      ? date
      : [
          date.getFullYear(),
          String(date.getMonth() + 1).padStart(2, "0"),
          String(date.getDate()).padStart(2, "0")
        ].join("-");
  let hash = 2166136261;

  for (const char of `lumen-drift:${day}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return {
    code: day.replaceAll("-", ""),
    seed: hash >>> 0
  };
}

export function createRunSummary(state) {
  return {
    status: state.status,
    routeCode: state.routeCode,
    difficulty: state.difficulty,
    score: Math.round(state.score),
    wave: state.wave,
    shield: Math.ceil(state.shield),
    shards: state.stats.shards,
    gates: state.stats.gates,
    grazes: state.stats.grazes,
    breaks: state.stats.hazardsBroken,
    missions: state.stats.missions,
    maxCombo: Number(state.maxCombo.toFixed(1))
  };
}

export function createShareCode(summary) {
  const result = summary.status === "won" ? "CLEAR" : "LOST";
  const difficulty = {
    soft: "SOFT",
    standard: "STD",
    eclipse: "ECL"
  }[summary.difficulty] ?? "STD";

  return [
    "LD",
    result,
    summary.routeCode,
    difficulty,
    summary.score,
    `W${summary.wave}`,
    `H${summary.shield}`,
    `S${summary.shards}`,
    `G${summary.gates}`,
    `R${summary.grazes}`,
    `B${summary.breaks}`,
    `M${summary.missions}`,
    `X${summary.maxCombo}`
  ].join("|");
}

export function createGameState(options = {}) {
  const difficulty = DIFFICULTIES[options.difficulty]
    ? options.difficulty
    : "standard";
  const route = options.route === "daily" ? "daily" : "run";
  const daily = route === "daily" ? createDailySeed(options.date) : null;
  const seed =
    options.seed ?? daily?.seed ?? Math.floor(Math.random() * 4294967295);

  const state = {
    status: "ready",
    difficulty,
    route,
    routeCode: options.routeCode ?? daily?.code ?? "RUN",
    seed,
    rng: createRng(seed),
    elapsed: 0,
    goal: options.goal ?? GOAL_SECONDS,
    score: 0,
    best: options.best ?? 0,
    shield: 100,
    wave: 1,
    combo: 1,
    maxCombo: 1,
    comboTimer: 0,
    overdrive: 0,
    dashCooldown: 0,
    dashTimer: 0,
    pulseCooldown: 0,
    spawnTimer: 0.35,
    gateTimer: 7,
    shake: 0,
    flash: 0,
    player: {
      x: ARENA.width * 0.5,
      y: ARENA.height * 0.78,
      r: PLAYER_RADIUS,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2
    },
    entities: [],
    particles: [],
    eventLog: ["Route loaded"],
    stats: {
      shards: 0,
      hazardsBroken: 0,
      gates: 0,
      grazes: 0,
      pulses: 0,
      missions: 0
    }
  };
  state.mission = createMission(0, state.wave, state.stats);
  return state;
}

export function startState(state) {
  if (state.status === "ready" || state.status === "paused") {
    state.status = "playing";
    pushEvent(state, "Signal engaged");
  }
  return state;
}

export function pauseState(state) {
  if (state.status === "playing") {
    state.status = "paused";
    pushEvent(state, "Signal held");
  } else if (state.status === "paused") {
    state.status = "playing";
    pushEvent(state, "Signal resumed");
  }
  return state;
}

export function updateGame(state, input = DEFAULT_INPUT, dt = 0) {
  if (state.status !== "playing") {
    return state;
  }

  const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  if (step <= 0) {
    return state;
  }

  state.elapsed += step;
  state.wave = 1 + Math.floor(state.elapsed / 15);
  tickTimers(state, step);
  updateCombo(state, step);
  updatePlayer(state, input, step);

  if (input.pulse) {
    activatePulse(state);
  }

  updateSpawns(state, step);
  updateEntities(state, step);
  resolveCollisions(state);
  updateMission(state);
  updateParticles(state, step);

  if (state.elapsed >= state.goal && state.status === "playing") {
    state.status = "won";
    state.score += Math.round(500 * state.combo + state.shield * 3);
    pushEvent(state, "Signal complete");
  }

  if (state.score > state.best) {
    state.best = state.score;
  }

  return state;
}

export function activatePulse(state) {
  if (state.overdrive < 100 || state.pulseCooldown > 0) {
    return 0;
  }

  const radius = 260;
  let cleared = 0;
  const remaining = [];

  for (const entity of state.entities) {
    if (
      entity.type === "static" &&
      distanceSq(state.player, entity) <= radius * radius
    ) {
      cleared += 1;
      burst(state, entity.x, entity.y, "#e05f3f", 12);
    } else {
      remaining.push(entity);
    }
  }

  state.entities = remaining;
  state.overdrive = 0;
  state.pulseCooldown = 4.2;
  state.flash = 0.28;
  state.shake = Math.max(state.shake, 0.25);
  state.stats.pulses += 1;

  if (cleared > 0) {
    state.score += Math.round(cleared * 28 * state.combo);
    addCombo(state, cleared * 0.2);
    pushEvent(state, `Pulse cleared ${cleared}`);
  } else {
    pushEvent(state, "Pulse released");
  }

  return cleared;
}

export function spawnEntity(state, forcedType) {
  if (state.entities.length >= ENTITY_LIMIT) {
    return null;
  }

  const settings = DIFFICULTIES[state.difficulty];
  const rng = state.rng;
  const waveLift = Math.min(state.wave - 1, 10);
  const roll = rng();
  const hazardChance = clamp(
    settings.hazardChance + waveLift * 0.014,
    0.24,
    0.64
  );
  const type =
    forcedType ??
    (roll < hazardChance ? "static" : roll < hazardChance + 0.44 ? "shard" : "charge");
  const x = 36 + rng() * (ARENA.width - 72);
  const speed = (70 + rng() * 90 + state.wave * 13) * settings.speedScale;
  const drift = (rng() - 0.5) * (48 + state.wave * 8);
  const base = {
    id: `${type}-${state.elapsed.toFixed(3)}-${Math.floor(rng() * 100000)}`,
    type,
    x,
    y: -42,
    vx: drift,
    vy: speed,
    age: 0,
    rotation: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 3.5
  };

  let entity;
  if (type === "static") {
    entity = {
      ...base,
      r: 18 + rng() * 12,
      damage: 16 + state.wave * 1.8,
      grazed: false,
      color: "#e05f3f"
    };
  } else if (type === "charge") {
    entity = {
      ...base,
      r: 15,
      value: 35,
      color: "#8fbf5b"
    };
  } else {
    entity = {
      ...base,
      type: "shard",
      r: 12 + rng() * 3,
      value: 10,
      color: "#e6b94f"
    };
  }

  state.entities.push(entity);
  return entity;
}

export function spawnGate(state) {
  if (state.entities.length >= ENTITY_LIMIT) {
    return null;
  }

  const rng = state.rng;
  const width = 170 + rng() * 80;
  const gate = {
    id: `gate-${state.elapsed.toFixed(3)}-${Math.floor(rng() * 100000)}`,
    type: "gate",
    x: width * 0.5 + 70 + rng() * (ARENA.width - width - 140),
    y: -52,
    w: width,
    h: 30,
    vx: 0,
    vy: 78 + state.wave * 12,
    r: 0,
    scored: false,
    age: 0,
    color: "#2aa6a1"
  };
  state.entities.push(gate);
  return gate;
}

export function createMission(index, wave, stats) {
  const def = MISSION_DEFS[index % MISSION_DEFS.length];
  const target = def.target(index, wave);
  return {
    index,
    stat: def.stat,
    label: def.label(target),
    target,
    progress: 0,
    startValue: stats[def.stat] ?? 0,
    reward: def.reward + Math.floor(index / MISSION_DEFS.length) * 35
  };
}

function tickTimers(state, dt) {
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.dashTimer = Math.max(0, state.dashTimer - dt);
  state.pulseCooldown = Math.max(0, state.pulseCooldown - dt);
  state.shake = Math.max(0, state.shake - dt * 1.8);
  state.flash = Math.max(0, state.flash - dt * 1.6);
}

function updateCombo(state, dt) {
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    return;
  }

  if (state.combo > 1) {
    state.combo = Math.max(1, state.combo - dt * 0.85);
  }
}

function updatePlayer(state, input, dt) {
  const player = state.player;
  let targetX = clamp(input.axisX ?? 0, -1, 1);
  let targetY = clamp(input.axisY ?? 0, -1, 1);

  if (input.pointer?.active) {
    const dx = input.pointer.x - player.x;
    const dy = input.pointer.y - player.y;
    const length = Math.hypot(dx, dy);
    if (length > 8) {
      targetX = dx / length;
      targetY = dy / length;
    }
  }

  const axisLength = Math.hypot(targetX, targetY);
  if (axisLength > 1) {
    targetX /= axisLength;
    targetY /= axisLength;
  }

  if (input.dash && state.dashCooldown <= 0) {
    state.dashTimer = 0.18;
    state.dashCooldown = 2.55;
    state.flash = Math.max(state.flash, 0.16);
    pushEvent(state, "Drift burst");
  }

  if (axisLength > 0.05) {
    player.angle = Math.atan2(targetY, targetX);
  }

  const dashBoost = state.dashTimer > 0 ? 1.85 : 1;
  const speed = (310 + Math.min(state.wave, 8) * 8) * dashBoost;
  const smoothing = state.dashTimer > 0 ? 18 : 12;
  player.vx += (targetX * speed - player.vx) * clamp(dt * smoothing, 0, 1);
  player.vy += (targetY * speed - player.vy) * clamp(dt * smoothing, 0, 1);
  player.x = clamp(player.x + player.vx * dt, player.r, ARENA.width - player.r);
  player.y = clamp(player.y + player.vy * dt, player.r, ARENA.height - player.r);
}

function updateSpawns(state, dt) {
  const settings = DIFFICULTIES[state.difficulty];
  state.spawnTimer -= dt;

  while (state.spawnTimer <= 0) {
    spawnEntity(state);
    const interval = Math.max(
      0.21,
      (0.88 - Math.min(state.wave, 10) * 0.052) * settings.spawnScale
    );
    state.spawnTimer += interval;
  }

  state.gateTimer -= dt;
  if (state.gateTimer <= 0) {
    spawnGate(state);
    state.gateTimer = 11.5 + state.rng() * 3.5 - Math.min(state.wave, 5) * 0.45;
  }
}

function updateEntities(state, dt) {
  for (const entity of state.entities) {
    entity.age += dt;
    entity.x += entity.vx * dt;
    entity.y += entity.vy * dt;
    entity.rotation += (entity.spin ?? 0) * dt;

    if (entity.type !== "gate") {
      if (entity.x < entity.r) {
        entity.x = entity.r;
        entity.vx = Math.abs(entity.vx) * 0.75;
      } else if (entity.x > ARENA.width - entity.r) {
        entity.x = ARENA.width - entity.r;
        entity.vx = -Math.abs(entity.vx) * 0.75;
      }
    }
  }

  state.entities = state.entities.filter((entity) => {
    const margin = entity.type === "gate" ? 90 : 70;
    return entity.y < ARENA.height + margin;
  });
}

function resolveCollisions(state) {
  const kept = [];

  for (const entity of state.entities) {
    if (entity.type === "gate") {
      handleGateCollision(state, entity);
      kept.push(entity);
      continue;
    }

    const hitRadius = state.player.r + entity.r;
    const proximity = distanceSq(state.player, entity);
    if (proximity > hitRadius * hitRadius) {
      maybeGrazeStatic(state, entity, proximity, hitRadius + GRAZE_MARGIN);
      kept.push(entity);
      continue;
    }

    if (entity.type === "shard") {
      collectShard(state, entity);
    } else if (entity.type === "charge") {
      collectCharge(state, entity);
    } else if (entity.type === "static") {
      hitStatic(state, entity);
    }
  }

  state.entities = kept;
}

function collectShard(state, entity) {
  state.score += Math.round(entity.value * state.combo);
  state.overdrive = clamp(state.overdrive + 7, 0, 100);
  state.stats.shards += 1;
  addCombo(state, 0.18);
  burst(state, entity.x, entity.y, entity.color, 8);
  pushEvent(state, "Shard linked");
}

function collectCharge(state, entity) {
  state.score += Math.round(entity.value * state.combo);
  state.shield = clamp(state.shield + 18, 0, 100);
  state.overdrive = clamp(state.overdrive + 24, 0, 100);
  addCombo(state, 0.32);
  burst(state, entity.x, entity.y, entity.color, 12);
  pushEvent(state, "Charge absorbed");
}

function hitStatic(state, entity) {
  if (state.dashTimer > 0) {
    state.score += Math.round((18 + state.wave * 2) * state.combo);
    state.overdrive = clamp(state.overdrive + 6, 0, 100);
    state.stats.hazardsBroken += 1;
    addCombo(state, 0.24);
    burst(state, entity.x, entity.y, entity.color, 12);
    pushEvent(state, "Static broken");
    return;
  }

  const settings = DIFFICULTIES[state.difficulty];
  state.shield = clamp(state.shield - entity.damage * settings.damageScale, 0, 100);
  state.combo = 1;
  state.comboTimer = 0;
  state.shake = Math.max(state.shake, 0.34);
  state.flash = Math.max(state.flash, 0.25);
  burst(state, entity.x, entity.y, entity.color, 16);
  pushEvent(state, "Shield struck");

  if (state.shield <= 0) {
    state.status = "lost";
    pushEvent(state, "Signal lost");
  }
}

function handleGateCollision(state, gate) {
  if (gate.scored) {
    return;
  }

  const player = state.player;
  const insideX = player.x > gate.x - gate.w * 0.5 && player.x < gate.x + gate.w * 0.5;
  const insideY = player.y > gate.y - player.r && player.y < gate.y + gate.h + player.r;

  if (insideX && insideY) {
    gate.scored = true;
    state.score += Math.round(75 * state.combo);
    state.overdrive = clamp(state.overdrive + 12, 0, 100);
    state.stats.gates += 1;
    addCombo(state, 0.5);
    burst(state, player.x, player.y, "#2aa6a1", 18);
    pushEvent(state, "Gate crossed");
  }
}

function maybeGrazeStatic(state, entity, proximity, grazeRadius) {
  if (
    entity.type !== "static" ||
    entity.grazed ||
    proximity > grazeRadius * grazeRadius
  ) {
    return;
  }

  entity.grazed = true;
  state.stats.grazes += 1;
  state.score += Math.round((8 + state.wave) * state.combo);
  state.overdrive = clamp(state.overdrive + 4, 0, 100);
  addCombo(state, 0.08);
  burst(state, state.player.x, state.player.y, "#f4efe5", 5);
  pushEvent(state, "Static grazed");
}

function updateMission(state) {
  const mission = state.mission;
  if (!mission) {
    return;
  }

  mission.progress = clamp(
    (state.stats[mission.stat] ?? 0) - mission.startValue,
    0,
    mission.target
  );

  if (mission.progress < mission.target) {
    return;
  }

  state.stats.missions += 1;
  state.score += Math.round(mission.reward * state.combo);
  state.overdrive = clamp(state.overdrive + 18, 0, 100);
  state.shield = clamp(state.shield + 8, 0, 100);
  pushEvent(state, "Objective complete");
  state.mission = createMission(state.stats.missions, state.wave, state.stats);
}

function addCombo(state, amount) {
  state.combo = clamp(state.combo + amount, 1, 9.9);
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = 3.2;
}

function burst(state, x, y, color, count) {
  const rng = state.rng;
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const speed = 40 + rng() * 150;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + rng() * 0.45,
      maxLife: 0.8,
      size: 2 + rng() * 3,
      color
    });
  }

  if (state.particles.length > PARTICLE_LIMIT) {
    state.particles.splice(0, state.particles.length - PARTICLE_LIMIT);
  }
}

function updateParticles(state, dt) {
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 1.9;
    particle.vy *= 1 - dt * 1.9;
  }

  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function pushEvent(state, message) {
  state.eventLog.unshift(message);
  if (state.eventLog.length > 5) {
    state.eventLog.length = 5;
  }
}
