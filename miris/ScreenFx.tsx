import { useEffect, useRef } from "react";
import { CanvasTexture, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, type Texture, UnsignedByteType } from "three";
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGPURenderer } from "three/webgpu";
import { getSelected, getSelectedPart, subscribeLab } from "./labState";

// Only the visible terminal needs a CRT frame; keep its cross-canvas upload at 30 Hz.
const W = 1024;
const H = 640;
const FRAME_MS = 1000 / 30;
export const screen = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType);
screen.flipY = false;
screen.colorSpace = SRGBColorSpace;
screen.minFilter = LinearFilter;
screen.magFilter = LinearFilter;
screen.needsUpdate = true;

let source: Texture | null = null;
let sourceOwner = -1;
let output: CanvasTexture | null = null;
export const getScreenOutput = () => output;

export function setScreenSource(t: Texture, owner: number) {
  sourceOwner = owner;
  if (t === source) return;
  source = t;
  screen.image = t.image as any;
  screen.needsUpdate = true;
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
      sourceOwner = -1;
      screen.image = { data: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1 };
      screen.needsUpdate = true;
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
