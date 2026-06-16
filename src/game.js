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
    color: 0x43d4c8,
    shadow: 0x155a63,
    accent: 0x9cff6d,
    eye: 0xefffff,
    block: 0.24,
    tempo: 0.86,
    scale: 1,
  },
  {
    name: "メテオ・テンタクル",
    hp: 112,
    color: 0xc85d53,
    shadow: 0x512037,
    accent: 0xffd166,
    eye: 0xfff5dc,
    block: 0.32,
    tempo: 0.8,
    scale: 1.05,
  },
  {
    name: "ゼロG・オクトアイ",
    hp: 140,
    color: 0x8c6dca,
    shadow: 0x2b1d5b,
    accent: 0x41e7ff,
    eye: 0xf1f6ff,
    block: 0.39,
    tempo: 0.74,
    scale: 1.12,
  },
  {
    name: "深宇宙ダイオウ",
    hp: 170,
    color: 0xb43d72,
    shadow: 0x371a45,
    accent: 0xfff06a,
    eye: 0xffeef7,
    block: 0.46,
    tempo: 0.68,
    scale: 1.2,
  },
];

const state = {
  mode: "ready",
  timeLeft: ROUND_SECONDS,
  score: 0,
  combo: 0,
  maxCombo: 0,
  beat: 0,
  nextSpawn: 0.3,
  alienIndex: 0,
  alienHp: aliens[0].hp,
  alienDownUntil: 0,
  alienSwapTimer: 0,
  aimX: 0.5,
  audioReady: false,
  audio: null,
};

let sceneRef = null;
let gameRef = null;

class KickScene extends Phaser.Scene {
  constructor() {
    super("KickScene");
    this.balls = [];
    this.shots = [];
    this.particles = [];
    this.goalBursts = [];
    this.stars = [];
    this.tentacleSegments = [];
  }

