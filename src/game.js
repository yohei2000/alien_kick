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
const MUSIC_BPM = 126;
const BEAT_SECONDS = 60 / MUSIC_BPM;
const BALL_LIFE_BEATS = 2.5;
const BALL_LIFE = BEAT_SECONDS * BALL_LIFE_BEATS;
const HIT_WINDOW = 0.18;
const PERFECT_WINDOW = 0.055;
const GOOD_WINDOW = 0.105;
const HIT_STOP_SECONDS = 0.08;
const MUSIC_STEP_SECONDS = BEAT_SECONDS / 4;
const MUSIC_LOOKAHEAD_SECONDS = 0.18;
const RHYTHM_PATTERN_BEATS = 8;
const FIRST_HIT_BEAT = 4;
const MAIN_GAIN = 0.82;
const MUSIC_GAIN = 0.5;
const SFX_GAIN = 0.72;

const NOTE = {
  F2: 87.31,
  G2: 98,
  A2: 110,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196,
  GS3: 207.65,
  A3: 220,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392,
  GS4: 415.3,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880,
  B5: 987.77,
};

const songChords = [
  { bass: NOTE.A2, pad: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4], arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5] },
  { bass: NOTE.F2, pad: [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4], arp: [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5] },
  { bass: NOTE.G2, pad: [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.G4], arp: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.G5] },
  { bass: NOTE.E3, pad: [NOTE.E3, NOTE.GS3, NOTE.B3, NOTE.E4], arp: [NOTE.GS4, NOTE.B4, NOTE.E5, NOTE.G5] },
];

const leadMotifs = [
  [NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.E5],
  [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.C5],
  [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.B4],
  [NOTE.E5, NOTE.GS4, NOTE.B4, NOTE.E5, NOTE.F5, NOTE.E5, NOTE.B4, NOTE.GS4],
];

const alienMusicProfiles = {
  Slime: {
    wobble: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.A4],
    sparkle: 0x32d48d,
  },
  Mantis: {
    blades: [NOTE.D5, NOTE.F5, NOTE.A5, NOTE.C5],
    sparkle: 0xffbe3d,
  },
  Psychic: {
    shimmer: [NOTE.GS4, NOTE.B4, NOTE.E5, NOTE.G5],
    sparkle: 0x58efff,
  },
};

const rhythmPatterns = [
  {
    name: "FOUR KICK",
    hits: [
      { beat: 0, lane: 1, side: -1, accent: true },
      { beat: 1, lane: 0, side: 1 },
      { beat: 2, lane: 2, side: -1 },
      { beat: 3, lane: 1, side: 1 },
      { beat: 4, lane: 0, side: -1, accent: true },
      { beat: 5, lane: 2, side: 1 },
      { beat: 6, lane: 1, side: -1 },
      { beat: 7, lane: 2, side: 1 },
    ],
  },
  {
    name: "SYNCOPATE",
    hits: [
      { beat: 0, lane: 1, side: -1, accent: true },
      { beat: 0.75, lane: 2, side: 1 },
      { beat: 1.5, lane: 0, side: -1 },
      { beat: 2.75, lane: 1, side: 1, accent: true },
      { beat: 4, lane: 2, side: -1 },
      { beat: 5.25, lane: 0, side: 1 },
      { beat: 6, lane: 1, side: -1 },
      { beat: 7.25, lane: 2, side: 1 },
    ],
  },
  {
    name: "DOUBLE TAP",
    hits: [
      { beat: 0, lane: 0, side: -1, accent: true },
      { beat: 0.5, lane: 1, side: 1 },
      { beat: 2, lane: 2, side: -1, accent: true },
      { beat: 2.5, lane: 1, side: 1 },
      { beat: 4, lane: 1, side: -1 },
      { beat: 5, lane: 0, side: 1 },
      { beat: 6, lane: 2, side: -1 },
      { beat: 6.5, lane: 1, side: 1 },
    ],
  },
  {
    name: "BREAK BEAT",
    hits: [
      { beat: 0, lane: 2, side: 1, accent: true },
      { beat: 1.5, lane: 0, side: -1 },
      { beat: 2.25, lane: 1, side: 1 },
      { beat: 3.5, lane: 2, side: -1 },
      { beat: 4, lane: 0, side: 1, accent: true },
      { beat: 4.75, lane: 1, side: -1 },
      { beat: 6.25, lane: 2, side: 1 },
      { beat: 7, lane: 0, side: -1 },
    ],
  },
];

