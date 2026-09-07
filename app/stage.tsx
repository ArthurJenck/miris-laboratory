import { useEffect, useMemo, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { TINTS, VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { ACESFilmicToneMapping, DoubleSide } from "three";
import { Fn, float, smoothstep, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Dossier from "../miris/Dossier";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import CapsuleFocus from "../miris/CapsuleFocus";
import { Bubbles, FloorGlow, LightShaft } from "../miris/CapsuleFx";
import { deckTexture, wallGlowMap, wallTexture, walkwayTexture, wearMap } from "../miris/textures";
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
  const deck = useMemo(() => { const t = deckTexture(); t.repeat.set(9, 9); return t; }, []);
  const walk = useMemo(() => { const t = walkwayTexture(); t.repeat.set(16, 2); return t; }, []);
  const wear = useMemo(() => { const t = wearMap(); t.repeat.set(7, 7); return t; }, []);
  const wall = useMemo(() => { const t = wallTexture(); t.repeat.set(10, 1); return t; }, []);
  const wallGlow = useMemo(() => { const t = wallGlowMap(); t.repeat.set(10, 1); return t; }, []);

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
      <hemisphereLight args={[0x9dc4dc, 0x0a1016, 0.9]} />
      <ambientLight intensity={0.18} color={0x7fa4ba} />
      <pointLight position={[0, 7.5, 0]} intensity={55} distance={30} decay={2} color={0xa8cdea} />
      <pointLight position={[0, 0.3, 0]} intensity={9} distance={9} decay={2} color={0x3bd6fe} />

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
