import { useEffect, useMemo } from "react";
import StaticInstances from "./StaticInstances";
import { Label, Ring, radial } from "./hardware";
import { walkwayTexture, wearMap } from "./textures";

const seams = radial(48, 3.15, 0.06);
const marks = radial(48, 2.7, 0.065);
const brightMarks = marks.filter((_, i) => i % 4 === 0);
const dimMarks = marks.filter((_, i) => i % 4 !== 0);
const plaques = radial(6, 3.65, 0.067);

/** The raised ring you stand on: a shallow deck, the walking surface round
 *  it, lit edges, seams and distance marks, and the division's label. */
export default function Platform() {
  const walk = useMemo(() => { const t = walkwayTexture(); t.repeat.set(6, 6); return t; }, []);
  const wear = useMemo(() => { const t = wearMap(); t.repeat.set(7, 7); return t; }, []);
  useEffect(() => () => { walk.dispose(); wear.dispose(); }, [walk, wear]);
  return (
    <group>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[3.8, 3.86, 0.07, 96]} />
        <meshStandardMaterial color="#34434d" map={walk} roughnessMap={wear} metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.054, 0]}>
        <ringGeometry args={[2.62, 3.73, 96]} />
        <meshStandardMaterial color="#a1b0b5" map={walk} roughness={0.65} metalness={0.45} />
      </mesh>
      {[2.59, 3.77].map((r) => (
        <Ring key={r} radius={r} y={0.065} tube={0.018} lit />
      ))}
      <StaticInstances transforms={seams}>
        <boxGeometry args={[0.018, 0.005, 1.06]} />
        <meshStandardMaterial color="#101e28" />
      </StaticInstances>
      <StaticInstances transforms={brightMarks}>
        <boxGeometry args={[0.09, 0.008, 0.12]} />
        <meshBasicMaterial color="#a4dcff" />
      </StaticInstances>
      <StaticInstances transforms={dimMarks}>
        <boxGeometry args={[0.09, 0.008, 0.12]} />
        <meshBasicMaterial color="#70848d" />
      </StaticInstances>
      <StaticInstances transforms={plaques}>
        <boxGeometry args={[0.38, 0.006, 0.09]} />
        <meshStandardMaterial color="#c2b18a" roughness={0.8} />
      </StaticInstances>
      <Ring radius={1.45} y={0.057} tube={0.012} color="#6a8797" />
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, -1.1]}>
        <Label text="BIOLOGY DIVISION / 06" width={1.8} height={0.28} />
      </group>
    </group>
  );
}
