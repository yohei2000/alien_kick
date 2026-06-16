const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const comboEl = document.querySelector("#combo");
const hpBar = document.querySelector("#hpBar");
const alienNameEl = document.querySelector("#alienName");
const alienStateEl = document.querySelector("#alienState");
const message = document.querySelector("#message");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const feedback = document.querySelector("#feedback");

const ROUND_SECONDS = 90;
const TARGET_SCORE = 100;
const HIT_WINDOW = 0.18;
const PERFECT_WINDOW = 0.055;
const GOOD_WINDOW = 0.105;
const BALL_LIFE = 1.28;

const aliens = [
  {
    name: "ネオン・グラブ",
    hp: 82,
    color: "#41e7ff",
    accent: "#9cff6d",
    block: 0.24,
    tempo: 0.86,
    shape: "glove",
  },
  {
    name: "メテオ・モグル",
    hp: 112,
    color: "#ff7b54",
    accent: "#ffd166",
    block: 0.32,
    tempo: 0.8,
    shape: "horn",
  },
  {
    name: "ゼロG・アイ",
    hp: 140,
    color: "#b08cff",
    accent: "#41e7ff",
    block: 0.39,
    tempo: 0.74,
    shape: "eye",
  },
  {
    name: "ギャラクシー番長",
    hp: 170,
    color: "#ff4f79",
    accent: "#fff06a",
    block: 0.46,
    tempo: 0.68,
    shape: "boss",
  },
];

