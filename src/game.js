const scoreEl = document.querySelector("#score");
const timeEl = document.querySelector("#time");
const comboEl = document.querySelector("#combo");
const hpBar = document.querySelector("#hpBar");
const alienNameEl = document.querySelector("#alienName");
const alienTagEl = document.querySelector("#alienTag");
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
const HIT_STOP_SECONDS = 0.08;

const aliens = [
  {
    type: "Slime",
    name: "スライムGK ネブラ",
    tag: "粘液ボディ: 低速だが伸びる",
    hp: 86,
    color: 0x32d48d,
    shadow: 0x126146,
    accent: 0xa9ff6e,
    eye: 0xf0fff6,
    block: 0.24,
    tempo: 0.86,
    scale: 1.02,
  },
  {
    type: "Mantis",
    name: "マンティスGK ザグ",
    tag: "鎌腕セーブ: 横に強い",
    hp: 118,
    color: 0xb7f246,
    shadow: 0x31551b,
    accent: 0xffbe3d,
    eye: 0xfff8d8,
    block: 0.34,
    tempo: 0.78,
    scale: 1.08,
  },
  {
    type: "Psychic",
    name: "サイキックGK ルクス",
    tag: "念動バリア: 硬いが崩れる",
    hp: 150,
    color: 0x8f70ff,
    shadow: 0x251b5e,
    accent: 0x58efff,
    eye: 0xffffff,
    block: 0.43,
    tempo: 0.7,
    scale: 1.12,
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
  hitStopTimer: 0,
  audioReady: false,
  audio: null,
};

let sceneRef = null;
let gameRef = null;

class CharacterAnimator {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);
    this.stateName = "idle";
    this.stateStartedBeat = 0;
    this.stateStartedMs = 0;
    this.meta = {};
  }

  setState(name, meta = {}) {
    if (this.stateName === name && !meta.force) {
      this.meta = { ...this.meta, ...meta };
      return;
    }
    this.stateName = name;
    this.stateStartedBeat = state.beat;
    this.stateStartedMs = this.scene.time.now;
    this.meta = meta;
  }

  beatAge() {
    return Math.max(0, state.beat - this.stateStartedBeat);
  }

  msAge() {
    return Math.max(0, this.scene.time.now - this.stateStartedMs);
  }
}

class KickerAnimator extends CharacterAnimator {
  constructor(scene) {
    super(scene);
    this.lockedUntilMs = 0;
    this.lastPose = "idle";
    this.plantFoot = null;
  }

  update(cue) {
    const now = this.scene.time.now;
    if (now < this.lockedUntilMs) return;

    if (this.stateName === "kick" && this.msAge() >= 80) {
      this.setState("followThrough", { force: true });
      this.lockedUntilMs = now + 190;
      return;
    }

    if (["followThrough", "goalReact", "missReact"].includes(this.stateName) && now < this.lockedUntilMs) return;

    if (state.mode !== "playing") {
      this.setState("idle");
    } else if (cue === "charge") {
      this.setState("charge");
    } else if (cue === "aim") {
      this.setState("aim");
    } else {
      this.setState("idle");
    }
  }

  kick(timing, hitPoint) {
    this.setState("kick", { timing, hitPoint, force: true });
    this.lockedUntilMs = this.scene.time.now + 80;
  }

  react(goal) {
    this.scene.time.delayedCall(120, () => {
      this.setState(goal ? "goalReact" : "missReact", { force: true });
      this.lockedUntilMs = this.scene.time.now + 470;
    });
  }

