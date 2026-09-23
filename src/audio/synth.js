// The synthesiser: turns a recipe from src/data/audio.js into sound.
//
// Nothing is streamed or loaded; every sound is an oscillator or a burst of
// noise with an envelope. One buffer of white noise is made once and reused.

/** Seconds of noise kept around; long enough that repeats are not noticeable. */
const NOISE_SECONDS = 1.5;

let noiseBuffer = null;

/** White noise, made once per audio context. */
function getNoise(ctx) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const frames = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

/** Forgets the cached noise, e.g. when the context is thrown away. */
export function resetSynth() {
  noiseBuffer = null;
}

/**
 * Plays one layer of a sound.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination  Channel gain (effects or music).
 * @param {object} layer  Recipe, see src/data/audio.js.
 * @param {{at?: number, gain?: number, rate?: number}} options
 *   `at` is the context time to start at, `rate` shifts the pitch.
 * @returns {AudioScheduledSourceNode} The source, already started and stopped.
 */
export function playLayer(ctx, destination, layer, { at = ctx.currentTime, gain = 1, rate = 1 } = {}) {
  const seconds = layer.seconds;
  const envelope = ctx.createGain();
  const peak = Math.max(0.0001, (layer.gain ?? 0.3) * gain);
  const attack = Math.min(layer.attack ?? 0.005, seconds * 0.5);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.linearRampToValueAtTime(peak, at + attack);
  // Exponential decay to (almost) nothing: that is how impacts fade.
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);

  // source -> envelope -> [filter] -> channel
  if (layer.filter) {
    const [type, frequency, q] = layer.filter;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, at);
    filter.Q.setValueAtTime(q ?? 1, at);
    envelope.connect(filter);
    filter.connect(destination);
  } else {
    envelope.connect(destination);
  }

  let source;
  if (layer.kind === 'noise') {
    source = ctx.createBufferSource();
    source.buffer = getNoise(ctx);
    source.playbackRate.setValueAtTime(rate, at);
    // Start somewhere inside the buffer, so repeated hits do not sound identical.
    const offset = Math.random() * Math.max(0, NOISE_SECONDS - seconds - 0.05);
    source.connect(envelope);
    source.start(at, Math.max(0, offset), seconds + 0.05);
  } else {
    source = ctx.createOscillator();
    source.type = layer.wave ?? 'sine';
    const from = (layer.from ?? 440) * rate;
    const to = (layer.to ?? from) * rate;
    source.frequency.setValueAtTime(from, at);
    if (to !== from) {
      if (layer.sweep === 'exp') source.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + seconds);
      else source.frequency.linearRampToValueAtTime(Math.max(1, to), at + seconds);
    }
    source.connect(envelope);
    source.start(at);
    source.stop(at + seconds + 0.02);
  }
  return source;
}

/**
 * Plays every layer of a sound.
 * @returns {number} How many voices it used.
 */
export function playSound(ctx, destination, sound, options = {}) {
  const layers = sound.layers ?? [sound];
  for (const layer of layers) playLayer(ctx, destination, layer, options);
  return layers.length;
}
