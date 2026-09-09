import { useEffect, useRef, useState } from "react";
import { STAGES } from "./config";
import type { Track } from "./tracks";

/* The state lives above the steps, in Guide. It used to live inside step 1.4's
 * card, which unmounted the moment anyone advanced: the room is built while the
 * series grows, so the twelve minute job lost its entire UI at exactly the
 * point the curriculum sends attendees on to the next step. */

/* One concept, six bodies. The workflow runs server side and writes each stage
   into data.json as it lands, so this only has to watch the file: a reload
   mid-run picks the same series back up. */
export function useHatch(track: Track) {
  const [concept, setConcept] = useState("");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [small, setSmallHere] = useState(false);
  const bag = useRef<string[]>([]);

  const read = async () => {
    try {
      const d = await (await fetch("/api/miris")).json();
      setData(d);
      return d;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    read().then((d) => {
      if (d?.concept) setConcept(d.concept);
      if (d?.traySmall) setSmallHere(true);
    });
  }, []);

  /* Folded or open outlives the reload that every Fill triggers. */
  const setSmall = (v: boolean) => {
    setSmallHere(v);
    void fetch("/api/miris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", patch: { traySmall: v } }),
    }).catch(() => {});
  };

  const stages: any[] = data?.specimens ?? [];
  const named = stages.filter((s) => s.stage).length;
  const drawn = stages.filter((s) => s.imageUrl).length;
  const done = stages.filter((s) => s.glb).length;
  /* Driven by the file, not by stage names. The names only land once the
     planner returns, so keying off them left the tray hidden for the first
     ten to twenty seconds of a paid run. hatchedAt is written the moment the
     run starts. */
  const running = busy || (Number(data?.hatchedAt) > 0 && !data?.zipReady);

  // While anything is in flight the file is the only source of truth, because
  // the request that started it dies with the page.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(read, 4000);
    return () => clearInterval(t);
  }, [running]);

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return setElapsed(0);
    const started = data?.hatchedAt || Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [running, data?.hatchedAt]);

  const hatch = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/miris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hatch", prompt: concept.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `request failed: ${res.status}`);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
      await read();
    }
  };

  const roll = () => {
    if (bag.current.length === 0) {
      bag.current = [...track.prompts].sort(() => Math.random() - 0.5);
    }
    let next = bag.current.pop()!;
    if (next === concept.trim() && bag.current.length > 0) {
      bag.current.unshift(next);
      next = bag.current.pop()!;
    }
    setConcept(next);
    setError("");
  };

  return { track, concept, setConcept, data, stages, named, drawn, done, running, elapsed, error, hatch, roll, small, setSmall, refresh: read };
}

export type HatchState = ReturnType<typeof useHatch>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Step 1.4's card. One sentence describes the creature; the six bodies that
 *  grow out of it are the workflow's business, not the attendee's. */
