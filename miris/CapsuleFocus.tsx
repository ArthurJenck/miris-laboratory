import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { getSelected } from "./labState";

const RING = 4.2;
const EYE = 1.7;
/* Where the camera comes to rest. Capsules stand 4.2 apart, so an orbit of
   radius 3.7 around one swept straight through its neighbours; 2.6 clears
   them. The wheel then zooms between the two limits below. */
const STANDOFF = 1.6;
const NEAREST = 1.2;
const FARTHEST = 3.2; // any further and the orbit clips the neighbours again
/* The aim sits a little toward the placard, so the glass and its file share
   the frame; the pivot is still, to the eye, the specimen. */
const TOWARD_CARD = 0.45;
/* The capsule interior runs y 0.36 to 2.96; this is its middle. */
const GLASS_MIDDLE = 1.66;
const TRAVEL = 0.9; // seconds

const home = new Vector3(0, EYE, 0);
const fromPos = new Vector3();
const fromTarget = new Vector3();
const toPos = new Vector3();
const toTarget = new Vector3();
const dir = new Vector3();

// Slow at both ends, quick through the middle. A linear move reads as a
// machine sliding; this reads as someone walking over to look.
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Walks the camera to whichever capsule is open, and back to the middle of
 *  the room when it closes. Mounted inside the Canvas; renders nothing. */
export default function CapsuleFocus() {
  const { camera, controls } = useThree() as any;
  const last = useRef<number | null>(null);
  const t = useRef(1);

  useFrame((_, dt) => {
    const i = getSelected();

    if (last.current !== i) {
      // A new destination: remember where the move starts from, so the ease
      // runs between two fixed points instead of chasing a moving one.
      fromPos.copy(camera.position);
      fromTarget.copy(controls?.target ?? home);
      if (i < 0) {
        // Going home keeps the direction they were facing, rather than
        // snapping the view back to whatever counts as forward.
        dir.subVectors(fromTarget, fromPos).setY(0);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
        dir.normalize();
        toPos.copy(home);
        toTarget.copy(home).addScaledVector(dir, 0.02);
      } else {
        const a = (i / 6) * Math.PI * 2;
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        toPos.set(cx * STANDOFF, EYE, cz * STANDOFF);
        // Right of the capsule as seen from the middle: (-sin a, cos a).
        toTarget.set(cx * RING - cz * TOWARD_CARD, GLASS_MIDDLE, cz * RING + cx * TOWARD_CARD);
      }
      last.current = i;
      t.current = 0;
      /* The negative rotateSpeed is for standing in the room: with the target
         two centimetres ahead, drag left looks left. Around a capsule that
         same sign runs the orbit backwards, so it flips with the destination. */
      if (controls) {
        controls.rotateSpeed = i < 0 ? -0.35 : 0.35;
        // Zoom is a focus-only affordance: standing in the room there is
        // nothing two centimetres ahead worth zooming toward.
        controls.enableZoom = i >= 0;
        controls.minDistance = i >= 0 ? NEAREST : 0;
        controls.maxDistance = i >= 0 ? FARTHEST : Infinity;
      }
    }

    if (t.current >= 1) return; // Arrived: hand the camera back to the user.
    t.current = Math.min(1, t.current + dt / TRAVEL);
    const k = ease(t.current);
    camera.position.lerpVectors(fromPos, toPos, k);
    if (controls?.target) {
      controls.target.lerpVectors(fromTarget, toTarget, k);
      controls.update();
    }
  });

  return null;
}