  draw() {
    const ring = strikeRing();
    const g = this.graphics;
    const t = state.beat;
    const pulse = Math.sin(t * 7) * 0.5 + 0.5;
    const footY = ring.y + 56;
    const scale = Math.min(1.12, Math.max(0.88, getWidth() / 390));
    const pose = this.poseForState(ring, footY, pulse, scale);

    this.container.setPosition(0, 0);
    g.clear();
    g.lineCap = 1;

    g.fillStyle(0x02070c, 0.28);
    g.fillEllipse(pose.plant.x + 18, footY + 14, 118 * scale, 24 * scale);

    if (this.stateName === "charge") {
      g.lineStyle(3, 0xffd166, 0.25 + pulse * 0.35);
      g.strokeCircle(pose.plant.x, pose.plant.y, 26 * scale + pulse * 7);
      g.fillStyle(0xffd166, 0.14 + pulse * 0.14);
      g.fillCircle(pose.plant.x, pose.plant.y, 19 * scale + pulse * 4);
    }

    drawLimb(g, pose.hip, pose.plantKnee, pose.plant, 11 * scale, 0xeef8ff);
    drawLimb(g, pose.hip, pose.kickKnee, pose.kickFoot, 12 * scale, 0x41e7ff);

    g.fillStyle(0xff4f79, 1);
    g.fillRoundedRect(pose.kickFoot.x - 5 * scale, pose.kickFoot.y - 5 * scale, 47 * scale, 16 * scale, 8 * scale);
    g.fillStyle(0xeef8ff, 0.95);
    g.fillRoundedRect(pose.plant.x - 23 * scale, pose.plant.y - 5 * scale, 42 * scale, 14 * scale, 7 * scale);

    drawLimb(g, pose.shoulder, pose.armA, pose.handA, 8 * scale, 0xeef8ff);
    drawLimb(g, pose.shoulder, pose.armB, pose.handB, 8 * scale, 0xffd166);

    g.lineStyle(18 * scale, 0x182a45, 1);
    g.beginPath();
    g.moveTo(pose.hip.x, pose.hip.y);
    g.lineTo(pose.chest.x, pose.chest.y);
    g.strokePath();

    g.lineStyle(10 * scale, 0x41e7ff, 1);
    g.beginPath();
    g.moveTo(pose.hip.x - 7 * scale, pose.hip.y - 3 * scale);
    g.lineTo(pose.chest.x + pose.twist * 18 * scale, pose.chest.y - 4 * scale);
    g.strokePath();

    g.fillStyle(0xffd8ba, 1);
    g.fillCircle(pose.head.x, pose.head.y, 16 * scale);
    g.fillStyle(0x07131f, 1);
    g.fillCircle(pose.head.x + 4 * scale, pose.head.y - 2 * scale, 2.8 * scale);
    g.lineStyle(2 * scale, 0x07131f, 0.7);
    g.lineBetween(pose.head.x - 8 * scale, pose.head.y + 7 * scale, pose.head.x + 10 * scale, pose.head.y + pose.mouth * scale);

    if (this.stateName === "kick") {
      g.lineStyle(5 * scale, 0xfff6cf, 0.82);
      g.beginPath();
      g.moveTo(pose.kickFoot.x + 30 * scale, pose.kickFoot.y);
      g.lineTo(pose.kickFoot.x + 86 * scale, pose.kickFoot.y - 18 * scale);
      g.strokePath();
      for (let i = 0; i < 4; i += 1) {
        g.lineStyle(2, 0xffd166, 0.55 - i * 0.1);
        g.strokeCircle(pose.kickFoot.x + 44 * scale, pose.kickFoot.y - 9 * scale, 18 * scale + i * 9 * scale);
      }
    }
  }

