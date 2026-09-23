// Sound for the game: a mixer with three volumes, a small scheduler for the
// music, and the table that turns simulation events into sounds.
//
// Everything is synthesised (src/audio/synth.js, recipes in src/data/audio.js).
// The audio context is only created after the first interaction, because Safari
// refuses to start one before that.

import { SOUNDS, MUSIC, MAX_VOICES } from '../data/audio.js';
import { playSound, playLayer, resetSynth } from './synth.js';

/** Which event becomes which sound. Events without an entry stay silent. */
const EVENT_SOUNDS = {
  shot: 'shot',
  beam: 'beam',
  chain: 'chain',
  launch: 'launch',
  explosion: 'explosion',
  leak: 'leak',
  podImpact: 'podImpact',
  towerBuilt: 'towerBuilt',
  waveStart: 'waveStart',
  waveCleared: 'waveCleared',
  command: 'command',
  stasis: 'command',
};

/**
 * @param {ReturnType<import('../core/prefs.js').createPrefs>} prefs
 */
export function createAudio(prefs) {
  /** @type {AudioContext|null} */
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let unlocked = false;
  let muted = false;

  /** Voices sounding right now, so a busy wave cannot drown itself. */
  let voices = 0;
  /** When each sound was last played, for its own throttle. */
  const lastPlayed = new Map();
  /** Music scheduling: the next bar and when we last looked ahead. */
  let nextBar = 0;
  let bars = 0;
  let sinceTick = 0;
  let pads = [];
  let intensity = 'calm';

  function applyVolumes() {
    if (!ctx) return;
    const v = prefs.values;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : v.master, now, 0.02);
    sfxGain.gain.setTargetAtTime(v.sfx, now, 0.02);
    musicGain.gain.setTargetAtTime(v.music * (intensity === 'wave' ? MUSIC.waveGain : MUSIC.calmGain), now, 0.4);
  }

  /** Starts the drone: three detuned oscillators through one filter. */
  function startPads() {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.Q.setValueAtTime(0.7, ctx.currentTime);
    filter.connect(musicGain);
    pads = MUSIC.intervals.map((interval, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(MUSIC.root * interval, ctx.currentTime);
      // A slow detune keeps the drone from sounding like a test tone.
      osc.detune.setValueAtTime((i - 1) * 6, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(i === 0 ? 0.5 : 0.22, ctx.currentTime);
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      return osc;
    });
  }

  /** Queues drum and bell hits a little ahead of the clock. */
  function scheduleMusic(dt) {
    if (!ctx) return;
    sinceTick += dt;
    if (sinceTick < MUSIC.tickSeconds) return;
    sinceTick = 0;
    const until = ctx.currentTime + MUSIC.lookaheadSeconds;
    if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.1;
    while (nextBar < until) {
      if (intensity === 'wave') playLayer(ctx, musicGain, MUSIC.drum, { at: nextBar, gain: 1 });
      if (bars % MUSIC.bellEveryBars === 0) {
        playLayer(ctx, musicGain, MUSIC.bell, { at: nextBar, rate: intensity === 'wave' ? 1 : 1.5 });
      }
      bars += 1;
      nextBar += MUSIC.bar;
    }
  }

  function ensureContext() {
    if (ctx) return true;
    const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    sfxGain = ctx.createGain();
    musicGain = ctx.createGain();
    sfxGain.connect(master);
    musicGain.connect(master);
    master.connect(ctx.destination);
    applyVolumes();
    startPads();
    return true;
  }

  const api = {
    /** True once sound is actually running. */
    get ready() {
      return unlocked && ctx !== null;
    },

    get muted() {
      return muted;
    },

    /**
     * Starts audio after a real interaction (Safari). Safe to call again.
     * @returns {Promise<boolean>}
     */
    async unlock() {
      if (unlocked) return true;
      if (!ensureContext()) return false;
      try {
        await ctx.resume();
      } catch {
        // Some browsers reject resume() outside a gesture; the next try wins.
        return false;
      }
      unlocked = ctx.state === 'running';
      return unlocked;
    },

    setMuted(value) {
      muted = value;
      applyVolumes();
    },

    /** Plays a sound by name, ignoring anything unknown. */
    play(name, { gain = 1, rate = 1 } = {}) {
      if (!api.ready) return;
      const sound = SOUNDS[name];
      if (!sound) return;
      const now = ctx.currentTime;
      if (sound.throttle && now - (lastPlayed.get(name) ?? -1) < sound.throttle) return;
      if (voices >= MAX_VOICES) return;
      lastPlayed.set(name, now);
      const used = playSound(ctx, sfxGain, sound, { gain, rate, at: now });
      voices += used;
      // The voices are gone once their envelope has run out.
      const seconds = Math.max(...(sound.layers ?? [sound]).map((l) => l.seconds));
      setTimeout(() => {
        voices = Math.max(0, voices - used);
      }, (seconds + 0.1) * 1000);
    },

    /**
     * Turns one frame of simulation events into sound and keeps the music going.
     * Must run before the events are drained.
     */
    update(dt, state) {
      if (!api.ready) return;
      for (const event of state.events) {
        if (event.type === 'kill') {
          api.play(event.boss ? 'bossKill' : 'kill');
        } else if (event.type === 'phase') {
          if (event.phase === 'defeat') api.play('defeat');
          else if (event.phase === 'victory') api.play('victory');
        } else {
          const name = EVENT_SOUNDS[event.type];
          if (name) api.play(name);
        }
      }
      // Flame throwers have no shot event; they burn while they are firing.
      if (state.towers.some((t) => t.firing)) api.play('flame');

      const wanted = state.phase === 'wave' ? 'wave' : 'calm';
      if (wanted !== intensity) {
        intensity = wanted;
        applyVolumes();
      }
      scheduleMusic(dt);
    },

    /** Called when a setting changed. */
    refresh() {
      applyVolumes();
    },

    /** Frees everything; only used when the page goes away or in tests. */
    async close() {
      if (!ctx) return;
      for (const osc of pads) osc.stop();
      pads = [];
      await ctx.close();
      ctx = null;
      unlocked = false;
      resetSynth();
    },
  };

  prefs.onChange(() => applyVolumes());
  return api;
}
