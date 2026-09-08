import { useEffect, useMemo } from "react";
import { blue, slots } from "./hardware";
import { walkwayTexture } from "./textures";

/** The straight path from the platform to the door, with a light strip down
 *  each edge and a seam every half metre. */
export default function Walkway() {
  const walk = useMemo(() => { const t = walkwayTexture(); t.repeat.set(6, 6); return t; }, []);
  useEffect(() => () => walk.dispose(), [walk]);
  return (
    <group>
      <mesh position={[0, 0.015, -7.2]}>
        <boxGeometry args={[2.3, 0.08, 7.4]} />
        <meshStandardMaterial color="#6e818a" map={walk} roughness={0.6} metalness={0.5} />
      </mesh>
      {[-1.12, 1.12].map((x) => (
        <mesh key={x} position={[x, 0.065, -7.2]}>
          <boxGeometry args={[0.04, 0.025, 7.4]} />
          <meshBasicMaterial color={blue} />
        </mesh>
      ))}
      {slots(12).map((i) => (
        <mesh key={i} position={[0, 0.06, -4.1 - i * 0.56]}>
          <boxGeometry args={[2.15, 0.006, 0.02]} />
          <meshStandardMaterial color="#1c303c" />
        </mesh>
      ))}
    </group>
  );
}
