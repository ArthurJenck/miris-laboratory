import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { getSelected, getSelectedPart } from "./labState";
import { EYE, GLASS_CENTRE, RING, SCREEN, angleOf, screenFrame } from "./layout";

/* Where the camera comes to rest. Capsules stand 4.2 apart, so an orbit of
   radius 3.7 around one swept straight through its neighbours; 3.1 clears
   them. The wheel then zooms between the two limits below. */
const STANDOFF = 1.1;
const NEAREST = 1.2;
const FARTHEST = 3.2; // any further and the orbit clips the neighbours again
/* Reading distance from a pedestal screen, along its normal, and the zoom
   range there. The screen is 0.9 wide; at 1.05 it fills most of the frame. */
const READING = 1.05;
const READ_NEAREST = 0.45;
const READ_FARTHEST = 2.2;
const TRAVEL = 0.9; // seconds

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
  const { camera, controls, size } = useThree() as any;
  const last = useRef<string | null>(null);
  const previousSelection = useRef(-1);
  const home = useRef(camera.position.clone()).current;
  const t = useRef(1);

  useFrame((_, dt) => {
    const i = getSelected();
    const part = getSelectedPart();
    const key = `${i}:${part}:${size.width}:${size.height}`;
    const readingDistance = Math.max(READING, SCREEN.w * 1.12 / (2 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect));

    if (last.current !== key) {
      if (i < 0 && previousSelection.current < 0) {
        last.current = key;
        t.current = 1;
        return;
      }
      if (i >= 0 && previousSelection.current < 0) home.copy(camera.position);
      previousSelection.current = i;
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
      } else if (part === "pedestal") {
        // Straight down the screen's normal, at reading distance: the file
        // fills the frame the way a plaque does when you lean over it.
        const f = screenFrame(i);
        toPos.copy(f.center).addScaledVector(f.normal, readingDistance);
        toTarget.copy(f.center);
      } else {
        const a = angleOf(i);
        const cx = Math.cos(a);
        const cz = Math.sin(a);
        toPos.set(cx * STANDOFF, EYE, cz * STANDOFF);
        // Aim at the middle of the glass, so orbiting once arrived turns
        // around the specimen rather than around a point beside it.
        toTarget.set(cx * RING, GLASS_CENTRE, cz * RING);
      }
      last.current = key;
      t.current = 0;
      /* The negative rotateSpeed is for standing in the room: with the target
         two centimetres ahead, drag left looks left. Around a capsule that
         same sign runs the orbit backwards, so it flips with the destination. */
      if (controls) {
        controls.rotateSpeed = i < 0 ? -0.35 : 0.35;
        // Zoom is a focus-only affordance: standing in the room there is
        // nothing two centimetres ahead worth zooming toward.
        controls.enableZoom = i >= 0;
        const reading = i >= 0 && part === "pedestal";
        controls.minDistance = i < 0 ? 0 : reading ? READ_NEAREST : NEAREST;
        controls.maxDistance = i < 0 ? Infinity : reading ? Math.max(READ_FARTHEST, readingDistance * 1.4) : FARTHEST;
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
