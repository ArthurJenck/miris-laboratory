import { useEffect, useRef } from "react";
import { CanvasTexture, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, type Texture, UnsignedByteType } from "three";
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGPURenderer } from "three/webgpu";

/* TSL cannot render inside the splat canvas, so the glitch runs here, in a
   renderer of its own, over the painted file, and the result is copied onto
   the active pedestal's screen each frame. One screen, one copy: cheap. Six
   would not be, so the other five show the file as painted. */
const W = 1024;
const H = 576;

/** The painted file the graph reads. One texture object, so the attendee's
 *  graph can name it; its pixels are swapped for whichever screen is active. */
export const screen = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType);
screen.flipY = false;
screen.colorSpace = SRGBColorSpace;
screen.minFilter = LinearFilter;
screen.magFilter = LinearFilter;
screen.needsUpdate = true;

let source: Texture | null = null;
let output: CanvasTexture | null = null;

/** The glitched frame, as a texture the main canvas can wear. Null until the
 *  graph exists and has drawn once. */
export const getScreenOutput = () => output;

/** Point the graph at a painted file. Same object, new pixels. */
export function setScreenSource(t: Texture) {
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
    // Never in the DOM: nothing looks at this canvas, the texture reads it.
    const canvas = document.createElement("canvas");
    let live = true;
    let raf = 0;
    let renderer: WebGPURenderer | null = null;

    (async () => {
      const r = new WebGPURenderer({ canvas, forceWebGL: true, antialias: false });
      await r.init();
      if (!live) return void r.dispose();
      renderer = r;
      r.setPixelRatio(1);
      r.setSize(W, H, false);
      r.setClearColor(0x000000, 1);
      const scene = new Scene();
      const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const mat = new MeshBasicNodeMaterial();
      mat.colorNode = nodeRef.current;
      matRef.current = mat;
      scene.add(new Mesh(new PlaneGeometry(2, 2), mat));
      const out = new CanvasTexture(canvas);
      // Upright as read from a canvas: the default flip on upload is the one
      // that matches the painted file. Checked both ways.
      out.flipY = true;
      out.colorSpace = SRGBColorSpace;
      out.minFilter = LinearFilter;
      out.magFilter = LinearFilter;
      out.generateMipmaps = false;
      output = out;
      const loop = () => {
        if (!live) return;
        if (source) {
          r.render(scene, cam);
          out.needsUpdate = true;
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      output?.dispose();
      output = null;
      matRef.current?.dispose();
      matRef.current = null;
      renderer?.dispose();
    };
  }, [hasNode]);

  // A new graph swaps the material's node; it never rebuilds the renderer.
  useEffect(() => {
    const mat = matRef.current;
    if (!mat || !node) return;
    mat.colorNode = node;
    mat.needsUpdate = true;
  }, [node]);

  return null;
}
