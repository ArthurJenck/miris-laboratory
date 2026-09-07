import { useSyncExternalStore } from "react";
import { FrontSide } from "three";
import { dossierHtml } from "./Card";
import useHtmlTexture from "./htmlTexture";
import { getSelected, labVersion, subscribeLab } from "./labState";

const RING = 4.2;
const MIDDLE = 1.66;
/* How far to the side of the glass the placard stands: to the right as seen
   from the middle of the room, outside the glass. */
const BESIDE = 1.5;
/* The markup is 340px wide, which the shared px-to-units ratio makes as tall
   as the glass. A little smaller reads as a label on the tank rather than a
   second tank. */
const SCALE = 0.85;

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
export default function DossierCard({ specimens = [] as any[] }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();
  const d = i >= 0 ? specimens[i]?.dossier : null;
  const { texture, width, height } = useHtmlTexture(d ? dossierHtml(d) : null);

  if (i < 0 || !texture) return null;
  const a = (i / 6) * Math.PI * 2;
  // Right of the capsule as seen from the middle of the room: the outward
  // vector is (cos a, sin a), so right is (-sin a, cos a).
  const x = Math.cos(a) * RING - Math.sin(a) * BESIDE;
  const z = Math.sin(a) * RING + Math.cos(a) * BESIDE;
  // A plane faces +Z; yawed by this it faces the middle of the room.
  const yaw = Math.atan2(-Math.cos(a), -Math.sin(a));

  return (
    <group position={[x, MIDDLE, z]} rotation={[0, yaw, 0]} scale={SCALE}>
      {/* Opaque and depth-writing on purpose. Drawn transparent and late it
          painted over the specimen from behind: splats write no depth, so
          nothing stopped it. As a solid in the opaque pass the splats blend
          over it when they are in front and sit behind it when they are not. */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} alphaTest={0.5} toneMapped={false} side={FrontSide} />
      </mesh>
      <mesh position={[0, 0, -0.02]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={0x0b1016} roughness={0.7} metalness={0.3} side={FrontSide} />
      </mesh>
    </group>
  );
}