  create() {
    sceneRef = this;
    this.background = this.add.graphics();
    this.fieldLines = this.add.graphics();
    this.goalNet = this.add.graphics();
    this.goalFx = this.add.graphics();
    this.alienLayer = this.add.container(0, 0);
    this.rhythm = this.add.graphics();
    this.ballLayer = this.add.container(0, 0);
    this.shotLayer = this.add.container(0, 0);
    this.player = this.add.graphics();
    this.particleLayer = this.add.container(0, 0);
    this.aim = this.add.graphics();
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xfff6cf, 0).setOrigin(0);
    this.makeStars();
    this.buildAlien();
    this.scale.on("resize", () => this.layout());
    this.input.on("pointerdown", (pointer) => kickAt(pointer.x));
    this.layout();
    syncHud();
  }

  layout() {
    this.w = this.scale.width;
    this.h = this.scale.height;
    this.flash.setSize(this.w, this.h);
    this.drawStaticScene();
    this.drawAlien(true);
  }

  update(_, deltaMs) {
    const dt = Math.min(0.033, deltaMs / 1000 || 0);
    if (state.mode === "playing") {
      updateGame(dt);
    }
    this.drawStaticScene();
    this.updateBalls();
    this.updateShots();
    this.updateParticles(dt);
    this.drawGoalEffects();
    this.drawAlien(false);
    this.drawRhythmLane();
    this.drawPlayer();
    this.drawAim();
    this.flash.alpha = Phaser.Math.Clamp(this.flash.alpha - dt * 3.3, 0, 0.42);
  }

  makeStars() {
    this.stars = Array.from({ length: 70 }, (_, i) => ({
      x: (i * 97 + 33) % 1000,
      y: (i * 53 + 19) % 420,
      seed: i * 0.73,
      size: i % 5 === 0 ? 2.4 : 1.4,
    }));
  }

  drawStaticScene() {
    const g = this.background;
    g.clear();
    const top = 0x07131f;
    const mid = 0x13324b;
    const grass = 0x1f7d46;
    g.fillGradientStyle(top, top, mid, mid, 1);
    g.fillRect(0, 0, this.w, this.h * 0.59);
    g.fillGradientStyle(0x22523b, 0x22523b, grass, grass, 1);
    g.fillRect(0, this.h * 0.59, this.w, this.h * 0.41);

    for (const star of this.stars) {
      const x = (star.x / 1000) * this.w;
      const y = (star.y / 420) * this.h * 0.52;
      const alpha = 0.35 + Math.sin(state.beat * 2 + star.seed) * 0.25;
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x, y, star.size);
    }

    const field = this.fieldLines;
    field.clear();
    field.lineStyle(2, 0xffffff, 0.14);
    for (let i = 0; i < 6; i += 1) {
      const y = this.h * (0.63 + i * 0.065);
      field.beginPath();
      field.moveTo(this.w * 0.08, y);
      field.lineTo(this.w * 0.92, y);
      field.strokePath();
    }

    this.drawGoal();
  }

  drawGoal() {
    const goal = getGoalBox();
    const g = this.goalNet;
    g.clear();
    g.lineStyle(6, 0xeef8ff, 0.86);
    g.strokeRoundedRect(goal.x, goal.y, goal.w, goal.h, 8);
    g.lineStyle(1.5, 0xeef8ff, 0.18);
    for (let i = 1; i < 7; i += 1) {
      const x = goal.x + (goal.w / 7) * i;
      g.lineBetween(x, goal.y + 4, x, goal.y + goal.h - 4);
    }
    for (let i = 1; i < 4; i += 1) {
      const y = goal.y + (goal.h / 4) * i;
      g.lineBetween(goal.x + 4, y, goal.x + goal.w - 4, y);
    }
  }

  buildAlien() {
    this.alienLayer.removeAll(true);
    this.alienShadow = this.add.ellipse(0, 0, 120, 28, 0x000000, 0.26);
    this.alienLayer.add(this.alienShadow);
    this.tentacles = this.add.graphics();
    this.alienBody = this.add.graphics();
    this.alienLayer.add([this.tentacles, this.alienBody]);
  }

  drawAlien(force) {
    if (!this.alienBody || force) this.buildAlien();
    const alien = aliens[state.alienIndex];
    const pose = getAlienPose();
    const wobble = Math.sin(state.beat * 2.4) * (pose.down ? 0.03 : 0.075);
    this.alienLayer.setPosition(pose.x, pose.y);
    this.alienLayer.setRotation(pose.down ? 0.62 + Math.sin(state.beat * 7) * 0.08 : wobble);
    this.alienLayer.setScale(alien.scale);

    this.alienShadow.setPosition(0, pose.s * 1.16);
    this.alienShadow.setSize(pose.s * 2.9, pose.s * 0.52);

    const tentacles = this.tentacles;
    tentacles.clear();
    const sway = pose.down ? 0.45 : 1;
    for (let i = 0; i < 8; i += 1) {
      const side = i < 4 ? -1 : 1;
      const row = i % 4;
      const rootX = side * pose.s * (0.18 + row * 0.12);
      const rootY = pose.s * (0.46 + row * 0.08);
      const wave = Math.sin(state.beat * 4 + i * 0.9) * pose.s * 0.13 * sway;
      const endX = side * pose.s * (0.62 + row * 0.25) + wave;
      const endY = pose.s * (1.12 + Math.sin(state.beat * 3.3 + i) * 0.12);
      const midX = side * pose.s * (0.34 + row * 0.2) - wave * 0.35;
      const midY = pose.s * (0.78 + row * 0.05);
      tentacles.lineStyle(pose.s * (0.18 - row * 0.018), alien.shadow, 1);
      tentacles.beginPath();
      tentacles.moveTo(rootX, rootY);
      drawQuadraticTo(tentacles, rootX, rootY, midX, midY, endX, endY);
      tentacles.strokePath();
      tentacles.lineStyle(pose.s * (0.12 - row * 0.012), alien.color, 1);
      tentacles.beginPath();
      tentacles.moveTo(rootX, rootY - pose.s * 0.02);
      drawQuadraticTo(tentacles, rootX, rootY - pose.s * 0.02, midX, midY - pose.s * 0.02, endX, endY - pose.s * 0.02);
      tentacles.strokePath();
      for (let cup = 1; cup <= 3; cup += 1) {
        const t = cup / 4;
        const x = quadratic(rootX, midX, endX, t);
        const y = quadratic(rootY, midY, endY, t);
        tentacles.fillStyle(0xffe6da, 0.72);
        tentacles.fillEllipse(x - side * pose.s * 0.035, y + pose.s * 0.025, pose.s * 0.07, pose.s * 0.048);
        tentacles.fillStyle(0x531936, 0.28);
        tentacles.fillEllipse(x - side * pose.s * 0.035, y + pose.s * 0.025, pose.s * 0.034, pose.s * 0.022);
      }
    }

    const body = this.alienBody;
    body.clear();
    body.fillStyle(alien.shadow, 1);
    body.fillEllipse(0, pose.s * 0.1, pose.s * 1.68, pose.s * 1.88);
    body.fillStyle(alien.color, 1);
    body.fillEllipse(0, -pose.s * 0.04, pose.s * 1.5, pose.s * 1.8);
    body.fillStyle(alien.accent, 0.5);
    body.fillEllipse(-pose.s * 0.24, -pose.s * 0.43, pose.s * 0.46, pose.s * 0.7);
    body.fillStyle(0xffffff, 0.22);
    body.fillEllipse(-pose.s * 0.3, -pose.s * 0.48, pose.s * 0.22, pose.s * 0.42);
    body.lineStyle(Math.max(2, pose.s * 0.035), 0xeef8ff, 0.5);
    body.strokeEllipse(0, -pose.s * 0.04, pose.s * 1.5, pose.s * 1.8);

    for (let i = 0; i < 12; i += 1) {
      const a = i * 1.71;
      const x = Math.cos(a) * pose.s * (0.2 + (i % 3) * 0.16);
      const y = -pose.s * 0.1 + Math.sin(a) * pose.s * (0.18 + (i % 2) * 0.14);
      body.fillStyle(0xffffff, 0.15);
      body.fillCircle(x, y, pose.s * (0.025 + (i % 2) * 0.012));
    }

    body.fillStyle(alien.eye, 1);
    body.fillEllipse(-pose.s * 0.26, -pose.s * 0.12, pose.s * 0.28, pose.s * 0.44);
    body.fillEllipse(pose.s * 0.26, -pose.s * 0.12, pose.s * 0.28, pose.s * 0.44);
    const glare = pose.down ? 0 : Math.sin(state.beat * 4) * pose.s * 0.025;
    body.fillStyle(0x07131f, 1);
    body.fillEllipse(-pose.s * 0.25 + glare, -pose.s * 0.1, pose.s * 0.124, pose.s * 0.24);
    body.fillEllipse(pose.s * 0.25 + glare, -pose.s * 0.1, pose.s * 0.124, pose.s * 0.24);
    body.lineStyle(Math.max(3, pose.s * 0.052), 0x07131f, 0.72);
    body.beginPath();
    body.moveTo(-pose.s * 0.45, -pose.s * 0.34);
    drawQuadraticTo(body, -pose.s * 0.45, -pose.s * 0.34, -pose.s * 0.25, -pose.s * 0.48, -pose.s * 0.05, -pose.s * 0.32);
    body.moveTo(pose.s * 0.45, -pose.s * 0.34);
    drawQuadraticTo(body, pose.s * 0.45, -pose.s * 0.34, pose.s * 0.25, -pose.s * 0.48, pose.s * 0.05, -pose.s * 0.32);
    body.strokePath();
    body.fillStyle(0x271229, 1);
    body.fillPoints([
      new Phaser.Geom.Point(0, pose.s * 0.1),
      new Phaser.Geom.Point(pose.s * 0.14, pose.s * 0.26),
      new Phaser.Geom.Point(0, pose.s * 0.39),
      new Phaser.Geom.Point(-pose.s * 0.14, pose.s * 0.26),
    ]);
  }

  drawRhythmLane() {
    const ring = strikeRing();
    const g = this.rhythm;
    g.clear();
    g.lineStyle(14, 0xffd166, 0.2);
    g.strokeCircle(ring.x, ring.y, ring.r);
    g.lineStyle(4, 0xffd166, 0.9 + Math.sin(state.beat * 12) * 0.1);
    g.strokeCircle(ring.x, ring.y, ring.r);
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(ring.x - 2, ring.y - ring.r - 18, 4, ring.r * 2 + 36);
  }

  drawPlayer() {
    const ring = strikeRing();
    const footX = ring.x - 26 + Math.sin(state.beat * 9) * 8;
    const footY = ring.y + 54;
    const g = this.player;
    g.clear();
    g.lineStyle(10, 0xeef8ff, 1);
    g.beginPath();
    g.moveTo(ring.x - 28, footY - 72);
    g.lineTo(ring.x - 12, footY - 22);
    g.lineTo(footX, footY);
    g.strokePath();
    g.lineStyle(12, 0x41e7ff, 1);
    g.beginPath();
    g.moveTo(ring.x + 24, footY - 70);
    g.lineTo(ring.x + 8, footY - 12);
    g.lineTo(ring.x + 50, footY + 8);
    g.strokePath();
    g.fillStyle(0xff4f79, 1);
    g.fillRoundedRect(ring.x + 26, footY, 48, 18, 8);
  }

  drawAim() {
    const x = state.aimX * this.w;
    const y = this.h * 0.88;
    const g = this.aim;
    g.clear();
    g.lineStyle(2, 0xffd166, 0.68);
    g.strokeTriangle(x, y - 34, x - 16, y, x + 16, y);
  }

  updateBalls() {
    for (const ball of this.balls) {
      if (ball.hit) {
        ball.sprite.setVisible(false);
        continue;
      }
      const p = ballPosition(ball);
      const age = state.beat - ball.born;
      const closeness = 1 - Math.min(1, Math.abs(age - BALL_LIFE) / HIT_WINDOW);
      ball.sprite.setPosition(p.x, p.y);
      ball.sprite.setScale((p.r / 24) * (1 + closeness * 0.25));
      ball.sprite.rotation = ball.spin + age * 8 * ball.side;
      ball.ring.clear();
      if (closeness > 0) {
        ball.ring.lineStyle(5, 0xffd166, closeness * 0.45);
        ball.ring.strokeCircle(p.x, p.y, p.r + 10);
      }
    }
    this.balls = this.balls.filter((ball) => {
      const keep = state.beat - ball.born < BALL_LIFE + 0.75;
      if (!keep) {
        ball.sprite.destroy();
        ball.ring.destroy();
      }
      return keep;
    });
  }

  updateShots() {
    for (const shot of this.shots) {
      const t = Phaser.Math.Clamp((state.beat - shot.born) / shot.duration, 0, 1);
      const p = shotPosition(shot, easeOutCubic(t));
      shot.sprite.setPosition(p.x, p.y);
      shot.sprite.setScale(p.r / 24);
      shot.sprite.rotation = shot.spin + state.beat * (shot.hard ? 18 : 13);
      const trail = this.add.circle(p.x, p.y, p.r * 0.8, shot.hard ? 0xffd166 : 0x41e7ff, 0.62);
      this.shotLayer.add(trail);
      this.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.25,
        duration: 230,
        onComplete: () => trail.destroy(),
      });
    }
    this.shots = this.shots.filter((shot) => {
      const keep = state.beat - shot.born < shot.duration + 0.3;
      if (!keep) shot.sprite.destroy();
      return keep;
    });
  }

  drawGoalEffects() {
    const goal = getGoalBox();
    const g = this.goalFx;
    g.clear();
    for (const burst of this.goalBursts) {
      const t = Phaser.Math.Clamp((state.beat - burst.born) / burst.life, 0, 1);
      const alpha = 1 - t;
      const radius = lerp(18, burst.hard ? goal.w * 0.62 : goal.w * 0.42, easeOutCubic(t));
      g.lineStyle(lerp(10, 2, t), burst.hard ? 0xffd166 : 0x41e7ff, alpha * 0.85);
      g.strokeCircle(burst.x, burst.y, radius);
      g.fillStyle(burst.hard ? 0xfff6cf : 0xc7fbff, alpha * 0.42);
      for (let i = 0; i < 14; i += 1) {
        const a = (i / 14) * Math.PI * 2 + state.beat * 0.8;
        g.fillTriangle(
          burst.x,
          burst.y,
          burst.x + Math.cos(a) * radius * 1.12,
          burst.y + Math.sin(a) * radius * 0.72,
          burst.x + Math.cos(a + 0.08) * radius * 0.36,
          burst.y + Math.sin(a + 0.08) * radius * 0.28,
        );
      }
      g.lineStyle(2, 0xffffff, alpha * 0.55);
      for (let i = 0; i < 5; i += 1) {
        const y = goal.y + goal.h * (0.18 + i * 0.16) + Math.sin(state.beat * 18 + i) * 8 * alpha;
        g.beginPath();
        g.moveTo(goal.x + 8, y);
        drawQuadraticTo(g, goal.x + 8, y, goal.x + goal.w * 0.5, y + 18 * alpha, goal.x + goal.w - 8, y);
        g.strokePath();
      }
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.sprite.setPosition(p.x, p.y);
      p.sprite.setAlpha(Phaser.Math.Clamp(p.life * 2.2, 0, 1));
    }
    this.particles = this.particles.filter((p) => {
      if (p.life > 0) return true;
      p.sprite.destroy();
      return false;
    });
  }

  createBall(ball) {
    ball.sprite = this.makeSoccerBall(ballPosition(ball).r);
    ball.ring = this.add.graphics();
    this.ballLayer.add([ball.ring, ball.sprite]);
    this.balls.push(ball);
  }

  createShot(shot) {
    shot.sprite = this.makeSoccerBall(24);
    shot.sprite.setDepth(20);
    this.shotLayer.add(shot.sprite);
    this.shots.push(shot);
  }

  createParticle(p) {
    p.sprite = this.add.circle(p.x, p.y, p.r, p.color, 1);
    this.particleLayer.add(p.sprite);
    this.particles.push(p);
  }

  createGoalBurst(burst) {
    this.goalBursts.push(burst);
  }

  makeSoccerBall(radius) {
    const textureKey = `ball-${Math.round(radius)}`;
    if (!this.textures.exists(textureKey)) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const size = Math.ceil(radius * 2.7);
      const cx = size / 2;
      const cy = size / 2;
      g.fillStyle(0xeef8ff, 1);
      g.fillCircle(cx, cy, radius);
      g.lineStyle(Math.max(2, radius * 0.1), 0x06111d, 1);
      g.strokeCircle(cx, cy, radius * 0.42);
      g.beginPath();
      g.moveTo(cx - radius, cy);
      drawQuadraticTo(g, cx - radius, cy, cx, cy - radius * 0.45, cx + radius, cy);
      g.moveTo(cx - radius, cy);
      drawQuadraticTo(g, cx - radius, cy, cx, cy + radius * 0.45, cx + radius, cy);
      g.strokePath();
      g.generateTexture(textureKey, size, size);
      g.destroy();
    }
    return this.add.image(0, 0, textureKey);
  }
}

