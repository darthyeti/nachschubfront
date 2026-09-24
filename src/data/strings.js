// All player-visible texts. German only; nothing visible is hard-coded elsewhere.

export const STRINGS = {
  gameTitle: 'Nachschubfront',
  documentTitle: 'Nachschubfront',
  canvasLabel: 'Spielfeld von Nachschubfront',
  /** Corner label; the number itself comes from data/version.js. */
  version: (v) => `v${v}`,

  hud: {
    wave: 'Welle',
    lives: 'Leben',
    seed: 'Seed',
    route: (cells) => `Route: ${cells} Felder`,
    routeBlocked: 'Route blockiert',
    requestSalvo: 'Salve anfordern',
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
    supplyHint:
      'Die Stufe gilt nur für künftige Kapseln, nicht für Stellungen, die schon stehen.',
    demolish: (cost) => `Abreißen · ab ${cost}`,
    demolishConfirm: (cost) => `Abreißen? ${cost}`,
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

  menu: {
    subtitle: 'Halte den Riss. Baue das Labyrinth. Fünfzig Wellen.',
    start: 'Feldzug beginnen',
    seedLabel: 'Seed',
    seedHint: 'Leer lassen für eine zufällige Karte.',
    seedRandom: 'Würfeln',
    settings: 'Einstellungen',
    back: 'Zurück',
    resume: 'Weiter',
    pauseTitle: 'Pause',
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
    cancelled: 'Abgebrochen',
    used: (name) => `${name} eingesetzt`,
  },

  commands: {
    orbitalStrike: { name: 'Orbitalschlag', effect: 'Ziel markieren, nach 2 s schwerer Flächenschaden' },
    stasisField: { name: 'Stasisfeld', effect: 'Friert Gegner im Umkreis ein' },
    prioritySupply: { name: 'Priorisierter Nachschub', effect: 'Nächste Salve: ein Rang mehr' },
    holyBanner: { name: 'Heiliges Banner', effect: 'Stellungen im Umkreis schlagen härter zu' },
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
    zoneAdded: 'Landezone',
    zoneRemoved: 'Zone gelöscht',
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
    tower: (doctrine, rank) => `${doctrine} ${rank}`,
    built: (name) => `${name} errichtet`,
    /** A capsule that came down on rubble: building there clears the heap. */
    onRubble: (cost) => `Trümmer · Abriss ${cost} R`,
    noFunds: (cost) => `Für den Abriss fehlen ${cost} R.`,
  },

  /** Comic words over the loudest moments; kept rare so they stay loud. */
  effects: {
    podImpact: 'KRACH!',
    orbitalStrike: 'EINSCHLAG!',
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
