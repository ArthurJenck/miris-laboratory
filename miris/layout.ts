import { Object3D, Vector3 } from "three";

/* Where everything in the room stands. One copy, so the capsules, the
   pedestals, the camera and the readout never disagree by a centimetre. */
export const CAPSULES = 6;
export const RING = 4.2; // how far each capsule stands from the middle of the room
export const PEDESTAL_RING = 3.2; // the pedestals stand just inside them
export const EYE = 1.7; // standing height

export const GLASS = { radius: 0.9, height: 2.6, bottom: 0.36 };
export const GLASS_TOP = GLASS.bottom + GLASS.height;
export const GLASS_CENTRE = GLASS.bottom + GLASS.height / 2;

/** Angle of slot `index` round the ring, from +x toward +z. */
export const angleOf = (index: number) => (index / CAPSULES) * Math.PI * 2;

/** A point on a ring of `radius` at slot `index`, at height `y`. */
export const onRing = (index: number, radius: number, y = 0): [number, number, number] => {
  const a = angleOf(index);
  return [Math.cos(a) * radius, y, Math.sin(a) * radius];
};

/** Where capsule `index` stands, turned an equal share of the circle from its
 *  neighbours. */
export const capsulePlacement = (index: number) => ({
  position: onRing(index, RING),
  facing: Math.PI / 2 - angleOf(index),
});

/** Where pedestal `index` stands, its screen turned to the middle of the room. */
export const pedestalPlacement = (index: number) => {
  const a = angleOf(index);
  return { position: onRing(index, PEDESTAL_RING), facing: Math.atan2(-Math.cos(a), -Math.sin(a)) };
};

/* The pedestal's screen: a tilted head on the body, and where its picture
   lands on that head. The focus camera and the hit boxes share these. */
export const SCREEN = { w: 0.9, h: 0.5625 };
export const HEAD = { y: 0.95, forward: 0.05, tilt: 0.65, face: 0.108 };

export interface ScreenFrame {
  center: Vector3;
  normal: Vector3;
  corners: Vector3[];
}

const frames = new Map<number, ScreenFrame>();

/** Where pedestal i's screen is in the world: centre, normal and corners, for
 *  the camera that reads it and the readout that brackets it. */
export function screenFrame(i: number): ScreenFrame {
  const known = frames.get(i);
  if (known) return known;
  const { position, facing } = pedestalPlacement(i);
  const root = new Object3D();
  root.position.fromArray(position);
  root.rotation.y = facing;
  const head = new Object3D();
  head.position.set(0, HEAD.y, HEAD.forward);
  head.rotation.x = HEAD.tilt;
  root.add(head);
  root.updateMatrixWorld(true);
  const at = (x: number, z: number) => head.localToWorld(new Vector3(x, HEAD.face, z));
  const center = at(0, 0);
  const normal = head.localToWorld(new Vector3(0, HEAD.face + 1, 0)).sub(center).normalize();
  const hw = SCREEN.w / 2;
  const hh = SCREEN.h / 2;
  const f = { center, normal, corners: [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)] };
  frames.set(i, f);
  return f;
}
