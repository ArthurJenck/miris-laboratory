import { useEffect, useMemo, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { TINTS, VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { ACESFilmicToneMapping, AdditiveBlending, DoubleSide } from "three";
import { Fn, float, smoothstep, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Dossier from "../miris/Dossier";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import CapsuleFocus from "../miris/CapsuleFocus";
import EffectCanvas, { anchorPos, anchorSeen, screenAspect } from "../miris/EffectCanvas";
import { StageSkeleton } from "../miris/Skeleton";

// A Miris stream is now a scene node: <mirisStream args={[{ uuid, viewerKey }]} />
extend({ MirisStream });

// Your file. Each step's code goes between the miris: comments below.
export default function Stage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);


  // miris:field-start
  // Step 5.3 goes here.
  const field = null;
  // miris:field-end

  const specimens = data?.specimens ?? [];

  if (!data || !data.track) return <StageSkeleton />;

  return (
    <>
    <Canvas
      linear
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
      }}
      camera={{ position: [0, 1.7, 0.02], fov: 55 }}
      style={{ position: "fixed", inset: 0 }}
    >
      <ambientLight intensity={0.5} color={0x8fb6cc} />
      <pointLight position={[0, 6, 0]} intensity={40} distance={26} color={0x9ec9ff} />
      <pointLight position={[0, 0.25, 0]} intensity={6} distance={7} color={0x3bd6fe} />

      {/* miris:scene-start */}
      {/* Steps 2.1 to 2.4 go here. */}
      {/* miris:scene-end */}


      <CapsuleProbe />
      <CapsuleFocus />
      <OrbitControls
        makeDefault
        target={[0, 1.7, 0]}
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.35}
      />
    </Canvas>

    {/* miris:card-start */}
    {/* Step 4.2 goes here. */}
    {/* miris:card-end */}

    {/* miris:hud-start */}
    {/* Step 5.1 goes here. */}
    {/* miris:hud-end */}

    {/* miris:effect-start */}
    {/* Step 5.2 goes here. */}
    {/* miris:effect-end */}
    </>
  );
}