  poseForState(ring, footY, pulse, scale) {
    const base = {
      hip: point(ring.x - 20 * scale, footY - 76 * scale),
      chest: point(ring.x - 36 * scale, footY - 130 * scale),
      shoulder: point(ring.x - 34 * scale, footY - 124 * scale),
      head: point(ring.x - 42 * scale, footY - 160 * scale),
      plant: point(ring.x - 40 * scale, footY),
      plantKnee: point(ring.x - 34 * scale, footY - 38 * scale),
      kickKnee: point(ring.x + 6 * scale, footY - 40 * scale),
      kickFoot: point(ring.x + 47 * scale, footY + 7 * scale),
      armA: point(ring.x - 68 * scale, footY - 102 * scale),
      handA: point(ring.x - 86 * scale, footY - 78 * scale),
      armB: point(ring.x - 8 * scale, footY - 104 * scale),
      handB: point(ring.x + 8 * scale, footY - 86 * scale),
      twist: 0,
      mouth: 9,
    };

    if (this.stateName === "idle") {
      base.chest.y += Math.sin(state.beat * 5) * 3 * scale;
      base.head.y += Math.sin(state.beat * 5) * 3 * scale;
      base.kickFoot.x += Math.sin(state.beat * 4.2) * 5 * scale;
      return base;
    }

    if (this.stateName === "aim") {
      base.twist = -1;
      base.chest.x -= 18 * scale;
      base.shoulder.x -= 20 * scale;
      base.head.x -= 14 * scale;
      base.armA.x -= 10 * scale;
      base.handA.x -= 20 * scale;
      base.armB.x += 16 * scale;
      base.handB.x += 18 * scale;
      base.kickFoot.x += 8 * scale;
      base.kickFoot.y -= 4 * scale;
      return base;
    }

    if (this.stateName === "charge") {
      if (!this.plantFoot) this.plantFoot = { ...base.plant };
      base.twist = -1.25;
      base.plant = { ...this.plantFoot };
      base.plantKnee = point(base.plant.x + 6 * scale, base.plant.y - 42 * scale);
      base.chest.x -= 28 * scale;
      base.head.x -= 22 * scale;
      base.kickKnee.x -= 12 * scale;
      base.kickKnee.y -= 12 * scale;
      base.kickFoot.x -= 42 * scale + pulse * 9 * scale;
      base.kickFoot.y -= 18 * scale;
      base.handA.x -= 35 * scale;
      base.handB.x += 22 * scale;
      return base;
    }

    this.plantFoot = null;
    if (this.stateName === "kick") {
      base.twist = 1.2;
      base.chest.x += 18 * scale;
      base.head.x += 9 * scale;
      base.plant.x -= 7 * scale;
      base.kickKnee.x += 38 * scale;
      base.kickKnee.y -= 12 * scale;
      base.kickFoot.x += 82 * scale;
      base.kickFoot.y -= 38 * scale;
      base.armA.x += 26 * scale;
      base.handA.x += 44 * scale;
      base.armB.y -= 28 * scale;
      base.mouth = 4;
      return base;
    }

    if (this.stateName === "followThrough") {
      base.twist = 0.9;
      base.chest.x += 10 * scale;
      base.kickKnee.x += 54 * scale;
      base.kickFoot.x += 46 * scale;
      base.kickFoot.y -= 88 * scale;
      base.armA.x += 36 * scale;
      base.armB.x -= 18 * scale;
      base.handB.y -= 36 * scale;
      base.mouth = 5;
      return base;
    }

    if (this.stateName === "goalReact") {
      const hop = Math.sin(Math.min(1, this.msAge() / 280) * Math.PI) * 20 * scale;
      base.hip.y -= hop;
      base.chest.y -= hop + 8 * scale;
      base.head.y -= hop + 10 * scale;
      base.armA.y -= 54 * scale;
      base.handA.y -= 82 * scale;
      base.armB.y -= 56 * scale;
      base.handB.y -= 86 * scale;
      base.kickFoot.x += 16 * scale;
      base.mouth = 16;
      return base;
    }

    base.chest.y += 18 * scale;
    base.head.y += 20 * scale;
    base.armA.y += 22 * scale;
    base.handA.y += 36 * scale;
    base.armB.y += 18 * scale;
    base.handB.y += 34 * scale;
    base.kickFoot.x -= 16 * scale;
    base.mouth = 15;
    return base;
  }
}

