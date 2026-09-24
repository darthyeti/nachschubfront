// The records screen: best runs, lifetime statistics, and moving the profile
// from one device to another.
//
// It fills a panel that menu.js owns, so the overlay, the focus handling and the
// tap-beside-to-close behaviour stay in one place. Everything here reads the
// profile store and writes it only through replace() and reset().

import { STRINGS } from '../data/strings.js';
import { RULESET_VERSION } from '../data/rules.js';
import { bestList, favouriteDoctrine, exportProfile, parseImport, summarize } from '../storage/profile.js';

const T = STRINGS.records;

/** Rows in the table. The profile keeps more; this is what fits on a screen. */
const SHOWN = 10;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', (ev) => {
    onClick(ev);
    b.blur();
  });
  return b;
}

/** Date as the player writes it, or an empty cell when the file did not say. */
function shortDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function fileName(now = new Date()) {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `nachschubfront-profil-${iso}.json`;
}

/**
 * @param {HTMLElement} panel  The panel of the records overlay.
 * @param {object} options
 * @param {ReturnType<import('../storage/profile.js').createProfileStore>} options.profile
 * @param {(seed: string) => void} options.onSeed   Carries a seed to the main menu.
 * @param {() => void} options.onBack
 * @param {boolean} options.canStore
 */
