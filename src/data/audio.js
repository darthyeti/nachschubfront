// Every sound in the game, as a recipe for the synthesiser in src/audio/.
//
// Nothing is loaded from a file: the sounds are built from oscillators and
// noise at runtime (decision M4). That keeps the repository small, works
// offline and avoids licence questions.
//
// A recipe is read like this:
//   kind    'tone' (an oscillator) or 'noise' (filtered noise)
//   wave    oscillator shape for tones
//   from/to frequency in Hz at the start and at the end of the sound
//   seconds  how long it takes
//   attack   seconds to full volume; the rest is the decay
//   gain     0 to 1, before the channel and master volume
//   filter   ['lowpass'|'highpass'|'bandpass', Hz, Q] for noise and tones
//   sweep    'exp' bends the pitch fall like a real impact, 'linear' is plain
//   layers   sounds played together, e.g. a click over a boom

export const SOUNDS = {
  // ---- weapons ----
  shot: {
    layers: [
      { kind: 'noise', seconds: 0.09, attack: 0.001, gain: 0.5, filter: ['bandpass', 1800, 1.2] },
      { kind: 'tone', wave: 'square', from: 320, to: 90, seconds: 0.07, attack: 0.001, gain: 0.25, sweep: 'exp' },
    ],
    throttle: 0.05,
  },
  beam: {
    layers: [
      { kind: 'tone', wave: 'sawtooth', from: 1400, to: 520, seconds: 0.16, attack: 0.004, gain: 0.22, sweep: 'exp' },
      { kind: 'noise', seconds: 0.12, attack: 0.002, gain: 0.16, filter: ['highpass', 2200, 0.7] },
    ],
    throttle: 0.07,
  },
  chain: {
    layers: [
      { kind: 'noise', seconds: 0.22, attack: 0.002, gain: 0.34, filter: ['bandpass', 3200, 6] },
      { kind: 'noise', seconds: 0.14, attack: 0.001, gain: 0.2, filter: ['highpass', 5000, 0.8] },
    ],
    throttle: 0.08,
  },
  launch: {
    layers: [
      { kind: 'tone', wave: 'sine', from: 180, to: 60, seconds: 0.22, attack: 0.004, gain: 0.5, sweep: 'exp' },
      { kind: 'noise', seconds: 0.2, attack: 0.002, gain: 0.3, filter: ['lowpass', 900, 0.8] },
    ],
    throttle: 0.09,
  },
  flame: {
    // A loop would be better, but a short breath every few frames carries it.
    layers: [{ kind: 'noise', seconds: 0.3, attack: 0.05, gain: 0.16, filter: ['bandpass', 700, 0.9] }],
    throttle: 0.22,
  },

  // ---- impacts ----
  explosion: {
    layers: [
      { kind: 'noise', seconds: 0.7, attack: 0.002, gain: 0.7, filter: ['lowpass', 1200, 0.9] },
      { kind: 'tone', wave: 'sine', from: 140, to: 40, seconds: 0.5, attack: 0.002, gain: 0.55, sweep: 'exp' },
    ],
    throttle: 0.06,
  },
  kill: {
    layers: [{ kind: 'noise', seconds: 0.16, attack: 0.002, gain: 0.22, filter: ['bandpass', 900, 1.6] }],
    throttle: 0.05,
  },
  bossKill: {
    layers: [
      { kind: 'noise', seconds: 1.1, attack: 0.004, gain: 0.7, filter: ['lowpass', 700, 0.8] },
      { kind: 'tone', wave: 'sawtooth', from: 190, to: 38, seconds: 0.9, attack: 0.004, gain: 0.5, sweep: 'exp' },
    ],
  },
  leak: {
    layers: [
      { kind: 'tone', wave: 'sawtooth', from: 220, to: 150, seconds: 0.45, attack: 0.01, gain: 0.4, sweep: 'linear' },
      { kind: 'tone', wave: 'square', from: 110, to: 74, seconds: 0.5, attack: 0.02, gain: 0.22, sweep: 'linear' },
    ],
  },

  // ---- supply ----
  podWarn: {
    layers: [{ kind: 'tone', wave: 'square', from: 880, to: 880, seconds: 0.09, attack: 0.004, gain: 0.16 }],
    throttle: 0.05,
  },
  podImpact: {
    layers: [
      { kind: 'noise', seconds: 1.2, attack: 0.002, gain: 0.85, filter: ['lowpass', 900, 0.9] },
      { kind: 'tone', wave: 'sine', from: 110, to: 30, seconds: 0.9, attack: 0.002, gain: 0.7, sweep: 'exp' },
      { kind: 'tone', wave: 'triangle', from: 1400, to: 900, seconds: 0.5, attack: 0.001, gain: 0.12, sweep: 'exp' },
    ],
    throttle: 0.04,
  },
  hatch: {
    layers: [
      { kind: 'noise', seconds: 0.18, attack: 0.001, gain: 0.35, filter: ['bandpass', 2600, 2.4] },
      { kind: 'tone', wave: 'square', from: 260, to: 120, seconds: 0.12, attack: 0.001, gain: 0.14, sweep: 'exp' },
    ],
    throttle: 0.04,
  },
  towerBuilt: {
    layers: [
      { kind: 'tone', wave: 'triangle', from: 392, to: 392, seconds: 0.18, attack: 0.008, gain: 0.3 },
      { kind: 'tone', wave: 'triangle', from: 587, to: 587, seconds: 0.35, attack: 0.02, gain: 0.26 },
    ],
  },

  // ---- match ----
  waveStart: {
    layers: [
      { kind: 'tone', wave: 'sawtooth', from: 98, to: 98, seconds: 1.2, attack: 0.08, gain: 0.34, filter: ['lowpass', 900, 0.8] },
      { kind: 'tone', wave: 'sawtooth', from: 147, to: 147, seconds: 1.1, attack: 0.12, gain: 0.22, filter: ['lowpass', 900, 0.8] },
    ],
  },
  waveCleared: {
    layers: [
      { kind: 'tone', wave: 'triangle', from: 523, to: 523, seconds: 0.5, attack: 0.01, gain: 0.3 },
      { kind: 'tone', wave: 'triangle', from: 784, to: 784, seconds: 0.7, attack: 0.06, gain: 0.24 },
    ],
  },
  command: {
    layers: [
      { kind: 'noise', seconds: 0.6, attack: 0.08, gain: 0.32, filter: ['highpass', 1400, 0.7] },
      { kind: 'tone', wave: 'sine', from: 420, to: 1200, seconds: 0.5, attack: 0.04, gain: 0.2, sweep: 'exp' },
    ],
  },
  victory: {
    layers: [
      { kind: 'tone', wave: 'triangle', from: 392, to: 392, seconds: 1.4, attack: 0.05, gain: 0.32 },
      { kind: 'tone', wave: 'triangle', from: 523, to: 523, seconds: 1.6, attack: 0.25, gain: 0.3 },
      { kind: 'tone', wave: 'triangle', from: 659, to: 659, seconds: 1.8, attack: 0.45, gain: 0.28 },
    ],
  },
  defeat: {
    layers: [
      { kind: 'tone', wave: 'sawtooth', from: 147, to: 69, seconds: 2.2, attack: 0.06, gain: 0.4, sweep: 'exp', filter: ['lowpass', 700, 0.9] },
      { kind: 'noise', seconds: 1.8, attack: 0.3, gain: 0.22, filter: ['lowpass', 500, 0.8] },
    ],
  },

  // ---- interface ----
  click: {
    layers: [{ kind: 'tone', wave: 'square', from: 520, to: 320, seconds: 0.05, attack: 0.001, gain: 0.12, sweep: 'exp' }],
    throttle: 0.03,
  },
  deny: {
    layers: [{ kind: 'tone', wave: 'square', from: 180, to: 120, seconds: 0.16, attack: 0.004, gain: 0.18, sweep: 'linear' }],
    throttle: 0.1,
  },
};

/**
 * The music: a slow drone that turns grim while a wave runs. Everything is
 * scheduled a little ahead of time, so the browser can sleep in between.
 */
export const MUSIC = {
  /** Root note of the drone in Hz (low G). */
  root: 49,
  /** Fifth and octave above it, mixed in quietly. */
  intervals: [1, 1.5, 2.005],
  /** Seconds per bar; the drum sits on the bar line. */
  bar: 2.4,
  /** How far ahead events are queued, and how often that is checked. */
  lookaheadSeconds: 1.2,
  tickSeconds: 0.35,
  /** Volume of the pad while planning and while a wave runs. */
  calmGain: 0.1,
  waveGain: 0.16,
  /** Drum hit on every bar while a wave runs. */
  drum: { kind: 'noise', seconds: 0.5, attack: 0.002, gain: 0.5, filter: ['lowpass', 220, 1.2] },
  /** A bell every this many bars, so the loop does not feel like a machine. */
  bellEveryBars: 4,
  bell: { kind: 'tone', wave: 'triangle', from: 294, to: 294, seconds: 2.6, attack: 0.4, gain: 0.12 },
};

/** Most voices that may sound at once; anything over that is dropped. */
export const MAX_VOICES = 18;
