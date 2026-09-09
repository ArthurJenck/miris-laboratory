import { Shape } from "three";
import { FloorGlow } from "../CapsuleFx";
import { blue } from "./hardware";

/** The pressure door at the end of the walkway: a bevelled frame, a recess,
 *  two leaves with their handles and hinges, and the light that spills from it. */
export default function Door() {
  return (
    <group position={[0, 2.18, -10.8]}>
      <Frame />
      <Leaf side={-1} />
      <Leaf side={1} />
      <SeamLights />
      <Spill />
    </group>
  );
}

// A rectangle with its corners cut off, the outline every panel of the door shares.
function panel(w: number, h: number, cut: number) {
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
}

// The right-hand leaf; the left is this one mirrored.
function halfLeaf() {
  const shape = new Shape();
  shape.moveTo(0.025, -1.69);
  shape.lineTo(1.04, -1.69);
  shape.lineTo(1.36, -1.37);
  shape.lineTo(1.36, 1.37);
  shape.lineTo(1.04, 1.69);
  shape.lineTo(0.025, 1.69);
  shape.closePath();
  return shape;
}

const frameShape = panel(4.05, 4.35, 0.55);
const recessShape = panel(3.28, 3.94, 0.46);
const leafShape = halfLeaf();

// Extrude settings: how deep the panel is, and how rounded its edge.
const bevel = (depth: number, size: number) => ({ depth, bevelEnabled: true, bevelThickness: size, bevelSize: size, bevelSegments: 3, steps: 1 });

// The outer frame, the darker recess set into it, and the sill along the bottom.
function Frame() {
  return (
    <>
      <mesh position={[0, 0, -0.12]}>
        <extrudeGeometry args={[frameShape, { ...bevel(0.25, 0.065), bevelThickness: 0.07 }]} />
        <meshStandardMaterial color="#607986" metalness={0.65} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.15]}>
        <extrudeGeometry args={[recessShape, { ...bevel(0.035, 0.05), bevelThickness: 0.055 }]} />
        <meshStandardMaterial color="#101f29" metalness={0.4} roughness={0.7} />
      </mesh>
      <mesh position={[0, -1.95, 0.2]}>
        <boxGeometry args={[2.25, 0.07, 0.36]} />
        <meshStandardMaterial color="#7c939e" metalness={0.65} roughness={0.5} />
      </mesh>
    </>
  );
}

// One leaf of the door with its lit outer edge; scale flips it to the other side.
function Leaf({ side }: { side: -1 | 1 }) {
  return (
    <group scale={[side, 1, 1]}>
      <mesh position={[0, 0, 0.24]}>
        <extrudeGeometry args={[leafShape, bevel(0.065, 0.018)]} />
        <meshStandardMaterial color="#405d6d" metalness={0.55} roughness={0.62} />
      </mesh>
      <mesh position={[1.48, 0, 0.26]}>
        <boxGeometry args={[0.023, 2.64, 0.025]} />
        <meshBasicMaterial color="#93c4dc" />
      </mesh>
      <Handle />
      <Hinge y={-0.95} />
      <Hinge y={0.95} />
    </group>
  );
}

// A dark backplate with a steel bar standing off it.
function Handle() {
  return (
    <>
      <mesh position={[0.26, -0.12, 0.324]}>
        <boxGeometry args={[0.105, 0.54, 0.025]} />
        <meshStandardMaterial color="#162b38" roughness={0.7} />
      </mesh>
      <mesh position={[0.28, -0.12, 0.345]}>
        <boxGeometry args={[0.036, 0.4, 0.04]} />
        <meshStandardMaterial color="#8a9da4" metalness={0.8} roughness={0.4} />
      </mesh>
    </>
  );
}

// A block on the outer edge with a pin through it.
function Hinge({ y }: { y: number }) {
  return (
    <group position={[1.74, y, 0.22]}>
      <mesh>
        <boxGeometry args={[0.22, 0.46, 0.16]} />
        <meshStandardMaterial color="#314957" metalness={0.65} roughness={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.2, 16]} />
        <meshStandardMaterial color="#91a3a9" metalness={0.75} roughness={0.4} />
      </mesh>
    </group>
  );
}

// Light in the gap between the leaves, and along the lintel above them.
function SeamLights() {
  return (
    <>
      <mesh position={[0, 0, 0.215]}>
        <boxGeometry args={[0.016, 3.32, 0.025]} />
        <meshBasicMaterial color="#77a9c5" />
      </mesh>
      <mesh position={[0, 1.94, 0.23]}>
        <boxGeometry args={[1.24, 0.055, 0.025]} />
        <meshBasicMaterial color="#c0e3f7" />
      </mesh>
    </>
  );
}

// A point light above the door and its pool on the deck, so the light has somewhere to land.
function Spill() {
  return (
    <>
      <pointLight position={[0, 2.1, 1.3]} color={blue} intensity={12} distance={10} decay={2} />
      <group position={[0, -2.18, 1.6]}>
        <FloorGlow color={0xa4dcff} opacity={0.22} radius={3} />
      </group>
    </>
  );
}
