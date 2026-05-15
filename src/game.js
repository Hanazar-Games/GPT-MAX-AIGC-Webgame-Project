import {
  ARENA,
  createDailySeed,
  createGameState,
  createRunSummary,
  createShareCode,
  pauseState,
  parseShareCode,
  startState,
  updateGame
} from "./core.js";

const storagePrefix = "lumen-drift-best";
const recordsKey = "lumen-drift-records";
const resultParam = "result";
const visualParam = "visual";
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const els = {
  score: document.querySelector("#score-value"),
  shield: document.querySelector("#shield-value"),
  time: document.querySelector("#time-value"),
  wave: document.querySelector("#wave-value"),
  route: document.querySelector("#route-value"),
  combo: document.querySelector("#combo-value"),
  best: document.querySelector("#best-value"),
  shards: document.querySelector("#shards-value"),
  gates: document.querySelector("#gates-value"),
  grazes: document.querySelector("#grazes-value"),
  breaks: document.querySelector("#breaks-value"),
  shieldMeter: document.querySelector("#shield-meter"),
  shieldMeterLabel: document.querySelector("#shield-meter-label"),
  overdriveMeter: document.querySelector("#overdrive-meter"),
  overdriveMeterLabel: document.querySelector("#overdrive-meter-label"),
  missionTitle: document.querySelector("#mission-title"),
  missionMeter: document.querySelector("#mission-meter"),
  missionMeterLabel: document.querySelector("#mission-meter-label"),
  eventLog: document.querySelector("#event-log"),
  recordList: document.querySelector("#record-list"),
  shareInput: document.querySelector("#share-input"),
  shareResult: document.querySelector("#share-result"),
  overlay: document.querySelector("#stage-overlay"),
  overlayKicker: document.querySelector("#overlay-kicker"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayDetail: document.querySelector("#overlay-detail"),
  difficulty: document.querySelector("#difficulty-select"),
  routeSelect: document.querySelector("#route-select"),
  visual: document.querySelector("#visual-select"),
  start: document.querySelector("#start-button"),
  pause: document.querySelector("#pause-button"),
  pulse: document.querySelector("#pulse-button"),
  copy: document.querySelector("#copy-button"),
  decode: document.querySelector("#decode-button"),
  link: document.querySelector("#link-button"),
  reset: document.querySelector("#reset-button")
};

const keys = new Set();
const pointer = {
  active: false,
  x: ARENA.width * 0.5,
  y: ARENA.height * 0.78
};
const inputQueue = {
  dash: false,
  pulse: false
};

let audio = null;
applyInitialSettings();
let state = makeState();
let lastFrame = performance.now();
let lastStatus = state.status;
let statusRender = "";
let recordsRender = "";
let runRecords = readRunRecords();

resizeCanvas();
syncHud(true);
drawScene(0);
registerServiceWorker();
requestAnimationFrame(frame);

els.start.addEventListener("click", () => {
  ensureAudio();
  if (state.status === "lost" || state.status === "won") {
    state = makeState();
  }
  startState(state);
  syncHud(true);
});

els.pause.addEventListener("click", () => {
  pauseState(state);
  syncHud(true);
});

els.pulse.addEventListener("click", () => {
  inputQueue.pulse = true;
});

els.copy.addEventListener("click", () => {
  copyShareCode();
});

els.decode.addEventListener("click", () => {
  decodeShareCode();
});

els.link.addEventListener("click", () => {
  copyResultLink();
});

els.shareInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    decodeShareCode();
  }
});

els.reset.addEventListener("click", () => {
  state = makeState();
  syncHud(true);
});

els.difficulty.addEventListener("change", () => {
  if (state.status !== "playing") {
    state = makeState();
    syncUrlSettings();
    syncHud(true);
  }
});

els.routeSelect.addEventListener("change", () => {
  if (state.status !== "playing") {
    state = makeState();
    syncUrlSettings();
    syncHud(true);
  }
});