const state = {
  mode: "ready",
  w: 0,
  h: 0,
  dpr: 1,
  timeLeft: ROUND_SECONDS,
  score: 0,
  combo: 0,
  maxCombo: 0,
  beat: 0,
  nextSpawn: 0.3,
  balls: [],
  particles: [],
  alienIndex: 0,
  alienHp: aliens[0].hp,
  alienDownUntil: 0,
  alienSwapTimer: 0,
  shake: 0,
  flash: 0,
  lastT: performance.now(),
  aimX: 0.5,
  feedbackText: "",
  feedbackTimer: 0,
  audioReady: false,
  audio: null,
};

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  canvas.width = Math.floor(state.w * state.dpr);
  canvas.height = Math.floor(state.h * state.dpr);
  canvas.style.width = `${state.w}px`;
  canvas.style.height = `${state.h}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
}

function resetGame() {
  state.mode = "playing";
  state.timeLeft = ROUND_SECONDS;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.beat = 0;
  state.nextSpawn = 0.2;
  state.balls = [];
  state.particles = [];
  state.alienIndex = 0;
  state.alienHp = aliens[0].hp;
  state.alienDownUntil = 0;
  state.alienSwapTimer = 0;
  state.shake = 0;
  state.flash = 0;
  state.lastT = performance.now();
  syncHud();
  message.hidden = true;
}

function syncHud() {
  const alien = aliens[state.alienIndex];
  scoreEl.textContent = String(state.score);
  timeEl.textContent = String(Math.max(0, Math.ceil(state.timeLeft)));
  comboEl.textContent = String(state.combo);
  alienNameEl.textContent = alien.name;
  alienStateEl.textContent =
    state.alienSwapTimer > 0 ? "NEXT" : state.alienDownUntil > state.beat ? "DOWN" : "KEEPER";
  hpBar.style.transform = `scaleX(${Math.max(0, state.alienHp / alien.hp)})`;
}

function showMessage(title, copy, button = "RETRY", action = start) {
  message.innerHTML = `
    <p class="message__eyebrow">ALIEN KICK BUSTER</p>
    <h1>${title}</h1>
    <p>${copy}</p>
    <button id="startButton" type="button">${button}</button>
  `;
  message.hidden = false;
  message.querySelector("button").addEventListener("click", action);
}

function start() {
  setupAudio();
  resetGame();
}

function setupAudio() {
  if (state.audioReady) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audio = new AudioContext();
  state.audioReady = true;
}

function blip(freq, duration = 0.05, gain = 0.07, type = "sine") {
  const audio = state.audio;
  if (!audio) return;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, audio.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

function spawnBall() {
  const lane = Math.floor(Math.random() * 3);
  const side = Math.random() > 0.5 ? 1 : -1;
  state.balls.push({
    id: Math.random(),
    born: state.beat,
    lane,
    side,
    hit: false,
    missed: false,
    spin: Math.random() * Math.PI,
  });
  blip(360 + lane * 70, 0.035, 0.028, "triangle");
}

function kickAt(clientX) {
  if (state.mode !== "playing") {
    if (state.mode === "paused") togglePause();
    return;
  }

  state.aimX = clamp(clientX / state.w, 0.08, 0.92);
  const active = state.balls
    .filter((ball) => !ball.hit && !ball.missed)
    .map((ball) => ({ ball, diff: Math.abs((state.beat - ball.born) - BALL_LIFE) }))
    .sort((a, b) => a.diff - b.diff)[0];

  if (!active || active.diff > HIT_WINDOW) {
    registerMiss();
    popFeedback("MISS", "#92a9bc");
    blip(120, 0.07, 0.05, "sawtooth");
    return;
  }

  active.ball.hit = true;
  const timing = active.diff <= PERFECT_WINDOW ? "hard" : active.diff <= GOOD_WINDOW ? "good" : "ok";
  resolveShot(active.ball, timing, active.diff);
}

function resolveShot(ball, timing, diff) {
  const alien = aliens[state.alienIndex];
  const down = state.alienDownUntil > state.beat;
  const powerBand = 1 + Math.floor(state.combo / 6) * 0.18;
  const timingPower = timing === "hard" ? 1.55 : timing === "good" ? 1.12 : 0.86;
  const aimLane = state.aimX < 0.38 ? 0 : state.aimX > 0.62 ? 2 : 1;
  const bait = aimLane === ball.lane ? 0.06 : 0;
  const blockChance = clamp(alien.block + bait - (down ? 0.3 : 0) - (timing === "hard" ? 0.2 : 0), 0.04, 0.72);
  const goal = Math.random() > blockChance;

  if (goal) {
    const points = timing === "hard" ? 5 : timing === "good" ? 3 : 2;
    state.score += points + Math.floor(state.combo / 10);
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.shake = timing === "hard" ? 9 : 4;
    state.flash = timing === "hard" ? 0.28 : 0.12;
    popFeedback(timing === "hard" ? "HARD HIT!" : timing === "good" ? "NICE!" : "GOAL", timing === "hard" ? "#ffd166" : "#41e7ff");
    blip(timing === "hard" ? 720 : 540, 0.08, 0.07, "square");
    emitShotParticles(ball, timing, true);
  } else {
    registerMiss();
    state.shake = 5;
    popFeedback("BLOCKED", alien.color);
    blip(170, 0.08, 0.055, "sawtooth");
    emitShotParticles(ball, timing, false);
  }

  if (state.combo >= 4 && timing !== "ok") {
    const damage = Math.round((timing === "hard" ? 18 : 9) * powerBand);
    state.alienHp -= damage;
    if (state.alienHp <= 0) knockDownAlien();
  }

  if (state.score >= TARGET_SCORE) endGame(true);
  syncHud();
}

function knockDownAlien() {
  state.alienDownUntil = state.beat + 4.6;
  state.alienSwapTimer = 1.6;
  state.score += 8;
  state.shake = 14;
  state.flash = 0.38;
  popFeedback("ALIEN DOWN!", "#ff4f79");
  blip(92, 0.15, 0.09, "square");
}

function nextAlien() {
  state.alienIndex = (state.alienIndex + 1) % aliens.length;
  state.alienHp = aliens[state.alienIndex].hp;
  state.alienDownUntil = 0;
  state.alienSwapTimer = 0;
  state.combo = Math.max(0, Math.floor(state.combo / 2));
  popFeedback(`${aliens[state.alienIndex].name}`, aliens[state.alienIndex].color);
}

function registerMiss() {
  state.combo = 0;
  state.shake = Math.max(state.shake, 4);
}

function emitShotParticles(ball, timing, goal) {
  const p = ballPosition(ball);
  const count = timing === "hard" ? 22 : 12;
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = goal ? 180 + Math.random() * 240 : 80 + Math.random() * 120;
    state.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      color: timing === "hard" ? "#ffd166" : goal ? "#41e7ff" : "#ff4f79",
      r: 2 + Math.random() * 4,
    });
  }
}

function popFeedback(text, color) {
  state.feedbackText = text;
  state.feedbackTimer = 0.42;
  feedback.textContent = text;
  feedback.style.background = `color-mix(in srgb, ${color} 80%, #06111d)`;
  feedback.classList.add("is-on");
  window.clearTimeout(popFeedback.timer);
  popFeedback.timer = window.setTimeout(() => feedback.classList.remove("is-on"), 230);
}

function togglePause() {
  if (state.mode === "playing") {
    state.mode = "paused";
    showMessage("PAUSED", "タップで再開。タイミングを取り戻して、次のボールを叩き込め。", "RESUME", togglePause);
  } else if (state.mode === "paused") {
    state.mode = "playing";
    state.lastT = performance.now();
    message.hidden = true;
  }
}

