import { useMemo } from "react";
import { Shape } from "three";
import { FloorGlow } from "./CapsuleFx";
import { blue } from "./hardware";

const bevel = (depth: number, size: number) => ({ depth, bevelEnabled: true, bevelThickness: size, bevelSize: size, bevelSegments: 3, steps: 1 });

/** The pressure door at the end of the walkway: a bevelled frame, a recess,
 *  two leaves with their handles and hinges, and the light that spills from it. */
export default function Door() {
  const [frame, recess, leaf] = useMemo(() => {
    const panel = (w: number, h: number, cut: number) => {
      const shape = new Shape();
      shape.moveTo(-w / 2 + cut, -h / 2);
      shape.lineTo(w / 2 - cut, -h / 2);
      shape.lineTo(w / 2, -h / 2 + cut);
      shape.lineTo(w / 2, h / 2 - cut);
      shape.lineTo(w / 2 - cut, h / 2);
      shape.lineTo(-w / 2 + cut, h / 2);
      shape.lineTo(-w / 2, h / 2 - cut);
      shape.lineTo(-w / 2, -h / 2 + cut);
      shape.closePath();
      return shape;
    };
    const half = new Shape();
    half.moveTo(0.025, -1.69);
    half.lineTo(1.04, -1.69);
    half.lineTo(1.36, -1.37);
    half.lineTo(1.36, 1.37);
    half.lineTo(1.04, 1.69);
    half.lineTo(0.025, 1.69);
    half.closePath();
    return [panel(4.05, 4.35, 0.55), panel(3.28, 3.94, 0.46), half];
  }, []);
  return (
    <group position={[0, 2.18, -10.8]}>
      <mesh position={[0, 0, -0.12]}>
        <extrudeGeometry args={[frame, { ...bevel(0.25, 0.065), bevelThickness: 0.07 }]} />
        <meshStandardMaterial color="#607986" metalness={0.65} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <extrudeGeometry args={[recess, { ...bevel(0.035, 0.05), bevelThickness: 0.055 }]} />
        <meshStandardMaterial color="#101f29" metalness={0.4} roughness={0.7} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} scale={[side, 1, 1]}>
          <mesh position={[0, 0, 0.24]}>
            <extrudeGeometry args={[leaf, bevel(0.065, 0.018)]} />
            <meshStandardMaterial color="#405d6d" metalness={0.55} roughness={0.62} />
          </mesh>
          <mesh position={[1.48, 0, 0.26]}>
            <boxGeometry args={[0.023, 2.64, 0.025]} />
            <meshBasicMaterial color="#93c4dc" />
          </mesh>
          <mesh position={[0.26, -0.12, 0.324]}>
            <boxGeometry args={[0.105, 0.54, 0.025]} />
            <meshStandardMaterial color="#162b38" roughness={0.7} />
          </mesh>
          <mesh position={[0.28, -0.12, 0.345]}>
            <boxGeometry args={[0.036, 0.4, 0.04]} />
            <meshStandardMaterial color="#8a9da4" metalness={0.8} roughness={0.4} />
          </mesh>
          {[-0.95, 0.95].map((y) => (
            <group key={y} position={[1.74, y, 0.22]}>
              <mesh>
                <boxGeometry args={[0.22, 0.46, 0.16]} />
                <meshStandardMaterial color="#314957" metalness={0.65} roughness={0.5} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.065, 0.065, 0.2, 16]} />
                <meshStandardMaterial color="#91a3a9" metalness={0.75} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      <mesh position={[0, 0, 0.215]}>
        <boxGeometry args={[0.016, 3.32, 0.025]} />
        <meshBasicMaterial color="#77a9c5" />
      </mesh>
      <mesh position={[0, 1.94, 0.23]}>
        <boxGeometry args={[1.24, 0.055, 0.025]} />
        <meshBasicMaterial color="#c0e3f7" />
      </mesh>
      <mesh position={[0, -1.95, 0.2]}>
        <boxGeometry args={[2.25, 0.07, 0.36]} />
        <meshStandardMaterial color="#7c939e" metalness={0.65} roughness={0.5} />
      </mesh>
      <pointLight position={[0, 2.1, 1.3]} color={blue} intensity={12} distance={10} decay={2} />
      <group position={[0, -2.18, 1.6]}>
        <FloorGlow color={0xa4dcff} opacity={0.22} radius={3} />
      </group>
    </group>
  );
}
