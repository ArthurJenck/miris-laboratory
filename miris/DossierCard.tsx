import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useSyncExternalStore } from "react";
import { DoubleSide, type Mesh } from "three";
import { dossierHtml } from "./Card";
import useHtmlTexture from "./htmlTexture";
import { getSelected, labVersion, subscribeLab } from "./labState";

const RING = 4.2;
const MIDDLE = 1.66;
/* How far to the right of the glass the card stands, from the camera's side.
   Outside the glass rather than in it, which is what kept the first in-scene
   card hidden behind its own capsule. */
const BESIDE = 1.5;
/* The markup is 340px wide, which the shared px-to-units ratio makes as tall
   as the glass. Smaller reads as a label on the tank rather than a second tank. */
const SCALE = 0.72;

/** The specimen's file, standing in the room beside its capsule. The markup is
 *  the same as the flat panel used, painted into a canvas and sampled as a
 *  texture, so the card lives in the scene: it has a place, it recedes and
 *  parallaxes with everything else, and it can be occluded. It turns to face
 *  the camera every frame, which is what stops it going edge-on. */
export default function DossierCard({ specimens = [] as any[] }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();
  const d = i >= 0 ? specimens[i]?.dossier : null;
  const { texture, width, height } = useHtmlTexture(d ? dossierHtml(d) : null);
  const mesh = useRef<Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    mesh.current?.lookAt(camera.position);
  });

  if (i < 0 || !texture) return null;
  const a = (i / 6) * Math.PI * 2;
  // Right of the capsule as seen from the middle of the room: the forward
  // vector is (cos a, sin a), so right is (-sin a, cos a).
  const x = Math.cos(a) * RING - Math.sin(a) * BESIDE;
  const z = Math.sin(a) * RING + Math.cos(a) * BESIDE;

  return (
    <mesh ref={mesh} position={[x, MIDDLE, z]} scale={SCALE} renderOrder={20}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}
