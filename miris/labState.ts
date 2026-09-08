export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/* Where each capsule is on screen, and which one the pointer is over. The
   canvas writes it every frame; the readout, which lives outside the canvas,
   reads it. A plain store rather than React state: this changes 60 times a
   second and only two components care. */
let boxes: (Box | null)[] = [null, null, null, null, null, null];
/* Screen box of the hovered specimen itself, from the stream's own bounds, so
   the brackets frame the creature and not the tube it stands in. Null when
   nothing is hovered or the stream has not reported a size yet. */
let reticle: Box | null = null;
let hover = -1;
let selected = -1;
let version = 0;
const subs = new Set<() => void>();

export const subscribeLab = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const labVersion = () => version;
export const getBoxes = () => boxes;
export const getHover = () => hover;
export const getReticle = () => reticle;
export const setReticle = (b: Box | null) => {
  const p = reticle;
  const same = !b || !p ? b === p : Math.abs(b.x - p.x) < 1 && Math.abs(b.y - p.y) < 1 && Math.abs(b.w - p.w) < 1 && Math.abs(b.h - p.h) < 1;
  reticle = b;
  if (!same) bump();
};
export const getSelected = () => selected;

const bump = () => {
  version++;
  subs.forEach((f) => f());
};

/** Called from the canvas. Only wakes the readout when a box actually moved by
 *  a pixel, otherwise every frame would re-render the DOM. */
export const setBoxes = (next: (Box | null)[]) => {
  const same = next.every((b, i) => {
    const p = boxes[i];
    if (!b || !p) return b === p;
    return Math.abs(b.x - p.x) < 1 && Math.abs(b.y - p.y) < 1 && Math.abs(b.w - p.w) < 1 && Math.abs(b.h - p.h) < 1;
  });
  boxes = next;
  if (!same) bump();
};

export const setHover = (i: number) => {
  if (i === hover) return;
  hover = i;
  bump();
};

/** Which capsule's dossier is open. -1 closes it. */
export const setSelected = (i: number) => {
  if (i === selected) return;
  selected = i;
  bump();
};