const aliens = [
  {
    type: "Slime",
    assetKey: "alien-slime",
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
    spriteHeight: 84,
  },
  {
    type: "Mantis",
    assetKey: "alien-mantis",
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
    spriteHeight: 126,
  },
  {
    type: "Psychic",
    assetKey: "alien-psychic",
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
    spriteHeight: 112,
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
  patternIndex: 0,
  patternStartBeat: FIRST_HIT_BEAT,
  rhythmStep: 0,
  nextRhythmCue: null,
  lastSongTime: 0,
  musicStartAt: 0,
  musicPauseAt: 0,
  musicNextStep: 0,
  lastComboTier: 0,
  alienIndex: 0,
  alienHp: aliens[0].hp,
  alienDownUntil: 0,
  alienSwapTimer: 0,
  finalWinTimer: 0,
  aimX: 0.5,
  hitStopTimer: 0,
  audioReady: false,
  audio: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  fxDelay: null,
  fxFeedback: null,
  fxFilter: null,
  noiseBuffer: null,
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
    this.container.remove(this.graphics);
    this.graphics.destroy();
    this.shadow = scene.add.ellipse(0, 0, 124, 26, 0x000000, 0.24);
    this.sprite = scene.add.image(0, 0, "kicker");
    this.sprite.setOrigin(0.29, 0.985);
    this.fx = scene.add.graphics();
    this.container.add([this.shadow, this.sprite, this.fx]);
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
    const t = state.beat;
    const pulse = Math.sin(t * 7) * 0.5 + 0.5;
    const scale = Math.min(1.12, Math.max(0.88, getWidth() / 390));
    const footX = ring.x - 34 * scale;
    const footY = ring.y + 58 * scale;
    let angle = -2 + Math.sin(t * 4.2) * 1.4;
    let x = footX;
    let y = footY;
    const textureKey = this.textureForState();
    if (this.sprite.texture.key !== textureKey) this.sprite.setTexture(textureKey);
    this.sprite.setOrigin(...this.originForState());
    const baseHeight = this.heightForState() * scale;
    const baseWidth = (this.sprite.width / this.sprite.height) * baseHeight;
    let displayWidth = baseWidth;
    let displayHeight = baseHeight;

    if (this.stateName === "aim") {
      angle = -10;
      x -= 12 * scale;
      y += 3 * scale;
    } else if (this.stateName === "charge") {
      angle = -16;
      x -= 18 * scale;
      y += 8 * scale;
      displayWidth *= 1.04;
      displayHeight *= 0.98;
    } else if (this.stateName === "kick") {
      angle = 3;
      x -= 26 * scale;
      y += 14 * scale;
      displayWidth *= 1.04;
      displayHeight *= 0.98;
    } else if (this.stateName === "followThrough") {
      angle = 10;
      x -= 22 * scale;
      y += 8 * scale;
    } else if (this.stateName === "goalReact") {
      angle = -6;
      y -= Math.sin(Math.min(1, this.msAge() / 280) * Math.PI) * 26 * scale;
    } else if (this.stateName === "missReact") {
      angle = 7;
      x += 8 * scale;
      y += 10 * scale;
    }

    this.container.setPosition(x, y);
    this.shadow.setPosition(18 * scale, 10 * scale);
    this.shadow.setSize(132 * scale, 24 * scale);
    this.sprite.setPosition(0, 0);
    this.sprite.setDisplaySize(displayWidth, displayHeight);
    this.sprite.setAngle(angle);
    this.fx.clear();

    if (this.stateName === "charge") {
      this.fx.lineStyle(3, 0xffd166, 0.25 + pulse * 0.35);
      this.fx.strokeCircle(0, 0, 26 * scale + pulse * 8);
      this.fx.lineStyle(1.5, 0xffffff, 0.22 + pulse * 0.16);
      this.fx.strokeCircle(0, 0, 40 * scale + pulse * 12);
    }

    if (this.stateName === "kick" || this.stateName === "followThrough") {
      this.fx.lineStyle(6 * scale, 0xfff6cf, 0.72);
      this.fx.beginPath();
      this.fx.moveTo(18 * scale, -44 * scale);
      drawQuadraticTo(this.fx, 18 * scale, -44 * scale, 78 * scale, -88 * scale, 146 * scale, -66 * scale);
      this.fx.strokePath();
    }
  }

  textureForState() {
    if (this.stateName === "aim" || this.stateName === "charge") return "kicker-prekick";
    if (this.stateName === "kick" || this.stateName === "followThrough") return "kicker-kick";
    return "kicker";
  }

  originForState() {
    if (this.stateName === "aim" || this.stateName === "charge") return [0.5, 0.96];
    if (this.stateName === "kick" || this.stateName === "followThrough") return [0.42, 0.9];
    return [0.29, 0.985];
  }

  heightForState() {
    if (this.stateName === "aim" || this.stateName === "charge") return 250;
    if (this.stateName === "kick" || this.stateName === "followThrough") return 238;
    return 255;
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
    this.sprite = scene.add.image(0, 0, alien.assetKey);
    this.sprite.setOrigin(0.5, alien.type === "Mantis" ? 0.84 : alien.type === "Psychic" ? 0.72 : 0.62);
    this.sprite.setAlpha(0.98);
    this.actionSprite = scene.add.image(0, 0, "alien-block");
    this.actionSprite.setOrigin(0.5, 0.56);
    this.actionSprite.setVisible(false);
    this.body = scene.add.graphics();
    this.fx = scene.add.graphics();
    this.container.remove(this.graphics);
    this.graphics.destroy();
    this.container.add([this.shadow, this.sprite, this.actionSprite, this.body, this.fx]);
    this.container.setDepth(9);
    this.expression = "neutral";
    this.expressionUntil = 0;
    this.saveLane = 1;
    this.actionUntilMs = 0;
    this.actionKind = "block";
  }

  setAlien(alien) {
    this.alien = alien;
    this.expression = "neutral";
    this.expressionUntil = 0;
    this.sprite.setTexture(alien.assetKey);
    this.sprite.setOrigin(0.5, alien.type === "Mantis" ? 0.84 : alien.type === "Psychic" ? 0.72 : 0.62);
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
    if (!goal) this.showAction("block", 320);
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
    const baseHeight = alien.spriteHeight;
    const baseWidth = (this.sprite.width / this.sprite.height) * baseHeight;
    this.sprite.setDisplaySize(baseWidth, baseHeight);
    this.sprite.clearTint();
    const actionActive = this.scene.time.now < this.actionUntilMs;
    this.sprite.setAlpha(actionActive ? 0 : 0.98);
    this.body.setAlpha(actionActive ? 0 : 1);
    this.actionSprite.setVisible(actionActive);

    if (alien.type === "Slime") this.drawSlimeSprite(pose, down, baseWidth, baseHeight);
    if (alien.type === "Mantis") this.drawMantisSprite(pose, down, baseWidth, baseHeight);
    if (alien.type === "Psychic") this.drawPsychicSprite(pose, down, baseWidth, baseHeight);
    if (actionActive) {
      this.drawActionSprite(pose, alien);
      return;
    }
    this.drawExpressionMarks(pose, alien);
  }

  showAction(kind, durationMs = 280) {
    this.actionKind = kind;
    this.actionUntilMs = Math.max(this.actionUntilMs, this.scene.time.now + durationMs);
    this.actionSprite.setTexture(kind === "hardhit" ? "alien-hardhit" : "alien-block");
    this.actionSprite.setAlpha(kind === "hardhit" ? 1 : 0.96);
    this.actionSprite.setScale(0.82);
    this.scene.tweens.add({
      targets: this.actionSprite,
      scaleX: kind === "hardhit" ? 0.98 : 0.9,
      scaleY: kind === "hardhit" ? 0.98 : 0.9,
      duration: 110,
      ease: "Back.Out",
    });
  }

  drawActionSprite(pose, alien) {
    const hardhit = this.actionKind === "hardhit";
    const height = Math.min(getWidth() * (hardhit ? 0.43 : 0.38), hardhit ? 164 : 146);
    this.actionSprite.setDisplaySize(height, height);
    this.actionSprite.setPosition((this.saveLane - 1) * (hardhit ? 7 : 16), hardhit ? -8 : -3);
    this.actionSprite.setAngle((this.saveLane - 1) * (hardhit ? -8 : 7) + Math.sin(state.beat * 14) * 1.6);
    this.fx.lineStyle(hardhit ? 5 : 3, hardhit ? 0xffd166 : alien.accent, hardhit ? 0.55 : 0.28);
    this.fx.strokeCircle(0, 0, pose.s * (hardhit ? 1.48 : 1.18));
  }

  drawSlimeSprite(pose, down, baseWidth, baseHeight) {
    const save = this.stateName === "saveSuccess";
    const stretchX = save ? 1.1 : 1 + Math.sin(state.beat * 7) * 0.035;
    const squashY = save ? 0.92 : 1 + Math.cos(state.beat * 7) * 0.025;
    this.sprite.setDisplaySize(baseWidth * stretchX, baseHeight * squashY);
    this.sprite.setPosition(0, 4);
    if (down) this.sprite.setTint(0xa8ffd0);
  }

  drawMantisSprite(pose, down, baseWidth, baseHeight) {
    const save = this.stateName === "saveSuccess";
    this.sprite.setDisplaySize(baseWidth * (save ? 1.06 : 1), baseHeight * (save ? 0.98 : 1));
    this.sprite.setPosition((this.saveLane - 1) * (save ? 18 : 0), -8);
    this.sprite.setAngle(save ? (this.saveLane - 1) * 10 : Math.sin(state.beat * 9) * 0.8);
    if (down) this.sprite.setTint(0xe5ff9a);
  }

  drawPsychicSprite(pose, down, baseWidth, baseHeight) {
    const save = this.stateName === "saveSuccess";
    this.sprite.setDisplaySize(baseWidth, baseHeight * (1 + Math.sin(state.beat * 4) * 0.015));
    this.sprite.setPosition(0, -10 + Math.sin(state.beat * 4.4) * 8);
    this.fx.lineStyle(3, this.alien.accent, save ? 0.28 : 0.16);
    this.fx.strokeCircle(0, 18, pose.s * (save ? 1.18 : 0.96));
    if (down) this.sprite.setTint(0xe8d7ff);
  }

  drawExpressionMarks(pose, alien) {
    const y = alien.type === "Slime" ? -40 : alien.type === "Psychic" ? -66 : -78;
    if (this.expression === "save") {
      this.body.lineStyle(4, alien.accent, 0.92);
      this.body.lineBetween(-28, y, -10, y - 10);
      this.body.lineBetween(10, y - 10, 28, y);
      return;
    }
    if (this.expression === "fail" || this.expression === "sad") {
      this.body.lineStyle(4, 0xff4f79, 0.92);
      this.body.lineBetween(-16, y - 6, 16, y + 12);
      this.body.strokeCircle(0, y + 24, 12);
      return;
    }
    this.body.lineStyle(3, 0xffffff, 0.34);
    this.body.strokeCircle(0, y + 8, 8);
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
    if (!goal && timing === "hard") this.showAction("hardhit", 360);
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

  preload() {
    this.load.image("kicker", "assets/characters/kicker.png");
    this.load.image("kicker-prekick", "assets/characters/kicker-prekick.png");
    this.load.image("kicker-kick", "assets/characters/kicker-kick.png");
    this.load.image("alien-slime", "assets/characters/slime.png");
    this.load.image("alien-mantis", "assets/characters/mantis.png");
    this.load.image("alien-psychic", "assets/characters/psychic.png");
    this.load.image("alien-block", "assets/characters/alien-block.png");
    this.load.image("alien-hardhit", "assets/characters/alien-hardhit.png");
  }

  create() {
    sceneRef = this;
    this.background = this.add.graphics();
    this.fieldLines = this.add.graphics();
    this.goalNet = this.add.graphics();
    this.goalNet.setDepth(18);
    this.goalFx = this.add.graphics();
    this.goalFx.setDepth(19);
    this.rhythm = this.add.graphics();
    this.rhythm.setDepth(14);
    this.ballLayer = this.add.container(0, 0);
    this.ballLayer.setDepth(16);
    this.shotLayer = this.add.container(0, 0);
    this.shotLayer.setDepth(17);
    this.particleLayer = this.add.container(0, 0);
    this.particleLayer.setDepth(15);
    this.aim = this.add.graphics();
    this.aim.setDepth(13);
    this.flash = this.add.rectangle(0, 0, 10, 10, 0xfff6cf, 0).setOrigin(0);
    this.flash.setDepth(30);
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
      const closeness = 1 - Math.min(1, Math.abs(state.beat - ball.hitTime) / HIT_WINDOW);
      ball.sprite.setPosition(p.x, p.y);
      ball.sprite.setScale((p.r / 24) * (1 + closeness * 0.25));
      ball.sprite.rotation = ball.spin + (state.beat - ball.born) * 8 * ball.side;
      ball.ring.clear();
      if (closeness > 0) {
        ball.ring.lineStyle(ball.accent ? 7 : 5, ball.accent ? 0xff4f79 : 0xffd166, closeness * 0.52);
        ball.ring.strokeCircle(p.x, p.y, p.r + 10);
      }
    }
    this.balls = this.balls.filter((ball) => {
      const keep = state.beat < ball.hitTime + 0.75;
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
  state.lastComboTier = 0;
  state.beat = 0;
  state.lastSongTime = 0;
  resetRhythmSequencer();
  startMusicClock();
  state.alienIndex = 0;
  state.alienHp = aliens[0].hp;
  state.alienDownUntil = 0;
  state.alienSwapTimer = 0;
  state.finalWinTimer = 0;
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
  if (state.audioReady) {
    ensureAudioRunning();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audio = new AudioContext();
  const audio = state.audio;
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;
  state.masterGain = audio.createGain();
  state.musicGain = audio.createGain();
  state.sfxGain = audio.createGain();
  state.fxDelay = audio.createDelay(1.2);
  state.fxFeedback = audio.createGain();
  state.fxFilter = audio.createBiquadFilter();
  state.masterGain.gain.value = MAIN_GAIN;
  state.musicGain.gain.value = MUSIC_GAIN;
  state.sfxGain.gain.value = SFX_GAIN;
  state.fxDelay.delayTime.value = BEAT_SECONDS * 0.75;
  state.fxFeedback.gain.value = 0.24;
  state.fxFilter.type = "highpass";
  state.fxFilter.frequency.value = 620;
  state.musicGain.connect(compressor);
  state.sfxGain.connect(compressor);
  state.fxDelay.connect(state.fxFeedback);
  state.fxFeedback.connect(state.fxDelay);
  state.fxDelay.connect(state.fxFilter);
  state.fxFilter.connect(state.musicGain);
  compressor.connect(state.masterGain);
  state.masterGain.connect(audio.destination);
  state.noiseBuffer = createNoiseBuffer(audio);
  state.audioReady = true;
  ensureAudioRunning();
}

function ensureAudioRunning() {
  if (state.audio?.state === "suspended") state.audio.resume();
}

function createNoiseBuffer(audio) {
  const length = Math.floor(audio.sampleRate * 0.45);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function startMusicClock() {
  const audio = state.audio;
  if (!audio) return;
  ensureAudioRunning();
  state.musicStartAt = audio.currentTime + 0.025;
  state.musicPauseAt = 0;
  state.lastSongTime = 0;
  state.musicNextStep = 0;
}

function pauseMusicClock() {
  if (!state.audio) return;
  state.musicPauseAt = getSongTime();
  state.audio.suspend();
}

function resumeMusicClock() {
  if (!state.audio) return;
  state.audio.resume();
  state.musicStartAt = state.audio.currentTime - state.musicPauseAt;
  state.lastSongTime = state.musicPauseAt;
  state.musicNextStep = Math.max(state.musicNextStep, Math.floor(state.musicPauseAt / MUSIC_STEP_SECONDS));
}

function getSongTime() {
  const audio = state.audio;
  if (!audio || !state.audioReady) return state.beat;
  return Math.max(0, audio.currentTime - state.musicStartAt);
}

function blip(freq, duration = 0.05, gain = 0.07, type = "sine") {
  const audio = state.audio;
  if (!audio) return;
  scheduleTone({
    freq,
    start: audio.currentTime,
    duration,
    gain,
    type,
    bus: state.sfxGain,
    attack: 0.004,
    release: Math.max(0.035, duration * 0.45),
  });
}

function scheduleTone({
  freq,
  start,
  duration,
  gain,
  type = "sine",
  bus = state.musicGain,
  attack = 0.006,
  release = 0.05,
  detune = 0,
  sweepTo = null,
  filterType = null,
  filterFreq = 1400,
  send = 0,
}) {
  const audio = state.audio;
  if (!audio || !bus) return;
  const osc = audio.createOscillator();
  const filter = filterType ? audio.createBiquadFilter() : null;
  const amp = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), start + duration);
  osc.detune.value = detune;
  if (filter) {
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, start);
    filter.Q.value = 0.8;
  }
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration + release);
  osc.connect(filter || amp);
  if (filter) filter.connect(amp);
  amp.connect(bus);
  if (send > 0 && state.fxDelay) {
    const sendGain = audio.createGain();
    sendGain.gain.value = send;
    amp.connect(sendGain);
    sendGain.connect(state.fxDelay);
  }
  osc.start(start);
  osc.stop(start + duration + release + 0.02);
}

function scheduleNoise({ start, duration, gain, bus = state.musicGain, filterType = "highpass", freq = 4000, q = 0.8 }) {
  const audio = state.audio;
  if (!audio || !bus || !state.noiseBuffer) return;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const amp = audio.createGain();
  source.buffer = state.noiseBuffer;
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.004);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(bus);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function resetRhythmSequencer() {
  state.nextSpawn = 0;
  state.patternIndex = 0;
  state.patternStartBeat = FIRST_HIT_BEAT;
  state.rhythmStep = 0;
  state.musicNextStep = 0;
  state.nextRhythmCue = null;
  queueNextRhythmCue();
}

function queueNextRhythmCue() {
  const pattern = rhythmPatterns[state.patternIndex];
  const hit = pattern.hits[state.rhythmStep];
  const hitBeat = state.patternStartBeat + hit.beat;
  state.nextRhythmCue = {
    ...hit,
    patternName: pattern.name,
    hitBeat,
    hitTime: hitBeat * BEAT_SECONDS,
    spawnTime: hitBeat * BEAT_SECONDS - BALL_LIFE,
  };
}

function advanceRhythmCue() {
  const previousPattern = state.patternIndex;
  const pattern = rhythmPatterns[state.patternIndex];
  state.rhythmStep += 1;
  if (state.rhythmStep >= pattern.hits.length) {
    state.rhythmStep = 0;
    state.patternStartBeat += RHYTHM_PATTERN_BEATS;
    state.patternIndex = (state.patternIndex + 1) % rhythmPatterns.length;
    if (state.patternIndex !== previousPattern) announceRhythmShift();
  }
  queueNextRhythmCue();
}

function announceRhythmShift() {
  const pattern = rhythmPatterns[state.patternIndex];
  popFeedback(`RHYTHM ${pattern.name}`, "#ffd166");
  playRhythmShiftSfx();
}

function updateMusic() {
  const audio = state.audio;
  if (!audio || state.mode !== "playing") return;
  ensureAudioRunning();
  const songNow = getSongTime();
  const energy = getMusicEnergy();
  state.musicGain?.gain.setTargetAtTime(MUSIC_GAIN + energy * 0.045, audio.currentTime, 0.08);
  state.fxFeedback?.gain.setTargetAtTime(0.22 + energy * 0.035, audio.currentTime, 0.12);
  state.fxFilter?.frequency.setTargetAtTime(620 + energy * 120, audio.currentTime, 0.12);
  const currentStep = Math.floor(songNow / MUSIC_STEP_SECONDS);
  if (state.musicNextStep < currentStep) state.musicNextStep = currentStep;
  while (state.musicNextStep * MUSIC_STEP_SECONDS <= songNow + MUSIC_LOOKAHEAD_SECONDS) {
    scheduleMusicStep(state.musicNextStep);
    state.musicNextStep += 1;
  }
}

function scheduleMusicStep(stepIndex) {
  const audio = state.audio;
  if (!audio) return;
  const songTime = stepIndex * MUSIC_STEP_SECONDS;
  const start = Math.max(audio.currentTime + 0.002, state.musicStartAt + songTime);
  const stepInBar = stepIndex % 16;
  const bar = Math.floor(stepIndex / 16);
  const phraseBar = bar % 16;
  const chord = getSongChord(bar);
  const energy = getMusicEnergy();
  const beat = stepIndex / 4;
  const hit = getRhythmHitAtMusicBeat(beat);

  if ([0, 6, 10].includes(stepInBar) || (bar % 2 === 1 && stepInBar === 14)) {
    scheduleKickDrum(start, stepInBar === 0 ? 1 + energy * 0.08 : 0.72 + energy * 0.04);
  }
  if (stepInBar === 4 || stepInBar === 12) scheduleSnareDrum(start, stepInBar === 12 ? 0.9 + energy * 0.05 : 0.74);
  if (stepInBar % 2 === 0) scheduleHat(start, stepInBar % 4 === 0 ? 0.92 : 0.55 + energy * 0.06);
  if ((bar + stepInBar) % 4 === 3) scheduleHat(start + MUSIC_STEP_SECONDS * 0.48, 0.28 + energy * 0.04);
  if (energy >= 2 && stepInBar % 4 === 2) scheduleOpenHat(start, 0.32);

  if (stepInBar === 0) schedulePadChord(start, chord, energy, phraseBar);
  scheduleBassStep(start, stepInBar, bar, chord, energy);
  scheduleArpStep(start, stepInBar, bar, chord, energy);
  scheduleLeadStep(start, stepInBar, bar, hit, chord, energy);
  scheduleAlienLayer(start, stepInBar, bar, chord, energy);
  scheduleComboGroove(start, stepInBar, energy);
  if (phraseBar === 15 && stepInBar >= 12) schedulePhraseLift(start, stepInBar, energy);
  if (hit) scheduleTargetTick(start, hit);
}

function getSongChord(bar) {
  return songChords[Math.floor((bar % 16) / 4)];
}

function getMusicEnergy() {
  const comboEnergy = Math.min(2, Math.floor(state.combo / 6));
  const alienEnergy = Math.min(1, state.alienIndex * 0.5);
  const timeEnergy = state.timeLeft < 25 ? 1 : 0;
  return Math.min(3, comboEnergy + alienEnergy + timeEnergy);
}

function getRhythmHitAtMusicBeat(musicBeat) {
  if (musicBeat < FIRST_HIT_BEAT - 0.001) return null;
  const patternCycle = Math.floor((musicBeat - FIRST_HIT_BEAT + 0.0001) / RHYTHM_PATTERN_BEATS);
  const localBeat = musicBeat - FIRST_HIT_BEAT - patternCycle * RHYTHM_PATTERN_BEATS;
  const pattern = rhythmPatterns[patternCycle % rhythmPatterns.length];
  return pattern.hits.find((hit) => Math.abs(hit.beat - localBeat) < 0.001) || null;
}

function scheduleKickDrum(start, strength = 1) {
  scheduleTone({
    freq: 96,
    sweepTo: 38,
    start,
    duration: 0.13,
    gain: 0.18 * strength,
    type: "sine",
    bus: state.musicGain,
    attack: 0.002,
    release: 0.05,
  });
  scheduleNoise({ start, duration: 0.035, gain: 0.035 * strength, filterType: "lowpass", freq: 420, q: 0.4 });
}

function scheduleSnareDrum(start, strength = 1) {
  scheduleNoise({ start, duration: 0.09, gain: 0.09 * strength, filterType: "bandpass", freq: 1900, q: 0.9 });
  scheduleTone({
    freq: 185,
    start,
    duration: 0.06,
    gain: 0.045 * strength,
    type: "triangle",
    bus: state.musicGain,
    release: 0.04,
  });
}

function scheduleHat(start, strength = 1) {
  scheduleNoise({ start, duration: 0.038, gain: 0.035 * strength, filterType: "highpass", freq: 7200, q: 0.7 });
}

function scheduleOpenHat(start, strength = 1) {
  scheduleNoise({ start, duration: 0.14, gain: 0.026 * strength, filterType: "highpass", freq: 6100, q: 0.7 });
}

function schedulePadChord(start, chord, energy, phraseBar) {
  const padGain = 0.0065 + energy * 0.0018;
  chord.pad.forEach((freq, i) => {
    scheduleTone({
      freq,
      start: start + i * 0.009,
      duration: BEAT_SECONDS * (phraseBar % 4 === 3 ? 3.2 : 3.75),
      gain: padGain,
      type: i % 2 ? "triangle" : "sine",
      bus: state.musicGain,
      attack: 0.22,
      release: 0.55,
      detune: i % 2 ? 5 : -4,
      filterType: "lowpass",
      filterFreq: 1400 + energy * 360,
      send: 0.16 + energy * 0.035,
    });
  });
}

function scheduleBassStep(start, stepInBar, bar, chord, energy) {
  const offsets = {
    0: 1,
    3: 1,
    6: 1.5,
    8: 2,
    10: 1.5,
    14: bar % 2 ? 2.25 : 0.75,
  };
  const offset = offsets[stepInBar];
  const bass = offset ? chord.bass * offset : null;
  if (!bass) return;
  scheduleTone({
    freq: bass,
    start,
    duration: MUSIC_STEP_SECONDS * (stepInBar === 0 ? 1.5 : 1.16),
    gain: 0.072 + energy * 0.008,
    type: "sawtooth",
    bus: state.musicGain,
    attack: 0.008,
    release: 0.08,
    filterType: "lowpass",
    filterFreq: 520 + energy * 90,
  });
}

function scheduleArpStep(start, stepInBar, bar, chord, energy) {
  const active = energy > 0 || bar % 4 >= 2;
  if (!active || ![1, 3, 5, 7, 9, 11, 13, 15].includes(stepInBar)) return;
  const arpIndex = (stepInBar + bar * 2) % chord.arp.length;
  const freq = chord.arp[arpIndex] * (energy >= 2 && stepInBar % 8 === 7 ? 2 : 1);
  scheduleTone({
    freq,
    start,
    duration: MUSIC_STEP_SECONDS * 0.64,
    gain: 0.018 + energy * 0.004,
    type: "triangle",
    bus: state.musicGain,
    attack: 0.004,
    release: 0.08,
    filterType: "highpass",
    filterFreq: 680,
    send: 0.24,
  });
}

function scheduleLeadStep(start, stepInBar, bar, hit, chord, energy) {
  const motif = leadMotifs[Math.floor((bar % 16) / 4)];
  const phraseStep = (bar % 4) * 4 + Math.floor(stepInBar / 4);
  const playBeatLead = stepInBar % 4 === 0 && (bar % 4 >= 1 || hit || energy >= 1);
  const playAnswer = energy >= 2 && (stepInBar === 6 || stepInBar === 14);
  if (!playBeatLead && !playAnswer) return;
  const freq = playAnswer ? chord.arp[(bar + stepInBar) % chord.arp.length] : motif[phraseStep % motif.length];
  scheduleTone({
    freq,
    start: start + (playAnswer ? MUSIC_STEP_SECONDS * 0.12 : 0),
    duration: playAnswer ? MUSIC_STEP_SECONDS * 0.72 : MUSIC_STEP_SECONDS * 1.45,
    gain: (hit?.accent ? 0.045 : 0.032) + energy * 0.004,
    type: "square",
    bus: state.musicGain,
    attack: 0.006,
    release: 0.11,
    filterType: "lowpass",
    filterFreq: 1700 + energy * 360,
    send: 0.21,
  });
  scheduleTone({
    freq: freq * 2,
    start: start + 0.012,
    duration: MUSIC_STEP_SECONDS * 0.72,
    gain: 0.008 + energy * 0.002,
    type: "sine",
    bus: state.musicGain,
    attack: 0.008,
    release: 0.12,
    send: 0.28,
  });
}

function scheduleAlienLayer(start, stepInBar, bar, chord, energy) {
  const alien = aliens[state.alienIndex];
  if (alien.type === "Slime") scheduleSlimeMusic(start, stepInBar, bar, energy);
  if (alien.type === "Mantis") scheduleMantisMusic(start, stepInBar, bar, energy);
  if (alien.type === "Psychic") schedulePsychicMusic(start, stepInBar, bar, chord, energy);
}

function scheduleSlimeMusic(start, stepInBar, bar, energy) {
  if (![2, 5, 10, 13].includes(stepInBar)) return;
  const profile = alienMusicProfiles.Slime;
  const freq = profile.wobble[(bar + stepInBar) % profile.wobble.length];
  scheduleTone({
    freq: freq * 0.5,
    sweepTo: freq * (stepInBar % 2 ? 0.62 : 0.78),
    start: start + MUSIC_STEP_SECONDS * 0.08,
    duration: MUSIC_STEP_SECONDS * 0.9,
    gain: 0.026 + energy * 0.004,
    type: "sine",
    bus: state.musicGain,
    attack: 0.01,
    release: 0.12,
    filterType: "lowpass",
    filterFreq: 920 + energy * 110,
    send: 0.12,
  });
}

function scheduleMantisMusic(start, stepInBar, bar, energy) {
  if (![3, 7, 11, 15].includes(stepInBar)) return;
  const profile = alienMusicProfiles.Mantis;
  const freq = profile.blades[(bar + stepInBar) % profile.blades.length];
  scheduleTone({
    freq,
    start,
    duration: MUSIC_STEP_SECONDS * 0.33,
    gain: 0.022 + energy * 0.004,
    type: "square",
    bus: state.musicGain,
    attack: 0.002,
    release: 0.045,
    filterType: "highpass",
    filterFreq: 1400,
    send: 0.08,
  });
  scheduleNoise({
    start: start + MUSIC_STEP_SECONDS * 0.08,
    duration: 0.026,
    gain: 0.022 + energy * 0.004,
    bus: state.musicGain,
    filterType: "bandpass",
    freq: 3500,
    q: 2.2,
  });
}

function schedulePsychicMusic(start, stepInBar, bar, chord, energy) {
  if (![0, 5, 9, 14].includes(stepInBar)) return;
  const profile = alienMusicProfiles.Psychic;
  const freq = profile.shimmer[(bar + stepInBar) % profile.shimmer.length];
  scheduleTone({
    freq: freq * 2,
    start: start + MUSIC_STEP_SECONDS * 0.18,
    duration: BEAT_SECONDS * 1.25,
    gain: 0.012 + energy * 0.003,
    type: "sine",
    bus: state.musicGain,
    attack: 0.08,
    release: 0.22,
    filterType: "highpass",
    filterFreq: 900,
    send: 0.42,
  });
  if (stepInBar === 0) {
    scheduleTone({
      freq: chord.pad[2] * 2,
      start: start + MUSIC_STEP_SECONDS * 0.5,
      duration: BEAT_SECONDS * 2.5,
      gain: 0.007 + energy * 0.002,
      type: "triangle",
      bus: state.musicGain,
      attack: 0.18,
      release: 0.38,
      send: 0.5,
    });
  }
}

function scheduleComboGroove(start, stepInBar, energy) {
  if (energy < 1) return;
  if (stepInBar === 2 || stepInBar === 10) {
    scheduleNoise({
      start: start + MUSIC_STEP_SECONDS * 0.38,
      duration: 0.035,
      gain: 0.024 + energy * 0.005,
      bus: state.musicGain,
      filterType: "highpass",
      freq: 8200,
    });
  }
  if (energy >= 3 && (stepInBar === 7 || stepInBar === 15)) {
    scheduleTone({
      freq: NOTE.A5,
      start: start + MUSIC_STEP_SECONDS * 0.18,
      duration: MUSIC_STEP_SECONDS * 0.42,
      gain: 0.018,
      type: "triangle",
      bus: state.musicGain,
      attack: 0.003,
      release: 0.08,
      send: 0.34,
    });
  }
}

function schedulePhraseLift(start, stepInBar, energy) {
  const lift = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5][stepInBar - 12];
  if (!lift) return;
  scheduleTone({
    freq: lift,
    start,
    duration: MUSIC_STEP_SECONDS * 0.7,
    gain: 0.018 + energy * 0.004,
    type: "triangle",
    bus: state.musicGain,
    attack: 0.003,
    release: 0.08,
    send: 0.34,
  });
}

