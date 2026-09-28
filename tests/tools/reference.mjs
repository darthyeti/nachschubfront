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
import { RULESET_VERSION } from '../../src/data/rules.js';

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
  return {
    ok: false,
    played,
    diff,
    why:
      `Das Nachspielen ergibt diese Partie nicht mehr: ${match.waves.length} Wellen aufgezeichnet, ` +
      `${played.waves.length} nachgespielt, erste Abweichung Welle ${first.wave} ` +
      `(${first.field} ${first.now} statt ${first.was}). ` +
      explain(match, app),
  };
}

/**
 * Why it came apart. Three cases, and they are not equally bad:
 *
 * - **Another rule version.** Said so outright at the recording, so there is
 *   nothing to suspect: the protocol belongs to rules that no longer apply.
 * - **Another build, same rule version.** Either a rule changed without the
 *   version being raised, or something outside the rules moved. Both are worth
 *   looking at, and the version is the thing to fix first.
 * - **Same build.** Then the simulation is not reproducible, which is a broken
 *   promise of the architecture (CLAUDE.md, principle 2) and a fault in the
 *   game — never the protocol's doing.
 */
function explain(match, app) {
  if (match.ruleset !== undefined && match.ruleset !== RULESET_VERSION) {
    return (
      `Gespielt unter Regelversion ${match.ruleset}, hier gilt ${RULESET_VERSION}: Das Protokoll gehört zu ` +
      'Regeln, die nicht mehr gelten, und ist kein Maßstab für die heutigen Zahlen.'
    );
  }
  if (app && app !== APP_VERSION) {
    return (
      `Regelversion ${match.ruleset} wie hier, aber aufgezeichnet mit Version ${app} statt ${APP_VERSION}: ` +
      'Dann hat sich eine Regel geändert, ohne dass RULESET_VERSION erhöht wurde — das gehört nachgetragen.'
    );
  }
  return (
    `Dieselbe Version (${app ?? 'unbekannt'}) und dieselbe Regelversion (${match.ruleset}): Dann läuft die ` +
    'Simulation nicht deterministisch, und das ist ein Fehler im Spiel, nicht im Protokoll.'
  );
}