function resetGame() {
  state.mode = "playing";
  state.timeLeft = ROUND_SECONDS;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.beat = 0;
  state.nextSpawn = 0.2;
  state.alienIndex = 0;
  state.alienHp = aliens[0].hp;
  state.alienDownUntil = 0;
  state.alienSwapTimer = 0;
  state.aimX = 0.5;
  if (sceneRef) {
    for (const item of [...sceneRef.balls, ...sceneRef.shots]) {
      item.sprite?.destroy();
      item.ring?.destroy();
    }
    for (const p of sceneRef.particles) p.sprite?.destroy();
    sceneRef.balls = [];
    sceneRef.shots = [];
    sceneRef.particles = [];
    sceneRef.goalBursts = [];
    sceneRef.buildAlien();
  }
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
  const ball = {
    id: Math.random(),
    born: state.beat,
    lane,
    side,
    hit: false,
    missed: false,
    spin: Math.random() * Math.PI,
  };
  sceneRef?.createBall(ball);
  blip(360 + lane * 70, 0.035, 0.028, "triangle");
}

function kickAt(clientX) {
  if (state.mode !== "playing") {
    if (state.mode === "paused") togglePause();
    return;
  }

  state.aimX = Phaser.Math.Clamp(clientX / getWidth(), 0.08, 0.92);
  const active = sceneRef.balls
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
  resolveShot(active.ball, timing);
}