function scheduleTargetTick(start, hit) {
  const root = hit.accent ? 932.33 : 783.99;
  scheduleTone({
    freq: root,
    start,
    duration: 0.055,
    gain: hit.accent ? 0.07 : 0.045,
    type: "triangle",
    bus: state.musicGain,
    attack: 0.002,
    release: 0.04,
  });
  if (hit.accent) {
    scheduleTone({
      freq: root * 1.5,
      start: start + 0.018,
      duration: 0.075,
      gain: 0.038,
      type: "sine",
      bus: state.musicGain,
      attack: 0.002,
      release: 0.05,
    });
  }
}

function playIncomingCue(ball) {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  const laneFreq = 440 + ball.lane * 92;
  scheduleTone({ freq: laneFreq, start, duration: 0.055, gain: ball.accent ? 0.055 : 0.035, type: "triangle", bus: state.sfxGain });
  scheduleTone({ freq: laneFreq * 1.5, start: start + 0.045, duration: 0.05, gain: ball.accent ? 0.04 : 0.025, type: "sine", bus: state.sfxGain });
}

function playKickImpactSfx(timing) {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  const hard = timing === "hard";
  scheduleTone({ freq: hard ? 132 : 118, sweepTo: hard ? 72 : 86, start, duration: hard ? 0.12 : 0.08, gain: hard ? 0.16 : 0.1, type: "sine", bus: state.sfxGain, attack: 0.002 });
  scheduleNoise({ start, duration: hard ? 0.09 : 0.055, gain: hard ? 0.09 : 0.045, bus: state.sfxGain, filterType: "bandpass", freq: hard ? 1500 : 1200 });
  if (hard) {
    [NOTE.A4, NOTE.E5, NOTE.A5].forEach((freq, i) => {
      scheduleTone({
        freq,
        start: start + i * 0.025,
        duration: 0.09,
        gain: 0.038,
        type: "triangle",
        bus: state.sfxGain,
        attack: 0.002,
        release: 0.07,
        send: 0.22,
      });
    });
  }
}

