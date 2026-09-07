import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useSyncExternalStore } from "react";
import { Vector3 } from "three";
import { anchor } from "./anchor";
import "./lab.css";
import { type Box, getBoxes, getFits, getHover, labVersion, setBoxes, setHover, subscribeLab } from "./labState";

const RING = 4.2; // where the capsules stand
const GLASS = 0.95; // a little wider than the glass, so brackets clear it
const TOP = 3.1;
const BOTTOM = 0.3;

const v = new Vector3();
const toGlass = new Vector3();
const across = new Vector3();
const UP = new Vector3(0, 1, 0);

/** A cylinder standing at capsule i, as the camera sees it: its two silhouette
 *  edges, perpendicular to the line of sight, at the given top and bottom. */
function silhouetteOf(i: number, camera: any, w: number, h: number, radius: number, bottom: number, top: number): Box | null {
  const a = (i / 6) * Math.PI * 2;
  const cx = Math.cos(a) * RING;
  const cz = Math.sin(a) * RING;
  toGlass.set(cx - camera.position.x, 0, cz - camera.position.z).normalize();
  across.crossVectors(toGlass, UP).normalize();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let ahead = false;
  for (const side of [-radius, radius]) {
    for (const y of [bottom, top]) {
      v.set(cx + across.x * side, y, cz + across.z * side).project(camera);
      if (v.z < 1) ahead = true;
      minX = Math.min(minX, (v.x * 0.5 + 0.5) * w);
      maxX = Math.max(maxX, (v.x * 0.5 + 0.5) * w);
      minY = Math.min(minY, (-v.y * 0.5 + 0.5) * h);
      maxY = Math.max(maxY, (-v.y * 0.5 + 0.5) * h);
    }
  }
  return ahead ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/** Screen box of one capsule for the brackets and the hit test: the glass
 *  silhouette with a little slack. It used to take the eight corners of the
 *  square footprint, which at any angle project up to forty percent outside
 *  the glass, so the reticle stood well clear of the tube it was bracketing. */
function boxOf(i: number, camera: any, w: number, h: number): Box | null {
  return silhouetteOf(i, camera, w, h, GLASS, BOTTOM, TOP);
}

/** Screen box of a world-space AABB: the specimen, once FitInGlass has placed it. */
function projectBox(center: [number, number, number], size: [number, number, number], camera: any, w: number, h: number): Box | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let ahead = false;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        v.set(center[0] + (sx * size[0]) / 2, center[1] + (sy * size[1]) / 2, center[2] + (sz * size[2]) / 2).project(camera);
        if (v.z < 1) ahead = true;
        minX = Math.min(minX, (v.x * 0.5 + 0.5) * w);
        maxX = Math.max(maxX, (v.x * 0.5 + 0.5) * w);
        minY = Math.min(minY, (-v.y * 0.5 + 0.5) * h);
        maxY = Math.max(maxY, (-v.y * 0.5 + 0.5) * h);
      }
    }
  }
  return ahead ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

/** Invisible plumbing inside the canvas: projects the six capsules every frame
 *  and feeds the TSL overlay the one under the pointer. Renders nothing. */
export function CapsuleProbe() {
  const { camera, size } = useThree();
  useFrame(() => {
    setBoxes(Array.from({ length: 6 }, (_, i) => boxOf(i, camera, size.width, size.height)));
    const i = getHover();
    if (i < 0) {
      anchor.seen = false;
      return;
    }
    const fit = getFits()[i];
    const b = fit
      ? projectBox(fit.center, fit.size, camera, size.width, size.height)
      : silhouetteOf(i, camera, size.width, size.height, 0.9, 0.36, 2.96);
    if (!b) {
      anchor.seen = false;
      return;
    }
    // Centre in NDC, extents in overlay units: half the screen height is 1.
    anchor.x = ((b.x + b.w / 2) / size.width) * 2 - 1;
    anchor.y = 1 - ((b.y + b.h / 2) / size.height) * 2;
    anchor.w = b.w / size.height;
    anchor.h = b.h / size.height;
    anchor.seen = true;
  });
  return null;
}

/** The laboratory's readout. Lives OUTSIDE the canvas: a fixed element inside
 *  drei's fullscreen layer anchors to that layer's transform and ends up
 *  floating in the scene rather than pinned to the window. */
export default function LabHud({ specimens = [] as any[] }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const boxes = getBoxes();
  const hover = getHover();

  // Hover is decided here, from the pointer against the projected boxes, so no
  // event handler has to hang off the glass the attendee wrote.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      let best = -1;
      let bestArea = Infinity;
      getBoxes().forEach((b, i) => {
        if (!b || e.clientX < b.x || e.clientX > b.x + b.w || e.clientY < b.y || e.clientY > b.y + b.h) return;
        // The nearest capsule is the smallest box the pointer is inside.
        if (b.w * b.h < bestArea) {
          bestArea = b.w * b.h;
          best = i;
        }
      });
      setHover(best);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const live = specimens.filter((s) => s?.uuid).length;
  const box = hover >= 0 ? boxes[hover] : null;
  const named = hover >= 0 ? specimens[hover]?.dossier?.name : null;

  return (
    <div className="mw-hud" aria-hidden="true">
      <div className="mw-hud-tl">
        <b>Vivarium · Sublevel 7</b>
        <span>Directorate of Applied Genetics</span>
      </div>
      <div className="mw-hud-bl">{hover >= 0 ? "Click to open dossier" : "Containment capsule"}</div>
      <div className="mw-hud-br">
        {live} {live === 1 ? "specimen" : "specimens"} · Containment active
      </div>
      {box && (
        <div className="mw-brackets" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
          <i /><i /><i /><i />
          {named && <em>{named}</em>}
        </div>
      )}
    </div>
  );
}
