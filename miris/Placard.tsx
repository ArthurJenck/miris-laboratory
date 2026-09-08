import { useFrame, useThree } from "@react-three/fiber";
import { Component, type ReactNode, useRef, useSyncExternalStore } from "react";
import { FrontSide, Mesh } from "three";
import { FOCUS_DISTANCE } from "./CapsuleFocus";
import { getSelected, labVersion, subscribeLab } from "./labState";

const RING = 4.2;
const MIDDLE = 1.66;
/* The markup is 340px wide and the shared px-to-units ratio is 0.0045, so the
   card is this wide before SCALE. The frame fit needs it before the child has
   painted, and the plate behind it is sized from the child once it has. */
const CARD_WIDTH = 340 * 0.0045;
/* The placard's inner edge stands this far from the capsule's axis: just
   outside the glass, so the tube never hides it. */
const EDGE = 1.0;
/* Hinged on that edge and swung back, the way a sign angles toward whoever
   is reading it. Flat, its far edge fell out of frame with the guide open.
   This is the least it swings; a narrow window swings it further, and only
   past the steepest angle does it shrink instead. */
const TILT = 0.56;
const STEEPEST = 1.0;
/* Keep the far edge a little inside the frame, not flush with the sidebar. */
const MARGIN = 0.96;

/* The markup is 340px wide, which the shared px-to-units ratio makes as tall
   as the glass. A little smaller reads as a label on the tank rather than a
   second tank. */
const SCALE = 0.85;
/* Never smaller than this: below it the notes stop being readable. */
const SMALLEST = 0.6;
/* On a very narrow stage the card may slide in over the edge of the glass,
   but never over the creature, which fills seven tenths of it. */
const INNERMOST = 0.65;

/** Tilt, scale and inner edge that put the card's far edge inside the frame
 *  at the focus distance. The far edge is edge + w cos t across and w sin t
 *  further back, and the frame is k times as wide as it is deep. Swing first,
 *  shrink second, slide in last; past all three it crops, and the stage is
 *  too narrow for the room anyway. */
function fitToFrame(width: number, k: number): { tilt: number; scale: number; edge: number } {
  const fits = (w: number, t: number, edge: number) => w * (Math.cos(t) - k * Math.sin(t)) <= FOCUS_DISTANCE * k - edge;
  for (let t = TILT; t <= STEEPEST; t += 0.02) if (fits(width * SCALE, t, EDGE)) return { tilt: t, scale: SCALE, edge: EDGE };
  const slope = Math.cos(STEEPEST) - k * Math.sin(STEEPEST);
  if (slope <= 0) return { tilt: STEEPEST, scale: SCALE, edge: EDGE };
  const scale = Math.max(SMALLEST, Math.min(SCALE, (FOCUS_DISTANCE * k - EDGE) / slope / width));
  if (fits(width * scale, STEEPEST, EDGE)) return { tilt: STEEPEST, scale, edge: EDGE };
  const edge = Math.max(INNERMOST, FOCUS_DISTANCE * k - width * scale * slope);
  return { tilt: STEEPEST, scale, edge };
}

/** Where the specimen's file stands: to the right of the open capsule, hinged
 *  on its inner edge and turned to face the room, sized and tilted to fit the
 *  frame. What it shows is the child's business: step 4.2's File paints the
 *  markup and hangs a plane at the hinge. A dark plate behind it, sized to
 *  whatever plane the child made, keeps the reverse a slab rather than text
 *  read backwards. */
export default function Placard({ specimens = [] as any[], children }: { specimens?: any[]; children: (d: any) => ReactNode }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();
  const d = i >= 0 ? specimens[i]?.dossier : null;
  const camera = useThree((s) => s.camera) as any;
  const aspect = useThree((s) => s.size.width / s.size.height);
  const group = useRef<any>(null);
  const plate = useRef<Mesh>(null);

  useFrame(() => {
    const g = group.current;
    const p = plate.current;
    if (!g || !p) return;
    let plane: any = null;
    g.traverse((o: any) => {
      if (!plane && o !== p && o.isMesh && o.geometry?.type === "PlaneGeometry") plane = o;
    });
    const w = plane?.geometry?.parameters?.width ?? 0;
    const h = plane?.geometry?.parameters?.height ?? 0;
    p.visible = w > 0 && h > 0;
    p.scale.set(w, h, 1);
    p.position.set(w / 2, 0, -0.02);
  });

  if (i < 0 || !d) return null;
  // One object for the child: the dossier, plus where this specimen sits in
  // the series, since a file that cannot say which stage it is fails at its job.
  const file = { ...d, stage: specimens[i]?.stage ?? "", index: i, stages: specimens.map((s: any) => s?.stage ?? "") };
  const k = Math.tan((camera.fov * Math.PI) / 360) * aspect * MARGIN;
  const { tilt, scale, edge } = fitToFrame(CARD_WIDTH, k);
  const a = (i / 6) * Math.PI * 2;
  // Right of the capsule as seen from the middle of the room: the outward
  // vector is (cos a, sin a), so right is (-sin a, cos a).
  const x = Math.cos(a) * RING - Math.sin(a) * edge;
  const z = Math.sin(a) * RING + Math.cos(a) * edge;
  // A plane faces +Z; yawed by this it faces the middle of the room. The
  // extra tilt turns it about its inner edge, far edge receding.
  const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + tilt;

  return (
    <group ref={group} position={[x, MIDDLE, z]} rotation={[0, yaw, 0]} scale={scale}>
      <Quietly>{children(file)}</Quietly>
      <mesh ref={plate} rotation={[0, Math.PI, 0]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color={0x0b1016} roughness={0.7} metalness={0.3} side={FrontSide} />
      </mesh>
    </group>
  );
}

/* The child is the attendee's code mid-edit. A throw there should cost the
   card, not the room. */
class Quietly extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("The file's markup or paint threw; showing no card until it is fixed.", e);
  }
  componentDidUpdate(prev: { children: ReactNode }) {
    if (this.state.failed && prev.children !== this.props.children) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
