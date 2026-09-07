// Where the hovered capsule is on screen, in normalised device coordinates.
// Written by CapsuleProbe inside the canvas and read by the TSL overlay, which
// has no camera of its own.
// w and h are the projected half extents of the glass, in the overlay's own
// units (half the screen height is 1), so the field can hug the silhouette
// instead of flooding the middle where the specimen is.
export const anchor = { x: 0, y: 0, w: 0, h: 0, seen: false };
