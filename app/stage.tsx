import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, extend, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MirisStream } from "@miris-inc/three";
import { VIEWER_KEY as DEMO_KEY } from "../miris/config";
import { Group, NoToneMapping } from "three";
import { Fn, float, hash, step, texture, time, uv, vec2, vec3, vec4 } from "three/tsl";
import Dossier from "../miris/Dossier";
import LabHud, { CapsuleProbe } from "../miris/LabHud";
import CapsuleFocus from "../miris/CapsuleFocus";
import Pedestals from "../miris/Pedestals";
import useHtmlTexture from "../miris/htmlTexture";
import HdrGuard from "../miris/HdrGuard";
import BudgetGuard from "../miris/BudgetGuard";
import GlassOrder from "../miris/GlassOrder";
import { floorMaps, walkwayTexture, wearMap } from "../miris/textures";
import ScreenFx, { screen } from "../miris/ScreenFx";
import { VaultFloor, VaultWalkway, VaultCapsule } from "../miris/VaultRoom";
import { StageSkeleton } from "../miris/Skeleton";

extend({ MirisStream });

// miris:parts-start
function FitInGlass({ position, children }: any) {
  return <group position={position}>{children}</group>;
}
// miris:parts-end

// Your file. Each step's code goes between the miris: comments below.
export default function Stage({ initialData }: { initialData?: any } = {}) {
  const [data, setData] = useState<any>(initialData ?? null);

  useEffect(() => {
    if (initialData) return;
    fetch(import.meta.env.PROD ? "/miris-scene.json" : "/api/miris")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({}));
  }, [initialData]);


  // miris:markup-start
  const fileMarkup = undefined;
  // miris:markup-end

  // miris:field-start
  const glitch = null;
  // miris:field-end

  const specimens = data?.specimens ?? [];
  const floor = useMemo(() => floorMaps(14), []);
  const walk = useMemo(() => { const t = walkwayTexture(); t.repeat.set(6, 6); return t; }, []);
  const wear = useMemo(() => { const t = wearMap(); t.repeat.set(7, 7); return t; }, []);

  useEffect(() => () => {
    Object.values(floor).forEach((map) => map.dispose());
    walk.dispose();
    wear.dispose();
  }, [floor, walk, wear]);

  if (!data || !data.track) return <StageSkeleton />;

  return (
    <>
    <Canvas
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: NoToneMapping,
      }}
      camera={{ position: [0, 1.7, 0.02], fov: 55 }}
      style={{ position: "fixed", top: 0, left: 0, width: "calc(100vw - var(--mw-side, 0px))", height: "100dvh", touchAction: "none" }}
    >
      <hemisphereLight args={[0xb7d8f0, 0x26323b, 1.2]} />
      <directionalLight position={[-6, 9, 4]} intensity={2.1} color={0xbfe0f2} />
      <pointLight position={[0, 0.3, 0]} intensity={4} distance={9} decay={2} color={0x3bd6fe} />

      {/* miris:scene-start */}

      {/* miris:scene-end */}

      {/* miris:card-start */}

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

    {/* miris:hud-end */}

    {/* miris:effect-start */}

    {/* miris:effect-end */}
    </>
  );
}
