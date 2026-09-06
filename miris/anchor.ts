// Where the hovered capsule is on screen, in normalised device coordinates.
// Written by CapsuleProbe inside the canvas and read by the TSL overlay, which
// has no camera of its own.
export const anchor = { x: 0, y: 0, seen: false };
