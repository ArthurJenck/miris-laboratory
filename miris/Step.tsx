import { useState } from "react";
import type { Step, Sub } from "./curriculum";
import type { Track } from "./tracks";
import { ConceptField, type HatchState } from "./Build";
import Chevron from "./Chevron";
import Code from "./highlight";
import { PARTS } from "./snippets.mjs";
import { subName } from "./transition";
import { indexOfSub, nextSub, subState } from "./progress";

export interface StepActions {
  fill: (snippetId: string, num: string) => void | Promise<void>;
  clear: (snippetId: string) => void | Promise<void>;
  /** Re-reads data.json, for the parts of a step that write it themselves. */
  reload: () => void;
  /** Verifies the substep actually happened, then moves the progress pointer
   *  if it did, or reports what is missing if it did not. */
  done: (sub: Sub) => void | Promise<void>;
  /** Opens a finished substep for reading, or returns to the pointer with "". */
  view: (subNum: string) => void;
  /** Moves the pointer back to a finished substep, to do it again. */
  undo: (subNum: string) => void | Promise<void>;
  /** Returns the pane to whichever step actually holds the pointer. */
  backToProgress: () => void;
  /** The last substep's Done. Shows the closing pane. */
  finish: () => void | Promise<void>;
}

export interface StepPaneProps {
  /** The step being displayed, which is not always the step holding the pointer. */
  step: Step;
  /** data.step, the persisted progress pointer. */
  currentSubNum: string;
  data: any;
  track: Track;
  /** Substep number currently being written or checked, or "". */
  busy: string;
  /** What the last Done click found wrong, keyed by substep number. */
  problems: Record<string, string>;
  /** Owned by Guide so the tray outlives step 1.2. */
  hatch: HatchState;
  /** The substep whose card is open. Usually the progress pointer, but a
   *  finished substep can be opened to re-read it. */
  openSubNum: string;
  /** Shows the paste-it-for-me and clear buttons under each snippet. The
   *  wand in the guide's header turns it on. */
  assist: boolean;
  actions: StepActions;
}

const FLAG = "chrome://flags/#canvas-draw-element";

/* Whether this browser can draw HTML into a canvas. There is no fallback: the
 * screens stay dark until the flag is on, and this says so before the attendee
 * writes the code that needs it. */
function RenderPathBadge() {
  const canDraw = typeof CanvasRenderingContext2D !== "undefined" && "drawElementImage" in CanvasRenderingContext2D.prototype;
  return canDraw ? (
    <p className="mw-path" data-native>
      Your browser can draw HTML into a canvas.
    </p>
  ) : (
    <p className="mw-path" data-failed>
      Your browser cannot draw HTML into a canvas yet, so the screens will stay dark. In Chrome, turn on{" "}
      <code>{FLAG}</code> and relaunch.
    </p>
  );
}

const withNoun = (text: string, noun: string) => text.replaceAll("{noun}", noun);

/* The snippets carry the indentation they need inside the marker block, which
   is six columns of it. Kept for the file, dropped for a 408px panel. */
const dedent = (code: string) => {
  if (!code) return "";
  const lines = code.replace(/\n+$/, "").split("\n");
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length),
  );
  return lines.map((l) => l.slice(indent)).join("\n");
};

