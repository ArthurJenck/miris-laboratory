/* HTML-in-Canvas, behind chrome://flags/#canvas-draw-element: a canvas with
   layoutsubtree lays its children out, requestPaint has the browser paint them,
   the canvas fires paint once it has, and drawElementImage copies one in. */
interface CanvasRenderingContext2D {
  drawElementImage(element: Element, x: number, y: number): void;
}

interface HTMLCanvasElement {
  onpaint: ((event: Event) => void) | null;
  requestPaint?(): void;
}
