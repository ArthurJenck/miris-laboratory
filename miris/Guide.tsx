import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import BuildTray, { useBuild } from "./Build";
import { detect, getPath, subscribePath } from "./htmlInCanvas";
import { STEPS, type Sub } from "./curriculum";
import { transition } from "./transition";
import { nextSub, stepOfSub } from "./progress";
import Rail from "./Rail";
import StepPane, { type StepActions } from "./Step";
import { trackById } from "./tracks";
import Start from "./Start";
import { PanelSkeleton } from "./Skeleton";
import "./guide.css";

/* The workshop API is Vite dev middleware, so a build has no counterpart for it.
 * The tell is not the status code: a built app answers /api/miris with its SPA
 * fallback, which is 200 and text/html. Checking the content type is what
 * actually distinguishes "no dev server" from "real error". */
const NOT_DEV =
  "The workshop API is not running. It only exists under npm run dev, not in a built preview.";

/* One place that turns a Response into either data or a sentence a human can
 * act on. Both the initial load and every post go through it, because the
 * failure that mattered was an unguarded res.json(): WebKit rejects it with
 * "The string did not match the expected pattern", which tells an attendee
 * nothing at all. */
type ApiResult = { ok: boolean; data: any; problem?: string };

async function readApi(res: Response): Promise<ApiResult> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) return { ok: false, data: {}, problem: NOT_DEV };

  let data: any;
  try {
    data = await res.json();
  } catch {
    // JSON content type but an unparseable or empty body. Nothing the dev
    // server does looks like this, so treat it as the API not being there.
    return { ok: false, data: {}, problem: `${NOT_DEV} (empty reply, status ${res.status})` };
  }
  if (!res.ok) return { ok: false, data, problem: data.error ?? `The workshop API returned ${res.status}.` };
  return { ok: true, data };
}

/* Known from the first minute, not discovered at step 5: whether this browser
 * can draw HTML into a canvas. Nothing is blocked either way, since the SVG
 * fallback always renders, but a Chrome that could do the real thing deserves
 * the tip while there is still time to flip the flag. */
function CapabilityLine() {
  const path = useSyncExternalStore(subscribePath, getPath, getPath);
  if (path === "drawElement" || path === "failed") return null;
  const { flaggable } = detect();
  return (
    <p className="mw-capline l12">
      {flaggable ? (
        <>
          Step 5 draws HTML into the canvas. Enable <code>chrome://flags/#canvas-draw-element</code> and
          relaunch to do it natively; otherwise the SVG fallback runs.
        </>
      ) : (
        <>Step 5 draws HTML into the canvas. This browser uses the SVG fallback, which still renders.</>
      )}
    </p>
  );
}

