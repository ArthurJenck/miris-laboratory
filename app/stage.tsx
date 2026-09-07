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
  const field = useMemo(() => Fn(() => {
    const p = uv().mul(2).sub(1).mul(vec2(screenAspect, float(1)));
    const a = anchorPos.mul(vec2(screenAspect, float(1)));
    const d = p.sub(a).length();
    const halo = smoothstep(float(0.02), float(0.5), d).oneMinus().mul(anchorSeen);
    const scan = uv().y.mul(220).sub(time.mul(1.4)).sin().mul(0.5).add(0.5).mul(0.03);
    const glow = halo.mul(0.5).add(scan);
    return vec4(vec3(0.42, 0.86, 1.0).mul(glow), glow);
  })(), []);
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial map={deck} roughnessMap={wear} roughness={0.9} metalness={0.35} />
      </mesh>
      <gridHelper args={[36, 36, 0x1d4c60, 0x123243]} position={[0, 0, 0]} />
      <mesh position={[0, 6.9, 0]}>
        <cylinderGeometry args={[16, 16, 14, 48, 1, false]} />
        <meshStandardMaterial
          map={wall}
          emissiveMap={wallGlow}
          emissive={0xffffff}
          emissiveIntensity={0.35}
          roughness={0.9}
          metalness={0.1}
          side={DoubleSide}
        />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = ((i + 0.5) / 6) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 9.4, 2.1, Math.sin(angle) * 9.4]}
            rotation={[0, -angle + Math.PI / 2, 0]}
          >
            <planeGeometry args={[2.6, 3.4]} />
            <meshBasicMaterial color={0x0d5eb1} toneMapped={false} transparent opacity={0.5} side={DoubleSide} />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.6, 3.8, 64]} />
        <meshStandardMaterial map={walk} roughnessMap={wear} roughness={0.5} metalness={0.55} />
      </mesh>
      {[2.6, 3.8].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <torusGeometry args={[r, 0.022, 8, 128]} />
          <meshBasicMaterial color={0x3bd6fe} toneMapped={false} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[3.12, 3.28, 64]} />
        <meshBasicMaterial color={0xffffff} toneMapped={false} transparent opacity={0.85} />
      </mesh>
      {specimens.map((s, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 4.2;
        const z = Math.sin(angle) * 4.2;
        return (
          <group key={s.id} position={[x, 0, z]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[1.05, 1.18, 0.36, 32]} />
              <meshStandardMaterial color={0x0b0d10} roughness={0.6} metalness={0.35} />
            </mesh>
            <mesh position={[0, 1.66, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 2.6, 40, 1, true]} />
              <meshStandardMaterial
                color={TINTS[i]}
                emissive={TINTS[i]}
                emissiveIntensity={0.5}
                transparent
                opacity={0.18}
                roughness={0.2}
                metalness={0.1}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
            <LightShaft />
            <Bubbles color={TINTS[i]} />
            <FloorGlow color={TINTS[i]} />
            {[0.36, 2.96].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.9, 0.014, 8, 64]} />
                <meshBasicMaterial color={0x3f93b0} toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, 4.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.34, 24]} />
              <meshBasicMaterial color={0xa9d6e8} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      {specimens.map((s, i) => {
        if (!s.uuid) return null;
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mirisStream
            key={s.id}
            position={[Math.cos(angle) * 4.2, 1.6, Math.sin(angle) * 4.2]}
            scale={0.15}
            args={[{ uuid: s.uuid, viewerKey: data.viewerKey || DEMO_KEY }]}
          />
        );
      })}
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
    <Dossier specimens={specimens} />
    {/* miris:card-end */}

    {/* miris:hud-start */}
    <LabHud specimens={specimens} />
    {/* miris:hud-end */}

    {/* miris:effect-start */}
    <EffectCanvas node={field} />
    {/* miris:effect-end */}
    </>
  );
}
