import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, MUSIC, MAX_VOICES } from '../../src/data/audio.js';

const layersOf = (sound) => sound.layers ?? [sound];

test('every sound is a playable recipe', () => {
  for (const [name, sound] of Object.entries(SOUNDS)) {
    const layers = layersOf(sound);
    assert.ok(layers.length > 0, name);
    for (const layer of layers) {
      assert.ok(['tone', 'noise'].includes(layer.kind), `${name}: kind`);
      assert.ok(layer.seconds > 0 && layer.seconds <= 3, `${name}: seconds`);
      assert.ok(layer.gain > 0 && layer.gain <= 1, `${name}: gain`);
      assert.ok((layer.attack ?? 0) >= 0 && (layer.attack ?? 0) < layer.seconds, `${name}: attack`);
      if (layer.kind === 'tone') assert.ok(layer.from > 0, `${name}: pitch`);
      // An exponential sweep can never reach zero.
      if (layer.sweep === 'exp') assert.ok((layer.to ?? layer.from) > 0, `${name}: sweep target`);
      if (layer.filter) {
        assert.ok(['lowpass', 'highpass', 'bandpass'].includes(layer.filter[0]), `${name}: filter type`);
        assert.ok(layer.filter[1] > 0, `${name}: filter frequency`);
      }
    }
  }
});

test('the sounds that fire often have a throttle', () => {
  for (const name of ['shot', 'beam', 'chain', 'launch', 'explosion', 'kill', 'click']) {
    assert.ok(SOUNDS[name].throttle > 0, name);
  }
});

test('the music loop has sensible timings', () => {
  assert.ok(MUSIC.bar > 0.5 && MUSIC.bar < 8);
  assert.ok(MUSIC.lookaheadSeconds > MUSIC.tickSeconds, 'queue further ahead than the check interval');
  assert.ok(MUSIC.waveGain > MUSIC.calmGain, 'a running wave is louder than planning');
  assert.ok(MUSIC.intervals.includes(1), 'the root note is part of the drone');
  assert.ok(MAX_VOICES >= 8);
});