function endGame(win) {
  if (state.mode !== "playing") return;
  state.mode = win ? "win" : "lose";
  const copy = win
    ? `${state.score}点、最大${state.maxCombo}コンボ。地球側の勝ちです。`
    : `${state.score}点で終了。100点まであと${Math.max(0, TARGET_SCORE - state.score)}点でした。`;
  showMessage(win ? "YOU WIN" : "TIME UP", copy, "PLAY AGAIN");
}

function update(dt) {
  if (state.mode !== "playing") return;

  const alien = aliens[state.alienIndex];
  state.beat += dt;
  state.timeLeft -= dt;
  state.nextSpawn -= dt;
  state.shake = Math.max(0, state.shake - dt * 22);
  state.flash = Math.max(0, state.flash - dt);
  state.feedbackTimer = Math.max(0, state.feedbackTimer - dt);

  if (state.nextSpawn <= 0) {
    spawnBall();
    const pressure = Math.max(0, (TARGET_SCORE - state.score) / TARGET_SCORE) * 0.06;
    state.nextSpawn = Math.max(0.46, alien.tempo - Math.min(0.2, state.combo * 0.008) - pressure);
  }

  for (const ball of state.balls) {
    const age = state.beat - ball.born;
    if (!ball.hit && !ball.missed && age > BALL_LIFE + HIT_WINDOW) {
      ball.missed = true;
      registerMiss();
      popFeedback("MISS", "#92a9bc");
    }
  }
  state.balls = state.balls.filter((ball) => state.beat - ball.born < BALL_LIFE + 0.75);

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.alienSwapTimer > 0) {
    state.alienSwapTimer -= dt;
    if (state.alienSwapTimer <= 0) nextAlien();
  }

  if (state.timeLeft <= 0) endGame(state.score >= TARGET_SCORE);
  syncHud();
}

function draw() {
  const shakeX = (Math.random() - 0.5) * state.shake;
  const shakeY = (Math.random() - 0.5) * state.shake;
  ctx.save();
  ctx.clearRect(0, 0, state.w, state.h);
  ctx.translate(shakeX, shakeY);
  drawBackground();
  drawGoal();
  drawAlien();
  drawRhythmLane();
  drawBalls();
  drawPlayer();
  drawParticles();
  drawAim();
  if (state.flash > 0) {
    ctx.globalAlpha = state.flash;
    ctx.fillStyle = "#fff6cf";
    ctx.fillRect(-20, -20, state.w + 40, state.h + 40);
  }
  ctx.restore();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, state.h);
  g.addColorStop(0, "#07131f");
  g.addColorStop(0.58, "#13324b");
  g.addColorStop(0.59, "#22523b");
  g.addColorStop(1, "#1f7d46");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, state.w, state.h);

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  for (let i = 0; i < 56; i += 1) {
    const x = (i * 97 + 33) % state.w;
    const y = (i * 53 + 19) % (state.h * 0.46);
    const twinkle = 0.45 + Math.sin(state.beat * 2 + i) * 0.3;
    ctx.globalAlpha = twinkle;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const y = state.h * (0.63 + i * 0.065);
    ctx.beginPath();
    ctx.moveTo(state.w * 0.08, y);
    ctx.lineTo(state.w * 0.92, y);
    ctx.stroke();
  }
}

function drawGoal() {
  const gx = state.w * 0.5;
  const gy = state.h * 0.25;
  const gw = Math.min(state.w * 0.78, 470);
  const gh = Math.min(state.h * 0.24, 155);
  ctx.strokeStyle = "rgba(238,248,255,0.84)";
  ctx.lineWidth = 6;
  roundRect(gx - gw / 2, gy, gw, gh, 8, true, false);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(238,248,255,0.18)";
  for (let i = 1; i < 7; i += 1) {
    const x = gx - gw / 2 + (gw / 7) * i;
    ctx.beginPath();
    ctx.moveTo(x, gy + 4);
    ctx.lineTo(x, gy + gh - 4);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i += 1) {
    const y = gy + (gh / 4) * i;
    ctx.beginPath();
    ctx.moveTo(gx - gw / 2 + 4, y);
    ctx.lineTo(gx + gw / 2 - 4, y);
    ctx.stroke();
  }
}

