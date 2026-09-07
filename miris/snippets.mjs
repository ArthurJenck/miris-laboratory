const FLOOR = `      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial map={deck} roughnessMap={wear} roughness={0.9} metalness={0.35} />
      </mesh>
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
            <meshBasicMaterial
              map={shade}
              color={0x3f8fe0}
              transparent
              opacity={0.9}
              depthWrite={false}
              side={DoubleSide}
            />
          </mesh>
        );
      })}`;

const WALKWAY = `      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.6, 3.8, 64]} />
        <meshStandardMaterial map={walk} roughnessMap={wear} roughness={0.5} metalness={0.55} />
      </mesh>
      {[2.6, 3.8].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <torusGeometry args={[r, 0.03, 6, 96]} />
          <meshBasicMaterial color={0x3bd6fe} toneMapped={false} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[3.12, 3.28, 64]} />
        <meshBasicMaterial color={0xc8e8f7} toneMapped={false} transparent opacity={0.75} />
      </mesh>`;

const CAPSULES_SNIPPET = `      {specimens.map((s, i) => {
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
                emissiveIntensity={0.35}
                transparent
                opacity={0.16}
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
                <torusGeometry args={[0.9, 0.022, 6, 48]} />
                <meshBasicMaterial color={0x3f93b0} toneMapped={false} />
              </mesh>
            ))}
            <mesh position={[0, 4.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.34, 24]} />
              <meshBasicMaterial color={0xa9d6e8} toneMapped={false} />
            </mesh>
          </group>
        );
      })}`;

const STREAMS = `      {specimens.map((s, i) => {
        if (!s.uuid) return null;
        const angle = (i / 6) * Math.PI * 2;
        return (
          <FitInGlass key={s.id} position={[Math.cos(angle) * 4.2, 1.66, Math.sin(angle) * 4.2]} fill={0.7}>
            <mirisStream args={[{ uuid: s.uuid, viewerKey: data.viewerKey || DEMO_KEY }]} />
          </FitInGlass>
        );
      })}`;


const HUD = `    <LabHud specimens={specimens} />`;

const EFFECT = `    <EffectCanvas node={field} />`;

const FIELD = `  const field = useMemo(() => Fn(() => {
    const p = uv().mul(2).sub(1).mul(vec2(screenAspect, float(1)));
    const a = anchorPos.mul(vec2(screenAspect, float(1)));
    const d = p.sub(a).length();
    const halo = smoothstep(float(0.02), float(0.5), d).oneMinus().mul(anchorSeen);
    const scan = uv().y.mul(220).sub(time.mul(1.4)).sin().mul(0.5).add(0.5).mul(0.03);
    const glow = halo.mul(0.5).add(scan);
    return vec4(vec3(0.42, 0.86, 1.0).mul(glow), glow);
  })(), []);`;

const CARD_PANEL = `    <Dossier specimens={specimens} />`;

export const SNIPPETS = {
  floor: FLOOR,
  walkway: `${FLOOR}\n${WALKWAY}`,
  capsules: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}`,
  streams: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}\n${STREAMS}`,
  hud: HUD,
  effect: EFFECT,
  field: FIELD,
  card: CARD_PANEL,
};

/* What each step actually adds. SNIPPETS is cumulative because the scene ones
   share a marker, so showing an attendee SNIPPETS.capsules would show them the
   walkway they already have. The Fill button writes the cumulative block; the
   card shows the part. */
export const PARTS = {
  floor: FLOOR,
  walkway: WALKWAY,
  capsules: CAPSULES_SNIPPET,
  streams: STREAMS,
  hud: HUD,
  effect: EFFECT,
  field: FIELD,
  card: CARD_PANEL,
};

/* Clearing a step puts the block back to the step before it, not to empty.
   Four steps share the `scene` marker because the snippets are cumulative, so
   a marker-wide clear at 2.2 would take 2.1's deck with it. null means there is
   nothing before it and the block returns to the template's blank. */
export const CLEARS_TO = {
  card: null,
  floor: null,
  walkway: "floor",
  capsules: "walkway",
  streams: "capsules",
  hud: null,
  effect: null,
  field: null,
};

export const MARKER_FOR = {
  card: "card",
  floor: "scene",
  walkway: "scene",
  capsules: "scene",
  streams: "scene",
  hud: "hud",
  effect: "effect",
  field: "field",
};
