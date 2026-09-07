import { useEffect, useRef, useState } from "react";
import { STAGES } from "./config";
import type { Track } from "./tracks";

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

/* The archive names its meshes 01-egg through 06-adult, so a leading number is
   the growth order. Only a leading one counts: matching any digit anywhere put
   "HL2 Ammo Crate" first, ahead of six correctly numbered specimens, because
   of the 2 in HL2. Anything unnumbered sorts after rather than being dropped,
   so a renamed asset still lands somewhere the attendee can see it. */
const INDEXED = /^\s*(\d+)\s*[-_. ]/;
const orderOf = (name: string) => {
  const m = String(name).match(INDEXED);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

/** Step 3.2. A scoped key already knows which assets it can read, so asking
 *  for six uuids as well was asking the attendee to retype what the key could
 *  answer for itself. Paste the key, look at what it found, seal all six. */
export function CapsuleAuto({ data, onDone }: { data: any; onDone: () => void }) {
  const [key, setKey] = useState(data?.viewerKey ?? "");
  const [found, setFound] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(false);

  const find = async () => {
    setBusy(true);
    setError("");
    setFound(null);
    try {
      const { MirisScene } = await import("@miris-inc/three");
      const scene: any = new (MirisScene as any)({ viewerKey: key.trim() });
      if (scene.ready) await scene.ready;
      const assets = await scene.fetchAssets();
      scene.dispose?.();
      if (!assets?.length) throw new Error("That key cannot see any assets. Check it is the key you scoped, and that the uploads finished.");
      setFound([...assets].sort((a: any, b: any) => orderOf(a.name) - orderOf(b.name) || String(a.name).localeCompare(String(b.name))));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const seal = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/miris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adopt", viewerKey: key.trim(), uuids: found!.slice(0, STAGES).map((a) => a.uuid) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `request failed: ${res.status}`);
      onDone();
      location.reload();
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setBusy(false);
    }
  };

  if (manual) return <CapsuleForm data={data} onDone={onDone} />;

  const take = found?.slice(0, STAGES) ?? [];
  const numbered = found?.filter((a) => INDEXED.test(String(a.name))).length ?? 0;
  return (
    <div className="mw-build mw-capsule">
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="scoped viewer key" spellCheck={false} />

      {!found && (
        <button className="btn btn-primary btn-sm" disabled={busy || !key.trim()} onClick={find}>
          {busy ? "Looking" : "Find my specimens"}
        </button>
      )}

      {found && (
        <>
          <ol className="mw-found">
            {take.map((a, i) => (
              <li key={a.uuid}>
                <span className="mw-found-n">{String(i + 1).padStart(2, "0")}</span>
                <span className="mw-found-name">{a.name}</span>
              </li>
            ))}
          </ol>
          <p className={numbered === 0 ? "mw-error" : "mw-note"}>
            {numbered === 0
              ? `None of the ${found.length} assets this key reads are numbered, so this order is alphabetical and almost certainly wrong. Check you pasted the key scoped to your six.`
              : found.length > STAGES
                ? `That key reads ${found.length} assets. The ${numbered} numbered ones lead, and the first ${STAGES} go in.`
                : found.length < STAGES
                  ? `That key reads ${found.length}. The rest of the capsules stay empty until more finish processing.`
                  : "In growth order, one per capsule."}
          </p>
          <div className="mw-row">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={seal}>
              {busy ? "Sealing" : `Seal ${take.length === 1 ? "the capsule" : `all ${take.length}`}`}
            </button>
            <button className="mw-link" onClick={() => setFound(null)} disabled={busy}>
              Look again
            </button>
          </div>
        </>
      )}

      {error && <p className="mw-error">{error}</p>}
      {!found && (
        <button className="mw-link" onClick={() => setManual(true)}>
          Enter them by hand
        </button>
      )}
    </div>
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
      <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="scoped viewer key" spellCheck={false} />
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