export function createRecordsScreen(panel, { profile, onSeed, onBack, canStore = true }) {
  panel.append(el('h2', 'menu-title', T.title));
  panel.append(el('p', 'menu-subtitle', T.intro));
  if (!canStore) panel.append(el('p', 'menu-warning', T.storageWarning));
  const locked = el('p', 'menu-warning', T.lockedWarning);
  locked.hidden = true;
  panel.append(locked);

  // ---------- Best runs ----------
  const table = el('table', 'records-table');
  const head = el('tr');
  for (const [label, cls] of [
    [T.rank, 'num'],
    [T.seed, 'seed'],
    [T.wave, 'num'],
    [T.score, 'num'],
    [T.runs, 'num'],
  ]) {
    head.append(el('th', cls, label));
  }
  const thead = el('thead');
  thead.append(head);
  table.append(thead);
  const tbody = el('tbody');
  table.append(tbody);
  const empty = el('p', 'menu-hint', T.empty);
  const older = el('p', 'menu-hint');
  panel.append(table, empty, older);

  // ---------- Statistics ----------
  panel.append(el('h3', 'menu-section', T.stats));
  const statList = el('dl', 'menu-score');
  panel.append(statList);

  // ---------- Transfer ----------
  panel.append(el('h3', 'menu-section', T.transfer));
  const transfer = el('div', 'records-actions');
  const exportButton = button(T.export, 'alt', doExport);
  const copyButton = button(T.copy, 'alt', doCopy);
  const fileButton = button(T.importFile, 'alt', () => fileInput.click());
  transfer.append(exportButton, copyButton, fileButton);
  panel.append(transfer, el('p', 'menu-hint', T.exportHint));

  // A file picker is the comfortable way; iPadOS does not always hand over a
  // file from another app, so the paste box below is the one that always works.
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json,text/plain';
  fileInput.hidden = true;
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      check(await file.text());
    } catch {
      fail(T.errors.read);
    }
  });
  panel.append(fileInput);

  panel.append(el('p', 'menu-hint records-paste-label', T.importPaste));
  const paste = el('textarea', 'records-paste');
  paste.rows = 3;
  paste.spellcheck = false;
  paste.placeholder = T.importPastePlaceholder;
  paste.setAttribute('aria-label', T.importPaste);
  panel.append(paste);

  const pasteActions = el('div', 'records-actions');
  pasteActions.append(button(T.importCheck, 'alt', () => check(paste.value)), button(T.reset, 'alt', askReset));
  panel.append(pasteActions);

  // ---------- Confirmation block ----------
  // Replacing and clearing both run through here: nothing is written before the
  // player has seen what goes and confirmed it.
  const confirm = el('div', 'records-confirm');
  confirm.hidden = true;
  const confirmTitle = el('h3', 'menu-section');
  const confirmText = el('p', 'menu-hint');
  const confirmCompare = el('dl', 'menu-score');
  const confirmActions = el('div', 'records-actions');
  const confirmOk = button('', 'primary', () => {});
  confirmActions.append(confirmOk, button(T.cancel, 'alt', hideConfirm));
  confirm.append(confirmTitle, confirmText, confirmCompare, confirmActions);
  panel.append(confirm);

  const status = el('p', 'records-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  panel.append(status);

  const actions = el('div', 'menu-actions');
  actions.append(button(STRINGS.menu.back, 'primary menu-primary', onBack));
  panel.append(actions);

  // ---------- Behaviour ----------

  function say(text, kind = 'ok') {
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function fail(text) {
    say(text, 'error');
  }

  function hideConfirm() {
    confirm.hidden = true;
    say('');
  }

  function showConfirm({ title, text, compare, okLabel, onOk }) {
    confirmTitle.textContent = title;
    confirmText.textContent = text;
    confirmCompare.replaceChildren();
    for (const [label, value] of compare) {
      confirmCompare.append(el('dt', null, label), el('dd', null, value));
    }
    confirmOk.textContent = okLabel;
    confirmOk.onclick = () => {
      onOk();
      confirmOk.blur();
    };
    confirm.hidden = false;
    say('');
    confirmOk.focus();
  }

  function doExport() {
    const text = JSON.stringify(exportProfile(profile.values), null, 2);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = fileName();
    a.click();
    // Safari needs the URL a moment longer than the click.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(fileName());
  }

  async function doCopy() {
    const text = JSON.stringify(exportProfile(profile.values));
    try {
      await navigator.clipboard.writeText(text);
      say(T.copied);
    } catch {
      fail(T.copyFailed);
    }
  }

  /** Checks a candidate and, if it holds up, asks before replacing. */
  function check(text) {
    if (!text || !text.trim()) return fail(T.errors.parse);
    const result = parseImport(text.trim());
    if (!result.ok) return fail(T.errors[result.error] ?? T.errors.parse);
    showConfirm({
      title: T.replaceTitle,
      text: T.replaceIntro,
      compare: [
        [T.replaceHere, T.replaceSummary(summarize(profile.values))],
        [T.replaceFile, T.replaceSummary(result.summary)],
      ],
      okLabel: T.replaceConfirm,
      onOk() {
        profile.replace(result.profile);
        paste.value = '';
        confirm.hidden = true;
        refresh();
        say(T.replaceDone);
      },
    });
  }

  function askReset() {
    showConfirm({
      title: T.reset,
      text: T.resetConfirm,
      compare: [[T.replaceHere, T.replaceSummary(summarize(profile.values))]],
      okLabel: T.reset,
      onOk() {
        profile.reset();
        confirm.hidden = true;
        refresh();
        say(T.resetDone);
      },
    });
  }

  /** Counts runs recorded under any other ruleset version. */
  function olderRuns(p) {
    let n = 0;
    for (const [key, list] of Object.entries(p.best)) {
      if (Number(key) !== RULESET_VERSION) n += list.length;
    }
    return n;
  }

  function fillTable(list) {
    tbody.replaceChildren();
    list.slice(0, SHOWN).forEach((entry, i) => {
      const row = el('tr');
      row.append(el('td', 'num', String(i + 1)));

      // The seed is the one interactive cell: it carries over to the main menu.
      const seedCell = el('td', 'seed');
      const pick = button(entry.seed, 'records-seed', () => onSeed(entry.seed));
      pick.title = T.seedTitle(entry.seed);
      seedCell.append(pick);
      if (entry.victory) {
        const star = el('span', 'records-victory', T.victoryMark);
        star.title = T.victoryTitle;
        seedCell.append(star);
      }
      const date = shortDate(entry.date);
      if (date) seedCell.append(el('span', 'records-date', date));
      row.append(seedCell);

      row.append(el('td', 'num', String(entry.wave)));
      row.append(el('td', 'num', String(entry.score)));
      row.append(el('td', 'num', String(entry.runs)));
      tbody.append(row);
    });
  }

  function fillStats(stats) {
    const favourite = favouriteDoctrine(stats);
    statList.replaceChildren();
    for (const [label, value] of [
      [T.matches, String(stats.matches)],
      [T.victories, String(stats.victories)],
      [T.kills, String(stats.kills)],
      [T.bestWave, stats.bestWave > 0 ? String(stats.bestWave) : T.none],
      [T.playtime, stats.seconds > 0 ? T.duration(stats.seconds) : T.none],
      [T.favourite, favourite ? STRINGS.doctrines[favourite] : T.none],
    ]) {
      statList.append(el('dt', null, label), el('dd', null, value));
    }
  }

  /** Redraws everything from the current profile. Called whenever it is shown. */
  function refresh() {
    const p = profile.values;
    const list = bestList(p);
    fillTable(list);
    table.hidden = list.length === 0;
    empty.hidden = list.length > 0;
    const old = olderRuns(p);
    older.textContent = old > 0 ? T.olderRules(old) : '';
    older.hidden = old === 0;
    fillStats(p.stats);
    locked.hidden = !profile.locked;
    // A profile with nothing in it has nothing to hand on.
    const bare = summarize(p).runs === 0;
    exportButton.disabled = bare;
    copyButton.disabled = bare;
  }

  profile.onChange(refresh);
  refresh();

  return {
    /** Called by menu.js every time the screen opens. */
    refresh() {
      hideConfirm();
      refresh();
    },
  };
}