class AlienKeeperAnimator extends CharacterAnimator {
  constructor(scene, alien) {
    super(scene);
    this.alien = alien;
    this.shadow = scene.add.ellipse(0, 0, 120, 28, 0x000000, 0.28);
    this.body = scene.add.graphics();
    this.fx = scene.add.graphics();
    this.container.remove(this.graphics);
    this.graphics.destroy();
    this.container.add([this.shadow, this.body, this.fx]);
    this.expression = "neutral";
    this.expressionUntil = 0;
    this.saveLane = 1;
  }

  setAlien(alien) {
    this.alien = alien;
    this.expression = "neutral";
    this.expressionUntil = 0;
    this.introPose();
  }

  introPose() {
    this.setState("introPose", { force: true });
    this.container.setAlpha(0);
    this.container.setScale(this.alien.scale * 0.7);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: this.alien.scale,
      scaleY: this.alien.scale,
      duration: 380,
      ease: "Back.Out",
    });
  }

  loseReaction() {
    this.setState("loseReaction", { force: true });
    this.expression = "fail";
    this.expressionUntil = state.beat + 1.5;
    this.scene.tweens.add({
      targets: this.container,
      angle: this.alien.type === "Psychic" ? 18 : -16,
      y: this.container.y + 26,
      duration: 160,
      yoyo: true,
      repeat: 1,
      ease: "Sine.Out",
    });
  }

  playSave(goal, aimLane, timing) {
    this.saveLane = aimLane;
    this.expression = goal ? "fail" : "save";
    this.expressionUntil = state.beat + (goal ? 0.7 : 0.52);
    this.setState(goal ? "saveFail" : "saveSuccess", { force: true, timing });
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + (aimLane - 1) * (goal ? 7 : 18),
      duration: 85,
      yoyo: true,
      ease: "Quad.Out",
    });
  }

  draw() {
    const pose = getAlienPose();
    const alien = this.alien;
    const t = state.beat;
    const down = pose.down || this.stateName === "loseReaction";
    const introLift = this.stateName === "introPose" ? Math.max(0, 1 - this.msAge() / 380) * 48 : 0;
    const saveLean = ["saveSuccess", "saveFail"].includes(this.stateName) ? (this.saveLane - 1) * 0.16 : 0;
    const idleBob = down ? Math.sin(t * 9) * 2 : Math.sin(t * this.idleSpeed()) * this.idleRange();

    this.container.setPosition(pose.x + saveLean * pose.s, pose.y + idleBob - introLift);
    this.container.setRotation(down ? 0.45 + Math.sin(t * 8) * 0.07 : saveLean + Math.sin(t * 2.2) * 0.035);
    this.container.setScale(alien.scale * (down ? 0.92 : 1));
    this.shadow.setPosition(0, pose.s * 1.18);
    this.shadow.setSize(pose.s * (down ? 3.1 : 2.7), pose.s * 0.48);
    this.shadow.setAlpha(down ? 0.2 : 0.28);

    if (this.expressionUntil <= state.beat) this.expression = down ? "fail" : "neutral";

    this.body.clear();
    this.fx.clear();
    if (alien.type === "Slime") this.drawSlime(pose);
    if (alien.type === "Mantis") this.drawMantis(pose);
    if (alien.type === "Psychic") this.drawPsychic(pose);
  }

  idleSpeed() {
    return this.alien.type === "Slime" ? 6.2 : this.alien.type === "Mantis" ? 9.4 : 4.4;
  }

  idleRange() {
    return this.alien.type === "Slime" ? 8 : this.alien.type === "Mantis" ? 5 : 13;
  }

  drawSlime(pose) {
    const g = this.body;
    const s = pose.s;
    const save = this.stateName === "saveSuccess";
    const fail = this.expression === "fail";
    const stretchX = save ? 1.28 : 1 + Math.sin(state.beat * 7) * 0.06;
    const squashY = save ? 0.78 : 1 + Math.cos(state.beat * 7) * 0.05;

    for (let i = 0; i < 5; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const rootX = side * s * (0.24 + i * 0.05);
      const rootY = s * 0.22;
      const endX = side * s * (0.75 + (save ? 0.38 : 0.12) + i * 0.04);
      const endY = s * (0.55 + Math.sin(state.beat * 5 + i) * 0.16);
      g.lineStyle(s * 0.18, this.alien.shadow, 0.82);
      g.beginPath();
      g.moveTo(rootX, rootY);
      drawQuadraticTo(g, rootX, rootY, side * s * 0.52, s * 0.6, endX, endY);
      g.strokePath();
      g.fillStyle(this.alien.accent, 0.55);
      g.fillCircle(endX, endY, s * 0.11);
    }

    g.fillStyle(this.alien.shadow, 1);
    g.fillEllipse(0, s * 0.14, s * 1.72 * stretchX, s * 1.52 * squashY);
    g.fillStyle(this.alien.color, 1);
    g.fillEllipse(0, 0, s * 1.55 * stretchX, s * 1.42 * squashY);
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(-s * 0.34, -s * 0.28, s * 0.38, s * 0.5);
    g.fillStyle(this.alien.accent, 0.32);
    g.fillCircle(s * 0.33, -s * 0.1, s * 0.22);

    this.drawEyes(g, s, fail ? "sad" : this.expression);
    g.lineStyle(s * 0.04, 0x063927, 0.8);
    const mouthY = fail ? s * 0.34 : s * 0.26;
    g.beginPath();
    g.moveTo(-s * 0.25, mouthY);
    drawQuadraticTo(g, -s * 0.25, mouthY, 0, fail ? s * 0.2 : s * 0.42, s * 0.25, mouthY);
    g.strokePath();
  }

  drawMantis(pose) {
    const g = this.body;
    const s = pose.s;
    const save = this.stateName === "saveSuccess";
    const lane = this.saveLane - 1;
    const armReach = save ? 1.34 : 1;
    const wing = Math.sin(state.beat * 10) * s * 0.06;

    g.lineStyle(s * 0.1, this.alien.shadow, 1);
    for (const side of [-1, 1]) {
      const reachSide = save && side === Math.sign(lane || 1) ? 1.45 : armReach;
      const shoulder = point(side * s * 0.42, -s * 0.22);
      const elbow = point(side * s * 0.86 * reachSide, s * (0.06 + side * wing * 0.01));
      const claw = point(side * s * 1.23 * reachSide, -s * (0.26 + (save ? 0.08 : 0)));
      drawLimb(g, shoulder, elbow, claw, s * 0.11, this.alien.accent);
      g.lineStyle(s * 0.05, 0xfff6cf, 0.9);
      g.beginPath();
      g.moveTo(claw.x, claw.y);
      drawQuadraticTo(g, claw.x, claw.y, claw.x - side * s * 0.1, claw.y + s * 0.34, claw.x - side * s * 0.44, claw.y + s * 0.45);
      g.strokePath();
    }

    g.fillStyle(this.alien.shadow, 1);
    g.fillTriangle(0, -s * 0.92, s * 0.58, s * 0.62, -s * 0.58, s * 0.62);
    g.fillStyle(this.alien.color, 1);
    g.fillTriangle(0, -s * 1.02, s * 0.46, s * 0.48, -s * 0.46, s * 0.48);
    g.fillStyle(0xffffff, 0.18);
    g.fillTriangle(-s * 0.12, -s * 0.76, s * 0.2, s * 0.28, -s * 0.32, s * 0.24);
    g.lineStyle(s * 0.04, this.alien.accent, 0.85);
    g.lineBetween(0, -s * 0.92, 0, s * 0.42);
    g.lineBetween(-s * 0.32, -s * 0.04, s * 0.32, -s * 0.04);

    this.drawEyes(g, s, this.expression, -s * 0.25);
    g.lineStyle(s * 0.045, 0x14220d, 0.9);
    g.lineBetween(-s * 0.22, s * 0.12, s * 0.22, this.expression === "fail" ? s * 0.24 : s * 0.08);
  }

  drawPsychic(pose) {
    const g = this.body;
    const f = this.fx;
    const s = pose.s;
    const save = this.stateName === "saveSuccess";
    const phase = state.beat * 3.5;

    for (let i = 0; i < 3; i += 1) {
      f.lineStyle(2 + i, i % 2 ? this.alien.accent : 0xffffff, 0.18 + i * 0.08);
      f.strokeEllipse(0, -s * 0.04, s * (1.72 + i * 0.34 + (save ? 0.35 : 0)), s * (0.72 + i * 0.18), phase + i);
    }
    for (let i = 0; i < 5; i += 1) {
      const a = phase + i * 1.26;
      g.fillStyle(i % 2 ? this.alien.accent : this.alien.color, 0.82);
      g.fillCircle(Math.cos(a) * s * 0.84, Math.sin(a) * s * 0.36, s * 0.07);
    }

    g.fillStyle(this.alien.shadow, 1);
    g.fillEllipse(0, s * 0.05, s * 1.35, s * 1.48);
    g.fillStyle(this.alien.color, 1);
    g.fillEllipse(0, -s * 0.06, s * 1.18, s * 1.38);
    g.fillStyle(this.alien.accent, 0.36);
    g.fillCircle(0, -s * 0.78, s * 0.18 + Math.sin(phase) * s * 0.025);
    g.lineStyle(s * 0.035, 0xffffff, 0.42);
    g.strokeEllipse(0, -s * 0.06, s * 1.18, s * 1.38);

    this.drawEyes(g, s, this.expression);
    g.lineStyle(s * 0.045, 0x130c36, 0.92);
    g.beginPath();
    g.moveTo(-s * 0.22, s * 0.24);
    drawQuadraticTo(g, -s * 0.22, s * 0.24, 0, this.expression === "save" ? s * 0.38 : s * 0.14, s * 0.22, s * 0.24);
    g.strokePath();
  }

  drawEyes(g, s, expression, yOffset = 0) {
    const narrow = expression === "save";
    const sad = expression === "fail" || expression === "sad";
    const eyeH = narrow ? s * 0.16 : s * 0.31;
    const eyeY = -s * 0.18 + yOffset;
    g.fillStyle(this.alien.eye, 1);
    g.fillEllipse(-s * 0.24, eyeY, s * 0.24, eyeH);
    g.fillEllipse(s * 0.24, eyeY, s * 0.24, eyeH);
    g.fillStyle(0x07131f, 1);
    const pupilDrop = sad ? s * 0.06 : 0;
    g.fillEllipse(-s * 0.23, eyeY + pupilDrop, s * 0.09, Math.max(s * 0.07, eyeH * 0.55));
    g.fillEllipse(s * 0.23, eyeY + pupilDrop, s * 0.09, Math.max(s * 0.07, eyeH * 0.55));
    if (sad) {
      g.lineStyle(s * 0.038, 0x07131f, 0.8);
      g.lineBetween(-s * 0.37, eyeY - s * 0.19, -s * 0.12, eyeY - s * 0.08);
      g.lineBetween(s * 0.37, eyeY - s * 0.19, s * 0.12, eyeY - s * 0.08);
    }
  }

  emitContactEffect(x, y, goal, timing) {
    if (this.alien.type === "Slime") this.emitSlimeSplash(x, y, goal, timing);
    if (this.alien.type === "Mantis") this.emitMantisSlash(x, y, goal, timing);
    if (this.alien.type === "Psychic") this.emitPsychicPulse(x, y, goal, timing);
  }

  emitSlimeSplash(x, y, goal, timing) {
    const count = goal ? 12 : 22;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * (goal ? 130 : 260);
      this.scene.createParticle({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 70,
        life: 0.35 + Math.random() * 0.45,
        color: i % 2 ? this.alien.color : this.alien.accent,
        r: 3 + Math.random() * (timing === "hard" ? 6 : 4),
      });
    }
  }

  emitMantisSlash(x, y, goal, timing) {
    const slash = this.scene.add.graphics();
    slash.lineStyle(timing === "hard" ? 8 : 5, goal ? 0xff4f79 : this.alien.accent, 0.88);
    for (let i = 0; i < 3; i += 1) {
      slash.beginPath();
      slash.moveTo(x - 62 + i * 18, y + 34 - i * 12);
      drawQuadraticTo(slash, x - 62 + i * 18, y + 34 - i * 12, x, y - 48, x + 70 - i * 10, y - 10 + i * 8);
      slash.strokePath();
    }
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.28,
      scaleY: 1.28,
      duration: 280,
      onComplete: () => slash.destroy(),
    });
  }

  emitPsychicPulse(x, y, goal, timing) {
    for (let i = 0; i < 4; i += 1) {
      const ring = this.scene.add.circle(x, y, 18 + i * 8, goal ? 0xff4f79 : this.alien.accent, 0);
      ring.setStrokeStyle(timing === "hard" ? 5 : 3, i % 2 ? this.alien.accent : 0xffffff, 0.74);
      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 2.1 + i * 0.26,
        duration: 330 + i * 60,
        ease: "Quad.Out",
        onComplete: () => ring.destroy(),
      });
    }
  }
}

