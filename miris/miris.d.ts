import type { MirisStream } from "@miris-inc/three";
import type { ThreeElement } from "@react-three/fiber";

// Types the <mirisStream> tag. extend() is what actually registers it, in miris/Scene.tsx.
declare module "@react-three/fiber" {
  interface ThreeElements {
    mirisStream: ThreeElement<typeof MirisStream>;
  }
}

/* HTML-in-Canvas, behind chrome://flags/#canvas-draw-element: a canvas with
   layoutsubtree lays its children out, requestPaint has the browser paint them,
   the canvas fires paint once it has, and drawElementImage copies one in. */
declare global {
  interface CanvasRenderingContext2D {
    drawElementImage(element: Element, x: number, y: number): void;
  }
  interface HTMLCanvasElement {
    onpaint: ((event: Event) => void) | null;
    requestPaint?(): void;
  }
}
