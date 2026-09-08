import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { getBoxes } from "./labState";
import { GLASS_CENTRE, RING, angleOf } from "./layout";

const RESCAN = 60; // frames between looks for glass that arrived late

const at = new Vector3();

/* The SDK draws all six specimens as one splat mesh that writes no depth, so
   glass can only be ordered against all of them at once. Drawn first, a tube's
   near wall never tinted the creature behind it; drawn last, a tube across the
   room tinted a creature standing in front of it. This decides per tube, per
   frame: glass draws over the splats unless a nearer capsule overlaps it on
   screen, in which case it drops behind them. The screen boxes are the same
   silhouettes the readout uses. */
export default function GlassOrder() {
  const { scene, camera } = useThree();
  const glass = useRef<any[]>([]);
  const frame = useRef(0);

  useFrame(() => {
    if (frame.current++ % RESCAN === 0 || glass.current.length < 6) {
      glass.current = [];
      scene.traverse((o: any) => {
        const m = /^glass-(\d)$/.exec(o.name ?? "");
        if (m) glass.current[Number(m[1])] = o;
      });
    }
    const boxes = getBoxes();
    const dist = boxes.map((_, i) => {
      const a = angleOf(i);
      return at.set(Math.cos(a) * RING, GLASS_CENTRE, Math.sin(a) * RING).distanceTo(camera.position);
    });
    boxes.forEach((b, i) => {
      const g = glass.current[i];
      if (!g) return;
      let covered = false;
      if (b) {
        for (let j = 0; j < boxes.length && !covered; j++) {
          const c = boxes[j];
          if (j === i || !c || dist[j] >= dist[i]) continue;
          covered = b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h;
        }
      }
      g.renderOrder = covered ? -1 : 1;
    });
  });

  return null;
}
