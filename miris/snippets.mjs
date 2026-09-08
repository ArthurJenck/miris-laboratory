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
        <meshBasicMaterial color={0xd9e6ec} toneMapped={false} />
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
                emissiveIntensity={0.12}
                transparent
                opacity={0.05}
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

const EFFECT = `    <ScreenFx node={glitch} />`;

const FIELD = `  // TSL: JavaScript that builds a shader graph. Each call is a node, and the
  // graph runs once per pixel of the screen, every frame, on the GPU.
  const glitch = useMemo(() => Fn(() => {
    // The painted file is the texture \`screen\`; p is where this pixel is on it.
    const p = uv();
    // A clock that ticks every second and a half. hash turns a tick into a
    // number that holds still until the next one; only about one tick in
    // four earns a tear, and it lasts a tenth of the tick.
    const tick = time.mul(0.66).floor();
    const rare = step(float(0.75), hash(tick.add(3)));
    const live = step(time.mul(0.66).fract(), float(0.1)).mul(rare);
    const band = hash(tick).mul(0.8).add(0.1);
    const inBand = step(p.y.sub(band).abs(), float(0.03));
    const shift = inBand.mul(live).mul(hash(tick.add(11)).sub(0.5)).mul(0.08);
    // Sample the file with the torn rows slid sideways, red pulled a little further.
    const q = vec2(p.x.add(shift), p.y);
    const c = texture(screen, q);
    const r = texture(screen, q.add(vec2(shift.mul(0.6), float(0)))).r;
    // Faint scanlines and a softer flicker, so it reads as a screen and stays legible.
    const scan = p.y.mul(400).sin().mul(0.5).add(0.5).mul(0.06).oneMinus();
    const flicker = time.mul(9).sin().mul(0.01).add(0.99);
    return vec4(vec3(r, c.g, c.b).mul(scan).mul(flicker), float(1));
  })(), []);`;

const MARKUP = `  // The file is HTML. The browser lays it out with the guide's own CSS, then
  // paints it into a canvas, and that canvas becomes a texture on a plane.
  const fileMarkup = (d: any) => \`
    <div class="mw-dossier mw-screen">
      <div>
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
      </div>
      <div>
        <p class="mw-d-head">Handler notes</p>
        <p class="mw-d-notes">\${d.notes}</p>
      </div>
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
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}`;

const CARD_PANEL = `      <Dossier specimens={specimens} />
      <Pedestals specimens={specimens}>{(d: any) => <File html={fileMarkup(d)} />}</Pedestals>`;

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
