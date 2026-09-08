/* The code each step adds to app/stage.tsx, and where it goes. */

// Inside <Scene>: one line per part of the room.
const FLOOR = `        <Floor />`;
const PLATFORM = `        <Platform />`;
const WALKWAY = `        <Walkway />`;
const DOOR = `        <Door />`;
const SPECIMENS = `        {specimens.map((specimen, index) => <Specimen key={index} />)}`;
const STREAMS = `        {specimens.map((specimen, index) => (
          <Specimen key={index}>
            <mirisStream args={[{ uuid: specimen.uuid, viewerKey }]} scale={specimen.scale} />
          </Specimen>
        ))}`;
const SCREENS = `        {specimens.map((specimen, index) => (
          <Specimen key={index}>
            <mirisStream args={[{ uuid: specimen.uuid, viewerKey }]} scale={specimen.scale} />
            <Screen>
              <File />
            </Screen>
          </Specimen>
        ))}`;

// After <Scene>: on the page, not in the canvas.
const HUD = `      <Readout />`;
const EFFECT = `      <ScreenFx node={glitch} />`;

const FIELD = `  const glitch = useMemo(() => Fn(() => {
    const point = uv();
    const tick = time.mul(0.55).floor();
    const live = step(float(0.83), hash(tick.add(3))).mul(step(time.mul(0.55).fract(), float(0.055)));
    const band = step(point.y.sub(hash(tick)).abs(), float(0.018));
    const shift = band.mul(live).mul(0.014);
    const shifted = vec2(point.x.add(shift), point.y);
    const color = texture(screenTexture, shifted);
    const phosphor = color.r.mul(0.21).add(color.g.mul(0.72)).add(color.b.mul(0.07));
    const scan = point.y.mul(1131).sin().mul(0.035).add(0.965);
    const flicker = time.mul(8).sin().mul(0.006).add(0.994);
    const edge = point.x.mul(point.x.oneMinus()).mul(point.y).mul(point.y.oneMinus()).mul(16).pow(0.12);
    const glow = texture(screenTexture, shifted.add(vec2(0.0015, 0))).g.mul(0.08);
    return vec4(vec3(0.48, 0.78, 1).mul(phosphor.add(glow)).mul(scan).mul(flicker).mul(edge), float(1));
  })(), []);`;

const MARKUP = `// The file is HTML. The browser lays it out with the lab's own CSS; the next
// step draws it into a canvas, and that canvas becomes a texture on a plane.
const fileMarkup = (dossier: any) => \`
  <div class="mw-dossier mw-screen">
    <header class="mw-d-terminal">MIRIS BIOLOGY DIVISION <span>M-06 / RECORD ACCESS</span></header>
    <div>
      <p class="mw-d-code">\${dossier.designation} / \${dossier.series}</p>
      <h3>\${dossier.name}</h3>
      <p class="mw-d-class">\${dossier.classification}</p>
      <ol class="mw-d-series">
        \${dossier.stages.map((stageName: string, stageIndex: number) => \`
          <li class="\${stageIndex === dossier.index ? "on" : ""}"><b>\${String(stageIndex + 1).padStart(2, "0")}</b><span>\${stageName}</span></li>\`).join("")}
      </ol>
      <p class="mw-d-stage">Stage \${dossier.index + 1} of \${dossier.stages.length}: \${dossier.stage}</p>
      <ul class="mw-d-stats">
        \${(dossier.stats || []).map((stat: any) => \`
          <li><span>\${stat.label}</span><i><b style="width:\${stat.value}%"></b></i><span>\${stat.value}</span></li>\`).join("")}
      </ul>
    </div>
    <div>
      <p class="mw-d-head">Field observations</p>
      <p class="mw-d-notes">\${dossier.notes}</p>
    </div>
    <footer class="mw-d-terminal">BIOLOGICAL RECORD / READ ONLY <span>TERMINAL \${String(dossier.index + 1).padStart(2, "0")} / 06</span></footer>
  </div>\`;`;

