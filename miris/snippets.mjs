const FLOOR = `      <VaultFloor floor={floor} />`;

const WALKWAY = `      <VaultWalkway walk={walk} wear={wear} />`;

const CAPSULES_SNIPPET = `      {specimens.map((s, i) => <VaultCapsule key={s.id} index={i} />)}`;

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

const FIELD = `  const glitch = useMemo(() => Fn(() => {
    const p = uv();
    const tick = time.mul(0.55).floor();
    const live = step(float(0.83), hash(tick.add(3))).mul(step(time.mul(0.55).fract(), float(0.055)));
    const band = step(p.y.sub(hash(tick)).abs(), float(0.018));
    const shift = band.mul(live).mul(0.014);
    const q = vec2(p.x.add(shift), p.y);
    const c = texture(screen, q);
    const phosphor = c.r.mul(0.21).add(c.g.mul(0.72)).add(c.b.mul(0.07));
    const scan = p.y.mul(1131).sin().mul(0.035).add(0.965);
    const flicker = time.mul(8).sin().mul(0.006).add(0.994);
    const edge = p.x.mul(p.x.oneMinus()).mul(p.y).mul(p.y.oneMinus()).mul(16).pow(0.12);
    const glow = texture(screen, q.add(vec2(0.0015, 0))).g.mul(0.08);
    return vec4(vec3(0.48, 0.78, 1).mul(phosphor.add(glow)).mul(scan).mul(flicker).mul(edge), float(1));
  })(), []);`;

const MARKUP = `  // The file is HTML. The browser lays it out with the guide's own CSS, then
  // paints it into a canvas, and that canvas becomes a texture on a plane.
  const fileMarkup = (d: any) => \`
    <div class="mw-dossier mw-screen">
      <header class="mw-d-terminal">MIRIS BIOLOGY DIVISION <span>M-06 / RECORD ACCESS</span></header>
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
        <p class="mw-d-head">Field observations</p>
        <p class="mw-d-notes">\${d.notes}</p>
      </div>
      <footer class="mw-d-terminal">BIOLOGICAL RECORD / READ ONLY <span>TERMINAL \${String(d.index + 1).padStart(2, "0")} / 06</span></footer>
    </div>\`;`;

const FIT = `function FitInGlass({ position, fill = 0.7, children }: any) {
  const turntable = useRef<Group>(null);
  const box = useRef<Group>(null);
  const settled = useRef(false);
  useFrame((_, dt) => {
    const g = box.current;
    if (!g || !turntable.current) return;
    if (settled.current) {
      turntable.current.rotation.y = (turntable.current.rotation.y + Math.min(dt, 0.1) * 0.08) % (Math.PI * 2);
      return;
    }
    let stream: any = null;
    g.traverse((o: any) => { if (!stream && o.getBounds) stream = o; });
    const b = stream?.getBounds();
    if (!b || !(b.size[1] > 0)) return;
    // Fit the horizontal diagonal so every angle clears the glass.
    const want = Math.min((2.6 * fill) / b.size[1], (1.8 * fill) / Math.hypot(b.size[0], b.size[2]));
    if (Math.abs(want - 1) < 0.01) {
      g.position.x += position[0] - b.center[0];
      g.position.y += position[1] - b.center[1];
      g.position.z += position[2] - b.center[2];
      settled.current = true;
      return;
    }
    g.scale.multiplyScalar(1 + (want - 1) * 0.6);
    g.position.x += (position[0] - b.center[0]) * 0.6;
    g.position.y += (position[1] - b.center[1]) * 0.6;
    g.position.z += (position[2] - b.center[2]) * 0.6;
  });
  return <group ref={turntable} position={position}><group ref={box}>{children}</group></group>;
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
   nothing before it and the block returns to its empty lesson state. */
export const EMPTY_BLOCKS = {
  scene: "",
  card: "",
  hud: "",
  effect: "",
  field: "  const glitch = null;",
  markup: "  const fileMarkup = undefined;",
  parts: `function FitInGlass({ position, children }: any) {
  return <group position={position}>{children}</group>;
}`,
};

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
