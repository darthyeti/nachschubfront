// Map generation parameters (GDD section 4).

export const MAP = {
  /** Map is size x size cells. */
  size: 24,

  /** Rift and bastion sit on opposite edges, at least this far from the corners. */
  edgeMargin: 6,

  /**
   * Beacons the route runs through, in order (GDD section 4). Two of them, one
   * per map half, so the base route is short and open: the player lengthens it.
   * The halves are the ones left and right of the rift-to-bastion axis, which
   * forces a sideways sweep without sending the route back and forth in depth.
   */
  beaconCount: 2,

  /** Cells between the two beacons, measured in king steps (8-way movement). */
  minBeaconDistance: 10,

  /** Cells between a beacon and the rift or the bastion, same measure. */
  minAnchorDistance: 8,

  /**
   * Beacons keep this many cells from the map border. Not a GDD number: it
   * stops a beacon from sitting in a corner where the route hugs the edge.
   */
  beaconMargin: 2,

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
