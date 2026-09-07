import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group } from "three";
import { setFit } from "./labState";

/* The capsule's inside, from the snippet that builds it. */
const FLOOR = 0.36;
const RIM = 2.96;
const GLASS = 0.9;
const MIDDLE = (FLOOR + RIM) / 2;
/* Not the whole capsule by default: a specimen touching the glass reads as
   stuck in it rather than suspended in it. */
const DEFAULT_FILL = 0.7;

/* A generated mesh arrives at whatever size the generator felt like. Measured
   across a real series it was about 0.28 units, so the snippet's scale of 0.15
   put a creature in the glass at a fortieth of the height it should be: a
   speck, and the same speck whatever the attendee grew.

   The size is not known until the stream loads, so it cannot be a constant.
   MirisStream.getBounds reports in world space with the current scale already
   applied, which makes the correction proportional: measure, multiply, measure
   again. Iterating rather than solving in one step keeps this honest about the
   convention it is reading, and it settles within a few frames either way. */
const CLOSE_ENOUGH = 0.01;
const SETTLE = 0.6;

export default function FitInGlass({
  position,
  fill = DEFAULT_FILL,
  children,
}: {
  position: [number, number, number];
  fill?: number;
  children: React.ReactNode;
}) {
  const box = useRef<Group>(null);
  const rest = useRef(0);

  useFrame(() => {
    const g = box.current;
    // Two frames of stillness after it lands, then stop measuring for good.
    if (!g || rest.current > 2) return;

    let stream: any = null;
    g.traverse((o: any) => {
      if (!stream && typeof o?.getBounds === "function") stream = o;
    });
    const b = stream?.getBounds?.();
    const size = b?.size;
    const centre = b?.center;
    // Zero extent means nothing has arrived yet, and dividing by it would
    // throw the specimen to infinity on the first frame.
    if (!size || !centre || !(size[1] > 1e-6)) return;

    const tall = (RIM - FLOOR) * fill;
    // The glass is the tighter limit for anything wider than it is high.
    const across = GLASS * 2 * fill;
    const wide = Math.max(size[0], size[2]);
    const want = Math.min(tall / size[1], wide > 1e-6 ? across / wide : Infinity);
    const off = Math.hypot(centre[0] - position[0], centre[1] - MIDDLE, centre[2] - position[2]);

    if (Math.abs(want - 1) < CLOSE_ENOUGH && off < CLOSE_ENOUGH) {
      rest.current += 1;
      // Settled: tell the HUD where the creature is, so the hover glow can hug
      // it. Which capsule this is comes from where it stands, not a prop, so
      // the attendee's snippet stays one line.
      if (rest.current === 1) {
        const slot = Math.round(Math.atan2(position[2], position[0]) / (Math.PI / 3));
        setFit(((slot % 6) + 6) % 6, { center: [centre[0], centre[1], centre[2]], size: [size[0], size[1], size[2]] });
      }
      return;
    }
    rest.current = 0;

    g.scale.multiplyScalar(1 + (want - 1) * SETTLE);
    g.position.x += (position[0] - centre[0]) * SETTLE;
    g.position.y += (MIDDLE - centre[1]) * SETTLE;
    g.position.z += (position[2] - centre[2]) * SETTLE;
  });

  return (
    <group ref={box} position={position}>
      {children}
    </group>
  );
}