function playGoalSfx(timing) {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  const hard = timing === "hard";
  const notes = hard ? [659.25, 880, 1174.66] : [523.25, 659.25, 783.99];
  notes.forEach((freq, i) => {
    scheduleTone({ freq, start: start + i * 0.035, duration: 0.12, gain: hard ? 0.075 : 0.052, type: "triangle", bus: state.sfxGain, release: 0.08 });
  });
  if (hard) scheduleNoise({ start, duration: 0.16, gain: 0.08, bus: state.sfxGain, filterType: "highpass", freq: 4200 });
}

function playBlockSfx(timing) {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  scheduleTone({ freq: timing === "hard" ? 150 : 130, sweepTo: 92, start, duration: 0.12, gain: 0.095, type: "square", bus: state.sfxGain, release: 0.05 });
  scheduleNoise({ start, duration: 0.12, gain: 0.07, bus: state.sfxGain, filterType: "bandpass", freq: 900, q: 1.5 });
}

function playMissSfx() {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  scheduleTone({ freq: 190, sweepTo: 82, start, duration: 0.16, gain: 0.075, type: "sawtooth", bus: state.sfxGain, release: 0.08 });
}

function playRhythmShiftSfx() {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  [520, 780, 1040].forEach((freq, i) => {
    scheduleTone({ freq, start: start + i * 0.045, duration: 0.08, gain: 0.045, type: i % 2 ? "sine" : "triangle", bus: state.sfxGain });
  });
}

