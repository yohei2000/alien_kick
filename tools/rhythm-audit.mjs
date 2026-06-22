import {
  BALL_LIFE,
  BEAT_SECONDS,
  FIRST_HIT_BEAT,
  PRE_TARGET_LEAD_BEATS,
  RHYTHM_PATTERN_BEATS,
  collectRhythmTimeline,
  rhythmPatterns,
} from "../src/rhythm-data.js";

const EPSILON_SECONDS = 1e-9;
const SAMPLE_NOTES = 32;

const timeline = collectRhythmTimeline({
  fromBeat: FIRST_HIT_BEAT,
  toBeat: FIRST_HIT_BEAT + RHYTHM_PATTERN_BEATS * Math.ceil(SAMPLE_NOTES / rhythmPatterns[0].hits.length + 2),
  limit: SAMPLE_NOTES,
});

const failures = [];

if (timeline.length < SAMPLE_NOTES) {
  failures.push(`Expected ${SAMPLE_NOTES} notes, got ${timeline.length}.`);
}

for (const note of timeline) {
  assertClose(note.targetTickTime, note.hitTime, `target tick matches hit time for ${note.patternName}#${note.rhythmStep}`);
  assertClose(note.spawnTime, note.hitTime - BALL_LIFE, `spawn time is BALL_LIFE before hit for ${note.patternName}#${note.rhythmStep}`);

  for (const leadBeats of PRE_TARGET_LEAD_BEATS) {
    const cue = note.preCueTimes.find((entry) => entry.leadBeats === leadBeats);
    if (!cue) {
      failures.push(`Missing ${leadBeats}-beat pre cue for ${note.patternName}#${note.rhythmStep}.`);
      continue;
    }
    assertClose(cue.cueTime, note.hitTime - leadBeats * BEAT_SECONDS, `${leadBeats}-beat pre cue aligns for ${note.patternName}#${note.rhythmStep}`);
  }
}

for (let i = 1; i < timeline.length; i += 1) {
  const previous = timeline[i - 1];
  const current = timeline[i];
  const expectedCycle = Math.floor((current.hitBeat - FIRST_HIT_BEAT) / RHYTHM_PATTERN_BEATS);
  if (current.cycle !== expectedCycle) {
    failures.push(`Pattern cycle drift at note ${i}: expected ${expectedCycle}, got ${current.cycle}.`);
  }
  if (current.hitTime <= previous.hitTime) {
    failures.push(`Timeline is not strictly increasing at note ${i}.`);
  }
}

if (failures.length > 0) {
  console.error("Rhythm audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      bpm: Math.round((60 / BEAT_SECONDS) * 1000) / 1000,
      noteCount: timeline.length,
      firstHitTime: timeline[0].hitTime,
      lastHitTime: timeline[timeline.length - 1].hitTime,
      checked: ["targetTickTime === hitTime", "spawnTime === hitTime - BALL_LIFE", "pre cues at -1 beat and -0.5 beat", "pattern cycle monotonicity"],
    },
    null,
    2,
  ),
);

function assertClose(actual, expected, label) {
  if (Math.abs(actual - expected) > EPSILON_SECONDS) {
    failures.push(`${label}: expected ${expected}, got ${actual}.`);
  }
}
