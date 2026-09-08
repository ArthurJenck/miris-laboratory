/* The streaming budget as the readout sees it. Written from inside the canvas
   by BudgetGuard and CapsuleProbe, read outside it by Readout: a plain store,
   like labState, because it moves every frame and one component cares. */
export interface BudgetView {
  /** Splats the scene drew last frame, summed over visible LOD nodes. */
  drawn: number;
  /** The controller's current splat budget, or the pinned one. */
  budget: number;
  /** Frame time, smoothed, in milliseconds. */
  frameMs: number;
  /** null while the controller steers itself; a number while pinned. */
  pinned: number | null;
  /** Whether the controller is running at all. */
  live: boolean;
}

const view: BudgetView = { drawn: 0, budget: 0, frameMs: 0, pinned: null, live: false };
let version = 0;
const subs = new Set<() => void>();

export const subscribeBudget = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const budgetVersion = () => version;
export const getBudget = () => view;

const bump = () => {
  version++;
  subs.forEach((f) => f());
};

/** From the canvas, a few times a second. Only wakes the readout when a
 *  number a person could read has changed. */
export const reportBudget = (next: Partial<BudgetView>) => {
  let changed = false;
  for (const k of Object.keys(next) as (keyof BudgetView)[]) {
    const v = next[k];
    if (v === undefined) continue;
    const prev = view[k];
    const same =
      typeof v === "number" && typeof prev === "number"
        ? k === "frameMs"
          ? Math.abs(v - prev) < 0.1
          : Math.abs(v - prev) < 500
        : v === prev;
    if (!same) {
      (view as any)[k] = v;
      changed = true;
    }
  }
  if (changed) bump();
};

/** From the slider. null hands the budget back to the controller. */
export const pinBudget = (n: number | null) => {
  if (view.pinned === n) return;
  view.pinned = n;
  if (n !== null) view.budget = n;
  bump();
};