/** The code the step adds, to be typed in rather than pressed for. */
function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mw-snip">
      <pre className="k14">
        <Code code={code} />
      </pre>
      <button
        type="button"
        className="mw-copy l12"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
          } catch {
            // Clipboard denied. The block is selectable, so this is a
            // convenience failing, not the step.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export default function StepPane({
  step,
  currentSubNum,
  data,
  track,
  busy,
  problems,
  hatch,
  openSubNum,
  assist,
  actions,
}: StepPaneProps) {
  // Browsing ahead via the rail shows a step that holds no current substep. The
  // forward button belongs to the pointer, not to whatever is on screen, so
  // offering "next" here would name a substep from a different step entirely.
  const isProgressStep = step.subs.some((s) => s.num === currentSubNum);
  const upNext = isProgressStep ? nextSub(currentSubNum) : undefined;
  // Reading a finished substep rather than standing on it. Only the most
  // recently finished one can be undone: stepping back further would strand
  // every substep between here and there as done-but-not-done.
  const browsing = openSubNum !== currentSubNum;
  const undoable = indexOfSub(openSubNum) === indexOfSub(currentSubNum) - 1;

  return (
    <div className="mw-pane">
      <h2 className="t20 mw-pane-title">{step.title}</h2>

      {step.subs.map((sub: Sub) => {
        const state = subState(sub.num, currentSubNum);

        if (sub.num !== openSubNum) {
          // Every substep opens, ahead ones included: reading what is coming is
          // how anyone decides whether to keep going now or take a break. The
          // pointer does not move by reading, so this is not a way to skip.
          const reachable = true;
          return (
            <div
              key={sub.num}
              className="mw-line"
              data-state={state}
              data-reachable={reachable || undefined}
              style={{ viewTransitionName: subName(sub.num) } as React.CSSProperties}
              onClick={reachable ? () => actions.view(state === "here" ? "" : sub.num) : undefined}
              role={reachable ? "button" : undefined}
              tabIndex={reachable ? 0 : undefined}
              onKeyDown={
                reachable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        actions.view(state === "here" ? "" : sub.num);
                      }
                    }
                  : undefined
              }
            >
              <span className="l12 k">{sub.num}</span>
              <span className="c14 ttl">{withNoun(sub.title, track.noun)}</span>
              {state === "done" && (
                <span className="tick" aria-hidden="true">
                  &#10003;
                </span>
              )}
            </div>
          );
        }

        return (
          <article
            key={sub.num}
            className="mw-now"
            style={{ viewTransitionName: subName(sub.num) } as React.CSSProperties}
          >
            <div className="mw-now-eb">
              <p className="l12">Step {sub.num}</p>
            </div>

            <h3 className="mw-now-title">{withNoun(sub.title, track.noun)}</h3>
            <p className="c14">{withNoun(sub.body, track.noun)}</p>
            {sub.renderPath && <RenderPathBadge />}
            {sub.code && (
              <pre className="k14">
                <Code code={sub.code} />
              </pre>
            )}

            {sub.link && (
              <a
                className="btn btn-secondary btn-sm mw-goto"
                href={sub.link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sub.link.label} &rarr;
              </a>
            )}

            {sub.panel && <ConceptField hatch={hatch} />}

            {sub.fill && (
              <>
                <Snippet code={dedent(PARTS[sub.fill as keyof typeof PARTS] ?? "")} />
                {assist && (
                  <div className="mw-row mw-autorow">
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy === sub.num}
                      onClick={() => actions.fill(sub.fill!, sub.num)}
                    >
                      {busy === sub.num ? "Writing" : "Or paste it for me"}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => actions.clear(sub.fill!)}>
                      Clear block
                    </button>
                  </div>
                )}
              </>
            )}


            {sub.explain && (
              <details className="mw-why">
                <summary className="l12">
                  Why
                  <Chevron />
                </summary>
                <p>{sub.explain}</p>
              </details>
            )}

            {problems[sub.num] && (
              <p className="mw-snag c14" role="status">
                {problems[sub.num]}
              </p>
            )}

            {browsing ? (
              <div className="mw-row mw-backrow">
                {undoable && (
                  <button className="btn btn-secondary btn-sm" onClick={() => actions.undo(sub.num)}>
                    Undo this step
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => actions.view("")}>
                  Back to {currentSubNum}
                </button>
              </div>
            ) : upNext ? (
              <button
                className="btn btn-secondary btn-sm mw-next"
                disabled={busy === sub.num}
                onClick={() => actions.done(sub)}
              >
                {busy === sub.num ? "Checking" : "Done"}
              </button>
            ) : (
              // The last substep. Nothing to check on disk, so Done becomes
              // Finish and opens the closing pane rather than stopping dead.
              <button className="btn btn-primary btn-sm mw-next" onClick={() => actions.finish()}>
                Finish
              </button>
            )}
          </article>
        );
      })}

      {!isProgressStep && (
        <button className="btn btn-ghost btn-sm mw-next" onClick={actions.backToProgress}>
          Back to step {currentSubNum}
        </button>
      )}
    </div>
  );
}
