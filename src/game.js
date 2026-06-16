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
    name: "ネオン・クラーケン",
    hp: 82,
    color: "#43d4c8",
    shadow: "#155a63",
    accent: "#9cff6d",
    block: 0.24,
    tempo: 0.86,
    shape: "octopus",
  },
  {
    name: "メテオ・テンタクル",
    hp: 112,
    color: "#c85d53",
    shadow: "#512037",
    accent: "#ffd166",
    block: 0.32,
    tempo: 0.8,
    shape: "octopus",
  },
  {
    name: "ゼロG・オクトアイ",
    hp: 140,
    color: "#8c6dca",
    shadow: "#2b1d5b",
    accent: "#41e7ff",
    block: 0.39,
    tempo: 0.74,
    shape: "octopus",
  },
  {
    name: "深宇宙ダイオウ",
    hp: 170,
    color: "#b43d72",
    shadow: "#371a45",
    accent: "#fff06a",
    block: 0.46,
    tempo: 0.68,
    shape: "octopus",
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
  shots: [],
  particles: [],
  goalBursts: [],
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
  state.shots = [];
  state.particles = [];
  state.goalBursts = [];
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
  const aimLane = state.aimX < 0.38 ? 0 : state.aimX > 0.62 ? 2 : 1;
  const bait = aimLane === ball.lane ? 0.06 : 0;
  const blockChance = clamp(alien.block + bait - (down ? 0.3 : 0) - (timing === "hard" ? 0.2 : 0), 0.04, 0.72);
  const goal = Math.random() > blockChance;
  createShot(ball, timing, goal, aimLane);

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
    emitGoalBurst(timing, aimLane);
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

function createShot(ball, timing, goal, aimLane) {
  const start = ballPosition(ball);
  const goalBox = getGoalBox();
  const alien = getAlienPose();
  const laneX = goalBox.x + goalBox.w * (0.22 + aimLane * 0.28);
  const target = goal
    ? {
        x: laneX + (Math.random() - 0.5) * goalBox.w * 0.16,
        y: goalBox.y + goalBox.h * (timing === "hard" ? 0.32 : 0.46),
      }
    : {
        x: alien.x + (aimLane - 1) * state.w * 0.035,
        y: alien.y - alien.s * 0.1,
      };
  state.shots.push({
    startX: start.x,
    startY: start.y,
    targetX: target.x,
    targetY: target.y,
    controlX: (start.x + target.x) / 2 + (aimLane - 1) * state.w * 0.08,
    controlY: Math.min(start.y, target.y) - state.h * (timing === "hard" ? 0.22 : 0.16),
    born: state.beat,
    duration: timing === "hard" ? 0.42 : 0.5,
    spin: ball.spin,
    hard: timing === "hard",
    goal,
    trail: [],
  });
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

function emitGoalBurst(timing, aimLane) {
  const goalBox = getGoalBox();
  const x = goalBox.x + goalBox.w * (0.22 + aimLane * 0.28);
  const y = goalBox.y + goalBox.h * 0.42;
  const hard = timing === "hard";
  state.goalBursts.push({
    x,
    y,
    born: state.beat,
    life: hard ? 0.78 : 0.58,
    hard,
  });

  const count = hard ? 58 : 36;
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (hard ? 190 : 130) + Math.random() * (hard ? 360 : 230);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 120,
      life: 0.42 + Math.random() * 0.5,
      color: i % 3 === 0 ? "#ffd166" : i % 3 === 1 ? "#41e7ff" : "#ffffff",
      r: 2 + Math.random() * (hard ? 6 : 4),
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

  for (const shot of state.shots) {
    const t = clamp((state.beat - shot.born) / shot.duration, 0, 1);
    const p = shotPosition(shot, easeOutCubic(t));
    shot.trail.push({ x: p.x, y: p.y, r: p.r, life: 0.22 });
    shot.trail = shot.trail
      .map((trail) => ({ ...trail, life: trail.life - dt }))
      .filter((trail) => trail.life > 0)
      .slice(-10);
  }
  state.shots = state.shots.filter((shot) => state.beat - shot.born < shot.duration + 0.3);

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 260 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  state.goalBursts = state.goalBursts.filter((burst) => state.beat - burst.born < burst.life);

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
  drawGoalEffects();
  drawAlien();
  drawRhythmLane();
  drawBalls();
  drawShots();
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
  const goal = getGoalBox();
  ctx.strokeStyle = "rgba(238,248,255,0.84)";
  ctx.lineWidth = 6;
  roundRect(goal.x, goal.y, goal.w, goal.h, 8, true, false);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(238,248,255,0.18)";
  for (let i = 1; i < 7; i += 1) {
    const x = goal.x + (goal.w / 7) * i;
    ctx.beginPath();
    ctx.moveTo(x, goal.y + 4);
    ctx.lineTo(x, goal.y + goal.h - 4);
    ctx.stroke();
  }
  for (let i = 1; i < 4; i += 1) {
    const y = goal.y + (goal.h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(goal.x + 4, y);
    ctx.lineTo(goal.x + goal.w - 4, y);
    ctx.stroke();
  }
}

function drawAlien() {
  const alien = aliens[state.alienIndex];
  const pose = getAlienPose();
  const { down, x: gx, y: gy, s } = pose;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(down ? Math.sin(state.beat * 7) * 0.08 + 0.62 : Math.sin(state.beat * 2.4) * 0.05);

  ctx.fillStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, s * 1.16, s * 1.45, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  drawTentacles(alien, s, down);
  drawOctopusHead(alien, s, down);
  ctx.restore();
}

function drawTentacles(alien, s, down) {
  const sway = down ? 0.45 : 1;
  for (let i = 0; i < 8; i += 1) {
    const side = i < 4 ? -1 : 1;
    const row = i % 4;
    const rootX = side * s * (0.18 + row * 0.12);
    const rootY = s * (0.46 + row * 0.08);
    const wave = Math.sin(state.beat * 4 + i * 0.9) * s * 0.13 * sway;
    const endX = side * s * (0.62 + row * 0.25) + wave;
    const endY = s * (1.12 + Math.sin(state.beat * 3.3 + i) * 0.12);
    const midX = side * s * (0.34 + row * 0.2) - wave * 0.35;
    const midY = s * (0.78 + row * 0.05);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = s * (0.18 - row * 0.018);
    ctx.strokeStyle = alien.shadow;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
    ctx.lineWidth *= 0.68;
    ctx.strokeStyle = alien.color;
    ctx.beginPath();
    ctx.moveTo(rootX, rootY - s * 0.02);
    ctx.quadraticCurveTo(midX, midY - s * 0.02, endX, endY - s * 0.02);
    ctx.stroke();

    const cups = 3;
    for (let cup = 1; cup <= cups; cup += 1) {
      const t = cup / (cups + 1);
      const x = quadratic(rootX, midX, endX, t);
      const y = quadratic(rootY, midY, endY, t);
      ctx.fillStyle = "rgba(255, 230, 218, 0.72)";
      ctx.beginPath();
      ctx.ellipse(x - side * s * 0.035, y + s * 0.025, s * 0.035, s * 0.024, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(83, 25, 54, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x - side * s * 0.035, y + s * 0.025, s * 0.017, s * 0.011, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawOctopusHead(alien, s, down) {
  const bodyGradient = ctx.createRadialGradient(-s * 0.28, -s * 0.45, s * 0.08, 0, 0, s * 1.08);
  bodyGradient.addColorStop(0, "#d7fff8");
  bodyGradient.addColorStop(0.14, alien.accent);
  bodyGradient.addColorStop(0.42, alien.color);
  bodyGradient.addColorStop(1, alien.shadow);
  ctx.fillStyle = bodyGradient;
  ctx.strokeStyle = "rgba(238,248,255,0.5)";
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.02);
  ctx.bezierCurveTo(s * 0.78, -s * 1, s * 0.98, -s * 0.12, s * 0.78, s * 0.43);
  ctx.bezierCurveTo(s * 0.52, s * 1.04, -s * 0.52, s * 1.04, -s * 0.78, s * 0.43);
  ctx.bezierCurveTo(-s * 0.98, -s * 0.12, -s * 0.78, -s * 1, 0, -s * 1.02);
  ctx.fill();
  ctx.stroke();

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-s * 0.28, -s * 0.45, s * 0.18, s * 0.34, -0.48, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  for (let i = 0; i < 10; i += 1) {
    const a = i * 1.71;
    const x = Math.cos(a) * s * (0.2 + (i % 3) * 0.16);
    const y = -s * 0.1 + Math.sin(a) * s * (0.18 + (i % 2) * 0.14);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.arc(x, y, s * (0.025 + (i % 2) * 0.012), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#f3fbff";
  ctx.beginPath();
  ctx.ellipse(-s * 0.26, -s * 0.12, s * 0.14, s * 0.22, -0.18, 0, Math.PI * 2);
  ctx.ellipse(s * 0.26, -s * 0.12, s * 0.14, s * 0.22, 0.18, 0, Math.PI * 2);
  ctx.fill();

  const glare = down ? 0 : Math.sin(state.beat * 4) * s * 0.025;
  ctx.fillStyle = "#07131f";
  ctx.beginPath();
  ctx.ellipse(-s * 0.25 + glare, -s * 0.1, s * 0.062, s * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(s * 0.25 + glare, -s * 0.1, s * 0.062, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(7,19,31,0.72)";
  ctx.lineWidth = Math.max(3, s * 0.052);
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.34);
  ctx.quadraticCurveTo(-s * 0.25, -s * 0.48, -s * 0.05, -s * 0.32);
  ctx.moveTo(s * 0.45, -s * 0.34);
  ctx.quadraticCurveTo(s * 0.25, -s * 0.48, s * 0.05, -s * 0.32);
  ctx.stroke();

  ctx.fillStyle = "#271229";
  ctx.beginPath();
  ctx.moveTo(0, s * 0.1);
  ctx.lineTo(s * 0.14, s * 0.26);
  ctx.lineTo(0, s * 0.39);
  ctx.lineTo(-s * 0.14, s * 0.26);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 230, 218, 0.34)";
  ctx.lineWidth = Math.max(1.5, s * 0.022);
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.25);
  ctx.lineTo(s * 0.1, s * 0.25);
  ctx.stroke();
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

function drawShots() {
  for (const shot of state.shots) {
    const t = clamp((state.beat - shot.born) / shot.duration, 0, 1);
    const eased = easeOutCubic(t);
    const p = shotPosition(shot, eased);

    for (const trail of shot.trail) {
      ctx.save();
      ctx.globalAlpha = clamp(trail.life * 4, 0, 0.75);
      ctx.fillStyle = shot.hard ? "#ffd166" : "#41e7ff";
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(shot.spin + state.beat * (shot.hard ? 18 : 13));
    ctx.shadowColor = shot.hard ? "#ffd166" : "#41e7ff";
    ctx.shadowBlur = shot.hard ? 22 : 12;
    drawSoccerBall(0, 0, p.r);
    ctx.restore();
  }
}

function drawGoalEffects() {
  const goal = getGoalBox();
  for (const burst of state.goalBursts) {
    const t = clamp((state.beat - burst.born) / burst.life, 0, 1);
    const alpha = 1 - t;
    const radius = lerp(18, burst.hard ? goal.w * 0.62 : goal.w * 0.42, easeOutCubic(t));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = burst.hard ? "#ffd166" : "#41e7ff";
    ctx.lineWidth = lerp(10, 2, t);
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.48;
    ctx.fillStyle = burst.hard ? "#fff6cf" : "#c7fbff";
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2 + state.beat * 0.8;
      ctx.beginPath();
      ctx.moveTo(burst.x, burst.y);
      ctx.lineTo(burst.x + Math.cos(a) * radius * 1.12, burst.y + Math.sin(a) * radius * 0.72);
      ctx.lineTo(burst.x + Math.cos(a + 0.08) * radius * 0.36, burst.y + Math.sin(a + 0.08) * radius * 0.28);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const y = goal.y + goal.h * (0.18 + i * 0.16) + Math.sin(state.beat * 18 + i) * 8 * alpha;
      ctx.beginPath();
      ctx.moveTo(goal.x + 8, y);
      ctx.quadraticCurveTo(goal.x + goal.w * 0.5, y + 18 * alpha, goal.x + goal.w - 8, y);
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

function drawSoccerBall(x, y, r) {
  ctx.fillStyle = "#eef8ff";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#06111d";
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x, y - r * 0.45, x + r, y);
  ctx.moveTo(x - r, y);
  ctx.quadraticCurveTo(x, y + r * 0.45, x + r, y);
  ctx.stroke();
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

function shotPosition(shot, t) {
  const x = quadratic(shot.startX, shot.controlX, shot.targetX, t);
  const y = quadratic(shot.startY, shot.controlY, shot.targetY, t);
  const scale = shot.goal ? lerp(1.05, 0.55, t) : lerp(1, 0.82, t);
  return {
    x,
    y,
    r: Math.min(state.w * 0.065, 24) * scale,
  };
}

function getGoalBox() {
  const w = Math.min(state.w * 0.78, 470);
  const h = Math.min(state.h * 0.24, 155);
  return {
    x: state.w * 0.5 - w / 2,
    y: state.h * 0.25,
    w,
    h,
  };
}

function getAlienPose() {
  const down = state.alienDownUntil > state.beat;
  return {
    down,
    x: state.w * 0.5 + Math.sin(state.beat * 2.2) * (down ? 5 : 22),
    y: state.h * (down ? 0.43 : 0.37),
    s: Math.min(state.w, state.h) * (down ? 0.108 : 0.132),
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

function quadratic(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
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
