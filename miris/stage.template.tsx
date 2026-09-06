import { useEffect, useMemo, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { Billboard, OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { TINTS, VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { ACESFilmicToneMapping, AdditiveBlending, DoubleSide } from "three";
import { Fn, float, smoothstep, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Card, { dossierHtml } from "../miris/Card";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import EffectCanvas, { anchorPos, anchorSeen, screenAspect } from "../miris/EffectCanvas";
import useHtmlTexture from "../miris/htmlTexture";
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

  // miris:label-start
  // Step 5.3 replaces this placeholder. It stays above the return because it
  // calls a React hook, and hooks run on every render.
  const label = useHtmlTexture(false);
  // miris:label-end

  // miris:field-start
  // Step 5.3 replaces this. A TSL graph is built once, not per frame.
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
      {/* Sublevel 7 is dark. Almost everything you see is emissive geometry. */}
      <ambientLight intensity={0.5} color={0x8fb6cc} />
      <pointLight position={[0, 6, 0]} intensity={40} distance={26} color={0x9ec9ff} />
      <pointLight position={[0, 0.25, 0]} intensity={6} distance={7} color={0x3bd6fe} />

      {/* miris:scene-start */}
      {/* Steps 2.1 to 2.4 go here, in that order. */}
      {/* miris:scene-end */}

      {/* miris:card-start */}
      {/* Steps 5.2 and 5.4 go here. */}
      {/* miris:card-end */}

      <CapsuleProbe />
      {/* The camera never leaves the middle of the room. Orbiting a target two
          centimetres in front of it turns the view in place instead of flying
          around the ring, and rotateSpeed is negative so a drag left looks left. */}
      <OrbitControls
        makeDefault
        target={[0, 1.7, 0]}
        enablePan={false}
        enableZoom={false}
        rotateSpeed={-0.35}
      />
    </Canvas>

    {/* miris:hud-start */}
    {/* Step 5.1 goes here. */}
    {/* miris:hud-end */}

    {/* miris:effect-start */}
    {/* Step 5.2 goes here. */}
    {/* miris:effect-end */}
    </>
  );
}