function resolveShot(ball, timing) {
  const alien = aliens[state.alienIndex];
  const down = state.alienDownUntil > state.beat;
  const powerBand = 1 + Math.floor(state.combo / 6) * 0.18;
  const aimLane = state.aimX < 0.38 ? 0 : state.aimX > 0.62 ? 2 : 1;
  const bait = aimLane === ball.lane ? 0.06 : 0;
  const blockChance = Phaser.Math.Clamp(
    alien.block + bait - (down ? 0.3 : 0) - (timing === "hard" ? 0.2 : 0),
    0.04,
    0.72,
  );
  const goal = Math.random() > blockChance;
  createShot(ball, timing, goal, aimLane);

  if (goal) {
    const points = timing === "hard" ? 5 : timing === "good" ? 3 : 2;
    state.score += points + Math.floor(state.combo / 10);
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    popFeedback(timing === "hard" ? "HARD HIT!" : timing === "good" ? "NICE!" : "GOAL", timing === "hard" ? "#ffd166" : "#41e7ff");
    sceneRef.flash.alpha = timing === "hard" ? 0.28 : 0.12;
    sceneRef.cameras.main.shake(timing === "hard" ? 180 : 110, timing === "hard" ? 0.012 : 0.006);
    blip(timing === "hard" ? 720 : 540, 0.08, 0.07, "square");
    emitShotParticles(ball, timing, true);
    emitGoalBurst(timing, aimLane);
  } else {
    registerMiss();
    popFeedback("BLOCKED", `#${alien.color.toString(16).padStart(6, "0")}`);
    sceneRef.cameras.main.shake(120, 0.008);
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
        x: alien.x + (aimLane - 1) * getWidth() * 0.035,
        y: alien.y - alien.s * 0.1,
      };
  sceneRef?.createShot({
    startX: start.x,
    startY: start.y,
    targetX: target.x,
    targetY: target.y,
    controlX: (start.x + target.x) / 2 + (aimLane - 1) * getWidth() * 0.08,
    controlY: Math.min(start.y, target.y) - getHeight() * (timing === "hard" ? 0.22 : 0.16),
    born: state.beat,
    duration: timing === "hard" ? 0.42 : 0.5,
    spin: ball.spin,
    hard: timing === "hard",
    goal,
  });
}