function drawAlien() {
  const alien = aliens[state.alienIndex];
  const down = state.alienDownUntil > state.beat;
  const gx = state.w * 0.5 + Math.sin(state.beat * 2.2) * (down ? 5 : 22);
  const gy = state.h * (down ? 0.43 : 0.37);
  const s = Math.min(state.w, state.h) * (down ? 0.105 : 0.13);
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(down ? Math.sin(state.beat * 7) * 0.08 + 0.52 : Math.sin(state.beat * 3) * 0.06);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, s * 1.18, s * 1.1, s * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = alien.color;
  ctx.strokeStyle = alien.accent;
  ctx.lineWidth = Math.max(3, s * 0.055);
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.78, s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (alien.shape === "horn" || alien.shape === "boss") {
    ctx.fillStyle = alien.accent;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.7);
    ctx.lineTo(-s * 0.9, -s * 1.32);
    ctx.lineTo(-s * 0.18, -s * 0.94);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.55, -s * 0.7);
    ctx.lineTo(s * 0.9, -s * 1.32);
    ctx.lineTo(s * 0.18, -s * 0.94);
    ctx.fill();
  }

  ctx.fillStyle = "#06111d";
  if (alien.shape === "eye") {
    ctx.fillStyle = "#eef8ff";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.1, s * 0.42, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#06111d";
    ctx.beginPath();
    ctx.arc(Math.sin(state.beat * 5) * s * 0.1, -s * 0.1, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-s * 0.28, -s * 0.18, s * 0.12, 0, Math.PI * 2);
    ctx.arc(s * 0.28, -s * 0.18, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#06111d";
  ctx.lineWidth = Math.max(3, s * 0.055);
  ctx.beginPath();
  ctx.arc(0, s * 0.18, s * 0.28, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();

  ctx.fillStyle = alien.accent;
  ctx.beginPath();
  ctx.arc(-s * 0.92, s * 0.1 + Math.sin(state.beat * 8) * 5, s * 0.2, 0, Math.PI * 2);
  ctx.arc(s * 0.92, s * 0.1 - Math.sin(state.beat * 8) * 5, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRhythmLane() {
  const ring = strikeRing();
  ctx.save();
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.85 + Math.sin(state.beat * 12) * 0.12;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(ring.x - 2, ring.y - ring.r - 18, 4, ring.r * 2 + 36);
}

function drawBalls() {
  for (const ball of state.balls) {
    if (ball.hit) continue;
    const p = ballPosition(ball);
    const age = state.beat - ball.born;
    const closeness = 1 - Math.min(1, Math.abs(age - BALL_LIFE) / HIT_WINDOW);
    const r = p.r * (1 + closeness * 0.25);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(ball.spin + age * 8 * ball.side);
    ctx.fillStyle = "#eef8ff";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#06111d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(0, -r * 0.45, r, 0);
    ctx.moveTo(-r, 0);
    ctx.quadraticCurveTo(0, r * 0.45, r, 0);
    ctx.stroke();
    if (closeness > 0) {
      ctx.globalAlpha = closeness * 0.45;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const ring = strikeRing();
  const footX = ring.x - 26 + Math.sin(state.beat * 9) * 8;
  const footY = ring.y + 54;
  ctx.save();
  ctx.strokeStyle = "#eef8ff";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ring.x - 28, footY - 72);
  ctx.lineTo(ring.x - 12, footY - 22);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  ctx.strokeStyle = "#41e7ff";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(ring.x + 24, footY - 70);
  ctx.lineTo(ring.x + 8, footY - 12);
  ctx.lineTo(ring.x + 50, footY + 8);
  ctx.stroke();
  ctx.fillStyle = "#ff4f79";
  roundRect(ring.x + 26, footY, 48, 18, 8, false, true);
  ctx.restore();
}

function drawAim() {
  const y = state.h * 0.88;
  const x = state.aimX * state.w;
  ctx.save();
  ctx.strokeStyle = "rgba(255,209,102,0.68)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 34);
  ctx.lineTo(x - 16, y);
  ctx.lineTo(x + 16, y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life * 2.2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function strikeRing() {
  return {
    x: state.w * 0.5,
    y: state.h * 0.72,
    r: Math.min(state.w * 0.12, 54),
  };
}

function ballPosition(ball) {
  const t = clamp((state.beat - ball.born) / BALL_LIFE, 0, 1.25);
  const ring = strikeRing();
  const laneOffset = (ball.lane - 1) * state.w * 0.18;
  const sx = state.w * (ball.side > 0 ? 0.82 : 0.18);
  const sy = state.h * 0.1;
  const ex = ring.x + laneOffset * 0.2;
  const ey = ring.y;
  const curve = Math.sin(t * Math.PI) * state.h * 0.12;
  return {
    x: lerp(sx, ex, t) + laneOffset * (1 - t) * 0.3,
    y: lerp(sy, ey, t) - curve,
    r: lerp(10, Math.min(state.w * 0.07, 28), t),
  };
}

function roundRect(x, y, w, h, r, stroke, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function loop(now) {
  const dt = Math.min(0.033, (now - state.lastT) / 1000 || 0);
  state.lastT = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

window.addEventListener("resize", resize);
window.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  kickAt(event.clientX);
});
message.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});
startButton.addEventListener("click", start);
pauseButton.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
});
pauseButton.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.mode === "playing") togglePause();
});

resize();
syncHud();
requestAnimationFrame(loop);
