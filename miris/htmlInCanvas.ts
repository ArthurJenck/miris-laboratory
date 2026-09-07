/* HTML-in-Canvas, with a fallback for every browser that cannot do it yet.
 *
 * Chrome draws live DOM into a canvas with ctx.drawElementImage(), behind
 * chrome://flags/#canvas-draw-element. Everywhere else the same element is
 * serialised into an <svg><foreignObject> and drawn as an image. Both paths end
 * in the same place: pixels on a 2D canvas, which three.js takes as a texture.
 *
 * API verified 2026-09-01 against the Chromium Intent to Experiment and the
 * WICG explainer. The flag is a dedicated one, not the general
 * #enable-experimental-web-platform-features that most write-ups name. */

export type RenderPath = "drawElement" | "foreignObject" | "failed";

export interface Capability {
  path: RenderPath;
  /** Only ever selects warning copy. Never selects a code path. */
  engine: "chromium" | "webkit" | "gecko" | "unknown";
  /** Whether a flag could change this. Safari and Firefox: false. */
  flaggable: boolean;
}

/** The card is drawn at twice its CSS size so it stays crisp when the camera
 *  moves close. Not devicePixelRatio: this texture is sampled in 3D, where the
 *  screen's own density is only half the story. */
const SCALE = 2;

type Ctx2D = CanvasRenderingContext2D & {
  drawElementImage?: (el: Element, dx: number, dy: number) => void;
};

/** Establishes "probably". paintElement's try/catch establishes "actually". */
const hasDrawElement = (): boolean =>
  typeof CanvasRenderingContext2D !== "undefined" &&
  "drawElementImage" in CanvasRenderingContext2D.prototype;

/** UA sniffing, deliberately quarantined to copy selection. Chromium is tested
 *  first because Chrome's UA string contains "Safari" too. */