function playKnockdownSfx() {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  scheduleTone({ freq: 92, sweepTo: 34, start, duration: 0.24, gain: 0.15, type: "square", bus: state.sfxGain, attack: 0.003, release: 0.12 });
  scheduleNoise({ start, duration: 0.22, gain: 0.09, bus: state.sfxGain, filterType: "lowpass", freq: 700 });
  [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4].forEach((freq, i) => {
    scheduleTone({
      freq,
      start: start + 0.12 + i * 0.035,
      duration: 0.26,
      gain: 0.045,
      type: i % 2 ? "triangle" : "sine",
      bus: state.sfxGain,
      attack: 0.01,
      release: 0.18,
      send: 0.32,
    });
  });
}

function playComboTierSfx(tier) {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  const root = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5][Math.max(0, tier - 1)] || NOTE.C5;
  [root, root * 1.25, root * 1.5].forEach((freq, i) => {
    scheduleTone({
      freq,
      start: start + i * 0.04,
      duration: 0.12 + tier * 0.015,
      gain: 0.032 + tier * 0.004,
      type: "triangle",
      bus: state.sfxGain,
      attack: 0.003,
      release: 0.1,
      send: 0.35,
    });
  });
}

function playWinFanfare() {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  const notes = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.A5, NOTE.B5, NOTE.A5];
  notes.forEach((freq, i) => {
    scheduleTone({
      freq,
      start: start + i * 0.09,
      duration: i >= 3 ? 0.28 : 0.16,
      gain: 0.06,
      type: i % 2 ? "square" : "triangle",
      bus: state.sfxGain,
      attack: 0.004,
      release: 0.16,
      filterType: "lowpass",
      filterFreq: 2400,
      send: 0.42,
    });
  });
  scheduleNoise({ start: start + 0.18, duration: 0.28, gain: 0.08, bus: state.sfxGain, filterType: "highpass", freq: 5000 });
}

