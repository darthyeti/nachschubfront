// All player-visible texts. German only; nothing visible is hard-coded elsewhere.

export const STRINGS = {
  gameTitle: 'Nachschubfront',
  documentTitle: 'Nachschubfront',
  canvasLabel: 'Spielfeld von Nachschubfront',
  /** Corner label; the number itself comes from data/version.js. */
  version: (v) => `v${v}`,

  /** The "?" help overlay: one speech bubble per HUD symbol, [title, text]. */
  help: {
    open: 'Hilfe: Symbole erklären',
    close: 'Hilfe schließen',
    dismiss: 'Tippen zum Schließen',
    wave: ['Welle', 'Aktuelle Welle und wie viele es insgesamt sind.'],
    lives: ['Leben', 'Jeder Durchbruch kostet Leben, Bosse und der Koloss mehr als normale Gegner. Bei 0 ist die Partie verloren.'],
    supply: ['Nachschubstufe', 'Je höher, desto bessere Ränge bringen neue Kapseln.'],
    requisition: ['Requisition', 'Deine Währung. Gibt es für Abschüsse und als Bonus nach jeder Welle.'],
    points: (fromWave) => ['Kommandopunkte', `Für Spezialkommandos ab Welle ${fromWave}. Gibt es für Bosse und Wellen ohne Durchbruch.`],
    route: ['Routenlänge', 'So viele Felder laufen die Gegner. Ein Strich heißt: Weg blockiert.'],
    codex: ['Rezepte', 'Zeigt, welche Stellungen sich verschmelzen lassen.'],
    menu: ['Menü', 'Pause, Einstellungen, Bestenliste und Neue Partie.'],
    supplyDisc: ['Nachschub', 'Baut die Nachschubstufe aus. Kostet Requisition.'],
    demolishDisc: ['Abreißen', 'Räumt ein Trümmerfeld und gibt das Feld frei.'],
    bulwarkDisc: ['Bollwerk', 'Macht aus Trümmern ein Bollwerk, das Rammstößen standhält.'],
    salvo: ['Salve', 'Startet die Runde: Kapseln landen, du wählst eine Stellung, die Welle beginnt.'],
    speed: ['Tempo', 'Pause, einfache, doppelte und dreifache Geschwindigkeit.'],
    /** Third line of a command bubble; every number comes from data/commands.js. */
    commandMeta: (cost, fromWave, cooldown) =>
      `${cost} KP · ab Welle ${fromWave} · ${cooldown === 1 ? '1 Welle' : `${cooldown} Wellen`} Pause`,
  },

  hud: {
    wave: 'Welle',
    lives: 'Leben',
    seed: 'Seed',
    route: (cells) => `Route: ${cells} Felder`,
    routeLabel: 'Routenlänge',
    routeBlocked: 'Route blockiert',
    /** On the status plate there is room for the number alone. */
    routeBlockedShort: '—',
    supplyLabel: 'Nachschubstufe',
    requisitionLabel: 'Requisition',
    requestSalvo: 'Salve anfordern',
    /** On the round main button there is only room for the word itself. */
    requestSalvoShort: 'Salve',
    zones: (n, max) => `Zonen ${n}/${max}`,
    supply: (level) => `Nachschub ${level}`,
    requisition: (n) => `Requisition ${n}`,
    commandPoints: (n) => `${n} KP`,
    commandPointsTitle: 'Kommandopunkte',
    buySupply: (level, next, cost) => `Nachschubstufe ${level} auf ${next} · ${cost}`,
    supplyMax: 'Nachschubstufe voll',
    /** Read out for screen readers and shown on hover or a long press. */
    supplyChancesLabel: 'Rangchancen der nächsten Stufe',
    supplyChance: (rank, percent) => `${rank} ${percent} %`,
    supplyName: 'Nachschub ausbauen',
    supplyHint:
      'Die Stufe gilt nur für künftige Kapseln, nicht für Stellungen, die schon stehen.',
    demolish: (cost) => `Abreißen · ab ${cost}`,
    demolishName: 'Trümmer abreißen',
    demolishHint:
      'Räumt ein Trümmerfeld und gibt das Feld frei. Jeder weitere Abriss kostet mehr.',
    demolishConfirm: (cost) => `Abreißen? ${cost}`,
    bulwark: (cost) => `Bollwerk · ${cost}`,
    bulwarkName: 'Bollwerk bauen',
    bulwarkConfirm: (cost) => `Bollwerk bauen? ${cost}`,
    bulwarkHint:
      'Macht aus einem Trümmerfeld ein Bollwerk. Es blockiert wie Trümmer, hält aber dem Rammstoß eines Kolosses stand.',
    newGame: 'Neue Partie',
    pause: 'Pause',
    speed: (n) => `${n}x`,
    speedGroup: 'Spielgeschwindigkeit',
    codex: 'Rezepte',
    menu: 'Menü',
    obstacleMode: 'Hindernis-Modus',
    artSprites: 'Grafik: Sprites',
    artPlaceholder: 'Grafik: Platzhalter',
    stress: 'Belastungstest',
    stressOn: 'Belastungstest läuft',
  },

  /** The round icon buttons in the running game (docs/ART.md, "Runenscheiben-Knopf"). */
  rune: {
    lockedLabel: (name, wave) => `${name} — ab Welle ${wave}`,
    cooldownLabel: (name, waves) => `${name} — noch ${waves} Wellen`,
  },

  menu: {
    subtitle: 'Grimdark Tower Defense',
    tagline: 'Halte den Riss. Baue das Labyrinth. Fünfzig Wellen.',
    start: 'Neue Partie',
    resumeMatch: 'Fortsetzen',
    resumeNone: 'Es läuft keine Partie.',
    seedScreen: 'Seed eingeben',
    seedTitle: 'Partie starten',
    seedIntro: 'Seed eingeben oder zufällig ziehen',
    seedLabel: 'Seed',
    seedHint: 'Derselbe Seed ergibt dieselbe Karte.',
    seedRandom: 'Zufällig',
    seedApply: 'Übernehmen',
    seedStart: 'Partie starten',
    seedTaken: (seed) => `Seed ${seed} übernommen.`,
    seedErrors: {
      empty: 'Bitte einen Seed eingeben oder würfeln.',
      long: 'Höchstens 24 Zeichen.',
      chars: (chars) => `Das gehört in keinen Seed: ${chars} — erlaubt sind Buchstaben und Ziffern.`,
    },
    settings: 'Einstellungen',
    back: 'Zurück',
    resume: 'Fortsetzen',
    exportMatch: 'Partie exportieren',
    exportMatchCopy: 'Protokoll kopieren',
    exportMatchHint:
      'Schreibt mit, was du in dieser Partie getan hast, als Datei. ' +
      'Für das Abstimmen der Werte — Bestwerte und Statistik bleiben davon unberührt.',
    exportMatchDone: (name) => `Gespeichert: ${name}`,
    exportMatchCopied: 'Protokoll in die Zwischenablage kopiert.',
    exportMatchFailed: 'Das Protokoll konnte nicht abgelegt werden.',
    exportMatchEmpty: 'Noch nichts aufgezeichnet: spiele zuerst eine Welle.',
    exportMatchTainted: 'Achtung: In dieser Partie wurden Debug-Hebel benutzt.',
    exportMatchAbout: ({ seed, wave, waves, ratings }) =>
      `Seed ${seed}, ${waves} ${waves === 1 ? 'Welle' : 'Wellen'} bis Welle ${wave}, ${ratings} bewertet.`,
    // The test entry (M6, step 4). Only reachable with ?debug, so the wording may
    // name protocols and waves the way the balancing work does.
    testEntry: 'Testeinstieg',
    testEntryTitle: 'Testeinstieg',
    testEntryIntro:
      'Eine aufgezeichnete Partie bis kurz vor eine Welle nachspielen und von dort weiterspielen. ' +
      'Die Welle, die du wählst, steht dir noch bevor.',
    testEntryPick: 'Protokoll',
    testEntryNone:
      'Kein Protokoll vorhanden. Spiele eine Partie, oder lade eine Protokolldatei aus balancing/protokolle/.',
    testEntryFile: 'Datei laden',
    testEntryWave: 'Ab Welle',
    testEntryOption: ({ seed, wave, waves }) =>
      `Seed ${seed} · ${waves} ${waves === 1 ? 'Welle' : 'Wellen'} bis ${wave}`,
    testEntryFileOption: ({ seed, wave, waves }) =>
      `Datei: Seed ${seed} · ${waves} ${waves === 1 ? 'Welle' : 'Wellen'} bis ${wave}`,
    testEntryWorking: (wave) => `Welle 1 bis ${wave - 1} wird nachgespielt …`,
    // Kept short: it goes into the banner over the board, which clips a long
    // line, and the status bar already shows the route and the requisition.
    testEntryReady: ({ wave, lives, towers }) =>
      `Welle ${wave} steht bevor: ${lives} Leben, ${towers} Stellungen.`,
    testEntryTainted: 'Diese Partie zählt nicht als Messung — sie ist gestellt, nicht gespielt.',
    testEntryErrors: {
      short: ({ wave, reached }) =>
        `Das Protokoll kommt nur bis Welle ${reached}, für Welle ${wave} müsste es bis ${wave - 1} reichen.`,
      over: ({ wave }) => `Die Partie ist vor Welle ${wave} verloren — von dort ist nichts weiterzuspielen.`,
      stuck: () => 'Das Nachspielen bleibt hängen. Ein anderes Protokoll oder eine andere Welle wählen.',
      first: () => 'Welle 1 ist eine neue Partie, dafür braucht es keinen Einstieg.',
      file: () => 'Das ist kein Protokoll.',
    },
    pauseTitle: 'Pausiert',
    pauseStatus: (wave, total, lives, requisition) =>
      `Welle ${wave}/${total} · Leben ${lives} · Requisition ${requisition}`,
    pauseDetail: (phase, seed) => `${phase} · Seed ${seed}`,
    leaveMatch: 'Partie verlassen',
    toMenu: 'Hauptmenü',
    newGame: 'Neue Partie',
    howTo:
      'Landezonen antippen, Salve anfordern, aus den Kapseln eine Stellung wählen. ' +
      'Die Gegner laufen immer den kürzesten freien Weg — mit Trümmern und Stellungen wird er länger.',
    hint: 'Leertaste pausiert · Escape öffnet das Menü · R zeigt die Rezepte',
    records: 'Bestenliste',
    updateReady: 'Neue Version bereit',
    updateApply: 'Neu laden',
    updateHint: 'Die laufende Partie geht dabei verloren.',
    install: 'Auf den Home-Bildschirm',
    installIos: 'Teilen-Knopf antippen, dann „Zum Home-Bildschirm“ — so läuft das Spiel offline und im Vollbild.',
    installDismiss: 'Nicht mehr zeigen',
  },

  records: {
    title: 'Bestenliste',
    intro: 'Die besten Läufe auf diesem Gerät. Ein Tipp auf einen Seed übernimmt ihn ins Hauptmenü.',
    empty: 'Noch keine beendete Partie. Die erste Wertung landet hier.',
    /** Table head. */
    rank: '#',
    seed: 'Seed',
    wave: 'Welle',
    score: 'Punkte',
    runs: 'Läufe',
    victoryMark: '★',
    victoryTitle: 'Alle fünfzig Wellen abgewehrt',
    seedTitle: (seed) => `Seed ${seed} ins Hauptmenü übernehmen`,
    taken: (seed) => `Seed ${seed} übernommen.`,
    olderRules: (n) => `Dazu ${n} ältere Läufe aus einer früheren Regelversion.`,

    stats: 'Statistik',
    matches: 'Partien',
    victories: 'Siege',
    kills: 'Abschüsse',
    bestWave: 'Weiteste Welle',
    playtime: 'Spielzeit',
    favourite: 'Liebste Doktrin',
    none: '—',
    duration: (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (h > 0) return `${h} h ${m} min`;
      // A first, short match should not read as "0 min".
      return m > 0 ? `${m} min` : `${Math.round(seconds)} s`;
    },

    transfer: 'Übertragen',
    export: 'Exportieren',
    exportHint: 'Speichert eine JSON-Datei mit Bestwerten und Statistik. Einstellungen bleiben am Gerät.',
    copy: 'Kopieren',
    copied: 'In die Zwischenablage kopiert.',
    copyFailed: 'Kopieren hat nicht geklappt. Bitte die Datei exportieren.',
    import: 'Importieren',
    importFile: 'Datei wählen',
    importPaste: 'Oder den Inhalt einer Exportdatei hier einfügen:',
    importPastePlaceholder: 'JSON einfügen',
    importCheck: 'Prüfen',
    reset: 'Alles löschen',
    resetConfirm: 'Bestwerte und Statistik wirklich löschen? Das lässt sich nicht rückgängig machen.',
    resetDone: 'Bestwerte und Statistik sind gelöscht.',
    cancel: 'Abbrechen',

    replaceTitle: 'Profil ersetzen',
    replaceIntro: 'Der Import ersetzt den Stand auf diesem Gerät. Zusammengeführt wird nicht.',
    replaceHere: 'Auf diesem Gerät',
    replaceFile: 'In der Datei',
    replaceSummary: ({ runs, seeds, bestWave, bestScore }) =>
      `${runs} Partien · ${seeds} Seeds · weiteste Welle ${bestWave} · ${bestScore} Punkte`,
    replaceConfirm: 'Ersetzen',
    replaceDone: 'Profil ersetzt.',

    errors: {
      parse: 'Das ist keine lesbare JSON-Datei.',
      magic: 'Diese Datei stammt nicht aus Nachschubfront.',
      future: 'Die Datei kommt aus einer neueren Version des Spiels.',
      empty: 'In der Datei steht keine beendete Partie.',
      read: 'Die Datei konnte nicht gelesen werden.',
    },
    storageWarning: 'Bestwerte können in diesem Browser nicht gespeichert werden.',
    lockedWarning:
      'Auf diesem Gerät liegt ein Profil aus einer neueren Version. Es bleibt unangetastet, ' +
      'neue Ergebnisse werden nicht gespeichert.',
  },

  /** The line of three buttons after a wave (M6, Teil 1). */
  rating: {
    label: 'Wie war die Welle?',
    question: 'Wie war die Welle?',
    questionFor: (wave) => `Welle ${wave}: wie war sie?`,
    answers: {
      easy: 'Zu leicht',
      fine: 'Passt',
      hard: 'Zu schwer',
    },
    thanks: 'Notiert.',
  },

  settings: {
    title: 'Einstellungen',
    volumes: 'Lautstärke',
    master: 'Gesamt',
    sfx: 'Effekte',
    music: 'Musik',
    motion: 'Bewegung',
    motionAuto: 'Wie das System',
    motionFull: 'Voll',
    motionReduced: 'Reduziert',
    motionHint: 'Reduziert bedeutet: kein Wackeln, gedämpfte Blitze, ruhige Asche.',
    language: 'Sprache',
    languageValue: 'Deutsch',
    languageHint: 'Weitere Sprachen sind nicht vorgesehen.',
    save: 'Spielstand',
    saveHint: 'Bestwerte und Statistik. Die Einstellungen bleiben am Gerät.',
    rating: 'Wellen bewerten',
    ratingOn: 'An',
    ratingOff: 'Aus',
    ratingHint:
      'Nach einigen Wellen erscheinen drei Knöpfe: zu leicht, passt, zu schwer. ' +
      'Gefragt wird an zehn von fünfzig Wellen — wer fünfzigmal gefragt wird, tippt, ' +
      'wer zehnmal gefragt wird, überlegt. Die Antworten wandern ins Partie-Protokoll ' +
      'und helfen beim Abstimmen der Werte.',
    percent: (v) => `${Math.round(v * 100)} %`,
    storageWarning: 'Einstellungen können in diesem Browser nicht gespeichert werden.',
  },

  endScreen: {
    victory: 'Die Front hält',
    victoryDetail: 'Alle fünfzig Wellen abgewehrt.',
    defeat: 'Die Bastion ist gefallen',
    defeatDetail: (wave) => `Gefallen in Welle ${wave}.`,
    again: 'Neue Partie',
    sameSeed: 'Gleicher Seed',
    records: 'Bestenliste',
    newRecord: 'Neuer Bestwert für diesen Seed',
    previousBest: (score) => `Bisher bester Lauf auf diesem Seed: ${score} Punkte`,
  },

  codex: {
    open: 'Rezepte',
    title: 'Rezepte',
    intro:
      'Drei verschiedene Doktrinen ab dem genannten Rang ergeben eine Spezialstellung. ' +
      'Zutaten dürfen aus der Salve und aus stehenden Stellungen kommen, mindestens eine aus der Salve.',
    minRank: (rank) => `ab ${rank}`,
    close: 'Schließen',
  },

  loading: {
    title: 'Nachschub wird geladen …',
  },

  doctrines: {
    flame: 'Flamme',
    autocannon: 'Autokanone',
    laser: 'Laser',
    mortar: 'Mörser',
    psi: 'Psi',
    tesla: 'Tesla',
  },

  /** Rank names by rank number (1 to 5). */
  ranks: {
    1: 'Rekrut',
    2: 'Veteran',
    3: 'Elite',
    4: 'Held',
    5: 'Legende',
  },

  recipes: {
    purgeShrine: { name: 'Reinigungsschrein', effect: 'Großer Flammenring, verlangsamt, Brand stapelt' },
    stormBattery: { name: 'Sturmbatterie', effect: 'Schnellfeuer auf drei Ziele, stark gegen Luft' },
    emberCauldron: { name: 'Glutkessel', effect: 'Brennende Aura, Blitze entzünden' },
    siegeMortar: { name: 'Belagerungsmörser', effect: 'Sehr große Reichweite, riesiger Explosionsradius' },
    thunderTower: { name: 'Gewitterturm', effect: 'Kette über 8 Ziele, kurze Betäubung' },
    soulfireObelisk: {
      name: 'Seelenfeuer-Obelisk',
      effect: 'Schaden in Prozent der maximalen Lebenspunkte, Waffe gegen Bosse',
    },
  },

  enemies: {
    swarmer: 'Schwärmer',
    warrior: 'Krieger',
    breaker: 'Brecher',
    warpseer: 'Warp-Seher',
    carrionflyer: 'Aasflieger',
    burster: 'Zerplatzer',
    healer: 'Heiler',
    broodmother: 'Brutmutter',
    colossusbreaker: 'Kolossbrecher',
    warpherald: 'Warp-Herold',
    swarmqueen: 'Schwarmkönigin',
    daemonprince: 'Dämonenprinz',
    koloss: 'Koloss',
  },

  koloss: {
    /** Two waves out: it is coming, no target yet (GDD section 9). */
    warning: (waves) =>
      waves === 1 ? 'Ein Koloss nähert sich · Ankunft in 1 Welle' : `Ein Koloss nähert sich · Ankunft in ${waves} Wellen`,
    warningDetail: 'Bollwerke halten seinem Rammstoß stand, Trümmer nicht.',
    /** One wave out: the marked spot is where he will hit. */
    predicted: 'Der Koloss zielt hierher',
    predictedDetail: 'Verstärke sie, dann sucht er sich die nächstschwächste.',
    arrived: 'Der Koloss ist da',
    arrivedDetail: 'Kein Kommando tötet ihn allein.',
    breach: (cells) =>
      cells === 0
        ? 'Der Koloss bricht durch'
        : cells === 1
          ? 'Der Koloss reißt ein Feld auf'
          : `Der Koloss reißt ${cells} Felder auf`,
    stoppedByBulwark: 'Ein Bollwerk hält den Rammstoß auf',
    stoppedByTower: 'Eine Stellung hält den Rammstoß auf',
    /** Chip in the HUD while a run is announced. */
    chip: (waves) => (waves === 0 ? 'Koloss!' : `Koloss in ${waves}`),
    target: 'Ziel des Kolosses',
  },

  /** Wave kinds, shown in the info panel and the wave statistics. */
  waveKinds: {
    horde: 'Horde',
    armour: 'Panzer',
    air: 'Flieger',
    warp: 'Warp',
    mixed: 'Gemischt',
    boss: 'Boss',
  },

  armor: {
    flesh: 'Fleisch',
    plate: 'Panzer',
    warpshield: 'Warp-Schild',
    flyer: 'Flieger',
  },

  info: {
    title: 'Infos',
    close: 'Schließen',
    hint: 'Lange drücken oder mit der Maus darüber',
    tower: 'Stellung',
    enemy: 'Gegner',
    terrain: 'Gelände',
    damagePerSecond: 'Schaden/s',
    range: 'Reichweite',
    targets: 'Ziele',
    ground: 'Boden',
    air: 'Luft',
    groundAndAir: 'Boden und Luft',
    waveDamage: 'Schaden diese Welle',
    armor: 'Rüstung',
    health: 'Leben',
    shield: 'Schild',
    speed: 'Tempo',
    reward: 'Belohnung',
    status: 'Zustand',
    burning: 'brennt',
    slowed: 'verlangsamt',
    frozen: 'eingefroren',
    boss: 'Boss',
    cells: (n) => `${n} Felder`,
    cellsPerSecond: (n) => `${n} Felder/s`,
    special: 'Spezialstellung',
    /** Names of what can stand on a cell. */
    terrainNames: {
      rift: 'Riss',
      bastion: 'Bastion',
      beacon: 'Signalfeuer',
      ruin: 'Ruine',
      crater: 'Krater',
      wall: 'Mauerrest',
      rubble: 'Trümmer',
      free: 'Freies Feld',
      pod: 'Kapsel',
    },
    blocked: 'blockiert',
    walkable: 'begehbar',
  },

  commandBar: {
    title: 'Spezialkommandos',
    cost: (n) => `${n} KP`,
    fromWave: (wave) => `ab Welle ${wave}`,
    cooldown: (waves) => (waves === 1 ? 'noch 1 Welle' : `noch ${waves} Wellen`),
    aimHint: (name) => `${name}: Ziel antippen`,
    lineStartHint: (name) => `${name}: Anfang antippen`,
    lineEndHint: (name) => `${name}: Ende antippen`,
    lineConfirm: 'Luftschlag? Nochmal tippen',
    cancelled: 'Abgebrochen',
    used: (name) => `${name} eingesetzt`,
  },

  commands: {
    orbitalStrike: { name: 'Orbitalschlag', effect: 'Ziel markieren, nach 2 s schwerer Flächenschaden' },
    stasisField: { name: 'Stasisfeld', effect: 'Friert Gegner im Umkreis ein' },
    prioritySupply: {
      name: 'Priorisierter Nachschub',
      effect: 'Nächste Salve: ein Rang mehr, ab Nachschubstufe 6 zwei',
    },
    holyBanner: { name: 'Heiliges Banner', effect: 'Stellungen im Umkreis schlagen härter zu' },
    airstrike: { name: 'Luftschlag', effect: 'Linie ziehen, Geschwader fliegt sie ab · stark gegen Panzer' },
  },

  phases: {
    planning: 'Planung',
    salvo: 'Salve',
    selection: 'Auswahl',
    wave: 'Welle läuft',
    evaluation: 'Auswertung',
    defeat: 'Niederlage',
    victory: 'Sieg',
  },

  score: {
    title: 'Wertung',
    wave: 'Welle',
    kills: 'Abschüsse',
    lives: 'Leben',
    total: 'Punkte',
  },

  banners: {
    waveCleared: (wave, leaked) =>
      leaked === 0 ? `Welle ${wave} abgewehrt` : `Welle ${wave} vorbei · ${leaked} durchgebrochen`,
    defeat: (wave) => `Die Bastion ist gefallen · Welle ${wave}`,
    victory: 'Alle Wellen überstanden',
  },

  placement: {
    protected: 'Geschützt',
    blocks: 'Blockiert den Weg',
    phase: 'Nur in der Planung',
    occupied: 'Belegt',
    outside: 'Außerhalb',
    full: 'Alle Zonen vergeben',
    added: 'Hindernis',
    removed: 'Entfernt',
    target: 'Nichts zum Abreißen',
    locked: 'Noch nicht verfügbar',
    cooldown: 'Kommando lädt nach',
    points: 'Zu wenig Kommandopunkte',
    funds: 'Zu wenig Requisition',
    demolished: 'Abgerissen',
    bulwarkBuilt: 'Bollwerk',
    bulwarkTarget: 'Nur auf Trümmern',
    zoneAdded: 'Landezone',
    zoneRemoved: 'Zone gelöscht',
    /**
     * Markers the last purchase invalidated: the demolition became unpayable, or
     * the ground was built on. The cell itself says which (`placement.funds` or
     * `placement.occupied`).
     */
    zonesDropped: (n) =>
      n === 1
        ? 'Eine Landezone entfernt: Das Feld ist nicht mehr bebaubar.'
        : `${n} Landezonen entfernt: Die Felder sind nicht mehr bebaubar.`,
  },

  selection: {
    title: 'Eine Option wählen',
    hint: 'Kapsel wählen, dann die Aktion. Der Rest wird zu Trümmern.',
    pod: (n) => `Kapsel ${n}`,
    keep: 'Behalten',
    merge: (size, rank) => `Verschmelzen ×${size} → ${rank}`,
    mergeBadge: (size) => `×${size}`,
    recipe: (name) => `Rezept: ${name}`,
    recipeBadge: 'Rezept',
    consumes: (n) => (n === 1 ? 'verbraucht 1 Stellung' : `verbraucht ${n} Stellungen`),
    // Upgrading instead of building (GDD section 11), from wave 30.
    upgrade: (from, to) => `Aufwerten: ${from} → ${to}`,
    upgradeCost: (n) => `kostet ${n} R, baut nichts`,
    upgradeBadge: 'Aufwerten',
    tower: (doctrine, rank) => `${doctrine} ${rank}`,
    built: (name) => `${name} errichtet`,
    /** A capsule that came down on rubble: building there clears the heap. */
    onRubble: (cost) => `Trümmer · Abriss ${cost} R`,
    noFunds: (cost) => `Für den Abriss fehlen ${cost} R.`,
    /**
     * A recipe that eats standing emplacements is armed on touch: the first tap
     * shows which ones, the second one builds (GDD section 13).
     */
    confirm: 'Nochmal antippen zum Bauen',
    confirmBanner: (n) =>
      n === 1
        ? 'Die gezeigte Stellung wird verbraucht. Nochmal antippen zum Bauen.'
        : `Die ${n} gezeigten Stellungen werden verbraucht. Nochmal antippen zum Bauen.`,
    /** Every capsule of the salvo stands on rubble nobody can clear. */
    allOnRubble: 'Keine Kapsel dieser Salve ist bebaubar.',
    forfeit: 'Salve verfallen lassen',
    forfeitNote: 'Keine Stellung, die Welle beginnt',
    forfeited: 'Salve verfallen',
  },

  /** Comic words over the loudest moments; kept rare so they stay loud. */
  effects: {
    podImpact: 'KRACH!',
    orbitalStrike: 'EINSCHLAG!',
    airstrike: 'ANFLUG!',
    kolossBreach: 'DURCHBRUCH!',
  },

  gallery: {
    title: 'Sprite-Galerie',
    intro:
      'Jede schräge Reihe ist eine Doktrin (hinten Flamme, dann Autokanone, Laser, Mörser, Psi, vorn Tesla). ' +
      'In jeder Reihe steigt der Rang von 1 (hinten rechts) bis 5 (vorn links). Davor die sechs Rezept-Stellungen. ' +
      'Gegner unten: erste Reihe läuft nach links, zweite nach rechts, dahinter die fünf Bosse. ' +
      'Ganz vorn die Nachschubkapsel in fünf Stufen: geschlossen bis vollständig geöffnet.',
    flash: 'Treffer-Variante',
    podStage: (n) => `Kapsel ${n}`,
    silhouette: 'Silhouetten',
    labels: 'Beschriftung',
    zoom: (z) => `Zoom ${z}`,
    stats: (zoom, count) => `Zoom ${zoom} · gerastert: ${count}`,
  },

  debugPanel: {
    title: 'Debug',
    wave: 'Welle',
    jump: 'Springen',
    grant: 'Geben',
    requisition: '+500 R',
    commandPoints: '+5 KP',
    pod: 'Kapsel',
    podFree: 'zufällig',
    invulnerable: 'Unverwundbar',
    waveStats: (wave, spawned, killed, leaked) =>
      `Welle ${wave}: ${spawned} Gegner, ${killed} tot, ${leaked} durch`,
    towerDamage: (name, damage, share) => `${name}: ${damage} (${share} %)`,
  },

  debug: {
    fps: 'fps',
    frameTime: (ms) => `Rechenzeit ${ms} ms`,
    enemies: (n) => `${n} Gegner`,
    canvas: 'Canvas',
  },
};