els.visual.addEventListener("change", () => {
  syncVisualMode();
  syncUrlSettings();
  drawScene(performance.now() / 1000);
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) {
    return;
  }

  keys.add(event.key.toLowerCase());
  if (event.code === "Space") {
    inputQueue.dash = true;
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "e" || event.key === "Shift") {
    inputQueue.pulse = true;
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "p") {
    pauseState(state);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointer.active = true;
  setPointer(event);
  if (state.status === "ready") {
    startState(state);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (pointer.active) {
    setPointer(event);
  }
});

canvas.addEventListener("pointerup", (event) => {
  pointer.active = false;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener("pointercancel", () => {
  pointer.active = false;
});

function makeState() {
  const daily = createDailySeed();
  const route = els.routeSelect.value;
  const routeCode = route === "daily" ? daily.code : "RUN";
  const best =
    Number(localStorage.getItem(bestKey(els.difficulty.value, routeCode)) ?? "0") || 0;
  const next = createGameState({
    difficulty: els.difficulty.value,
    route,
    routeCode,
    seed: route === "daily" ? daily.seed : undefined,
    best
  });
  lastStatus = next.status;
  return next;
}

function applyInitialSettings() {
  const params = new URLSearchParams(location.search);
  setSelectValue(els.difficulty, params.get("mode"));
  setSelectValue(els.routeSelect, params.get("route"));
  setSelectValue(els.visual, params.get(visualParam));
  if (!params.has(visualParam) && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    els.visual.value = "calm";
  }
  syncVisualMode();
  loadShareCode(params.get(resultParam), { syncUrl: false });
}

function setSelectValue(select, value) {
  if (!value) {
    return;
  }

  const allowed = Array.from(select.options).some((option) => option.value === value);
  if (allowed) {
    select.value = value;
  }
}

function syncUrlSettings() {
  const params = new URLSearchParams(location.search);

  if (els.difficulty.value === "standard") {
    params.delete("mode");
  } else {
    params.set("mode", els.difficulty.value);
  }

  if (els.routeSelect.value === "run") {
    params.delete("route");
  } else {
    params.set("route", els.routeSelect.value);
  }

  if (els.visual.value === "standard") {
    params.delete(visualParam);
  } else {
    params.set(visualParam, els.visual.value);
  }

  replaceUrlParams(params);
}

function syncVisualMode() {
  document.documentElement.dataset.visual = els.visual.value;
}

function isCalmVisuals() {
  return els.visual.value === "calm";
}

function frame(now) {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;

  const input = collectInput();
  updateGame(state, input, dt);
  inputQueue.dash = false;
  inputQueue.pulse = false;

  const currentBest =
    Number(localStorage.getItem(bestKey(state.difficulty, state.routeCode)) ?? "0");
  if (state.best > currentBest) {
    localStorage.setItem(bestKey(state.difficulty, state.routeCode), String(state.best));
  }

  if (state.status !== lastStatus) {
    handleStatusChange();
    lastStatus = state.status;
  }

  drawScene(now / 1000);
  syncHud();
  requestAnimationFrame(frame);
}

function collectInput() {
  const left = keys.has("arrowleft") || keys.has("a");
  const right = keys.has("arrowright") || keys.has("d");
  const up = keys.has("arrowup") || keys.has("w");
  const down = keys.has("arrowdown") || keys.has("s");

  return {
    axisX: Number(right) - Number(left),
    axisY: Number(down) - Number(up),
    pointer: pointer.active ? pointer : null,
    dash: inputQueue.dash,
    pulse: inputQueue.pulse
  };
}

function handleStatusChange() {
  if (state.status === "won") {
    saveRunRecord(state);
    loadShareCode(createShareCode(createRunSummary(state)), { syncUrl: false });
    playTone(523, 0.16, "triangle");
    setTimeout(() => playTone(659, 0.18, "triangle"), 90);
  } else if (state.status === "lost") {
    saveRunRecord(state);
    loadShareCode(createShareCode(createRunSummary(state)), { syncUrl: false });
    playTone(130, 0.22, "sawtooth");
  }
}

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(
    (rect.width * ratio) / ARENA.width,
    0,
    0,
    (rect.height * ratio) / ARENA.height,
    0,
    0
  );
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * ARENA.width;
  pointer.y = ((event.clientY - rect.top) / rect.height) * ARENA.height;
}

function syncHud(force = false) {
  const remaining = Math.max(0, Math.ceil(state.goal - state.elapsed));
  els.score.textContent = formatNumber(state.score);
  els.shield.textContent = String(Math.ceil(state.shield));
  els.time.textContent = String(remaining);
  els.wave.textContent = String(state.wave);
  els.route.textContent = state.routeCode;
  els.combo.textContent = `${state.combo.toFixed(1)}x`;
  els.best.textContent = formatNumber(state.best);
  els.shards.textContent = String(state.stats.shards);
  els.gates.textContent = String(state.stats.gates);
  els.grazes.textContent = String(state.stats.grazes);
  els.breaks.textContent = String(state.stats.hazardsBroken);
  els.shieldMeter.style.width = `${state.shield}%`;
  els.shieldMeterLabel.textContent = `${Math.ceil(state.shield)}%`;
  els.overdriveMeter.style.width = `${state.overdrive}%`;
  els.overdriveMeterLabel.textContent = `${Math.floor(state.overdrive)}%`;
  els.missionTitle.textContent = state.mission.label;
  els.missionMeter.style.width = `${(state.mission.progress / state.mission.target) * 100}%`;
  els.missionMeterLabel.textContent = `${state.mission.progress}/${state.mission.target}`;
  els.pulse.disabled = state.overdrive < 100 || state.status !== "playing";
  els.pause.disabled = state.status === "ready" || state.status === "lost" || state.status === "won";
  els.start.disabled = state.status === "playing";
  els.copy.disabled = state.status !== "won" && state.status !== "lost";
  els.difficulty.disabled = state.status === "playing";
  els.routeSelect.disabled = state.status === "playing";

  renderOverlay();

  const nextLog = state.eventLog.join("|");
  if (force || nextLog !== statusRender) {
    els.eventLog.innerHTML = state.eventLog.map((item) => `<li>${item}</li>`).join("");
    statusRender = nextLog;
  }

  renderRecords(force);
}

function renderOverlay() {
  els.overlay.classList.toggle("is-hidden", state.status === "playing");

  if (state.status === "ready") {
    els.overlayKicker.textContent = "Ready";
    els.overlayTitle.textContent = state.route === "daily" ? state.routeCode : "Lumen Drift";
    els.overlayDetail.textContent =
      state.route === "daily" ? "Daily route awaiting launch." : "Signal route awaiting launch.";
  } else if (state.status === "paused") {
    els.overlayKicker.textContent = "Paused";
    els.overlayTitle.textContent = "Signal Held";
    els.overlayDetail.textContent = "The route is suspended.";
  } else if (state.status === "won") {
    const summary = createRunSummary(state);
    els.overlayKicker.textContent = "Complete";
    els.overlayTitle.textContent = formatNumber(state.score);
    els.overlayDetail.textContent = createShareCode(summary);
  } else if (state.status === "lost") {
    const summary = createRunSummary(state);
    els.overlayKicker.textContent = "Offline";
    els.overlayTitle.textContent = formatNumber(state.score);
    els.overlayDetail.textContent = createShareCode(summary);
  }
}

function bestKey(difficulty, routeCode) {
  return `${storagePrefix}:${difficulty}:${routeCode}`;
}

function drawScene(time) {
  const calm = isCalmVisuals();
  const shake = !calm && state.shake > 0 ? state.shake * 8 : 0;
  const offsetX = (Math.sin(time * 46) + Math.sin(time * 17)) * shake;
  const offsetY = (Math.cos(time * 39) + Math.sin(time * 13)) * shake;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  drawBackground(time, calm);
  drawEntities(time, calm);
  if (!calm) {
    drawParticles();
  }
  drawPlayer(time, calm);
  if (!calm && state.flash > 0) {
    ctx.fillStyle = `rgba(244, 239, 229, ${state.flash * 0.18})`;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  }
  ctx.restore();
}

function drawBackground(time, calm) {
  ctx.fillStyle = "#11110f";
  ctx.fillRect(-20, -20, ARENA.width + 40, ARENA.height + 40);

  ctx.fillStyle = "#181713";
  const scroll = calm ? 0 : (time * 18) % 80;
  for (let y = -80; y < ARENA.height + 80; y += 80) {
    ctx.fillRect(0, y + scroll, ARENA.width, 1);
  }

  ctx.strokeStyle = "rgba(244, 239, 229, 0.08)";
  ctx.lineWidth = 1;
  for (let x = 80; x < ARENA.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (calm ? 0 : Math.sin(time + x) * 8), ARENA.height);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(42, 166, 161, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ARENA.width * 0.18, ARENA.height + 20);
  ctx.bezierCurveTo(
    ARENA.width * 0.24,
    ARENA.height * 0.55,
    ARENA.width * 0.18,
    ARENA.height * 0.32,
    ARENA.width * 0.34,
    -20
  );
  ctx.moveTo(ARENA.width * 0.82, ARENA.height + 20);
  ctx.bezierCurveTo(
    ARENA.width * 0.76,
    ARENA.height * 0.55,
    ARENA.width * 0.82,
    ARENA.height * 0.32,
    ARENA.width * 0.66,
    -20
  );
  ctx.stroke();
}

function drawEntities(time, calm) {
  for (const entity of state.entities) {
    if (entity.type === "gate") {
      drawGate(entity, time, calm);
    } else if (entity.type === "static") {
      drawStatic(entity);
    } else if (entity.type === "charge") {
      drawCharge(entity, time, calm);
    } else {
      drawShard(entity);
    }
  }
}

function drawShard(entity) {
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.rotate(entity.rotation);
  ctx.fillStyle = "#e6b94f";
  ctx.strokeStyle = "rgba(244, 239, 229, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -entity.r * 1.25);
  ctx.lineTo(entity.r * 0.85, 0);
  ctx.lineTo(0, entity.r * 1.25);
  ctx.lineTo(-entity.r * 0.85, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStatic(entity) {
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.rotate(entity.rotation);
  ctx.strokeStyle = entity.grazed ? "#e6b94f" : "#e05f3f";
  ctx.fillStyle = entity.grazed ? "rgba(230, 185, 79, 0.16)" : "rgba(224, 95, 63, 0.2)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2;
    const radius = index % 2 === 0 ? entity.r * 1.2 : entity.r * 0.62;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCharge(entity, time, calm) {
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.strokeStyle = "#8fbf5b";
  ctx.fillStyle = "rgba(143, 191, 91, 0.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, entity.r + (calm ? 0 : Math.sin(time * 8 + entity.age) * 2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, entity.r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGate(gate, time, calm) {
  const left = gate.x - gate.w * 0.5;
  const right = gate.x + gate.w * 0.5;
  const pulse = calm ? 0.44 : 0.4 + Math.sin(time * 5 + gate.age) * 0.18;

  ctx.save();
  ctx.strokeStyle = gate.scored ? "rgba(143, 191, 91, 0.72)" : `rgba(42, 166, 161, ${pulse})`;
  ctx.lineWidth = gate.scored ? 5 : 4;
  ctx.beginPath();
  ctx.moveTo(left, gate.y);
  ctx.lineTo(right, gate.y);
  ctx.moveTo(left, gate.y + gate.h);
  ctx.lineTo(right, gate.y + gate.h);
  ctx.stroke();

  ctx.fillStyle = gate.scored ? "rgba(143, 191, 91, 0.26)" : "rgba(42, 166, 161, 0.18)";
  ctx.fillRect(left, gate.y, gate.w, gate.h);
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = withAlpha(particle.color, alpha);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(time, calm) {
  const player = state.player;
  const dash = state.dashTimer > 0;

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.strokeStyle = dash ? "#f4efe5" : "#2aa6a1";
  ctx.fillStyle = dash ? "#e6b94f" : "#f4efe5";
  ctx.lineWidth = dash ? 4 : 3;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-16, -15);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-16, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2aa6a1";
  ctx.beginPath();
  ctx.arc(-3, 0, calm ? 5 : 5 + Math.sin(time * 9) * 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = dash
    ? `rgba(230, 185, 79, ${calm ? 0.42 : 0.62})`
    : `rgba(42, 166, 161, ${calm ? 0.22 : 0.32})`;
  ctx.beginPath();
  ctx.arc(0, 0, dash ? (calm ? 28 : 31) : 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function ensureAudio() {
  if (audio) {
    audio.ctx.resume();
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  audio = {
    ctx: new AudioContext()
  };
  playTone(330, 0.08, "triangle");
}

function playTone(frequency, duration, type = "sine") {
  if (!audio) {
    return;
  }

  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.04, audio.ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.ctx.destination);
  osc.start();
  osc.stop(audio.ctx.currentTime + duration + 0.02);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function saveRunRecord(runState) {
  const summary = createRunSummary(runState);
  runRecords.unshift({
    ...summary,
    shareCode: createShareCode(summary),
    date: new Date().toISOString()
  });
  runRecords = runRecords.slice(0, 5);
  localStorage.setItem(recordsKey, JSON.stringify(runRecords));
  renderRecords(true);
}

function copyShareCode() {
  if (state.status !== "won" && state.status !== "lost") {
    return;
  }

  const code = createShareCode(createRunSummary(state));
  loadShareCode(code, { syncUrl: false });
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).then(
      () => pushCopyEvent("Share copied"),
      () => pushCopyEvent("Share ready")
    );
  } else {
    pushCopyEvent("Share ready");
  }
}

function decodeShareCode(options = {}) {
  return loadShareCode(els.shareInput.value, {
    syncUrl: options.syncUrl ?? true
  });
}

function copyResultLink() {
  const inputCode = els.shareInput.value.trim();
  const summary =
    (inputCode ? parseShareCode(inputCode) : null) ??
    (!inputCode && (state.status === "won" || state.status === "lost")
      ? createRunSummary(state)
      : null);
  if (!summary) {
    els.shareResult.textContent = "Invalid result code";
    return;
  }

  const code = createShareCode(summary);
  loadShareCode(code, { syncUrl: true });
  const url = createResultUrl(code);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(
      () => pushCopyEvent("Link copied"),
      () => pushCopyEvent("Link ready")
    );
  } else {
    pushCopyEvent("Link ready");
  }
}

function loadShareCode(code, options = {}) {
  if (!code) {
    return false;
  }

  const summary = parseShareCode(code);
  if (!summary) {
    els.shareResult.textContent = "Invalid result code";
    return false;
  }

  const canonicalCode = createShareCode(summary);
  els.shareInput.value = canonicalCode;
  renderShareSummary(summary);
  if (options.syncUrl) {
    syncResultUrl(canonicalCode);
  }
  return true;
}

function renderShareSummary(summary) {
  const result = summary.status === "won" ? "Clear" : "Lost";
  const route = summary.routeCode === "RUN" ? "Run" : summary.routeCode;
  els.shareResult.textContent = [
    `${result} / ${route} / ${summary.difficulty}`,
    `${formatNumber(summary.score)} pts`,
    `W${summary.wave}`,
    `H${summary.shield}`,
    `X${summary.maxCombo}`
  ].join(" / ");
}

function syncResultUrl(code) {
  const params = new URLSearchParams(location.search);
  params.set(resultParam, code);
  replaceUrlParams(params);
}

function createResultUrl(code) {
  const url = new URL(location.href);
  url.searchParams.set(resultParam, code);
  return url.toString();
}

function replaceUrlParams(params) {
  const query = params.toString();
  const nextUrl = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", nextUrl);
}

function pushCopyEvent(message) {
  state.eventLog.unshift(message);
  if (state.eventLog.length > 5) {
    state.eventLog.length = 5;
  }
  syncHud(true);
}

function readRunRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(recordsKey) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function renderRecords(force = false) {
  const nextRender = JSON.stringify(runRecords);
  if (!force && nextRender === recordsRender) {
    return;
  }

  if (runRecords.length === 0) {
    els.recordList.innerHTML = "<li>No runs yet</li>";
  } else {
    els.recordList.innerHTML = runRecords
      .map((record) => {
        const result = record.status === "won" ? "Clear" : "Lost";
        const route = record.routeCode === "RUN" ? "Run" : record.routeCode;
        return [
          "<li>",
          `<strong>${formatNumber(record.score)}</strong>`,
          `<span>${result} / ${route} / ${record.difficulty}</span>`,
          `<em>W${record.wave} S${record.shards} G${record.gates} R${record.grazes}</em>`,
          "</li>"
        ].join("");
      })
      .join("");
  }

  recordsRender = nextRender;
}

function withAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
