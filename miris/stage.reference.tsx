import { extend, type ThreeElement } from "@react-three/fiber";
import { MirisStream } from "@miris-inc/three";
import { useEffect, useState, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { Fn, float, hash, step, texture, time, uv, vec2, vec3, vec4 } from "three/tsl";
import { Scene, Room, Platform, Walkway, Door, Specimen, Screen, Readout, ScreenFx, screenTexture, Controls } from "../miris";
import specimens from "./specimens.json" with { type: "json" };

extend({ MirisStream });

declare module "@react-three/fiber" {
  interface ThreeElements {
    mirisStream: ThreeElement<typeof MirisStream>;
  }
}

// The viewer key you scoped to your six assets. Every stream reads through it.
const viewerKey = "EtE0iRieHOo_fauIBuMJIr0YR4-OyWtA6Z3jUd55Msc";

// The file is HTML. The browser lays it out with the lab's own CSS; the next
// step draws it into a canvas, and that canvas becomes a texture on a plane.
const fileMarkup = (dossier: any) => `
  <div class="mw-dossier mw-screen">
    <header class="mw-d-terminal">MIRIS BIOLOGY DIVISION <span>M-06 / RECORD ACCESS</span></header>
    <div>
      <p class="mw-d-code">${dossier.designation} / ${dossier.series}</p>
      <h3>${dossier.name}</h3>
      <p class="mw-d-class">${dossier.classification}</p>
      <ol class="mw-d-series">
        ${dossier.stages.map((stageName: string, stageIndex: number) => `
          <li class="${stageIndex === dossier.index ? "on" : ""}"><b>${String(stageIndex + 1).padStart(2, "0")}</b><span>${stageName}</span></li>`).join("")}
      </ol>
      <p class="mw-d-stage">Stage ${dossier.index + 1} of ${dossier.stages.length}: ${dossier.stage}</p>
      <ul class="mw-d-stats">
        ${(dossier.stats || []).map((stat: any) => `
          <li><span>${stat.label}</span><i><b style="width:${stat.value}%"></b></i><span>${stat.value}</span></li>`).join("")}
      </ul>
    </div>
    <div>
      <p class="mw-d-head">Field observations</p>
      <p class="mw-d-notes">${dossier.notes}</p>
    </div>
    <footer class="mw-d-terminal">BIOLOGICAL RECORD / READ ONLY <span>TERMINAL ${String(dossier.index + 1).padStart(2, "0")} / 06</span></footer>
  </div>`;

// Lay the file out as real HTML inside a canvas, draw it in whenever it
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
}

// Your file. Each step adds a few lines to it.
export default function Stage() {
  const glitch = useMemo(() => Fn(() => {
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
  })(), []);

  return (
    <>
      <Scene>
        <Room />
        <Platform />
        <Walkway />
        <Door />
        {specimens.map((specimen, index) => (
          <Specimen key={index}>
            <mirisStream args={[{ uuid: specimen.uuid, viewerKey }]} scale={specimen.scale} />
            <Screen>
              <File />
            </Screen>
          </Specimen>
        ))}
      </Scene>

      <Readout />
      <ScreenFx node={glitch} />
      <Controls />
    </>
  );
}
