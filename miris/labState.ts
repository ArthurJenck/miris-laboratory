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
/* Screen boxes of the six pedestal screens, for hover and for clicks. */
let pedestalBoxes: (Box | null)[] = [null, null, null, null, null, null];
/* A capsule has two things to look at: the organism in the glass and the file
   on the pedestal in front of it. Hover and selection say which. */
export type Part = "organism" | "pedestal";
let hover = -1;
let hoverPart: Part = "organism";
let selected = -1;
let selectedPart: Part = "organism";
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
export const getSelectedPart = () => selectedPart;
export const getHoverPart = () => hoverPart;
export const getPedestalBoxes = () => pedestalBoxes;

const sameBoxes = (a: (Box | null)[], b: (Box | null)[]) =>
  a.every((x, i) => {
    const y = b[i];
    if (!x || !y) return x === y;
    return Math.abs(x.x - y.x) < 1 && Math.abs(x.y - y.y) < 1 && Math.abs(x.w - y.w) < 1 && Math.abs(x.h - y.h) < 1;
  });

export const setPedestalBoxes = (next: (Box | null)[]) => {
  const same = sameBoxes(next, pedestalBoxes);
  pedestalBoxes = next;
  if (!same) bump();
};

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

export const setHover = (i: number, part: Part = "organism") => {
  if (i === hover && part === hoverPart) return;
  hover = i;
  hoverPart = part;
  bump();
};

/** Which capsule is open, and whether you walked to the glass or the pedestal.
 *  -1 closes it. */
export const setSelected = (i: number, part: Part = "organism") => {
  if (i === selected && part === selectedPart) return;
  selected = i;
  selectedPart = part;
  bump();
};
