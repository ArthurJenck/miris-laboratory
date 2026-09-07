import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { detect, paintElement } from "./htmlInCanvas";

/** Scene units per CSS pixel: a 200px card comes out 0.9 units wide, which is
 *  the width the old drei overlay read as at the same position. */
const UNITS_PER_PX = 0.0045;

/** Fallback for --accent, which resolves from :root in guide.css. */
const ACCENT_FALLBACK = "#35ddfe";

export interface HtmlTexture {
  /** Null until the first paint lands, and while `html` is empty. */
  texture: CanvasTexture | null;
  /** Plane size in scene units, already converted. */
  width: number;
  height: number;
}

const EMPTY: HtmlTexture = { texture: null, width: 0, height: 0 };

/** Your markup, painted into a canvas, handed back as a three.js texture.
 *
 *  The markup is rendered offscreen, laid out for real, then drawn:
 *  ctx.drawElementImage() where the browser has HTML-in-Canvas, an SVG
 *  foreignObject serialisation everywhere else. Both paths end as pixels in
 *  the same 2D canvas, and a CanvasTexture samples it from there. Pass a
 *  falsy value to render nothing.
 */
export default function useHtmlTexture(html: string | false | null | undefined): HtmlTexture {
  const [out, setOut] = useState<HtmlTexture>(EMPTY);

  useEffect(() => {
    if (!html) {
      setOut((prev) => {
        prev.texture?.dispose();
        return EMPTY;
      });
      return;
    }

    let alive = true;
    let made: CanvasTexture | null = null;

    // Offscreen via `left`, never display:none: an unrendered element never
    // paints, and the native call throws without a paint snapshot. The native
    // path also requires the element to live INSIDE the canvas it draws onto,
    // with layoutsubtree; the fallback lays out in a plain div and paints into
    // a canvas of its own.
    const offscreen = "position:fixed;left:-10000px;top:0;pointer-events:none";
    let host: HTMLElement;
    let target: HTMLCanvasElement;
    if (detect().path === "drawElement") {
      const c = document.createElement("canvas");
      c.setAttribute("layoutsubtree", "");
      c.style.cssText = offscreen;
      host = c;
      target = c;
    } else {
      host = document.createElement("div");
      host.style.cssText = offscreen;
      target = document.createElement("canvas");
    }
    host.innerHTML = html;
    document.body.appendChild(host);

    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      ACCENT_FALLBACK;

    const draw = async () => {
      if (!alive) return;
      const el = host.firstElementChild as HTMLElement | null;
      if (!el) return;
      try {
        await paintElement(el, target, accent);
      } catch {
        // Neither path could draw. Stay empty rather than showing a broken
        // texture; the step's badge reports the failure.
        return;
      }
      if (!alive) return;
        const texture = new CanvasTexture(target);
        // A 2D canvas draws in sRGB, so say so and let three decode it. This
        // was tagged linear back when the stage rendered with <Canvas linear>
        // and nothing re-encoded on output; both halves of that went together.
        texture.colorSpace = SRGBColorSpace;
        made = texture;
        setOut((prev) => {
          prev.texture?.dispose();
          return {
            texture,
            width: el.offsetWidth * UNITS_PER_PX,
            height: el.offsetHeight * UNITS_PER_PX,
          };
        });
    };

    /* The native path needs a recorded paint before it can be drawn from, and
       the canvas fires `paint` to say one exists. Waiting two frames instead
       was a guess, and a wrong one: it threw "No cached paint record for
       element" and fell through to the fallback. The event is also how a later
       restyle repaints, so it stays subscribed rather than firing once.
       The fallback lays out in a plain div, which has no such event, so it
       keeps the two-frame wait: one for layout, one to be safe. */
    let id = 0;
    const onPaint = () => void draw();
    if (target === host) {
      host.addEventListener("paint", onPaint);
      // Some builds record the first paint before a listener can attach, and
      // then never fire again. One nudge on the next frame covers that.
      id = requestAnimationFrame(() => void draw());
    } else {
      id = requestAnimationFrame(() => requestAnimationFrame(() => void draw()));
    }

    return () => {
      alive = false;
      host.removeEventListener("paint", onPaint);
      cancelAnimationFrame(id);
      made?.dispose();
      host.remove();
    };
  }, [html]);

  return out;
}