class AlienVisualFactory {
  static create(scene, alien) {
    return new AlienKeeperAnimator(scene, alien);
  }
}

class KickScene extends Phaser.Scene {
  constructor() {
    super("KickScene");
    this.balls = [];
    this.shots = [];
    this.particles = [];
    this.goalBursts = [];
    this.stars = [];
  }

  create() {
    sceneRef = this;
    this.background = this.add.graphics();
    this.fieldLines = this.add.graphics();
    this.goalNet = this.add.graphics();
    this.goalFx = this.add.graphics();
    this.rhythm = this.add.graphics();
    this.ballLayer = this.add.container(0, 0);
    this.shotLayer = this.add.container(0, 0);
    this.particleLayer = this.add.container(0, 0);
    this.aim = this.add.graphics();
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xfff6cf, 0).setOrigin(0);
    this.kicker = new KickerAnimator(this);
    this.alienVisual = AlienVisualFactory.create(this, aliens[state.alienIndex]);
    this.makeStars();
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
    this.alienVisual.draw();
  }

  update(_, deltaMs) {
    const dt = Math.min(0.033, deltaMs / 1000 || 0);
    if (state.mode === "playing") updateGame(dt);
    this.drawStaticScene();
    this.updateBalls();
    this.updateShots();
    this.updateParticles(dt);
    this.drawGoalEffects();
    this.alienVisual.draw();
    this.drawRhythmLane();
    this.kicker.update(getKickerCue());
    this.kicker.draw();
    this.drawAim();
    this.flash.alpha = Phaser.Math.Clamp(this.flash.alpha - dt * 3.3, 0, 0.42);
  }

  makeStars() {
    this.stars = Array.from({ length: 74 }, (_, i) => ({
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
    const mid = 0x12324d;
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
      if (!shot.trailNext || state.beat >= shot.trailNext) {
        shot.trailNext = state.beat + 0.025;
        const trail = this.add.circle(p.x, p.y, p.r * 0.82, shot.hard ? 0xffd166 : 0x41e7ff, 0.62);
        this.shotLayer.add(trail);
        this.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 0.25,
          duration: 230,
          onComplete: () => trail.destroy(),
        });
      }
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
    this.goalBursts = this.goalBursts.filter((burst) => state.beat - burst.born < burst.life + 0.15);
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

  setAlienVisual(alien) {
    this.alienVisual.setAlien(alien);
  }

  clearDynamicObjects() {
    for (const item of [...this.balls, ...this.shots]) {
      item.sprite?.destroy();
      item.ring?.destroy();
    }
    for (const p of this.particles) p.sprite?.destroy();
    this.balls = [];
    this.shots = [];
    this.particles = [];
    this.goalBursts = [];
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
  state.hitStopTimer = 0;
  if (sceneRef) {
    sceneRef.clearDynamicObjects();
    sceneRef.setAlienVisual(aliens[state.alienIndex]);
    sceneRef.kicker.setState("idle", { force: true });
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
  if (alienTagEl) alienTagEl.textContent = alien.tag;
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
    sceneRef?.kicker.setState("missReact", { force: true });
    sceneRef.kicker.lockedUntilMs = sceneRef.time.now + 360;
    registerMiss();
    popFeedback("MISS", "#92a9bc");
    blip(120, 0.07, 0.05, "sawtooth");
    return;
  }

  active.ball.hit = true;
  const timing = active.diff <= PERFECT_WINDOW ? "hard" : active.diff <= GOOD_WINDOW ? "good" : "ok";
  state.hitStopTimer = HIT_STOP_SECONDS;
  sceneRef?.kicker.kick(timing, ballPosition(active.ball));
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
  const shot = createShot(ball, timing, goal, aimLane);
  sceneRef?.alienVisual.playSave(goal, aimLane, timing);
  sceneRef?.alienVisual.emitContactEffect(shot.contactX, shot.contactY, goal, timing);
  sceneRef?.kicker.react(goal);

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
        x: alien.x + (aimLane - 1) * getWidth() * 0.045,
        y: alien.y - alien.s * 0.1,
      };
  const shot = {
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
    contactX: goal ? target.x : alien.x + (aimLane - 1) * alien.s * 0.6,
    contactY: goal ? target.y : alien.y - alien.s * 0.1,
  };
  sceneRef?.createShot(shot);
  return shot;
}

function knockDownAlien() {
  state.alienDownUntil = state.beat + 4.6;
  state.alienSwapTimer = 1.6;
  state.score += 8;
  sceneRef?.alienVisual.loseReaction();
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
  sceneRef?.setAlienVisual(aliens[state.alienIndex]);
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
    showMessage("PAUSED", "タップで再開。タイミングを取り直して、次のボールを叩き込もう。", "RESUME", togglePause);
  } else if (state.mode === "paused") {
    state.mode = "playing";
    message.hidden = true;
  }
}

