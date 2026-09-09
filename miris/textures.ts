import { CanvasTexture, RepeatWrapping, SRGBColorSpace, TextureLoader, type Texture } from "three";

/* Surfaces are drawn here rather than shipped as image files. WebContainer
   drops binaries on import, so a laboratory that depended on a texture folder
   would arrive bare in bolt. A canvas costs nothing and always survives. */

const make = (size: number, draw: (c: CanvasRenderingContext2D, s: number) => void): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
};

/** A gradient in 8 bits has about 200 usable steps, and a dark falloff uses
 *  only the bottom handful of them, so it arrives as concentric rings rather
 *  than a fade. One bit of noise per channel scatters each step boundary and
 *  the rings become grain below the eye's threshold. Costs nothing: this runs
 *  once, on the canvas, before the texture is ever uploaded. */
function dither(ctx: CanvasRenderingContext2D, s: number) {
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random() * 2 - 1;
    // Alpha too: in the glow textures it is alpha that carries the falloff.
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
    img.data[i + 3] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Value noise, tiled, so the edges meet when the texture repeats. */
function noise(ctx: CanvasRenderingContext2D, s: number, amount: number, scale: number) {
  const img = ctx.getImageData(0, 0, s, s);
  const grid = Math.max(2, Math.round(s / scale));
  const rand: number[] = [];
  for (let i = 0; i < grid * grid; i++) rand.push(Math.random());
  const at = (x: number, y: number) => rand[(y % grid) * grid + (x % grid)];
  const smooth = (t: number) => t * t * (3 - 2 * t);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const gx = (x / s) * grid;
      const gy = (y / s) * grid;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = smooth(gx - x0);
      const fy = smooth(gy - y0);
      const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const bot = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      const n = (top * (1 - fy) + bot * fy - 0.5) * amount;
      const i = (y * s + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** The walkway: lighter, brushed along one axis, with bolt heads at the seams. */
export const walkwayTexture = () =>
  make(512, (ctx, s) => {
    ctx.fillStyle = "#2b3640";
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 14, 3);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
    ctx.lineWidth = 1;
    for (let y = 0; y < s; y += 3) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random());
      ctx.lineTo(s, y + Math.random());
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(10, 16, 20, 0.5)";
    for (const [x, y] of [
      [24, 24],
      [s - 24, 24],
      [24, s - 24],
      [s - 24, s - 24],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

/** The pool of light a capsule throws on the deck. Radial, so it has no edge. */
const makeGlow = () =>
  make(512, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
    g.addColorStop(0.35, "rgba(255,255,255,0.28)");
    g.addColorStop(0.7, "rgba(255,255,255,0.06)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    dither(ctx, s);
  });

/* All six capsules throw the same pool of light, so they share one texture.
   FloorGlow built its own, which meant the room drew this gradient six times
   and kept six copies of it on the GPU. */
let sharedGlow: Texture | null = null;
export const glowTexture = () => (sharedGlow ??= makeGlow());

/** A roughness map so the deck is not uniformly matte under the rim lights. */
export const wearMap = () =>
  make(256, (ctx, s) => {
    ctx.fillStyle = "#b4b4b4";
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 90, 4);
  });

/* The deck is a real scan, CGAxis "Green Sci-Fi Floor 8766", downscaled to 2K
   colour and normal and 1K for the rest. The procedural deck below stayed dark
   and featureless from anywhere but the middle of the room; this one has
   grooves for the normal map to catch the light in. Loaded rather than drawn,
   which binaries surviving the bolt import made possible. */
const loader = new TextureLoader();
const tile = (url: string, repeat: number, srgb = false): Texture => {
  const t = loader.load(url);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  // 4, not 8. The deck is the one thing in the room with a measurable GPU
  // cost, and at 8 taps its five maps at grazing angles were 93% of it;
  // 4 keeps the texture legible into the distance for a fifteenth of that.
  t.anisotropy = 4;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
};

/** Every map the deck material takes, sharing one repeat so they stay aligned. */
export const floorMaps = (repeat = 12) => {
  const ao = tile("/textures/floor/floor_ao.jpg", repeat);
  // CircleGeometry carries one uv set; aoMap reads uv1 unless told otherwise.
  ao.channel = 0;
  return {
    map: tile("/textures/floor/floor_basecolor.jpg", repeat, true),
    normalMap: tile("/textures/floor/floor_normal.jpg", repeat),
    roughnessMap: tile("/textures/floor/floor_roughness.jpg", repeat),
    metalnessMap: tile("/textures/floor/floor_metallic.jpg", repeat),
    aoMap: ao,
  };
};
