import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import type { InstanceTransform } from "./StaticInstances";

/* The small parts every piece of the room is built from: its three colours,
   a ring, a printed label, and the arithmetic for things repeated round a circle. */
export const steel = "#344651";
export const enamel = "#71858c";
export const blue = "#a4dcff";

export const slots = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `count` transforms evenly round a ring of `radius` at height `y`, each
 *  turned to face along the ring; `x` slides them sideways along it. */
export const radial = (count: number, radius: number, y: number, x = 0): InstanceTransform[] =>
  slots(count).map((i) => {
    const a = (i * Math.PI * 2) / count;
    return {
      position: [x * Math.cos(a) - radius * Math.sin(a), y, -x * Math.sin(a) - radius * Math.cos(a)],
      rotation: [0, a, 0],
    };
  });

export function Ring({ radius, y, tube = 0.025, color = blue, lit = false }: { radius: number; y: number; tube?: number; color?: string; lit?: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <torusGeometry args={[radius, tube, 6, 80]} />
      {lit ? <meshBasicMaterial color={color} /> : <meshStandardMaterial color={color} metalness={0.65} roughness={0.4} />}
    </mesh>
  );
}

/** A plaque with one line of stencilled text, painted once into a canvas. */
export function Label({ text, width = 2, height = 0.35 }: { text: string; width?: number; height?: number }) {
  const map = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 160;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#15232c";
    c.fillRect(0, 0, 1024, 160);
    c.strokeStyle = "#7eabc2";
    c.lineWidth = 3;
    c.strokeRect(8, 8, 1008, 144);
    c.font = "bold 64px monospace";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#b8e1f4";
    c.fillText(text, 512, 85, 940);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [text]);
  useEffect(() => () => map.dispose(), [map]);
  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={map} />
    </mesh>
  );
}
