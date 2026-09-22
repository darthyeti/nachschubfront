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

  debug: {
    fps: 'fps',
    steps: 'Simulationsschritte',
    canvas: 'Canvas',
  },
};
