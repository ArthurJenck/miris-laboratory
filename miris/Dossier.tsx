import { useEffect, useSyncExternalStore } from "react";
import "./lab.css";
import { getBoxes, getPedestalBoxes, getSelected, labVersion, type Part, setSelected, subscribeLab } from "./labState";

/** Click to open a capsule's file, Escape or click away to close it. Lives
 *  outside the canvas because it reads the pointer against projected boxes;
 *  the file it opens stands on the pedestal, drawn by Specimen. */
export default function Dossier() {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();

  useEffect(() => {
    /* A drag is not a click. Orbiting the room ends with the pointer wherever
       it ends, and if that is over a capsule the file opened and the camera
       walked off to it. Anything that moved more than a few pixels between
       down and up is the orbit, not a choice. */
    let downAt: [number, number] | null = null;
    const onDown = (e: PointerEvent) => {
      downAt = [e.clientX, e.clientY];
    };
    const onClick = (e: MouseEvent) => {
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      // Anything with its own controls, the guide included, keeps its click.
      // Read from the event's path rather than the target: React has already
      // applied the handler's state by the time this fires, so a control that
      // closes itself on click, like the picker's options, is out of the
      // document, and closest() on a detached node finds nothing.
      const own = ".mw-panel, .mw-controls, .mw-tab, .mw-tray, .mw-tray-min, .mw-dev";
      if (e.composedPath().some((node) => (node as Element).matches?.(own))) return;
      // The pedestal stands in front of its tube, so it is tested first.
      let best = -1;
      let part: Part = "pedestal";
      let bestArea = Infinity;
      const pick = (boxes: ReturnType<typeof getBoxes>) =>
        boxes.forEach((b, n) => {
          if (!b || e.clientX < b.x || e.clientX > b.x + b.w || e.clientY < b.y || e.clientY > b.y + b.h) return;
          if (b.w * b.h < bestArea) {
            bestArea = b.w * b.h;
            best = n;
          }
        });
      pick(getPedestalBoxes());
      if (best < 0) {
        part = "organism";
        pick(getBoxes());
      }
      setSelected(best, part);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(-1);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The file itself is drawn in the scene by Specimen; this only decides
  // which capsule is open.
  void i;
  return null;
}
