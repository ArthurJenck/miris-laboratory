import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { TINTS, VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { DoubleSide, Group, NoToneMapping } from "three";
import { Fn, float, smoothstep, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Dossier from "../miris/Dossier";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import CapsuleFocus from "../miris/CapsuleFocus";
import Placard from "../miris/Placard";
import useHtmlTexture from "../miris/htmlTexture";
import HdrGuard from "../miris/HdrGuard";
import BudgetGuard from "../miris/BudgetGuard";
import GlassOrder from "../miris/GlassOrder";
import { FloorGlow, LightShaft, Pulse, RadialGlow } from "../miris/CapsuleFx";
import { floorMaps, walkwayTexture, wearMap } from "../miris/textures";
import EffectCanvas, { screenAspect } from "../miris/EffectCanvas";
import { StageSkeleton } from "../miris/Skeleton";

// A Miris stream is now a scene node: <mirisStream args={[{ uuid, viewerKey }]} />
extend({ MirisStream });

// miris:parts-start
// Steps 2.5 and 4.2 go here. Until 2.5, a stream shows at the size it arrived.
function FitInGlass({ position, children }: any) {
  return <group position={position}>{children}</group>;
}
// miris:parts-end

// Your file. Each step's code goes between the miris: comments below.
export default function Stage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, []);


  // miris:markup-start
  // Step 4.1 goes here.
  const fileMarkup = undefined;
  // miris:markup-end

  // miris:field-start
  // Step 5.3 goes here.
  const field = null;
  // miris:field-end

  const specimens = data?.specimens ?? [];
  const floor = useMemo(() => floorMaps(30), []);
  const walk = useMemo(() => { const t = walkwayTexture(); t.repeat.set(16, 2); return t; }, []);
  const wear = useMemo(() => { const t = wearMap(); t.repeat.set(7, 7); return t; }, []);

  if (!data || !data.track) return <StageSkeleton />;

  return (
    <>
    <Canvas
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        // No curve for now. The room went dark whenever a stream was in it,
        // and this looked like the cause; it was not. The SDK's HDR pass was
        // rendering the whole scene into a float target and compositing it
        // back unencoded, which HdrGuard now switches off. ACES could return.
        toneMapping: NoToneMapping,
      }}
      camera={{ position: [0, 1.7, 0.02], fov: 55 }}
      style={{ position: "fixed", top: 0, left: 0, width: "calc(100vw - var(--mw-side, 0px))", height: "100vh" }}
    >
      <hemisphereLight args={[0x7ea8c4, 0x0c141c, 0.45]} />
      {/* Strong enough to reach the deck at the walls. The scan is dark teal, and
          a point light with falloff lit only the middle of the room. */}
      <directionalLight position={[-6, 9, 4]} intensity={1.1} color={0xbfe0f2} />
      <pointLight position={[0, 0.3, 0]} intensity={4} distance={9} decay={2} color={0x3bd6fe} />

      {/* miris:scene-start */}
      {/* Steps 2.1 to 2.4 go here. */}
      {/* miris:scene-end */}

      {/* miris:card-start */}
      {/* Step 4.3 goes here. */}
      {/* miris:card-end */}


      <HdrGuard />
      <BudgetGuard />
      <CapsuleProbe />
      <GlassOrder />
      <CapsuleFocus />
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