export default function MirisGuide() {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<any>({ step: "1.1" });
  /* Separate from `data` because the seed above has no track, which is
     indistinguishable from "no track chosen yet". Without this the chooser
     flashed full-bleed on every reload before the panel arrived. */
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  // View state, deliberately separate from data.step. data.step is how far the
  // attendee has actually got; `selected` is only which step the pane shows.
  const [selected, setSelected] = useState<string | null>(null);
  // A finished substep opened for reading. Separate from data.step, which is
  // how far the attendee has actually got.
  const [viewing, setViewing] = useState("");
  // What the last Done click found wrong, keyed by substep so browsing the rail
  // does not carry one step's complaint onto another.
  const [problems, setProblems] = useState<Record<string, string>>({});

  // Every paste reloads the page, and losing your place in a long step list on
  // each one adds up. Position is saved as it changes and restored on mount;
  // sessionStorage, so a fresh tab still starts at the top.
  const scrollKeeper = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    try {
      const saved = sessionStorage.getItem("mw-scroll");
      if (saved) el.scrollTop = Number(saved);
    } catch {
      // Blocked storage costs the restore, not the scroller.
    }
    let raf = 0;
    el.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem("mw-scroll", String(el.scrollTop));
        } catch {}
      });
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await readApi(await fetch("/api/miris"));
      // A 500 body is still valid JSON, so without this check the guide would
      // quietly render an error object as its state.
      if (!r.ok) return setNote(r.problem!);
      setData(r.data);
    } catch (e) {
      setNote(`Could not reach the workshop API: ${(e as Error).message}`);
    } finally {
      // Resolves on failure too. load() swallows its errors into `note`, so
      // without the finally a dead API parks an attendee on the skeleton
      // forever, which is worse than the flash this replaces.
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const post = async (payload: object) => {
    const res = await fetch("/api/miris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return readApi(res);
  };

  const fill = async (snippetId: string, num: string) => {
    setBusy(num);
    setNote("");
    try {
      const r = await post({ action: "fill", snippetId });
      if (!r.ok) return setNote(r.problem!);
      setNote("Written into app/stage.tsx");
      await post({ action: "save", patch: { step: num } });
      await load();
    } catch (e) {
      setNote(`Could not write the file: ${(e as Error).message}`);
    } finally {
      // Without the finally, a dev server mid-recompile leaves this button
      // disabled and reading "Writing" until a page reload.
      setBusy("");
    }
  };

  const clear = async (snippetId: string) => {
    try {
      const r = await post({ action: "clear", snippetId });
      if (!r.ok) return setNote(r.problem!);
      setNote(
        r.data.back
          ? "Cleared this step. The steps before it are still in place."
          : "Cleared the block.",
      );
    } catch (e) {
      setNote(`Could not clear the block: ${(e as Error).message}`);
    }
  };

  const track = trackById(data.track);
  const trackVars = { ["--track" as string]: track.accent } as React.CSSProperties;

  // Above the steps, so the tray survives an advance: the mesh takes four to
  // six minutes and later steps send attendees away from 1.2 while it runs.
  const build = useBuild(track);

  // Swapping between the chooser and the panel is a view transition: the
  // chooser leaves, then the panel arrives from its edge. The artwork is not
  // part of it, deliberately, see the note in guide.css.
  const chooseTrack = async (id: string) => {
    // Feedback first. A tap on the chooser that turns out to fail used to
    // produce nothing at all, because the note bar only renders inside the
    // panel and the panel does not exist yet.
    setNote(id ? "Setting up your track" : "Going back to the chooser");

    // A different track means a different subject, so the previous one's
    // prompt, render and mesh do not carry over: they were the reason a
    // creature prompt turned up under Atelier.
    const patch: Record<string, unknown> =
      id && id !== data.track
        ? { track: id, prompt: "", imageUrl: "", falRequestId: "", modelStartedAt: 0, glb: "", card: null }
        : { track: id };
    const saved = await post({ action: "save", patch });
    if (!saved.ok) return setNote(saved.problem!);

    let next: any;
    try {
      const r = await readApi(await fetch("/api/miris"));
      if (!r.ok) return setNote(r.problem!);
      next = r.data;
    } catch (e) {
      return setNote(`Could not reach the workshop API: ${(e as Error).message}`);
    }

    // Clearing here, not before: every failure path above returns with its own
    // note still showing.
    transition(() => {
      setNote("");
      setData(next);
    }, id ? "in" : "out");
  };

  // Only 5 of the 16 substeps carry a `fill`, and fill() was the sole writer of
  // data.step. With every substep on screen that was cosmetic; with one step in
  // view it would pin an attendee to step 01 for the whole workshop.
  const advance = async (toSubNum: string, carryNote = "") => {
    setNote(carryNote);
    const r = await post({ action: "save", patch: { step: toSubNum } });
    if (!r.ok) return setNote(r.problem!);
    let next: any = null;
    try {
      const got = await readApi(await fetch("/api/miris"));
      if (!got.ok) return setNote(got.problem!);
      next = got.data;
    } catch (e) {
      return setNote(`Could not reach the workshop API: ${(e as Error).message}`);
    }
    // One commit, so the card that collapses and the line that expands are a
    // single transition rather than two frames.
    transition(() => {
      setSelected(null);
      setData(next);
    });
  };

  const writeLabel = async (num: string) => {
    setBusy(num);
    setNote("");
    try {
      const r = await post({ action: "label" });
      if (!r.ok) return setNote(r.problem!);
      await load();
      setNote(`Wrote "${r.data.card.name}".`);
    } catch (e) {
      setNote(`Could not write the label: ${(e as Error).message}`);
    } finally {
      setBusy("");
    }
  };

  // Done verifies before it advances. The check lives on the server because
  // every one of them reads a file the browser cannot see.
  const done = async (sub: Sub) => {
    setBusy(sub.num);
    setNote("");
    try {
      const r = await post({ action: "check", check: sub.check ?? "" });
      if (!r.ok) return setNote(r.problem!);
      if (!r.data.done) {
        setProblems((p) => ({ ...p, [sub.num]: r.data.problem }));
        // The card is long enough that the reason can land below the fold, and a
        // Done button that looks like it did nothing is worse than a refusal.
        requestAnimationFrame(() =>
          document.querySelector(".mw-snag")?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        );
        return;
      }
      setProblems((p) => {
        const { [sub.num]: _gone, ...rest } = p;
        return rest;
      });
      const next = nextSub(sub.num);
      if (next) await advance(next.num);
    } catch (e) {
      setNote(`Could not check the step: ${(e as Error).message}`);
    } finally {
      // A thrown fetch used to strand the button disabled at "Checking".
      setBusy("");
    }
  };


  const openSubNum = viewing || (data.step ?? "1.1");
  const progressStep = stepOfSub(openSubNum);
  const shownStep = selected
    ? STEPS.find((s) => s.num === selected) ?? progressStep
    : progressStep;

  const actions: StepActions = {
    fill,
    clear,
    writeLabel,
    done,
    view: (subNum: string) => transition(() => setViewing(subNum)),
    // Undo is the pointer moving back, so the reopened substep becomes current
    // again and its Done can re-verify the work.
    undo: async (subNum: string) => {
      setViewing("");
      await advance(subNum);
    },
    reload: () => { void load(); },
    backToProgress: () => setSelected(null),
  };

  if (!loaded) return <PanelSkeleton />;
  if (!data.track) return <Start onChoose={chooseTrack} note={note} />;

  if (!open) {
    return (
      <button className="mw-tab" style={trackVars} onClick={() => setOpen(true)}>
        Guide
      </button>
    );
  }

  return (
    <>
      <BuildTray build={build} />
      <aside className="mw-panel" style={trackVars}>
        <header className="mw-head">
          <b className="b14">Spatial streaming</b>
          <img className="mw-mark" src="/kit/assets/miris-logo-white.svg" alt="Miris" />
          <button className="mw-hide" onClick={() => setOpen(false)} aria-label="Hide the guide">
            ×
          </button>
        </header>

        {/* The chosen specimen carries into the sidebar as a full-width strip,
            so the choice stays visible for the whole workshop. Same screen
            blend and dissolve as the chooser doors, with its own focal point
            because this band is far wider than it is tall. */}
        <div className="mw-bar">
          <img
            className="mw-bar-art"
            src={track.image}
            alt=""
            aria-hidden="true"
            style={{ ["--focal-strip" as string]: track.focalStrip } as React.CSSProperties}
            /* Dropped by WebContainer in bolt; the strip keeps its own ground. */
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="mw-bar-label">{track.label}</span>
          <button className="mw-bar-change" onClick={() => chooseTrack("")}>
            Change
          </button>
        </div>

        <CapabilityLine />

        <div className="mw-split">
          <Rail
            progressStepNum={progressStep.num}
            shownStepNum={shownStep.num}
            onSelect={(num) =>
                transition(() => {
                  setViewing("");
                  setSelected(num);
                })
              }
          />
          <div className="mw-scroll" ref={scrollKeeper}>
            <StepPane
              step={shownStep}
              currentSubNum={data.step ?? "1.1"}
              data={data}
              track={track}
              busy={busy}
              problems={problems}
              build={build}
              openSubNum={openSubNum}
              actions={actions}
            />
          </div>
        </div>

        {note && <footer className="mw-note-bar">{note}</footer>}
      </aside>
    </>
  );
}