function knockDownAlien() {
  state.alienDownUntil = state.beat + 4.6;
  state.alienSwapTimer = 1.6;
  state.score += 8;
  sceneRef.flash.alpha = 0.38;
  sceneRef.cameras.main.shake(240, 0.018);
  popFeedback("ALIEN DOWN!", "#ff4f79");
  blip(92, 0.15, 0.09, "square");
}

function nextAlien() {
  state.alienIndex = (state.alienIndex + 1) % aliens.length;
  state.alienHp = aliens[state.alienIndex].hp;
  state.alienDownUntil = 0;
  state.alienSwapTimer = 0;
  state.combo = Math.max(0, Math.floor(state.combo / 2));
  sceneRef?.buildAlien();
  popFeedback(`${aliens[state.alienIndex].name}`, `#${aliens[state.alienIndex].color.toString(16).padStart(6, "0")}`);
}

function registerMiss() {
  state.combo = 0;
  sceneRef?.cameras.main.shake(90, 0.005);
}

function emitShotParticles(ball, timing, goal) {
  const p = ballPosition(ball);
  const count = timing === "hard" ? 22 : 12;
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const speed = goal ? 180 + Math.random() * 240 : 80 + Math.random() * 120;
    sceneRef?.createParticle({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.45,
      color: timing === "hard" ? 0xffd166 : goal ? 0x41e7ff : 0xff4f79,
      r: 2 + Math.random() * 4,
    });
  }
}