function playLoseStinger() {
  const audio = state.audio;
  if (!audio) return;
  const start = audio.currentTime;
  [NOTE.E4, NOTE.C4, NOTE.A3].forEach((freq, i) => {
    scheduleTone({
      freq,
      start: start + i * 0.11,
      duration: 0.22,
      gain: 0.05,
      type: "sawtooth",
      bus: state.sfxGain,
      attack: 0.006,
      release: 0.18,
      filterType: "lowpass",
      filterFreq: 900,
      send: 0.25,
    });
  });
}

function updateRhythmFeed() {
  while (state.nextRhythmCue && state.beat >= state.nextRhythmCue.spawnTime) {
    spawnBall(state.nextRhythmCue);
    advanceRhythmCue();
  }
}

function spawnBall(cue) {
  const lane = cue?.lane ?? Math.floor(Math.random() * 3);
  const side = cue?.side ?? (Math.random() > 0.5 ? 1 : -1);
  const ball = {
    id: Math.random(),
    born: cue?.spawnTime ?? state.beat,
    hitTime: cue?.hitTime ?? state.beat + BALL_LIFE,
    patternName: cue?.patternName ?? rhythmPatterns[state.patternIndex].name,
    accent: Boolean(cue?.accent),
    lane,
    side,
    hit: false,
    missed: false,
    spin: Math.random() * Math.PI,
  };
  sceneRef?.createBall(ball);
  playIncomingCue(ball);
}

