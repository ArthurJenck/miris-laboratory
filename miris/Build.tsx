import { useEffect, useRef, useState } from "react";
import { STAGES } from "./config";
import type { Track } from "./tracks";

const GRID = 16;
// Must match the mw-dot duration in guide.css: the delays are fractions of it.
const WAVE = 3.2;

/* A dot grid rather than a shimmering block. Delay runs off (x + y), so the
   crest travels the diagonal, and each dot carries the wave in both its scale
   and its opacity. Negative delays start every dot mid-cycle, so the wave is
   already moving on the first frame. */
function DotWave() {
  const step = 100 / GRID;
  const dots = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={(x + 0.5) * step}
          cy={(y + 0.5) * step}
          r={step / 7}
          style={{ animationDelay: `${(-(x + y) / (GRID * 2 - 2)) * WAVE}s` }}
        />,
      );
    }
  }
  return (
    <svg className="mw-skel" viewBox="0 0 100 100" aria-hidden="true">
      {dots}
    </svg>
  );
}

/* The state lives above the steps, in Guide. It used to live inside step 1.2's
 * card, which unmounted the moment anyone advanced: step 2.3 tells attendees to
 * make their Miris account while the model builds, so the four minute job lost
 * its entire UI at exactly the point the curriculum sends them away from it. */

/* One concept, six bodies. The workflow runs server side and writes each stage
   into data.json as it lands, so this only has to watch the file: a reload
   mid-run picks the same series back up. */
export function useHatch(track: Track) {
  const [concept, setConcept] = useState("");
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [small, setSmall] = useState(false);
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
    });
  }, []);

  const stages: any[] = data?.specimens ?? [];
  const named = stages.filter((s) => s.stage).length;
  const done = stages.filter((s) => s.glb).length;
  const running = busy || (named > 0 && done < STAGES && !data?.zipReady);

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

  return { track, concept, setConcept, data, stages, named, done, running, elapsed, error, hatch, roll, small, setSmall, refresh: read };
}

export type HatchState = ReturnType<typeof useHatch>;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Step 1.2's card. One sentence describes the creature; the six bodies that
 *  grow out of it are the workflow's business, not the attendee's. */
export function ConceptField({ hatch }: { hatch: HatchState }) {
  const { track, concept, setConcept, running, error } = hatch;
  if (running) return <p className="mw-note">Growing the series, in the tray to the left.</p>;
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
  drawn: "Drawn",
  building: "Building",
  ready: "Ready",
  live: "Streaming",
};

/** The tray: six rows, one per stage, and the archive when they all land. */
export default function HatchTray({ hatch }: { hatch: HatchState }) {
  const { stages, done, running, elapsed, data, small, setSmall } = hatch;
  if (!stages.some((s: any) => s.stage)) return null;

  return (
    <aside className={`mw-tray${small ? " is-small" : ""}`}>
      <header className="mw-tray-head">
        <span className="l12">
          <i className={running ? "mw-dot-live" : "mw-dot-done"} aria-hidden="true" />
          {running ? `Growing ${done} of ${STAGES}` : `${done} of ${STAGES} grown`}
        </span>
        <span className="mw-elapsed">{running ? mmss(elapsed) : null}</span>
        <button className="mw-tray-fold" onClick={() => setSmall(!small)} aria-label={small ? "Expand" : "Collapse"}>
          {small ? "+" : "\u2013"}
        </button>
      </header>

      {!small && (
        <>
          <ol className="mw-stages">
            {stages.map((s: any, i: number) => (
              <li key={s.id} className={`mw-stage is-${s.status}`}>
                <span className="mw-stage-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="mw-stage-name">{s.stage || "\u2014"}</span>
                <span className="mw-stage-state">{STATE_LABEL[s.status] ?? s.status}</span>
              </li>
            ))}
          </ol>

          {data?.zipReady ? (
            <a className="btn btn-primary btn-sm mw-dl" href="/api/miris?download=zip" download="specimens.zip">
              Download the archive
            </a>
          ) : (
            <p className="mw-note">
              Six renders and six meshes, running together. Four to six minutes. Make your Miris account while you
              wait.
            </p>
          )}
        </>
      )}
    </aside>
  );
}

export function CapsuleForm({ data, onDone }: { data: any; onDone: () => void }) {
  const i = data?.active ?? 0;
  const slot = data?.specimens?.[i];
  const [uuid, setUuid] = useState(slot?.uuid ?? "");
  const [key, setKey] = useState(data?.viewerKey ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/miris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "capsule", index: i, uuid: uuid.trim(), viewerKey: key.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `request failed: ${res.status}`);
      onDone();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mw-build mw-capsule">
      <p className="l12">Capsule {slot?.id ?? "01"}</p>
      <input value={uuid} onChange={(e) => setUuid(e.target.value)} placeholder="asset uuid" spellCheck={false} />
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="viewer key" spellCheck={false} />
      <button className="btn btn-primary btn-sm" disabled={busy || !uuid.trim()} onClick={save}>
        {busy ? "Sealing" : "Seal the capsule"}
      </button>
      {error && <p className="mw-error">{error}</p>}
    </div>
  );
}

/** Which capsule the attendee is filling. Shown wherever a step writes into
 *  one, so it is always obvious which of the six is about to change. */
export function CapsulePicker({ data, onDone }: { data: any; onDone: () => void }) {
  const specimens: any[] = data?.specimens ?? [];
  const active = data?.active ?? 0;
  const pick = async (i: number) => {
    await fetch("/api/miris", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", patch: { active: i } }),
    });
    onDone();
  };
  return (
    <div className="mw-capsules" role="group" aria-label="Choose a capsule">
      {specimens.map((s, i) => (
        <button
          key={s.id}
          className={`mw-cap${i === active ? " is-active" : ""}${s.uuid ? " is-full" : ""}`}
          onClick={() => pick(i)}
          title={s.dossier?.name ?? (s.uuid ? "Streaming" : "Empty")}
        >
          {s.id}
        </button>
      ))}
    </div>
  );
}
