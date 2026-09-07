import { useEffect, useSyncExternalStore } from "react";
import { dossierHtml } from "./Card";
import "./lab.css";
import { getBoxes, getSelected, labVersion, setSelected, subscribeLab } from "./labState";

/** The specimen file, anchored to the right edge of the window and opened by
 *  clicking a capsule. It is HTML over the canvas, not geometry in it: the
 *  panel has to stay readable at any camera angle, and a card standing in the
 *  scene turns edge-on and hides behind the glass. */
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
      let best = -1;
      let bestArea = Infinity;
      getBoxes().forEach((b, n) => {
        if (!b || e.clientX < b.x || e.clientX > b.x + b.w || e.clientY < b.y || e.clientY > b.y + b.h) return;
        if (b.w * b.h < bestArea) {
          bestArea = b.w * b.h;
          best = n;
        }
      });
      setSelected(best);
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

  const d = i >= 0 ? specimens[i]?.dossier : null;
  if (!d) return null;

  return (
    <div className="mw-dossier-panel" role="dialog" aria-label={`Specimen ${d.name}`}>
      <button className="mw-dossier-close" onClick={() => setSelected(-1)} aria-label="Close dossier">
        ×
      </button>
      <div dangerouslySetInnerHTML={{ __html: dossierHtml(d) }} />
      <p className="mw-dossier-foot">
        <span>Containment nominal</span>
        <span>&#9679; Rec</span>
      </p>
    </div>
  );
}
