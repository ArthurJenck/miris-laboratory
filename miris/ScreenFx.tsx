import { useEffect, useRef } from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from "three";
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGPURenderer } from "three/webgpu";
import { getSelected, getSelectedPart, subscribeLab } from "./labState";

// Only the visible terminal needs a CRT frame; keep its cross-canvas upload at 30 Hz.
const W = 1024;
const H = 640;
const FRAME_MS = 1000 / 30;
/* The painted file as the glitch sees it: one texture whose canvas is swapped
   to whichever screen is being read, so the attendee's graph can name it. */
const blank = document.createElement("canvas");
blank.width = 1;
blank.height = 1;
export const screenTexture = new CanvasTexture(blank);
screenTexture.colorSpace = SRGBColorSpace;
screenTexture.minFilter = LinearFilter;
screenTexture.magFilter = LinearFilter;
screenTexture.generateMipmaps = false;

let source: Texture | null = null;
let sourceVersion = -1;
let sourceOwner = -1;
let output: CanvasTexture | null = null;
export const getScreenOutput = () => output;

/** Points the glitch at a screen's painted texture. Cheap to call every frame:
 *  nothing is uploaded unless the texture or its painting changed. */
export function setScreenSource(painted: Texture, owner: number) {
  sourceOwner = owner;
  if (painted === source && painted.version === sourceVersion) return;
  source = painted;
  sourceVersion = painted.version;
  screenTexture.image = painted.image as HTMLCanvasElement;
  screenTexture.needsUpdate = true;
}

export default function ScreenFx({ node }: { node: any }) {
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const matRef = useRef<MeshBasicNodeMaterial | null>(null);
  const hasNode = node != null;

  useEffect(() => {
    if (!hasNode) return;
    const canvas = document.createElement("canvas");
    let live = true;
    let raf: number | null = null;
    let renderer: WebGPURenderer | null = null;
    let material: MeshBasicNodeMaterial | null = null;
    let geometry: PlaneGeometry | null = null;
    let out: CanvasTexture | null = null;
    let unsubscribe = () => {};
    let onVisibility = () => {};

    (async () => {
      const r = new WebGPURenderer({ canvas, forceWebGL: true, antialias: false });
      renderer = r;
      await r.init();
      if (!live) return void r.dispose();
      r.setPixelRatio(1);
      r.setSize(W, H, false);
      r.setClearColor(0x000000, 1);
      const scene = new Scene();
      const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const mat = new MeshBasicNodeMaterial();
      material = mat;
      mat.colorNode = nodeRef.current;
      matRef.current = mat;
      geometry = new PlaneGeometry(2, 2);
      scene.add(new Mesh(geometry, mat));
      out = new CanvasTexture(canvas);
      out.flipY = true;
      out.colorSpace = SRGBColorSpace;
      out.minFilter = LinearFilter;
      out.magFilter = LinearFilter;
      out.generateMipmaps = false;
      output = out;
      let lastDraw = -Infinity;
      const active = () => live && !document.hidden && getSelected() >= 0 && getSelectedPart() === "pedestal";
      const loop = (now: number) => {
        raf = null;
        if (!active()) return;
        if (source && sourceOwner === getSelected() && now - lastDraw >= FRAME_MS - 0.1) {
          r.render(scene, cam);
          out!.needsUpdate = true;
          lastDraw = now;
        }
        raf = requestAnimationFrame(loop);
      };
      const sync = () => {
        if (active()) {
          if (raf === null) {
            lastDraw = -Infinity;
            raf = requestAnimationFrame(loop);
          }
        } else if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      };
      unsubscribe = subscribeLab(sync);
      onVisibility = sync;
      document.addEventListener("visibilitychange", onVisibility);
      sync();
    })().catch((error) => {
      if (live) console.warn("CRT renderer unavailable; keeping the painted terminal.", error);
      renderer?.dispose();
    });

    return () => {
      live = false;
      if (raf !== null) cancelAnimationFrame(raf);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      if (output === out) output = null;
      if (matRef.current === material) matRef.current = null;
      out?.dispose();
      material?.dispose();
      geometry?.dispose();
      renderer?.dispose();
      source = null;
      sourceVersion = -1;
      sourceOwner = -1;
      screenTexture.image = blank;
      screenTexture.needsUpdate = true;
    };
  }, [hasNode]);

  useEffect(() => {
    const mat = matRef.current;
    if (!mat || !node) return;
    mat.colorNode = node;
    mat.needsUpdate = true;
  }, [node]);

  return null;
}
