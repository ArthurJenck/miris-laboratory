const FLOOR = `      <fog attach="fog" args={[0x02050a, 20, 50]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[46, 96]} />
        <meshStandardMaterial {...floor} roughness={0.85} metalness={0.6} normalScale={[0.9, 0.9]} />
      </mesh>
      <mesh position={[0, 6.9, 0]}>
        <cylinderGeometry args={[46, 46, 14, 64, 1, false]} />
        <meshStandardMaterial color={0x04070b} roughness={1} metalness={0} side={DoubleSide} />
      </mesh>`;

const WALKWAY = `      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
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
      <mesh position={[0, 0.02, -10.7]}>
        <boxGeometry args={[2.4, 0.04, 14.2]} />
        <meshStandardMaterial color={0x0b1119} roughness={0.45} metalness={0.6} />
      </mesh>
      {[-1.22, 1.22].map((x) => (
        <mesh key={x} position={[x, 0.05, -10.7]}>
          <boxGeometry args={[0.05, 0.02, 14.2]} />
          <meshBasicMaterial color={0x3bd6fe} toneMapped={false} />
        </mesh>
      ))}
      <group position={[0, 0, -18.1]}>
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[3.8, 4.0, 0.6]} />
          <meshStandardMaterial color={0x0a0e14} roughness={0.55} metalness={0.45} />
        </mesh>
        <mesh position={[0, 1.8, 0.31]}>
          <planeGeometry args={[2.7, 3.3]} />
          <meshBasicMaterial color={0x1f5aa8} toneMapped={false} />
        </mesh>
        <group position={[0, 1.65, 0.33]} scale={[1, 1.35, 1]}>
          <RadialGlow radius={2.9} color={0x3f8fe0} opacity={0.85} />
          <RadialGlow radius={1.7} color={0x7fbaff} opacity={0.9} />
          <RadialGlow radius={0.85} color={0xe2f2ff} opacity={1} />
        </group>
        <pointLight position={[0, 1.2, 1.6]} intensity={110} distance={24} decay={2} color={0x7cc0ff} />
        <group position={[0, 0, 2.6]}>
          <FloorGlow radius={3.6} color={0x9ad4ff} opacity={0.95} />
        </group>
      </group>`;

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
            <mesh position={[0, 1.66, 0]} name={"glass-" + i}>
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
            <Pulse color={TINTS[i]} seed={i / 6} />
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

const FIELD = `  // TSL: JavaScript that builds a shader graph. Each call is a node, and the
  // graph runs once per pixel, every frame, on the GPU.
  const field = useMemo(() => Fn(() => {
    // Where this pixel is: uv() runs 0 to 1 across the screen; this makes it
    // -1 to 1 from the middle, stretched so a circle stays a circle.
    const p = uv().mul(2).sub(1).mul(vec2(screenAspect, float(1)));
    // Scanlines: a sine wave up the screen, drifting with time, kept faint.
    const wave = uv().y.mul(220).sub(time.mul(1.4)).sin();
    const scan = wave.mul(0.5).add(0.5).mul(0.03);
    // Vignette: distance from the middle, nothing until 0.8, darkest at 1.6.
    const edge = smoothstep(float(0.8), float(1.6), p.length()).mul(0.5);
    // Colour and alpha. The lines add cyan light; the vignette adds only
    // alpha, and black at any alpha darkens whatever is behind it.
    return vec4(vec3(0.42, 0.86, 1.0).mul(scan), scan.add(edge));
  })(), []);`;

const MARKUP = `  // The file is HTML. The browser lays it out with the guide's own CSS, then
  // paints it into a canvas, and that canvas becomes a texture on a plane.
  const fileMarkup = (d: any) => \`
    <div class="mw-dossier">
      <p class="mw-d-code">\${d.designation} / \${d.series}</p>
      <h3>\${d.name}</h3>
      <p class="mw-d-class">\${d.classification}</p>
      <ol class="mw-d-series">
        \${d.stages.map((name: string, k: number) => \`
          <li class="\${k === d.index ? "on" : ""}"><b>\${String(k + 1).padStart(2, "0")}</b><span>\${name}</span></li>\`).join("")}
      </ol>
      <p class="mw-d-stage">Stage \${d.index + 1} of \${d.stages.length}: \${d.stage}</p>
      <ul class="mw-d-stats">
        \${(d.stats || []).map((s: any) => \`
          <li><span>\${s.label}</span><i><b style="width:\${s.value}%"></b></i><span>\${s.value}</span></li>\`).join("")}
      </ul>
      <p class="mw-d-head">Handler notes</p>
      <p class="mw-d-notes">\${d.notes}</p>
    </div>\`;`;

const FIT = `// A generated mesh arrives at whatever size the generator chose, and a stream
// reports its bounds in world space, scale included. So: measure, scale
// toward what fits, measure again, and stop once it has settled.
function FitInGlass({ position, fill = 0.7, children }: any) {
  const box = useRef<Group>(null);
  const settled = useRef(false);
  useFrame(() => {
    const g = box.current;
    if (!g || settled.current) return;
    let stream: any = null;
    g.traverse((o: any) => { if (!stream && o.getBounds) stream = o; });
    const b = stream?.getBounds();
    if (!b || !(b.size[1] > 0)) return;
    // The glass is 2.6 tall and 1.8 across; the tighter limit wins.
    const want = Math.min((2.6 * fill) / b.size[1], (1.8 * fill) / Math.max(b.size[0], b.size[2]));
    if (Math.abs(want - 1) < 0.01) { settled.current = true; return; }
    g.scale.multiplyScalar(1 + (want - 1) * 0.6);
    g.position.x += (position[0] - b.center[0]) * 0.6;
    g.position.y += (1.66 - b.center[1]) * 0.6;
    g.position.z += (position[2] - b.center[2]) * 0.6;
  });
  return <group ref={box} position={position}>{children}</group>;
}`;

const FILE = `// Paint the markup into a canvas and wear it as a texture. The browser lays
// the HTML out, drawElementImage copies the pixels, and three samples them.
function File({ html }: { html: string }) {
  const { texture, width, height } = useHtmlTexture(html);
  if (!texture) return null;
  return (
    <mesh position={[width / 2, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} alphaTest={0.5} toneMapped={false} />
    </mesh>
  );
}`;

const CARD_PANEL = `      <Dossier specimens={specimens} />
      <Placard specimens={specimens}>{(d: any) => <File html={fileMarkup(d)} />}</Placard>`;

export const SNIPPETS = {
  floor: FLOOR,
  walkway: `${FLOOR}\n${WALKWAY}`,
  capsules: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}`,
  streams: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}\n${STREAMS}`,
  fit: FIT,
  file: `${FIT}\n\n${FILE}`,
  hud: HUD,
  effect: EFFECT,
  field: FIELD,
  markup: MARKUP,
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
  fit: FIT,
  file: FILE,
  hud: HUD,
  effect: EFFECT,
  field: FIELD,
  markup: MARKUP,
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
  fit: null,
  file: "fit",
  hud: null,
  effect: null,
  field: null,
};

export const MARKER_FOR = {
  fit: "parts",
  file: "parts",
  markup: "markup",
  card: "card",
  floor: "scene",
  walkway: "scene",
  capsules: "scene",
  streams: "scene",
  hud: "hud",
  effect: "effect",
  field: "field",
};
