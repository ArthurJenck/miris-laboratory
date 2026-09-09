import type { Texture } from "three";
import { canDrawHtml } from "./renderPath";

/* Phones cannot draw HTML into a canvas, so the published lab shows them a
   picture of each screen instead. The picture is taken here, in the workshop,
   from the very canvas the attendee's File paints: whenever it repaints, the
   result goes to the dev API, which writes it to public/screens/. Vite copies
   public/ into the build, so step 7 ships the pictures with the room.

   Dev only. In the published lab there is no API to send to, and the browser
   that opens it is the one that needs the pictures, not the one making them. */

const SETTLE_MS = 800; // a dossier arriving repaints several screens at once; one write each

const sent = new Map<number, number>(); // slot -> texture.version last captured
const pending = new Map<number, ReturnType<typeof setTimeout>>();

/** Cheap to call every frame: nothing happens unless the texture has repainted
 *  since the last capture. */
export function captureScreen(index: number, painted: Texture) {
  if (import.meta.env.PROD || !canDrawHtml()) return;
  const canvas = painted.image;
  if (!(canvas instanceof HTMLCanvasElement)) return;
  if (sent.get(index) === painted.version) return;
  const version = painted.version;
  sent.set(index, version);

  clearTimeout(pending.get(index));
  pending.set(
    index,
    setTimeout(() => {
      pending.delete(index);
      let png: string;
      try {
        png = canvas.toDataURL("image/png");
      } catch (e) {
        console.warn(`[miris] could not read screen ${index + 1} for its phone picture`, e);
        return;
      }
      fetch("/api/miris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "screen", index, png }),
      }).catch(() => {
        // Let the next repaint try again rather than remembering this one as sent.
        if (sent.get(index) === version) sent.delete(index);
      });
    }, SETTLE_MS),
  );
}