function endGame(win) {
  if (state.mode !== "playing") return;
  state.mode = win ? "win" : "lose";
  const copy = win
    ? `${state.score}点、最大${state.maxCombo}コンボ。地球代表の勝ちです。`
    : `${state.score}点で終了。100点まであと${Math.max(0, TARGET_SCORE - state.score)}点でした。`;
  showMessage(win ? "YOU WIN" : "TIME UP", copy, "PLAY AGAIN");
}

function updateGame(dt) {
  if (state.hitStopTimer > 0) {
    state.hitStopTimer = Math.max(0, state.hitStopTimer - dt);
    syncHud();
    return;
  }

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
      sceneRef?.kicker.setState("missReact", { force: true });
      sceneRef.kicker.lockedUntilMs = sceneRef.time.now + 320;
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

function getKickerCue() {
  if (state.mode !== "playing" || !sceneRef) return "idle";
  const active = sceneRef.balls
    .filter((ball) => !ball.hit && !ball.missed)
    .map((ball) => {
      const age = state.beat - ball.born;
      return { ball, age, diff: Math.abs(age - BALL_LIFE) };
    })
    .sort((a, b) => a.diff - b.diff)[0];
  if (!active) return "idle";
  if (active.age > BALL_LIFE - 0.3 && active.diff <= HIT_WINDOW * 1.4) return "charge";
  if (active.age > BALL_LIFE - 0.75) return "aim";
  return "idle";
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
    x: getWidth() * 0.5,
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

function point(x, y) {
  return { x, y };
}

function drawLimb(g, a, b, c, width, color) {
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.moveTo(a.x, a.y);
  drawQuadraticTo(g, a.x, a.y, b.x, b.y, c.x, c.y);
  g.strokePath();
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