function engineOf(ua: string, vendor: string): Capability["engine"] {
  if (/Edg\/|Chrome\/|Chromium\//.test(ua)) return "chromium";
  if (/Firefox\//.test(ua)) return "gecko";
  if (/Safari\//.test(ua) || vendor.includes("Apple")) return "webkit";
  return "unknown";
}

export function detect(): Capability {
  const engine =
    typeof navigator === "undefined"
      ? "unknown"
      : engineOf(navigator.userAgent, navigator.vendor ?? "");
  return {
    path: hasDrawElement() ? "drawElement" : "foreignObject",
    engine,
    flaggable: engine === "chromium",
  };
}

/* ── the path store ───────────────────────────────────────
 * The badge lives in the guide and the painting happens in the R3F tree.
 * app/main.tsx renders those as siblings sharing no state, so the path travels
 * through this module instead: both trees import the same instance. Seeded from
 * detect() so the badge is right before the first paint, and corrected to what
 * actually ran after it. */

let current: RenderPath = detect().path;
const listeners = new Set<() => void>();

function report(path: RenderPath): RenderPath {
  if (path !== current) {
    current = path;
    listeners.forEach((l) => l());
  }
  return path;
}

export function subscribePath(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export const getPath = (): RenderPath => current;

/* ── the card's styles ────────────────────────────────────
 * One consumer only: the SVG in drawViaForeignObject, which is the one place
 * guide.css cannot reach. Values are resolved rather than var() because custom
 * properties do not cross into a foreignObject. Mirrors .mw-plate in
 * guide.css:463-481.
 *
 * Never inject this as a <style> for the live DOM. A <style> applies to the
 * whole document wherever it sits, so it would also restyle the native path's
 * card and every other .mw-plate on the page, and the two paths would stop
 * looking different.
 *
 * The font stack deliberately omits Geist. Same-origin woff2 could be fetched
 * and base64'd in, but a visible difference between the two paths is the point
 * of the exercise. The native path picks Geist up from guide.css. */

export const cardCss = (accent: string): string => `
.mw-plate {
  box-sizing: border-box;
  width: 200px;
  background: rgba(17, 18, 21, 0.94);
  border: 1px solid #252526;
  border-left: 2px solid ${accent};
  border-radius: 8px;
  padding: 13px 15px;
  font: 400 13px/1.5 ui-sans-serif, system-ui, sans-serif;
  color: #d6d4d4;
}
.mw-plate strong { display: block; font-weight: 500; color: #ffffff; margin-bottom: 5px; }
.mw-plate p { margin: 0 0 9px; font-size: 12px; color: #9e9d9f; }
.mw-plate ul { margin: 0; padding: 0; list-style: none; }
.mw-plate li {
  font: 400 11px/1.7 ui-monospace, monospace;
  color: #9e9d9f;
  border-top: 1px solid #252526;
  padding-top: 4px;
  margin-top: 4px;
}`;

/* ── the dossier's styles, lifted live ────────────────────
 * cardCss above mirrors the old .mw-plate label by hand. The dossier has
 * nineteen rules in lab.css and they change, so mirroring them would drift:
 * instead the rules that mention its classes are read out of the live
 * stylesheets at paint time. Custom properties do not cross into a
 * foreignObject, so var() is resolved against :root first. Font faces have no
 * selector and are skipped, which is why the fallback card sets in the system
 * face rather than Geist. */
function liveCssFor(needles: string[]): string {
  const root = getComputedStyle(document.documentElement);
  const resolve = (css: string) =>
    css.replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (_m, name: string, fb?: string) => {
      const v = root.getPropertyValue(name).trim();
      return v || (fb ?? "").trim() || "initial";
    });
  const out: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet
    }
    for (const r of Array.from(rules)) {
      const sr = r as CSSStyleRule;
      if (sr.selectorText && needles.some((n) => sr.selectorText.includes(n))) out.push(resolve(sr.cssText));
    }
  }
  return out.join("\n");
}

/* ── the two backends ─────────────────────────────────── */

async function drawViaForeignObject(
  el: HTMLElement,
  ctx: CanvasRenderingContext2D,
  accent: string,
  w: number,
  h: number,
): Promise<void> {
  // XMLSerializer, not outerHTML: foreignObject content has to be well-formed
  // XHTML and outerHTML makes no such promise about void elements.
  const markup = new XMLSerializer().serializeToString(el);

  // Safari will not render an SVG image without explicit width and height.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject x="0" y="0" width="${w}" height="${h}">` +
    `<div xmlns="http://www.w3.org/1999/xhtml">` +
    `<style>${cardCss(accent)}\n${liveCssFor([".mw-dossier", ".mw-d-"])}</style>${markup}</div>` +
    `</foreignObject></svg>`;

  const img = new Image();
  // load/error, not img.decode(). Chrome rejects decode() with an
  // EncodingError for an SVG carrying a foreignObject, while the very same
  // image fires load and draws perfectly. Awaiting decode() therefore threw on
  // every browser that takes this path, which is every browser without the
  // flag, and the card silently never appeared.
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("the label SVG could not be loaded"));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  ctx.drawImage(img, 0, 0, w, h);
}

/** Paint `el` onto `target`. Resolves with the path that actually ran, and
 *  rejects only when neither path could draw anything.
 *
 *  The native path only: `el` must be a descendant of `target`, and `target`
 *  must carry `layoutsubtree`, or the native call throws and the fallback runs
 *  instead. The fallback has no such rule and takes `el` from anywhere, as long
 *  as it has been laid out. */
export async function paintElement(
  el: HTMLElement,
  target: HTMLCanvasElement,
  accent: string,
): Promise<RenderPath> {
  try {
    return await paintInto(el, target, accent);
  } catch (e) {
    // Every failure reports, including the layout guard below, which throws
    // before either backend runs. Without this the store kept whatever
    // detect() seeded, so a total failure still read as "drawing your live DOM"
    // on the badge while the plane was blank.
    report("failed");
    throw e;
  }
}

async function paintInto(
  el: HTMLElement,
  target: HTMLCanvasElement,
  accent: string,
): Promise<RenderPath> {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (!w || !h) throw new Error("the card has no layout yet");

  target.width = w * SCALE;
  target.height = h * SCALE;
  target.style.width = `${w}px`;
  target.style.height = `${h}px`;

  const ctx = target.getContext("2d") as Ctx2D | null;
  if (!ctx) throw new Error("no 2D context");

  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (hasDrawElement()) {
    try {
      ctx.drawElementImage!(el, 0, 0);
      return report("drawElement");
    } catch {
      // Detection said yes and reality said no, usually because no paint
      // snapshot exists yet. Nothing to log: the fallback draws the same card
      // and the badge tells the attendee which path ran.
      ctx.clearRect(0, 0, w, h);
    }
  }

  await drawViaForeignObject(el, ctx, accent, w, h);
  return report("foreignObject");
}