function kickAt(clientX) {
  if (state.mode !== "playing") {
    if (state.mode === "paused") togglePause();
    return;
  }

  state.aimX = Phaser.Math.Clamp(clientX / getWidth(), 0.08, 0.92);
  const active = sceneRef.balls
    .filter((ball) => !ball.hit && !ball.missed)
    .map((ball) => ({ ball, diff: Math.abs(state.beat - ball.hitTime) }))
    .sort((a, b) => a.diff - b.diff)[0];

  if (!active || active.diff > HIT_WINDOW) {
    sceneRef?.kicker.setState("missReact", { force: true });
    sceneRef.kicker.lockedUntilMs = sceneRef.time.now + 360;
    registerMiss();
    popFeedback("MISS", "#92a9bc");
    playMissSfx();
    return;
  }

  active.ball.hit = true;
  const timing = active.diff <= PERFECT_WINDOW ? "hard" : active.diff <= GOOD_WINDOW ? "good" : "ok";
  state.hitStopTimer = HIT_STOP_SECONDS;
  sceneRef?.kicker.kick(timing, ballPosition(active.ball));
  playKickImpactSfx(timing);
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
    updateComboMusicTier();
    popFeedback(timing === "hard" ? "HARD HIT!" : timing === "good" ? "NICE!" : "GOAL", timing === "hard" ? "#ffd166" : "#41e7ff");
    sceneRef.flash.alpha = timing === "hard" ? 0.28 : 0.12;
    sceneRef.cameras.main.shake(timing === "hard" ? 180 : 110, timing === "hard" ? 0.012 : 0.006);
    playGoalSfx(timing);
    emitShotParticles(ball, timing, true);
    emitGoalBurst(timing, aimLane);
  } else {
    registerMiss();
    popFeedback("BLOCKED", `#${alien.color.toString(16).padStart(6, "0")}`);
    sceneRef.cameras.main.shake(120, 0.008);
    playBlockSfx(timing);
    emitShotParticles(ball, timing, false);
  }

  if (state.combo >= 4 && timing !== "ok") {
    const damage = Math.round((timing === "hard" ? 18 : 9) * powerBand);
    state.alienHp -= damage;
    if (state.alienHp <= 0) knockDownAlien();
  }

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
  if (state.alienDownUntil > state.beat || state.finalWinTimer > 0) return;
  const finalAlien = state.alienIndex >= aliens.length - 1;
  state.alienDownUntil = state.beat + 4.6;
  state.alienSwapTimer = finalAlien ? 0 : 1.6;
  state.finalWinTimer = finalAlien ? 1.65 : 0;
  state.score += 8;
  sceneRef?.alienVisual.loseReaction();
  sceneRef.flash.alpha = 0.38;
  sceneRef.cameras.main.shake(240, 0.018);
  popFeedback(finalAlien ? "ALL CLEAR!" : "ALIEN DOWN!", "#ff4f79");
  playKnockdownSfx();
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
  state.lastComboTier = 0;
  sceneRef?.cameras.main.shake(90, 0.005);
}

