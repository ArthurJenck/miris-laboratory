import { useEffect, useMemo, useState } from "react";
import { Canvas, extend } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { TINTS, VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { DoubleSide, NoToneMapping } from "three";
import { Fn, float, smoothstep, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Dossier from "../miris/Dossier";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import CapsuleFocus from "../miris/CapsuleFocus";
import FitInGlass from "../miris/FitInGlass";
import { FloorGlow, LightShaft, Pulse } from "../miris/CapsuleFx";
import { floorMaps, walkwayTexture, wearMap } from "../miris/textures";
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
        // NoToneMapping, and not by preference. With a stream in the scene the
        // SDK's render pass puts the curve through a second time: the glass,
        // the rings and the wall strips all dropped to near black the moment
        // step 2.5 landed, while the specimen itself stayed correct. Measured
        // three ways: no streams and ACES is right, streams and ACES is dark,
        // streams and no curve is right. Until the SDK stops doing that, the
        // scene is graded without one.
        toneMapping: NoToneMapping,
      }}
      camera={{ position: [0, 1.7, 0.02], fov: 55 }}
      style={{ position: "fixed", inset: 0 }}
    >
      <hemisphereLight args={[0x7ea8c4, 0x0c141c, 0.45]} />
      {/* Strong enough to reach the deck at the walls. The scan is dark teal, and
          a point light with falloff lit only the middle of the room. */}
      <directionalLight position={[-6, 9, 4]} intensity={1.1} color={0xbfe0f2} />
      <pointLight position={[0, 0.3, 0]} intensity={4} distance={9} decay={2} color={0x3bd6fe} />

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
