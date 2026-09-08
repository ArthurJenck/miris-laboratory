import { useEffect, useSyncExternalStore } from "react";
import "./lab.css";
import { getBoxes, getPedestalBoxes, getSelected, labVersion, type Part, setSelected, subscribeLab } from "./labState";

/** Click to open a capsule's file, Escape or click away to close it. Lives
 *  outside the canvas because it reads the pointer against projected boxes;
 *  the file it opens stands on the pedestal, drawn by Pedestals. */
export default function Dossier({ specimens = [] as any[] }) {
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const i = getSelected();

  useEffect(() => {
    /* A drag is not a click. Orbiting the room ends with the pointer wherever
       it ends, and if that is over a capsule the file opened and the camera
       walked off to it. Anything that moved more than a few pixels between
       down and up is the orbit, not a choice. */
    let downAt: [number, number] | null = null;
    const onDown = (e: MouseEvent) => {
      downAt = [e.clientX, e.clientY];
    };
    const onClick = (e: MouseEvent) => {
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      // Anything with its own controls, the guide included, keeps its click.
      // .mw-dossier-panel, not .mw-dossier: the shorter class does not exist,
      // so every click inside the open file fell through to the hit test and
      // the close button selected whichever capsule sat behind it.
      if ((e.target as HTMLElement)?.closest?.(".mw-panel, .mw-dossier-panel, .mw-tab, .mw-tray, .mw-tray-min, .mw-dev")) return;
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
    window.addEventListener("mousedown", onDown);
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // The file itself is drawn in the scene by Pedestals; this only decides
  // which capsule is open.
  void specimens;
  void i;
  return null;
}
