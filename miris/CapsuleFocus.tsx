import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { getSelected } from "./labState";

const RING = 4.2;
const EYE = 1.7;
/* Where the camera comes to rest. A capsule is 2.6 tall, so about three units
   back is what fits all of it in a 55 degree lens. The aim is nudged sideways
   so the capsule lands left of centre, clear of the dossier panel. */
const STANDOFF = 1.2;
const SIDESTEP = 0.9;
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
        // Perpendicular to the line out to the capsule: aiming past it on one
        // side swings the capsule to the other side of the frame.
        toTarget.set(cx * RING - cz * SIDESTEP, EYE, cz * RING + cx * SIDESTEP);
      }
      last.current = i;
      t.current = 0;
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
