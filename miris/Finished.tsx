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
        file painted from live HTML beside each one and a blue CRT treatment on the selected screen. Anyone with your link
        loads the same six streams at whatever detail their screen and connection justify.
      </p>

      <h3 className="c14 mw-finished-h">Worth trying while the room is still open</h3>
      <ul className="c14 mw-finished-list">
        <li>
          Rewrite the header in <code>fileMarkup</code>, then click a pedestal. Its screen repaints from your
          markup; keep additions inside the 640 by 400 pixel layout.
        </li>
        <li>
          In the glitch, widen the colour split by raising <code>0.004</code> in the <code>split</code> line, turn the
          rainbow up or down with <code>0.12</code> in the <code>sheen</code> line, or change how often it tears with{" "}
          <code>0.55</code> in the <code>live</code> line.
        </li>
        <li>
          In <code>app/specimens.json</code>, halve one creature's <code>scale</code>. The page reloads with
          only that tube changed.
        </li>
        <li>
          If you want the guide gone from the published lab, pass <code>guide=&#123;false&#125;</code> to{" "}
          <code>Workshop</code> in <code>app/main.tsx</code> and publish again. Leaving it in costs nothing: without
          the workshop API it renders nothing.
        </li>
      </ul>

      <h3 className="c14 mw-finished-h">Where the pieces are</h3>
      <ul className="c14 mw-finished-list">
        <li>
          <code>app/stage.tsx</code> composes the laboratory between the <code>miris:</code> comments.
          Each part it names is one file in <code>miris/</code>: <code>Scene</code>, <code>Room</code>,{" "}
          <code>Platform</code>, <code>Walkway</code>, <code>Door</code>, <code>Specimen</code>,{" "}
          <code>Screen</code>, <code>Readout</code> and <code>Controls</code>; repeated
          hardware is batched by <code>miris/lab-components/StaticInstances.tsx</code>.
        </li>
        <li>
          The Miris SDK: <a href="https://www.npmjs.com/package/@miris-inc/three" target="_blank" rel="noopener noreferrer">@miris-inc/three</a>.
          A stream is <code>&lt;mirisStream args=&#123;[&#123; uuid, viewerKey &#125;]&#125; /&gt;</code> and
          nothing else.
        </li>
        <li>
          HTML-in-Canvas: the{" "}
          <a href="https://html-in-canvas.dev" target="_blank" rel="noopener noreferrer">spec site and demos</a>.
          Your File is the whole implementation: a canvas with <code>layoutsubtree</code>,{" "}
          <code>drawElementImage</code> on paint, and a <code>CanvasTexture</code>. There is no fallback.
        </li>
        <li>
          TSL: the{" "}
          <a href="https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language" target="_blank" rel="noopener noreferrer">three.js shading language wiki</a>.
          The graph in <code>app/stage.tsx</code> runs through <code>miris/ScreenFx.tsx</code> on an unseen canvas.
          It updates only the selected terminal, at up to 30 frames per second, and pauses when hidden.
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
