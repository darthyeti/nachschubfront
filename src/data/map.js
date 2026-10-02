// Map generation parameters (GDD section 4).

export const MAP = {
  /**
   * How the map is laid out (sim/mapgen.js) and how its routes run
   * (sim/route.js): 'chain' is rift -> beacons -> bastion, the standard map.
   */
  layout: 'chain',

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

/**
 * King of the Hill (M7b, docs/meilensteine/M7b-king-of-the-hill.md, B1 and B4):
 * the bastion in the middle, four rifts on the edges, one attacking per wave.
 * The geometry is binding from the study (reference/studien/king-of-the-hill.html);
 * x is the column, y the row.
 */
export const KOTH_MAP = {
  /** 'center': every rift walks to the bastion, read off one distance field. */
  layout: 'center',
  size: 24,
  /** The bastion's 2 x 2 cells. */
  bastion: [
    { x: 11, y: 11 },
    { x: 12, y: 11 },
    { x: 11, y: 12 },
    { x: 12, y: 12 },
  ],
  /** Two gate cells each; ground enemies come out of them in turn. */
  rifts: [
    { id: 'north', gates: [{ x: 11, y: 0 }, { x: 12, y: 0 }] },
    { id: 'east', gates: [{ x: 23, y: 11 }, { x: 23, y: 12 }] },
    { id: 'south', gates: [{ x: 11, y: 23 }, { x: 12, y: 23 }] },
    { id: 'west', gates: [{ x: 0, y: 11 }, { x: 0, y: 12 }] },
  ],
  /** No beacons: the route runs straight from the gate to the bastion. */
  beaconCount: 0,
  /** Bastion and gates protect their surrounding ring of this radius (Chebyshev). */
  protectRadius: 1,
  /**
   * The ban zone against rings: every cell whose centre lies at most this far
   * from the map centre (euclidean) takes no building, landing or ruin (B4).
   * Coupled with the enemy strength, so calibrated together (B7).
   */
  banRadius: 4,
  /** Ruins placed from the seed, each checked against all four rifts. */
  obstacleCount: { min: 12, max: 20 },
  /** Single cells only, as in the study; the two kinds differ only in looks. */
  obstacleKinds: [
    { kind: 'ruin', weight: 4 },
    { kind: 'crater', weight: 3 },
  ],
  maxPlacementAttempts: 500,
};
