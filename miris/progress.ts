import { STEPS, type Step, type Sub } from "./curriculum";

/** Every substep in curriculum order. The rail is step-level; this is
 *  substep-level, which is what the progress pointer tracks. */
export const FLAT_SUBS: Sub[] = STEPS.flatMap((s) => s.subs);

export const indexOfSub = (num: string): number =>
  FLAT_SUBS.findIndex((s) => s.num === num);

/** The step that owns a substep. Falls back to the first step so a corrupt
 *  data.json cannot render an empty pane. */
export const stepOfSub = (num: string): Step =>
  STEPS.find((s) => s.subs.some((x) => x.num === num)) ?? STEPS[0];

/** The next substep in curriculum order, crossing step boundaries. Undefined
 *  on the last one, which is how the pane knows to hide the forward button
 *  rather than disable it: the kit has no defined disabled state. */
export const nextSub = (num: string): Sub | undefined => {
  const i = indexOfSub(num);
  return i < 0 ? FLAT_SUBS[0] : FLAT_SUBS[i + 1];
};

export type SubState = "done" | "here" | "ahead";

/** Index comparison, not string comparison. The old `data.step > sub.num`
 *  worked only while every number stayed single-digit either side of the dot:
 *  "2.10" sorts before "2.9" as a string. */
export const subState = (subNum: string, currentNum: string): SubState => {
  const a = indexOfSub(subNum);
  const b = indexOfSub(currentNum);
  if (a < 0 || b < 0) return "ahead";
  if (a < b) return "done";
  if (a === b) return "here";
  return "ahead";
};

/** Where the pointer lands after a chapter's finished code is written: the
 *  substep after the last `fill` in chapters up to and including this one.
 *  Substeps without code, pasting ids or tuning scales, stay open, because the
 *  finished code does not do them. Undefined when nothing that far has code,
 *  which is chapter 01. */
export const subAfterFills = (stepNum: string): Sub | undefined => {
  const chapters = STEPS.slice(0, STEPS.findIndex((s) => s.num === stepNum) + 1);
  const filled = chapters.flatMap((s) => s.subs).filter((s) => s.fill);
  const last = filled[filled.length - 1];
  return last ? nextSub(last.num) : undefined;
};
