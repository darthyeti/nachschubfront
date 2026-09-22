// Map generation parameters (GDD section 4).

export const MAP = {
  /** Map is size x size cells. */
  size: 24,

  /** Rift and bastion sit on opposite edges, at least this far from the corners. */
  edgeMargin: 6,

  /**
   * Beacon order, seen from the rift. 'near' is the rift's half of the map,
   * 'left'/'right' split along the rift edge. This order makes the two
   * diagonal legs (1 -> 2 and 3 -> 4) cross in the middle of the map.
   */
  beaconOrder: [
    { depth: 'near', side: 'left' },
    { depth: 'far', side: 'right' },
    { depth: 'far', side: 'left' },
    { depth: 'near', side: 'right' },
  ],

  /** Beacons sit at their quadrant's centre, shifted by up to this many cells per axis. */
  beaconJitter: 3,

  /** Rift, beacons and bastion protect their surrounding ring of this radius. */
  protectRadius: 1,

  /** Number of pre-placed obstacle objects (a wall counts as one). */
  obstacleCount: { min: 12, max: 20 },

  /** Relative weights of the obstacle kinds. */
  obstacleKinds: [
    { kind: 'ruin', weight: 4 },
    { kind: 'crater', weight: 3 },
    { kind: 'wall', weight: 3 },
  ],

  /** Wall remnants occupy this many cells in a straight line. */
  wallLength: { min: 2, max: 3 },

  /** Give up placing further obstacles after this many failed attempts. */
  maxPlacementAttempts: 500,
};
