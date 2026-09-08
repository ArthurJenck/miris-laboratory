import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import StaticInstances from "./StaticInstances";
import { Ring, enamel, radial, steel } from "./hardware";
import { RING } from "./layout";
import { floorMaps } from "./textures";

const wallPosts = radial(18, 11.2, 2.8);
const ceilingRibs = radial(18, 8.2, 5.6);
const wallLights = radial(18, 11, 3.45, 0.42);
const wallBases = radial(18, 11, 0.4);
const ceilingLamps = radial(6, RING, 5.45);

/** The room itself: the scanned metal deck, the wall round it, the ceiling
 *  with its ribs and lamps, and the fog that closes the distance. */
export default function Floor() {
  const maps = useMemo(() => floorMaps(14), []);
  useEffect(() => () => Object.values(maps).forEach((map) => map.dispose()), [maps]);
  return (
    <>
      <color attach="background" args={["#08121c"]} />
      <fog attach="fog" args={["#08121c", 12, 32]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <circleGeometry args={[24, 96]} />
        <meshStandardMaterial {...maps} color="#a4b9c7" roughness={0.72} metalness={0.42} normalScale={[0.55, 0.55]} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[11.5, 11.5, 6, 48, 1, true]} />
        <meshStandardMaterial color="#23343f" side={DoubleSide} roughness={0.8} metalness={0.35} />
      </mesh>
      <mesh position={[0, 6.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[11.5, 48]} />
        <meshStandardMaterial color="#17252d" roughness={0.8} />
      </mesh>
      {[5.65, 6.2, 10.9].map((r) => (
        <Ring key={r} radius={r} y={5.55} tube={0.14} color={steel} />
      ))}
      <Ring radius={5.8} y={5.48} tube={0.035} lit />
      <StaticInstances transforms={wallPosts}>
        <boxGeometry args={[0.24, 5.6, 0.38]} />
        <meshStandardMaterial color={enamel} metalness={0.5} roughness={0.6} />
      </StaticInstances>
      <StaticInstances transforms={ceilingRibs}>
        <boxGeometry args={[0.16, 0.24, 6]} />
        <meshStandardMaterial color={steel} metalness={0.6} roughness={0.5} />
      </StaticInstances>
      <StaticInstances transforms={wallLights}>
        <boxGeometry args={[0.08, 2.5, 0.06]} />
        <meshBasicMaterial color="#83b6d1" />
      </StaticInstances>
      <StaticInstances transforms={wallBases}>
        <boxGeometry args={[3.7, 0.5, 0.2]} />
        <meshStandardMaterial color="#182832" roughness={0.7} />
      </StaticInstances>
      <StaticInstances transforms={ceilingLamps}>
        <boxGeometry args={[1.4, 0.1, 0.16]} />
        <meshBasicMaterial color="#b2d7ea" />
      </StaticInstances>
      <Ring radius={10.98} y={0.68} tube={0.02} lit />
    </>
  );
}
