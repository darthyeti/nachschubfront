import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUNDS, MUSIC, MAX_VOICES } from '../../src/data/audio.js';
import { soundForEvent } from '../../src/audio/index.js';

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
  for (const name of ['shot', 'beam', 'chain', 'rocket', 'rocketHeavy', 'explosion', 'kill', 'click']) {
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

test('a launch from the rocket tower is the heavy rocket, any other launch the light one', () => {
  const state = {
    towers: [
      { id: 1, doctrine: 'mortar', special: null },
      { id: 2, doctrine: 'mortar', special: 'siegeMortar' },
      { id: 3, doctrine: 'autocannon', special: 'stormBattery' },
    ],
  };
  assert.equal(soundForEvent({ type: 'launch', towerId: 2 }, state), 'rocketHeavy');
  assert.equal(soundForEvent({ type: 'launch', towerId: 1 }, state), 'rocket');
  assert.equal(soundForEvent({ type: 'launch', towerId: 3 }, state), 'rocket');
  // A tower that is already gone falls back to the light sound.
  assert.equal(soundForEvent({ type: 'launch', towerId: 99 }, state), 'rocket');
  assert.equal(soundForEvent({ type: 'shot', towerId: 1 }, state), 'shot');
  assert.equal(soundForEvent({ type: 'explosion' }, state), 'explosion');
  assert.ok(SOUNDS.rocket && SOUNDS.rocketHeavy);
  assert.ok(SOUNDS.rocketHeavy.throttle > SOUNDS.rocket.throttle);
});

test('rocket voice caps leave room for the rest of the mix', () => {
  for (const name of ['rocket', 'rocketHeavy']) {
    const cap = SOUNDS[name].voiceCap;
    assert.ok(cap >= SOUNDS[name].layers.length && cap <= MAX_VOICES / 2, name);
  }
});
