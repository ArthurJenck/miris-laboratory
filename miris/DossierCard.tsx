import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useSyncExternalStore } from "react";
import { FrontSide, type Mesh, Vector3 } from "three";
import { dossierHtml } from "./Card";
import useHtmlTexture from "./htmlTexture";
import { getSelected, labVersion, subscribeLab } from "./labState";

const RING = 4.2;
const MIDDLE = 1.66;
/* How far to the side of the glass the card stands, from wherever the camera
   is. Outside the glass, which is what kept the first in-scene card hidden
   behind its own capsule. */
const BESIDE = 1.55;
/* The markup is 340px wide, which the shared px-to-units ratio makes as tall
   as the glass. Smaller reads as a label on the tank rather than a second tank. */
const SCALE = 0.95;
const UP = new Vector3(0, 1, 0);
const toGlass = new Vector3();
const across = new Vector3();

/** The specimen's file, standing in the room beside its capsule. The markup is
 *  the same as the flat panel used, painted into a canvas and sampled as a
 *  texture, so the card lives in the scene: it has a place, it recedes and
 *  parallaxes with everything else, and it can be occluded.
 *
 *  It stands to the camera's right of the glass, recomputed every frame: fixed
 *  to one side of the room instead, it swung in front of the specimen as you
 *  orbited, and seen from behind its text read mirrored. Front face only, so
 *  there is no back to catch. */
export default function DossierCard({ specimens = [] as any[] }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();
  const d = i >= 0 ? specimens[i]?.dossier : null;
  const { texture, width, height } = useHtmlTexture(d ? dossierHtml(d) : null);
  const mesh = useRef<Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    const m = mesh.current;
    if (!m || i < 0) return;
    const a = (i / 6) * Math.PI * 2;
    const cx = Math.cos(a) * RING;
    const cz = Math.sin(a) * RING;
    toGlass.set(cx - camera.position.x, 0, cz - camera.position.z).normalize();
    across.crossVectors(toGlass, UP).normalize();
    m.position.set(cx + across.x * BESIDE, MIDDLE, cz + across.z * BESIDE);
    // Face the camera by taking its rotation, not by lookAt: lookAt on a plane
    // can roll it, and the file came up upside down from some angles.
    m.quaternion.copy(camera.quaternion);
  });

  if (i < 0 || !texture) return null;
  return (
    <mesh ref={mesh} scale={SCALE} renderOrder={20}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} side={FrontSide} />
    </mesh>
  );
}