function emitGoalBurst(timing, aimLane) {
  const goalBox = getGoalBox();
  const x = goalBox.x + goalBox.w * (0.22 + aimLane * 0.28);
  const y = goalBox.y + goalBox.h * 0.42;
  const hard = timing === "hard";
  sceneRef?.createGoalBurst({
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
    sceneRef?.createParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - Math.random() * 120,
      life: 0.42 + Math.random() * 0.5,
      color: i % 3 === 0 ? 0xffd166 : i % 3 === 1 ? 0x41e7ff : 0xffffff,
      r: 2 + Math.random() * (hard ? 6 : 4),
    });
  }
}

function popFeedback(text, color) {
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

function updateGame(dt) {
  const alien = aliens[state.alienIndex];
  state.beat += dt;
  state.timeLeft -= dt;
  state.nextSpawn -= dt;

  if (state.nextSpawn <= 0) {
    spawnBall();
    const pressure = Math.max(0, (TARGET_SCORE - state.score) / TARGET_SCORE) * 0.06;
    state.nextSpawn = Math.max(0.46, alien.tempo - Math.min(0.2, state.combo * 0.008) - pressure);
  }

  for (const ball of sceneRef.balls) {
    const age = state.beat - ball.born;
    if (!ball.hit && !ball.missed && age > BALL_LIFE + HIT_WINDOW) {
      ball.missed = true;
      registerMiss();
      popFeedback("MISS", "#92a9bc");
    }
  }

  if (state.alienSwapTimer > 0) {
    state.alienSwapTimer -= dt;
    if (state.alienSwapTimer <= 0) nextAlien();
  }

  if (state.timeLeft <= 0) endGame(state.score >= TARGET_SCORE);
  syncHud();
}

function strikeRing() {
  return {
    x: getWidth() * 0.5,
    y: getHeight() * 0.72,
    r: Math.min(getWidth() * 0.12, 54),
  };
}

function ballPosition(ball) {
  const t = Phaser.Math.Clamp((state.beat - ball.born) / BALL_LIFE, 0, 1.25);
  const ring = strikeRing();
  const laneOffset = (ball.lane - 1) * getWidth() * 0.18;
  const sx = getWidth() * (ball.side > 0 ? 0.82 : 0.18);
  const sy = getHeight() * 0.1;
  const ex = ring.x + laneOffset * 0.2;
  const ey = ring.y;
  const curve = Math.sin(t * Math.PI) * getHeight() * 0.12;
  return {
    x: lerp(sx, ex, t) + laneOffset * (1 - t) * 0.3,
    y: lerp(sy, ey, t) - curve,
    r: lerp(10, Math.min(getWidth() * 0.07, 28), t),
  };
}

function shotPosition(shot, t) {
  const x = quadratic(shot.startX, shot.controlX, shot.targetX, t);
  const y = quadratic(shot.startY, shot.controlY, shot.targetY, t);
  const scale = shot.goal ? lerp(1.05, 0.55, t) : lerp(1, 0.82, t);
  return {
    x,
    y,
    r: Math.min(getWidth() * 0.065, 24) * scale,
  };
}

function getGoalBox() {
  const w = Math.min(getWidth() * 0.78, 470);
  const h = Math.min(getHeight() * 0.24, 155);
  return {
    x: getWidth() * 0.5 - w / 2,
    y: getHeight() * 0.25,
    w,
    h,
  };
}

function getAlienPose() {
  const down = state.alienDownUntil > state.beat;
  return {
    down,
    x: getWidth() * 0.5 + Math.sin(state.beat * 2.2) * (down ? 5 : 22),
    y: getHeight() * (down ? 0.43 : 0.37),
    s: Math.min(getWidth(), getHeight()) * (down ? 0.108 : 0.132),
  };
}

function getWidth() {
  return sceneRef?.scale.width || window.innerWidth;
}

function getHeight() {
  return sceneRef?.scale.height || window.innerHeight;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadratic(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

function drawQuadraticTo(graphics, startX, startY, controlX, controlY, endX, endY) {
  for (let i = 1; i <= 16; i += 1) {
    const t = i / 16;
    graphics.lineTo(quadratic(startX, controlX, endX, t), quadratic(startY, controlY, endY, t));
  }
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function initPhaser() {
  if (!window.Phaser) {
    showMessage("LOAD ERROR", "Phaserを読み込めませんでした。通信状態を確認して再読み込みしてください。", "RELOAD", () => location.reload());
    return;
  }
  gameRef = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#07131f",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    render: {
      antialias: true,
      powerPreference: "high-performance",
    },
    scene: KickScene,
  });
}

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

initPhaser();
