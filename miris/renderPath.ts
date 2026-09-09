/** Whether this browser can draw HTML into a canvas. Desktop Chrome behind
 *  chrome://flags/#canvas-draw-element says yes; phones and every other
 *  browser say no, and get the screens captured in step 4 instead. */
export const canDrawHtml = () =>
  typeof CanvasRenderingContext2D !== "undefined" && "drawElementImage" in CanvasRenderingContext2D.prototype;

/** Where a slot's captured screen lives, in public/ during the workshop and
 *  at the root of the published lab. */
export const screenImagePath = (index: number) => `/screens/${String(index + 1).padStart(2, "0")}.png`;
