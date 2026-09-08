import { OrbitControls } from "@react-three/drei";
import { Canvas, extend } from "@react-three/fiber";
import { MirisStream } from "@miris-inc/three";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { NoToneMapping } from "three";
import BudgetGuard from "./BudgetGuard";
import CapsuleFocus from "./CapsuleFocus";
import Dossier from "./Dossier";
import GlassOrder from "./GlassOrder";
import HdrGuard from "./HdrGuard";
import "./lab.css";
import { EYE } from "./layout";
import { CapsuleProbe } from "./Readout";
import { StageSkeleton } from "./Skeleton";
import Specimen from "./Specimen";
import useLab from "./useLab";

// Registers <mirisStream> as a JSX tag; miris.d.ts gives it a type.
extend({ MirisStream });

/** The canvas and everything the room needs that nobody should have to read:
 *  the renderer settings, the lights, a camera standing in the middle of the
 *  room at eye height, the controls, and the guards that keep the SDK honest. */
export default function Scene({ children }: { children?: ReactNode }) {
  const { ready } = useLab();
  if (!ready) return <StageSkeleton />;

  // The Specimens are numbered in the order they appear, first to sixth, so
  // each knows where round the ring it stands without being told.
  let slot = 0;
  const numbered = Children.map(children, (child) =>
    isValidElement(child) && child.type === Specimen && (child.props as any).index === undefined
      ? cloneElement(child as any, { index: slot++ })
      : child,
  );

  return (
    <div className="mw-canvas">
    <Canvas
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance", toneMapping: NoToneMapping }}
      camera={{ position: [0, EYE, 0.02], fov: 55 }}
    >
      <hemisphereLight args={[0xb7d8f0, 0x26323b, 1.2]} />
      <directionalLight position={[-6, 9, 4]} intensity={2.1} color={0xbfe0f2} />
      <pointLight position={[0, 0.3, 0]} intensity={4} distance={9} decay={2} color={0x3bd6fe} />

      {numbered}

      <HdrGuard />
      <BudgetGuard />
      <CapsuleProbe />
      <GlassOrder />
      <CapsuleFocus />
      <Dossier />
      {/* Aimed two centimetres ahead: dragging turns you on the spot rather
          than swinging you round the room, which is also why the speed is
          negative and pan and zoom are off. */}
      <OrbitControls makeDefault target={[0, EYE, 0]} enablePan={false} enableZoom={false} rotateSpeed={-0.35} />
    </Canvas>
    </div>
  );
}
