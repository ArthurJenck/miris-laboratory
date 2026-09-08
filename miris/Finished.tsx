import { STEPS } from "./curriculum";

/** The closing pane, shown in place of the steps once Finish is pressed on the
 *  last one. What was built, what is worth trying next, and the way back. */
export default function Finished({ data, onBack }: { data: any; onBack: () => void }) {
  const specimens: any[] = data?.specimens ?? [];
  const live = specimens.filter((s) => s?.uuid).length;
  const stages = specimens.map((s) => s?.stage).filter(Boolean);
  const concept: string = data?.concept || "";

  return (
    <div className="mw-pane mw-finished">
      <p className="l12">Sublevel 7</p>
      <h2 className="t20 mw-pane-title">Containment holds.</h2>

      <p className="c14">
        {concept ? <>You described <em>{concept}</em>. </> : null}
        {live} {live === 1 ? "specimen is" : "specimens are"} streaming
        {stages.length === 6 ? <>, {stages[0]} to {stages[5]},</> : null} into a room you built in three.js, with a
        file painted from live HTML beside each one and a shader field over the top. Anyone with your link
        loads the same six streams at whatever detail their screen and connection justify.
      </p>

      <h3 className="c14 mw-finished-h">Worth trying while the room is still open</h3>
      <ul className="c14 mw-finished-list">
        <li>
          Drag the budget slider in the readout to 40k and watch which capsules coarsen first. That order is
          the adaptive budget spending where the camera is looking.
        </li>
        <li>
          Click a capsule and rewrite <code>fileMarkup</code> to show the six stages as a strip rather than a
          list. Save, click again: the placard repaints from your markup.
        </li>
        <li>
          In the field, replace <code>p.length()</code> with <code>p.x.abs()</code> and the vignette becomes
          two dark bands. Every edit is a new shader graph, compiled when you save.
        </li>
        <li>
          Change <code>0.7</code> in your <code>FitInGlass</code> to <code>1</code> and the specimens fill the
          glass; the egg will touch the walls.
        </li>
        <li>
          If you want the guide gone from the published lab, comment out <code>&lt;MirisGuide /&gt;</code> in{" "}
          <code>app/main.tsx</code> and publish again. Leaving it in costs nothing: without the workshop API it
          renders nothing.
        </li>
      </ul>

      <h3 className="c14 mw-finished-h">Where the pieces are</h3>
      <ul className="c14 mw-finished-list">
        <li>
          <code>app/stage.tsx</code> is the whole laboratory. Everything you wrote is between the{" "}
          <code>miris:</code> comments; everything else is the frame around it.
        </li>
        <li>
          The Miris SDK: <a href="https://www.npmjs.com/package/@miris-inc/three" target="_blank" rel="noopener noreferrer">@miris-inc/three</a>.
          A stream is <code>&lt;mirisStream args=&#123;[&#123; uuid, viewerKey &#125;]&#125; /&gt;</code> and
          nothing else.
        </li>
        <li>
          HTML-in-Canvas: the{" "}
          <a href="https://github.com/WICG/html-in-canvas" target="_blank" rel="noopener noreferrer">WICG explainer</a>.
          The fallback in <code>miris/htmlInCanvas.ts</code> is what every browser without the flag ran.
        </li>
        <li>
          TSL: the{" "}
          <a href="https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language" target="_blank" rel="noopener noreferrer">three.js shading language wiki</a>.
          The field in <code>miris/EffectCanvas.tsx</code> is one full-screen quad on a second canvas.
        </li>
      </ul>

      <p className="c14 mw-finished-thanks">
        Thank you for building it. {STEPS.length} chapters, one creature, six capsules.
      </p>

      <button className="btn btn-ghost btn-sm mw-next" onClick={onBack}>
        Back to the steps
      </button>
    </div>
  );
}
