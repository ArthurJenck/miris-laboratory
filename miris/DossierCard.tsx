import { useThree } from "@react-three/fiber";
import { useSyncExternalStore } from "react";
import { FrontSide } from "three";
import { dossierHtml } from "./Card";
import { FOCUS_DISTANCE } from "./CapsuleFocus";
import useHtmlTexture from "./htmlTexture";
import { getSelected, labVersion, subscribeLab } from "./labState";

const RING = 4.2;
const MIDDLE = 1.66;
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

/** The specimen's file, standing in the room beside its capsule. The markup is
 *  the same as the flat panel used, painted into a canvas and sampled as a
 *  texture, so the card lives in the scene: it has a place, it recedes and
 *  parallaxes with everything else, and it can be occluded.
 *
 *  A placard, not a billboard. It stands to the right of the glass as seen
 *  from the middle of the room, turned to face the middle, and stays there:
 *  orbit and you walk around it like anything else in the room. Front face
 *  only, with a dark plate behind it, so from behind you see a slab and never
 *  the text reversed. */
export default function DossierCard({ specimens = [] as any[], html }: { specimens?: any[]; html?: (d: any) => string }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();
  const d = i >= 0 ? specimens[i]?.dossier : null;
  // The attendee's markup when they have written it, the designed file when
  // not, and the designed file again if theirs throws mid-edit.
  let markup: string | null = null;
  if (d) {
    try {
      markup = (html ?? dossierHtml)(d);
    } catch (e) {
      console.warn("fileMarkup threw, showing the default file instead", e);
      markup = dossierHtml(d);
    }
  }
  const { texture, width, height } = useHtmlTexture(markup);
  const camera = useThree((s) => s.camera) as any;
  const aspect = useThree((s) => s.size.width / s.size.height);

  if (i < 0 || !texture) return null;
  const k = Math.tan((camera.fov * Math.PI) / 360) * aspect * MARGIN;
  const { tilt, scale, edge } = fitToFrame(width, k);
  const a = (i / 6) * Math.PI * 2;
  // Right of the capsule as seen from the middle of the room: the outward
  // vector is (cos a, sin a), so right is (-sin a, cos a).
  const x = Math.cos(a) * RING - Math.sin(a) * edge;
  const z = Math.sin(a) * RING + Math.cos(a) * edge;
  // A plane faces +Z; yawed by this it faces the middle of the room. The
  // extra tilt turns it about its inner edge, far edge receding.
  const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + tilt;

  return (
    <group position={[x, MIDDLE, z]} rotation={[0, yaw, 0]} scale={scale}>
      {/* Opaque and depth-writing on purpose. Drawn transparent and late it
          painted over the specimen from behind: splats write no depth, so
          nothing stopped it. As a solid in the opaque pass the splats blend
          over it when they are in front and sit behind it when they are not. */}
      <mesh position={[width / 2, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} alphaTest={0.5} toneMapped={false} side={FrontSide} />
      </mesh>
      <mesh position={[width / 2, 0, -0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={0x0b1016} roughness={0.7} metalness={0.3} side={FrontSide} />
      </mesh>
    </group>
  );
}