function updateComboMusicTier() {
  const tier = Math.min(4, Math.floor(state.combo / 5));
  if (tier <= state.lastComboTier) return;
  state.lastComboTier = tier;
  playComboTierSfx(tier);
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
    pauseMusicClock();
    state.mode = "paused";
    showMessage("PAUSED", "タップで再開。タイミングを取り直して、次のボールを叩き込もう。", "RESUME", togglePause);
  } else if (state.mode === "paused") {
    resumeMusicClock();
    state.mode = "playing";
    message.hidden = true;
  }
}

function endGame(win) {
  if (state.mode !== "playing") return;
  state.mode = win ? "win" : "lose";
  if (win) playWinFanfare();
  else playLoseStinger();
  const copy = win
    ? `${aliens.length}体撃破、${state.score}点、最大${state.maxCombo}コンボ。地球代表の完全勝利です。`
    : `${state.score}点で終了。残りのエイリアンを倒しきれませんでした。`;
  showMessage(win ? "YOU WIN" : "TIME UP", copy, "PLAY AGAIN");
}

function updateGame(dt) {
  const audioClockRunning = state.audioReady && state.audio?.state === "running";
  let songNow = audioClockRunning ? getSongTime() : state.beat + dt;
  if (audioClockRunning && songNow + 0.05 < state.lastSongTime) {
    state.musicStartAt = state.audio.currentTime - state.beat;
    songNow = state.beat + dt;
  }
  const elapsed = Math.max(0, songNow - state.lastSongTime);
  state.lastSongTime = songNow;
  state.beat = songNow;
  if (state.hitStopTimer > 0) state.hitStopTimer = Math.max(0, state.hitStopTimer - elapsed);
  state.timeLeft -= elapsed;

  if (state.finalWinTimer > 0) {
    state.finalWinTimer -= elapsed;
    if (state.finalWinTimer <= 0) endGame(true);
    syncHud();
    return;
  }

  updateMusic();
  updateRhythmFeed();

  for (const ball of sceneRef.balls) {
    if (!ball.hit && !ball.missed && state.beat > ball.hitTime + HIT_WINDOW) {
      ball.missed = true;
      sceneRef?.kicker.setState("missReact", { force: true });
      sceneRef.kicker.lockedUntilMs = sceneRef.time.now + 320;
      registerMiss();
      popFeedback("MISS", "#92a9bc");
      playMissSfx();
    }
  }

  if (state.alienSwapTimer > 0) {
    state.alienSwapTimer -= elapsed;
    if (state.alienSwapTimer <= 0) nextAlien();
  }

  if (state.timeLeft <= 0) endGame(false);
  syncHud();
}

function getKickerCue() {
  if (state.mode !== "playing" || !sceneRef) return "idle";
  const active = sceneRef.balls
    .filter((ball) => !ball.hit && !ball.missed)
    .map((ball) => {
      const timeToHit = ball.hitTime - state.beat;
      return { ball, timeToHit, diff: Math.abs(timeToHit) };
    })
    .sort((a, b) => a.diff - b.diff)[0];
  if (!active) return "idle";
  if (active.timeToHit <= 0.3 && active.diff <= HIT_WINDOW * 1.4) return "charge";
  if (active.timeToHit <= 0.75) return "aim";
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
  const startTime = ball.hitTime - BALL_LIFE;
  const t = Phaser.Math.Clamp((state.beat - startTime) / BALL_LIFE, 0, 1.25);
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
