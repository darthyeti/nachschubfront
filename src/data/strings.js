// All player-visible texts. German only; nothing visible is hard-coded elsewhere.

export const STRINGS = {
  gameTitle: 'Nachschubfront',
  documentTitle: 'Nachschubfront',
  canvasLabel: 'Spielfeld von Nachschubfront',

  hud: {
    wave: 'Welle',
    lives: 'Leben',
    seed: 'Seed',
    route: (cells) => `Route: ${cells} Felder`,
    routeBlocked: 'Route blockiert',
    startWave: 'Welle starten',
    newGame: 'Neue Partie',
    pause: 'Pause',
    speed: (n) => `${n}x`,
    speedGroup: 'Spielgeschwindigkeit',
    obstacleMode: 'Hindernis-Modus',
    artSprites: 'Grafik: Sprites',
    artPlaceholder: 'Grafik: Platzhalter',
    stress: 'Belastungstest',
    stressOn: 'Belastungstest läuft',
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

  phases: {
    planning: 'Planung',
    salvo: 'Salve',
    selection: 'Auswahl',
    wave: 'Welle läuft',
    evaluation: 'Auswertung',
    defeat: 'Niederlage',
    victory: 'Sieg',
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
    added: 'Hindernis',
    removed: 'Entfernt',
  },

  gallery: {
    title: 'Sprite-Galerie',
    intro: 'Jede schräge Reihe ist eine Doktrin (hinten Flamme, dann Autokanone, Laser, Mörser, Psi, vorn Tesla). In jeder Reihe steigt der Rang von 1 (hinten rechts) bis 5 (vorn links). Gegner unten: hintere Reihe läuft nach links, vordere nach rechts.',
    flash: 'Treffer-Variante',
    zoom: (z) => `Zoom ${z}`,
    stats: (zoom, count) => `Zoom ${zoom} · gerastert: ${count}`,
  },

  debug: {
    fps: 'fps',
    frameTime: (ms) => `Rechenzeit ${ms} ms`,
    enemies: (n) => `${n} Gegner`,
    canvas: 'Canvas',
  },
};
