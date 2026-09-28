// Is a replayed match still the match that was recorded? (M6, part 1.)
//
// Every tool here reads a hand-played protocol by replaying it, so that a match
// from an older build is read the same way everywhere and the wave lines carry
// the same fields. That only holds while the replay reproduces the recording. It
// stops holding the moment a rule changes: on 28.09.2026 the placement rule for
// rubble was tightened (`88fc725`), and a match played an hour earlier then
// replayed to a defeat at wave 30 where the player had gone on to win at 50.
//
// Nothing caught it. `npm run calibrate` took that defeat as the reference and
// ranked the bots against a match nobody played — the numbers looked ordinary,
// which is the dangerous kind of wrong. So the check lives here, in one place,
// and every tool that uses a replay as a reference runs it first.
//
// The build stamp is the hint, not the test: the test is whether the waves come
// back the same. A protocol from an older build usually replays fine, because
// most matches never touch the rule that changed — only the ones that did come
// apart, so the build alone must not disqualify a protocol.

import { replayMatch, compareWaves } from '../../src/sim/replay.js';
import { APP_VERSION } from '../../src/data/version.js';

/** The fields that decide whether it is the same match. */
const FIELDS = ['lives', 'spawned', 'killed', 'leaked'];

/**
 * Replays a protocol and says whether the result may be used as a reference.
 * @param {object} match  The protocol, as parseProtocol hands it over.
 * @param {string|null} app  The build that recorded it, or null.
 * @returns {{ok: boolean, played: object, diff: Array, why: string|null}}
 */
export function reference(match, app = null) {
  const played = replayMatch(match);
  const diff = compareWaves(match.waves, played.waves, FIELDS);
  if (diff.length === 0) return { ok: true, played, diff, why: null };

  const first = diff[0];
  const stale = app && app !== APP_VERSION;
  return {
    ok: false,
    played,
    diff,
    why:
      `Das Nachspielen ergibt diese Partie nicht mehr: ${match.waves.length} Wellen aufgezeichnet, ` +
      `${played.waves.length} nachgespielt, erste Abweichung Welle ${first.wave} ` +
      `(${first.field} ${first.now} statt ${first.was}). ` +
      (stale
        ? `Aufgezeichnet mit Version ${app}, hier läuft ${APP_VERSION} — sehr wahrscheinlich hat sich eine Regel ` +
          'geändert. Dann ist das Protokoll kein Maßstab mehr und RULESET_VERSION müsste erhöht worden sein.'
        : `Aufgezeichnet mit derselben Version (${app ?? 'unbekannt'}) — dann ist die Simulation nicht ` +
          'deterministisch, und das ist ein Fehler im Spiel, nicht im Protokoll.'),
  };
}
