export const MUSIC_BPM = 126;
export const BEAT_SECONDS = 60 / MUSIC_BPM;
export const BALL_LIFE_BEATS = 2.5;
export const BALL_LIFE = BEAT_SECONDS * BALL_LIFE_BEATS;
export const HIT_WINDOW = 0.2;
export const PERFECT_WINDOW = 0.085;
export const GOOD_WINDOW = 0.14;
export const CALIBRATED_INPUT_OFFSET_SECONDS = 0.02;
export const MUSIC_STEP_SECONDS = BEAT_SECONDS / 4;
export const NOTE_HIGHWAY_PREVIEW_SECONDS = BEAT_SECONDS * 4;
export const RHYTHM_PATTERN_BEATS = 8;
export const FIRST_HIT_BEAT = 4;
export const PRE_TARGET_LEAD_BEATS = [1, 0.5];

export const rhythmPatterns = [
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

export function beatToSeconds(beat) {
  return beat * BEAT_SECONDS;
}

export function secondsToBeat(seconds) {
  return seconds / BEAT_SECONDS;
}

export function makeRhythmCue({ patternIndex, rhythmStep, patternStartBeat }) {
  const pattern = rhythmPatterns[patternIndex % rhythmPatterns.length];
  const hit = pattern.hits[rhythmStep % pattern.hits.length];
  const hitBeat = patternStartBeat + hit.beat;
  return makeTimelineHit({
    hit,
    pattern,
    patternIndex: patternIndex % rhythmPatterns.length,
    rhythmStep: rhythmStep % pattern.hits.length,
    cycle: Math.floor((hitBeat - FIRST_HIT_BEAT) / RHYTHM_PATTERN_BEATS),
    hitBeat,
  });
}

export function getRhythmHitAtMusicBeat(musicBeat, leadBeats = 0, tolerance = 0.001) {
  const targetBeat = musicBeat + leadBeats;
  if (targetBeat < FIRST_HIT_BEAT - tolerance) return null;
  const cycle = Math.floor((targetBeat - FIRST_HIT_BEAT + tolerance * 0.1) / RHYTHM_PATTERN_BEATS);
  const localBeat = targetBeat - FIRST_HIT_BEAT - cycle * RHYTHM_PATTERN_BEATS;
  const patternIndex = cycle % rhythmPatterns.length;
  const pattern = rhythmPatterns[patternIndex];
  const rhythmStep = pattern.hits.findIndex((entry) => Math.abs(entry.beat - localBeat) <= tolerance);
  if (rhythmStep < 0) return null;
  return makeTimelineHit({
    hit: pattern.hits[rhythmStep],
    pattern,
    patternIndex,
    rhythmStep,
    cycle,
    hitBeat: targetBeat,
    leadBeats,
  });
}

export function collectRhythmTimeline({ fromBeat = FIRST_HIT_BEAT, toBeat = FIRST_HIT_BEAT + RHYTHM_PATTERN_BEATS, limit = Infinity } = {}) {
  const notes = [];
  const firstCycle = Math.max(0, Math.floor((fromBeat - FIRST_HIT_BEAT - 0.001) / RHYTHM_PATTERN_BEATS));
  const lastCycle = Math.max(firstCycle, Math.ceil((toBeat - FIRST_HIT_BEAT) / RHYTHM_PATTERN_BEATS) + 1);

  for (let cycle = firstCycle; cycle <= lastCycle && notes.length < limit; cycle += 1) {
    const patternIndex = cycle % rhythmPatterns.length;
    const pattern = rhythmPatterns[patternIndex];
    for (let rhythmStep = 0; rhythmStep < pattern.hits.length && notes.length < limit; rhythmStep += 1) {
      const hit = pattern.hits[rhythmStep];
      const hitBeat = FIRST_HIT_BEAT + cycle * RHYTHM_PATTERN_BEATS + hit.beat;
      if (hitBeat < fromBeat - 0.001 || hitBeat > toBeat + 0.001) continue;
      notes.push(makeTimelineHit({ hit, pattern, patternIndex, rhythmStep, cycle, hitBeat }));
    }
  }

  return notes.sort((a, b) => a.hitTime - b.hitTime);
}

function makeTimelineHit({ hit, pattern, patternIndex, rhythmStep, cycle, hitBeat, leadBeats = 0 }) {
  const hitTime = beatToSeconds(hitBeat);
  return {
    ...hit,
    patternName: pattern.name,
    patternIndex,
    rhythmStep,
    cycle,
    leadBeats,
    hitBeat,
    hitTime,
    spawnTime: hitTime - BALL_LIFE,
    targetTickTime: hitTime,
    preCueTimes: PRE_TARGET_LEAD_BEATS.map((leadBeat) => ({
      leadBeats: leadBeat,
      cueTime: beatToSeconds(hitBeat - leadBeat),
    })),
  };
}