export function ConceptField({ hatch }: { hatch: HatchState }) {
  const { track, concept, setConcept, running, error, done } = hatch;
  const [again, setAgain] = useState(false);
  if (running) return <p className="mw-note">Growing the series, in the tray to the left.</p>;

  /* Once six are grown the form does not come back on its own. It did, with
     the same red button, and a second press is another twelve dollars. */
  if (done >= STAGES && !again)
    return (
      <div className="mw-build">
        <p className="mw-note">All six stages are grown. The archive is in the tray, to the left of this panel.</p>
        <button className="mw-link" onClick={() => setAgain(true)}>
          Grow a different {track.noun} instead
        </button>
      </div>
    );

  return (
    <div className="mw-build">
      <div className="mw-prompt">
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          rows={3}
          placeholder={track.hint}
        />
        <button
          type="button"
          className="mw-dice"
          onClick={hatch.roll}
          title={`Suggest ${/^[aeiou]/i.test(track.noun) ? "an" : "a"} ${track.noun}`}
          aria-label={`Suggest ${/^[aeiou]/i.test(track.noun) ? "an" : "a"} ${track.noun}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
            <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            <circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" />
            <circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" />
          </svg>
        </button>
      </div>
      <button className="btn btn-primary btn-sm" disabled={!concept.trim()} onClick={hatch.hatch}>
        Grow the series
      </button>
      {error && <p className="mw-error">{error}</p>}
    </div>
  );
}

const STATE_LABEL: Record<string, string> = {
  empty: "Waiting",
  named: "Planned",
  building: "Building",
  ready: "Ready",
  live: "Streaming",
};

/** The tray: six rows, one per stage, and the archive when they all land. */
export default function HatchTray({ hatch }: { hatch: HatchState }) {
  const { stages, drawn, done, running, elapsed, data, small, setSmall } = hatch;
  const box = useRef<HTMLElement>(null);

  /* Popover manners: Escape and a click outside put it away. Bound only while
     it is open, so the collapsed handle keeps its own click. */
  useEffect(() => {
    if (small) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSmall(true);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (box.current?.contains(t as Node)) return;
      // The guide and the dev bar are their own surfaces, not "outside".
      if (t?.closest?.(".mw-panel, .mw-tab, .mw-dev")) return;
      setSmall(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [small, setSmall]);

  // Present as soon as there is a run, even before it has named anything.
  if (!running && !stages.some((s: any) => s.stage)) return null;

  /* "Growing 0 of 6" was the headline for the first several minutes, because
     the count only moves when a mesh lands. A run is twelve jobs, a render and
     a mesh per specimen, so that is what the rail measures. */
  const jobs = STAGES * 2;
  const pct = Math.round(((drawn + done) / jobs) * 100);
  const count = running ? "Growing the series" : `${done} of ${STAGES} grown`;

  /* Collapsed is a pill, not an empty column. The tray is a full height fixed
     panel, so hiding only its list left 340px of nothing between the scene and
     the guide, which is the opposite of what collapsing is for. */
  if (small) {
    return (
      <button
        className="mw-tray-min"
        onClick={() => setSmall(false)}
        aria-expanded={false}
        aria-label={`${count}. Expand the tray`}
      >
        <i className="mw-tray-dot" {...(running ? { "data-busy": "" } : {})} aria-hidden="true" />
        <span className="l12">{count}</span>
        {running && <span className="mw-tray-clock">{mmss(elapsed)}</span>}
        <span className="mw-tray-chev" aria-hidden="true">
          +
        </span>
      </button>
    );
  }

  return (
    <aside className="mw-tray" ref={box} role="dialog" aria-label="Growth series">
      <header className="mw-tray-head">
        <span className="l12">
          <i className={running ? "mw-dot-live" : "mw-dot-done"} aria-hidden="true" />
          {count}
        </span>
        <span className="mw-elapsed">{running ? mmss(elapsed) : null}</span>
        <button className="mw-tray-fold" onClick={() => setSmall(true)} aria-expanded={true} aria-label="Collapse the tray">
          {"\u2013"}
        </button>
      </header>

      {running && (
        <div className="mw-prog">
          <div className="mw-prog-rail" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Run progress">
            <span className="mw-prog-fill" style={{ width: `${pct}%` }} />
          </div>
          <p className="mw-prog-read">
            {drawn} rendered, {done} built
          </p>
        </div>
      )}

      <ol className="mw-stages">
        {stages.map((s: any, i: number) => (
          <li key={s.id} className={`mw-stage is-${s.status}`} {...(running && s.imageUrl && !s.glb ? { "data-active": "" } : {})}>
            <span className="mw-stage-n">{String(i + 1).padStart(2, "0")}</span>
            <span className="mw-stage-name">{s.stage || "\u2014"}</span>
            {running ? (
              // Two jobs per specimen, so two pips: rendered, then built.
              <span className="mw-pips" aria-label={`${s.imageUrl ? "rendered" : "waiting"}, ${s.glb ? "built" : "not built"}`}>
                <i {...(s.imageUrl ? { "data-on": "" } : {})} />
                <i {...(s.glb ? { "data-on": "" } : {})} />
              </span>
            ) : (
              <span className="mw-stage-state">{STATE_LABEL[s.status] ?? s.status}</span>
            )}
          </li>
        ))}
      </ol>

      {data?.zipReady ? (
        <a className="btn btn-primary btn-sm mw-dl" href="/api/miris?download=zip" download="specimens.zip">
          Download the archive
        </a>
      ) : (
        <p className="mw-note">
          Each render grows from the one before it, and the meshes build as they land. About twelve minutes. Make
          your Miris account while you wait.
        </p>
      )}
    </aside>
  );
}

/** Offline-only controls, rendered nowhere else: the whole recorded run in one
 *  press, so everything downstream of the twelve minute wait can be rehearsed
 *  without paying for it. Reloads afterwards because the stage reads the API
 *  once on mount, and seeded capsules only stream after a fresh boot. */
export function DevBar({ hatch }: { hatch: HatchState }) {
  const { data, refresh } = hatch;
  const [busy, setBusy] = useState("");
  const [oops, setOops] = useState("");
  if (!data?.offline) return null;

  const run = async (action: string) => {
    setBusy(action);
    setOops("");
    try {
      const res = await fetch("/api/miris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `request failed: ${res.status}`);
      await refresh();
      location.reload();
    } catch (e: any) {
      setOops(e?.message ?? String(e));
      setBusy("");
    }
  };

  return (
    <div className="mw-dev">
      <span className="mw-dev-tag">OFFLINE</span>
      <button onClick={() => run("seed")} disabled={!!busy}>
        {busy === "seed" ? "Seeding…" : "Seed the lab"}
      </button>
      <button onClick={() => run("unseed")} disabled={!!busy}>
        {busy === "unseed" ? "Clearing…" : "Empty it"}
      </button>
      {oops && <span className="mw-dev-err">{oops}</span>}
    </div>
  );
}