const FILE = `// Lay the file out as real HTML inside a canvas, draw it in whenever it
// paints, and wear that canvas as the texture of a plane.
function File({ dossier }: any) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("layoutsubtree", "");
    canvas.width = 1280;
    canvas.height = 800;
    // On the page but under the room: only what the browser paints can be drawn.
    canvas.style.cssText = "position: fixed; top: 0; left: 0; z-index: -1; pointer-events: none";
    canvas.innerHTML = fileMarkup(dossier);
    document.body.append(canvas);

    const painted = new CanvasTexture(canvas);
    painted.colorSpace = SRGBColorSpace;
    canvas.onpaint = () => {
      const context = canvas.getContext("2d")!;
      context.setTransform(2, 0, 0, 2, 0, 0);
      context.drawElementImage(canvas.firstElementChild!, 0, 0);
      painted.needsUpdate = true;
    };
    canvas.requestPaint?.();
    setTexture(painted);

    return () => {
      canvas.remove();
      painted.dispose();
    };
  }, [dossier]);

  if (!texture) return null;
  return (
    <mesh>
      <planeGeometry args={[1.6, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}`;

/* The function the starter ships with, so the stage compiles and Screen has
   something to hand the file to from the first step. */
export const PLACEHOLDERS = {
  file: `function File({ dossier }: any) {
  return null;
}`,
};

/* app/specimens.json as the starter ships it: six slots, no ids, life size. */
export const EMPTY_SPECIMENS = Array.from({ length: 6 }, () => ({ uuid: "", scale: 1 }));

const stack = (...lines) => lines.join("\n");

/* What Fill writes. The scene and hud markers are shared by several steps, so
   those snippets are cumulative: filling the platform writes the floor too,
   and each version of the specimen map replaces the one before it. */
export const SNIPPETS = {
  floor: FLOOR,
  platform: stack(FLOOR, PLATFORM),
  walkway: stack(FLOOR, PLATFORM, WALKWAY),
  door: stack(FLOOR, PLATFORM, WALKWAY, DOOR),
  specimens: stack(FLOOR, PLATFORM, WALKWAY, DOOR, SPECIMENS),
  streams: stack(FLOOR, PLATFORM, WALKWAY, DOOR, STREAMS),
  screens: stack(FLOOR, PLATFORM, WALKWAY, DOOR, SCREENS),
  file: FILE,
  markup: MARKUP,
  field: FIELD,
  hud: HUD,
  effect: stack(HUD, EFFECT),
};

/* What each step actually adds: the part the card shows. */
export const PARTS = {
  floor: FLOOR,
  platform: PLATFORM,
  walkway: WALKWAY,
  door: DOOR,
  specimens: SPECIMENS,
  streams: STREAMS,
  screens: SCREENS,
  file: FILE,
  markup: MARKUP,
  field: FIELD,
  hud: HUD,
  effect: EFFECT,
};

/* A block with nothing in it yet. */
export const EMPTY_BLOCKS = {
  scene: "",
  hud: "",
  field: "  const glitch = null;",
  markup: `const fileMarkup = (dossier: any) => "";`,
  parts: PLACEHOLDERS.file,
};

/* Clearing a step puts its block back to the step before it, not to empty, so
   a clear at 2.2 does not take 2.1's floor with it. null means there is
   nothing before it and the block returns to its empty state. */
export const CLEARS_TO = {
  floor: null,
  platform: "floor",
  walkway: "platform",
  door: "walkway",
  specimens: "door",
  streams: "specimens",
  screens: "streams",
  file: null,
  markup: null,
  field: null,
  hud: null,
  effect: "hud",
};

export const MARKER_FOR = {
  floor: "scene",
  platform: "scene",
  walkway: "scene",
  door: "scene",
  specimens: "scene",
  streams: "scene",
  screens: "scene",
  file: "parts",
  markup: "markup",
  field: "field",
  hud: "hud",
  effect: "hud",
};

/* Steps that replace one named function inside the parts block, leaving
   whatever else the attendee put there alone. */
export const PART_NAME = {
  file: "File",
};
