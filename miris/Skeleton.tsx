/* Placeholders for the beat before /api/miris answers. Both reuse the breath
   from Build.tsx's dot wave rather than introducing a second loading language:
   dim, slow, and easy to ignore. */

/** The panel's own chrome, held from the first frame so nothing moves when the
 *  real content lands. The header is real text because it is a constant; only
 *  what comes from data.json is a bar. */
export function PanelSkeleton() {
  return (
    <aside className="mw-panel mw-skeleton" aria-busy="true" aria-label="Loading the guide">
      <header className="mw-head">
        <b className="b14">Spatial streaming</b>
        <img className="mw-mark" src="/kit/assets/miris-logo-white.svg" alt="Miris" />
      </header>

      {/* Matches .mw-bar's height exactly, so the specimen strip does not shove
          the rail down when it arrives. */}
      <div className="mw-bar mw-skel-bar" />

      <div className="mw-split">
        {/* Borrows .mw-steprail's own box, so the rail does not jump 52px
            sideways when the real ticks replace these. */}
        <div className="mw-steprail mw-skel-rail">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="mw-skel-tick" />
          ))}
        </div>
        <div className="mw-scroll">
          <div className="mw-skel-card">
            <span className="mw-skel-line" style={{ width: "22%" }} />
            <span className="mw-skel-line mw-skel-title" style={{ width: "64%" }} />
            <span className="mw-skel-line" style={{ width: "100%" }} />
            <span className="mw-skel-line" style={{ width: "92%" }} />
            <span className="mw-skel-line" style={{ width: "70%" }} />
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Stands in for the canvas until the stage has data to render. Deliberately
 *  ends there: once the Canvas mounts, the stream's own coarse-to-sharp arrival
 *  is the thing step 3.5 exists to show, so nothing covers it. */
export function StageSkeleton() {
  return <div className="mw-stage-skel" aria-hidden="true" />;
}
