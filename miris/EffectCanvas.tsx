import { useEffect, useRef } from "react";
import { Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene, Vector2, WebGPURenderer } from "three/webgpu";
import { uniform } from "three/tsl";
import { anchor } from "./anchor";

/* Handed to the attendee's TSL so the field can centre on the asset. Module
   level, because the node graph is built before this canvas exists. */
export const anchorPos = uniform(new Vector2(0, 0));
export const anchorSeen = uniform(0);
/* Half width and half height of the hovered glass on screen. */
export const anchorSize = uniform(new Vector2(0, 0));
/* Width over height. Without it a round field reads as an ellipse. */
export const screenAspect = uniform(1);

/** The second canvas. TSL cannot share a renderer with the splats, so the
 *  effect gets its own, stacked over the first and never interactive. */
export default function EffectCanvas({ node }: { node: any }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const matRef = useRef<MeshBasicNodeMaterial | null>(null);
  // Read inside the loop rather than closed over, so a rebuilt graph does not
  // mean a rebuilt renderer: one canvas can only ever hand out one context.
  const nodeRef = useRef(node);
  nodeRef.current = node;
  // Only whether there is a graph at all remounts the renderer, never which.
  const hasNode = node != null;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let live = true;
    let raf = 0;
    let renderer: WebGPURenderer | null = null;
    let cleanup = () => {};

    (async () => {
      // forceWebGL because the splats already hold a WebGL context, and a
      // WebGPU one alongside it buys nothing a screen-space pass can use.
      const r = new WebGPURenderer({ canvas, forceWebGL: true, alpha: true, antialias: false });
      await r.init();
      if (!live) return void r.dispose();
      renderer = r;

      // Sized from the element, not the window: the sidebar takes a strip of
      // the window and the overlay has to stop where the stage stops.
      const resize = () => {
        const w = canvas.clientWidth || innerWidth;
        const h = canvas.clientHeight || innerHeight;
        // Capped where the stage canvas is capped: a full-screen pass at a
        // higher density than the scene under it is pixels nobody sees.
        r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        r.setSize(w, h, false);
        screenAspect.value = w / h;
      };
      resize();
      // Nothing clears to black here, or the overlay hides the splats.
      r.setClearColor(0x000000, 0);
      addEventListener("resize", resize);
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      const scene = new Scene();
      const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const mat = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
      matRef.current = mat;
      mat.colorNode = nodeRef.current;
      scene.add(new Mesh(new PlaneGeometry(2, 2), mat));

      const loop = () => {
        if (!live) return;
        anchorPos.value.set(anchor.x, anchor.y);
        anchorSize.value.set(anchor.w, anchor.h);
        anchorSeen.value = anchor.seen ? 1 : 0;
        r.renderAsync(scene, cam);
        raf = requestAnimationFrame(loop);
      };
      loop();

      cleanup = () => {
        removeEventListener("resize", resize);
        ro.disconnect();
        matRef.current = null;
        mat.dispose();
      };
    })();

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      cleanup();
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

  if (!node) return null;
  return (
    <canvas
      ref={ref}
      style={{ position: "fixed", top: 0, left: 0, width: "calc(100vw - var(--mw-side, 0px))", height: "100vh", pointerEvents: "none", zIndex: 1 }}
    />
  );
}
