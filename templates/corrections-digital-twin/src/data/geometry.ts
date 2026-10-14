/**
 * Building footprints traced over `assets/facility-aerial.png`.
 *
 * These are presentation geometry rather than operational data, so they live in
 * the bundle and are joined onto the semantic-model rows by building id. Each
 * point is a percentage of the image's width and height, which lets the SVG
 * overlay use `viewBox="0 0 100 100"` and stay aligned at any size.
 *
 * The polygons were fitted to the actual roof boundaries: roofs were segmented
 * by brightness and split with a marker-controlled watershed (one marker per
 * building, so adjacent blocks separate along their real edges), then each
 * region was reduced to the four hull vertices enclosing the largest area.
 *
 * A *quadrilateral* rather than a bounding rectangle matters here: these roofs
 * are photographed obliquely, so they project to parallelograms. A minimum-area
 * rectangle enclosed 20–60% more ground than roof, which read as misalignment.
 * The administration block is a stepped cross, so it keeps a finely simplified
 * contour — a four-point fit would swallow its courtyards, and a coarse
 * simplification flattens its notches into visibly wrong diagonals.
 */

export type HotspotPoint = readonly [number, number];

export const BUILDING_HOTSPOTS: Record<string, readonly HotspotPoint[]> = {
  'housing-a': [
    [10.55, 38.28],
    [17.45, 36.07],
    [21.74, 40.23],
    [13.67, 41.8],
  ],
  'housing-b': [
    [19.66, 35.55],
    [27.21, 34.11],
    [30.34, 37.24],
    [23.7, 39.58],
  ],
  'housing-c': [
    [33.2, 32.16],
    [39.84, 32.55],
    [37.24, 36.33],
    [31.12, 35.03],
  ],
  'housing-d': [
    [45.05, 40.62],
    [53.39, 38.8],
    [56.38, 41.54],
    [47.01, 44.27],
  ],
  'housing-e': [
    [55.99, 37.5],
    [64.06, 35.94],
    [66.93, 38.41],
    [58.59, 40.89],
  ],
  'housing-f': [
    [73.18, 31.64],
    [80.34, 32.68],
    [77.99, 36.07],
    [71.74, 35.16],
  ],
  medical: [
    [48.05, 45.31],
    [57.55, 41.93],
    [60.55, 46.74],
    [53.78, 48.83],
  ],
  intake: [
    [26.17, 59.24],
    [33.33, 57.29],
    [38.15, 60.55],
    [29.17, 63.02],
  ],
  education: [
    [59.9, 42.06],
    [68.88, 39.58],
    [71.48, 43.1],
    [65.1, 45.18],
  ],
  recreation: [
    [80.99, 38.93],
    [91.54, 40.1],
    [89.06, 43.88],
    [81.38, 42.84],
  ],
  segregation: [
    [15.49, 31.25],
    [22.53, 29.43],
    [25.13, 31.77],
    [18.1, 33.98],
  ],
  kitchen: [
    [44.92, 28.26],
    [50.39, 29.04],
    [49.09, 31.51],
    [42.84, 31.38],
  ],
  // Traced at a finer tolerance than the other buildings: this block is a
  // stepped cross, and a coarse simplification flattens its notches into
  // diagonals that visibly miss the roof edge.
  administration: [
    [20.44, 44.14],
    [21.48, 45.83],
    [20.7, 47.27],
    [24.61, 51.56],
    [27.6, 50.91],
    [29.43, 52.86],
    [31.38, 53.65],
    [35.16, 52.6],
    [35.94, 53.65],
    [35.55, 54.69],
    [39.06, 58.2],
    [42.97, 57.16],
    [43.62, 55.34],
    [47.92, 53.65],
    [47.92, 52.99],
    [46.35, 51.43],
    [48.18, 50.52],
    [48.7, 49.48],
    [46.48, 47.27],
    [46.09, 46.22],
    [44.92, 45.83],
    [39.06, 40.23],
    [37.89, 38.41],
    [25.91, 42.32],
    [25.0, 41.93],
  ],
  maintenance: [
    [58.33, 54.04],
    [65.23, 51.56],
    [71.48, 56.9],
    [64.32, 59.77],
  ],
};

/** Fallback for a building that exists in the model but has no traced footprint. */
export const EMPTY_HOTSPOT: readonly HotspotPoint[] = [];
