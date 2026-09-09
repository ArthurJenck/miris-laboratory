import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { chapterSnapshot, mergeSpecimens, readViewerKey, specimensJson, starterStage, withViewerKey, writeReference } from "./lessonSource.mjs";
import { readData, writeData } from "./store.mjs";
import { EMPTY_SPECIMENS, SNIPPETS } from "./snippets.mjs";
import { emptyBank, emptySpecimen, normaliseBank } from "./specimens.mjs";
import { pollRun, runPatch, submitRun } from "./growthQueue.mjs";
import { zipSync } from "./zip.mjs";
import { tinyGlb } from "./tinyGlb.mjs";
import { DEMO_UUID, GROWTH_WORKFLOW, STAGES, STATUSES, STAT_LABELS, VIEWER_KEY } from "./config";
import { TRACKS } from "./tracks";

/* Dev only, by construction: configureServer has no production counterpart, so
 * a built app has no endpoint to reach. */

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
const SPECIMENS = join(ROOT, "app", "specimens.json");
const REFERENCE_SOURCES = new Set(["stage.template.tsx", "curriculum.ts", "snippets.mjs", "fixtures.json"].map((f) => join(MIRIS_DIR, f)));
/* What the stage returns to on reset: the file attendees start from. */
const TEMPLATE = join(ROOT, "miris", "stage.template.tsx");
const ZIP = join(ROOT, "miris", "specimens.zip");
/* Offline builds its own archive rather than overwriting the real one: the
   129MB of creature meshes from a paid run are not worth losing to a rehearsal. */
const ZIP_OFFLINE = join(MIRIS_DIR, "specimens.offline.zip");
const FIXTURES = join(MIRIS_DIR, "fixtures.json");

/* What each step's snippet must leave behind for its check to believe it. Kept
   in one table, and audited against the snippets when the server starts,
   because these drifted apart once: the room check went looking for a
   gridHelper the snippet had stopped emitting, so pressing Fill and then Done
   told the attendee they had not done a step they had just done. A check that
   blames the person for the repo's own drift is worse than no check. */
const PROOF = {
  setup: "extend(",
  room: "<Room",
  platform: "<Platform",
  walkway: "<Walkway",
  door: "<Door",
  specimens: "<Specimen",
  streams: "<mirisStream",
  screens: "<Screen>",
  hud: "<Readout",
  overlay: "<ScreenFx",
  controls: "<Controls",
  field: "Fn(",
  markup: "mw-dossier",
  file: "drawElementImage",
};

/** Which snippet each proof has to appear in. */
const PROOF_IN: Record<keyof typeof PROOF, keyof typeof SNIPPETS> = {
  setup: "setup",
  room: "room",
  platform: "platform",
  walkway: "walkway",
  door: "door",
  specimens: "specimens",
  streams: "streams",
  screens: "screens",
  hud: "hud",
  overlay: "effect",
  field: "field",
  markup: "markup",
  file: "file",
  controls: "controls",
};

const auditProofs = () => {
  const drifted = Object.entries(PROOF_IN)
    .filter(([id, snip]) => !SNIPPETS[snip]?.includes(PROOF[id as keyof typeof PROOF]))
    .map(([id, snip]) => `  ${id}: SNIPPETS.${snip} no longer contains ${JSON.stringify(PROOF[id as keyof typeof PROOF])}`);
  if (drifted.length) {
    console.warn(
      "\n[miris] step checks have drifted from the snippets they verify.\n" +
        drifted.join("\n") +
        "\nThose steps will refuse Done even when the attendee has pasted the snippet.\n",
    );
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


/* One check per step that has something verifiable on disk. Each returns null
 * when the step is done, or the sentence the attendee needs to read. Steps that
 * happen elsewhere entirely, signing up or deploying, have no entry: the Done
 * button just moves them on rather than pretending to know. */
/** app/specimens.json as it is on disk; the empty six if it is missing or broken. */
async function readSpecimensFile(): Promise<{ uuid?: string; scale?: number }[]> {
  try {
    const parsed = JSON.parse(await readFile(SPECIMENS, "utf8"));
    return Array.isArray(parsed) ? parsed : EMPTY_SPECIMENS;
  } catch {
    return EMPTY_SPECIMENS;
  }
}

/** Lays ids (and scales, when given) over app/specimens.json and sets the key
 *  in app/stage.tsx, so the room streams what data.json says it should. */
async function writeStageSpecimens(viewerKey: string | undefined, entries: { uuid?: string; scale?: number }[]) {
  const current = await readSpecimensFile();
  const next = specimensJson(mergeSpecimens(current, entries));
  if (next !== specimensJson(current)) await writeFile(SPECIMENS, next);
  if (viewerKey !== undefined) {
    const source = await readFile(STAGE, "utf8");
    const keyed = withViewerKey(source, viewerKey);
    if (keyed !== source) await writeFile(STAGE, keyed);
  }
}

/** Copies the key and ids the attendee has in their files into data.json, so the
 *  readout's count and the tray agree with what is streaming even when the ids
 *  were typed in rather than sealed. */
async function followStage(viewerKey: string, entries: { uuid?: string }[]) {
  const stored = await readData(MIRIS_DIR);
  const bank = normaliseBank(stored.specimens as any[]);
  let changed = stored.viewerKey !== viewerKey;
  bank.forEach((slot, i) => {
    const uuid = String(entries[i]?.uuid ?? "").trim();
    if (!uuid || slot.uuid === uuid) return;
    bank[i] = { ...slot, uuid, status: "live" };
    changed = true;
  });
  if (changed) await writeData(MIRIS_DIR, { specimens: bank, viewerKey });
}

/** A check that passes once `proof` appears in app/stage.tsx. The proofs are
 *  shaped like the JSX or the call the step adds, so an import line alone
 *  cannot satisfy one. */
const inFile = (proof: string, problem: string) => async () => ((await readFile(STAGE, "utf8")).includes(proof) ? null : problem);

const CHECKS: Record<string, (mode: string) => Promise<string | null>> = {
  async falKey(mode) {
    return falKey(mode)
      ? null
      : "No FAL_KEY yet. Create .env.local at the top level of the project, put your key in it, and save.";
  },

  async series() {
    const { specimens, zipReady, hatchedAt } = await readData(MIRIS_DIR);
    const grown = (specimens as any[])?.filter((s) => s.glb).length ?? 0;
    if (grown >= STAGES) return zipReady ? null : "All six are built but the archive is still being packed.";
    /* A run in flight is not a reason to hold anyone here. The room is built
       while the meshes grow, and the tray points at the Miris account in the
       meantime, so gating this on all six finishing would be twelve minutes of
       the session spent watching a tray. */
    if (Number(hatchedAt) > 0 && !zipReady) return null;
    return "Nothing grown yet. Describe your creature and press Grow the series.";
  },

  setup: inFile(PROOF.setup, "The extend call is not in app/stage.tsx yet. Add it and the declaration under the imports, or take the chapter's finished code."),
  room: inFile(PROOF.room, "No Room inside Scene yet. Add the line, or take the chapter's finished code."),
  platform: inFile(PROOF.platform, "No Platform yet. Add it under Room, or take the chapter's finished code."),
  walkway: inFile(PROOF.walkway, "No Walkway yet. Add it under Platform, or take the chapter's finished code."),
  door: inFile(PROOF.door, "No Door yet. Add it under Walkway, or take the chapter's finished code."),
  specimens: inFile(PROOF.specimens, "No Specimens yet. Add the map under Door, or take the chapter's finished code."),
  streams: inFile(PROOF.streams, "Nothing is streaming into the capsules yet. Replace the specimen line with the version that holds a stream, or take the chapter's finished code."),
  screens: inFile(PROOF.screens, "No Screen inside the Specimens yet. Replace the specimen line with the version that holds one, or take the chapter's finished code."),

  async ids() {
    // What streams is what the check reads: the ids in app/specimens.json and
    // the key in app/stage.tsx, however they got there.
    const entries = await readSpecimensFile();
    const viewerKey = readViewerKey(await readFile(STAGE, "utf8"));
    const { active } = await readData(MIRIS_DIR);
    const uuid = String(entries[Number(active) || 0]?.uuid ?? "").trim();
    if (!uuid) return "No ids yet. Copy each asset's id from the portal into app/specimens.json, in growth order.";
    if (!UUID_RE.test(uuid)) return `That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`;
    if (uuid === DEMO_UUID) return "That capsule still holds the demo specimen. Paste your own asset id from the portal.";
    if (!viewerKey) return "No viewer key yet. Paste the key you tagged workshop into viewerKey at the top of app/stage.tsx.";
    if (viewerKey === VIEWER_KEY) return "That is still the workshop's demo viewer key, which cannot read your assets. Paste the one you made.";
    await followStage(viewerKey, entries);
    return null;
  },

  hud: inFile(PROOF.hud, "No Readout yet. Add the line after Scene, or take the chapter's finished code."),
  controls: inFile(PROOF.controls, "No Controls yet. Add the line under ScreenFx, or take the chapter's finished code."),
  overlay: inFile(PROOF.overlay, "No ScreenFx yet. Add the line under Readout, or take the chapter's finished code."),

  async field() {
    const src = await readFile(STAGE, "utf8");
    if (!src.includes(PROOF.overlay)) return "No ScreenFx yet. Step 5.2 puts it there.";
    return src.includes(PROOF.field) ? null : "The effect is mounted but the glitch is still null. Write the TSL, or take the chapter's finished code.";
  },

  file: inFile(PROOF.file, "File does not draw anything yet. Replace the placeholder above Stage, or take the chapter's finished code."),
  markup: inFile(PROOF.markup, "No file markup yet. Replace the empty fileMarkup near the top of app/stage.tsx, or take the chapter's finished code."),
};

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

/* The registrar's file for one stage, pinned to the shape the screen can lay
   out: four stats and nothing else can be drawn as bars. */
const normaliseDossier = (d: any) => {
  if (typeof d?.name !== "string" || !d.name.trim()) return null;
  if (typeof d?.notes !== "string" || !d.notes.trim()) return null;
  const status = String(d?.status ?? "").toUpperCase();
  const byLabel = new Map(
    (Array.isArray(d?.stats) ? d.stats : []).map((x: any) => [String(x?.label ?? "").toUpperCase(), x?.value]),
  );
  return {
    designation: String(d?.designation ?? "SP-00").trim().toUpperCase().slice(0, 8),
    series: String(d?.series ?? "ARC").trim().toUpperCase().slice(0, 10),
    name: d.name.trim().toUpperCase().slice(0, 24),
    classification: String(d?.classification ?? "").trim().slice(0, 60),
    status: (STATUSES as readonly string[]).includes(status) ? status : "STABLE",
    generation: Math.round(clamp(d?.generation, 1, 12, 1)),
    viability: Math.round(clamp(d?.viability, 0, 100, 90) * 10) / 10,
    // Always the four labels, in order, whatever the model returned.
    stats: STAT_LABELS.map((label) => ({ label, value: Math.round(clamp(byLabel.get(label), 0, 100, 50)) })),
    traits: (Array.isArray(d?.traits) ? d.traits : []).map((t: any) => String(t).trim()).filter(Boolean).slice(0, 3),
    notes: d.notes.trim(),
  };
};

/** The workflow's dossiers node: one JSON array, six files in stage order.
 *  Models fence JSON out of habit however firmly they are told not to. */
const parseDossiers = (raw: unknown) => {
  if (typeof raw !== "string") return [];
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list.slice(0, STAGES).map(normaliseDossier) : [];
  } catch {
    return [];
  }
};

type Plan = {
  clade: string;
  development: string;
  anatomy: string;
  stages: { stage: string; prompt: string; carry: string; change: string }[];
};

/** The workflow's plan node answers in lines: Concept, Clade, Development,
 *  Anatomy, then "Stage N: name | body: ... | carry: ... | change: ...". */
const parsePlanText = (raw: unknown): Plan | null => {
  if (typeof raw !== "string") return null;
  const line = (label: string) => raw.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
  const stages: Plan["stages"] = [];
  for (const match of raw.matchAll(/^Stage\s*(\d)\s*:\s*([^|\r\n]+?)\s*(?:\|(.*))?$/gim)) {
    const fields: Record<string, string> = {};
    for (const part of (match[3] ?? "").split("|")) {
      const [key, ...rest] = part.split(":");
      if (rest.length) fields[key.trim().toLowerCase()] = rest.join(":").trim();
    }
    stages[Number(match[1]) - 1] = {
      stage: match[2].trim().slice(0, 24),
      prompt: fields.body ?? "",
      carry: fields.carry ?? "",
      change: fields.change ?? "",
    };
  }
  if (stages.filter(Boolean).length !== STAGES || stages.some((st) => !st.stage)) return null;
  return { clade: line("Clade"), development: line("Development"), anatomy: line("Anatomy"), stages };
};

/* meshy answers with several formats, and `model_glb` has been observed
   carrying an .fbx url. Trust the extension, not the field name: walk the whole
   reply and take the first url that is actually a glb. */
const findGlb = (node: unknown): string | null => {
  if (typeof node === "string") return /\.glb(\?|$)/i.test(node) ? node : null;
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findGlb(v);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      const hit = findGlb(v);
      if (hit) return hit;
    }
  }
  return null;
};

/** glTF binary starts with the ascii magic. A mesh that does not is not one. */
const isGlb = (buf: Buffer) => buf.length > 12 && buf.toString("ascii", 0, 4) === "glTF";

/** A file name a person can read in a download folder, in growth order. */
const stageFile = (i: number, stage: string) =>
  `${String(i + 1).padStart(2, "0")}-${stage.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "stage"}.glb`;

type Run = { id: string; statusUrl: string; responseUrl: string };

/* Each slot is patched on its own, read-modify-write inside the store's queue,
   so two patches landing together cannot clobber one another. */
const patchSlot = async (i: number, patch: Record<string, unknown>) => {
  const fresh = await readData(MIRIS_DIR);
  const bank = normaliseBank(fresh.specimens as any[]);
  bank[i] = { ...bank[i], ...patch };
  await writeData(MIRIS_DIR, { specimens: bank });
};

/** Turns the workflow's output map into six named, rendered, built stages and
 *  the archive. Throws with a sentence for the attendee when the map is short
 *  of what six capsules need. */
async function settleRun(output: any) {
  const plan = parsePlanText(output?.plan);
  if (!plan) throw new Error("The workflow did not return a usable growth plan. Press the button again.");
  const fresh = await readData(MIRIS_DIR);
  const bank = normaliseBank(fresh.specimens as any[]);
  plan.stages.forEach((st, i) => {
    bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, status: "named", imageUrl: "", glb: "", dossier: null };
  });
  await writeData(MIRIS_DIR, { clade: plan.clade, development: plan.development, anatomy: plan.anatomy, specimens: bank });

  const dossiers = parseDossiers(output?.dossiers);
  for (let i = 0; i < dossiers.length; i++) if (dossiers[i]) await patchSlot(i, { dossier: dossiers[i] });

  const glbs: string[] = [];
  for (let i = 0; i < STAGES; i++) {
    // The node reports `images`, and the output map hands that array on as `image_N`.
    const images = output?.[`image_${i + 1}`];
    const url = Array.isArray(images) ? images[0]?.url : images;
    if (typeof url === "string" && url) await patchSlot(i, { imageUrl: url, status: "building" });
    const glb = findGlb(output?.[`model_${i + 1}`]);
    if (!glb) throw new Error(`fal returned no glb for ${plan.stages[i].stage}. Press the button again.`);
    glbs[i] = glb;
    await patchSlot(i, { glb, status: "ready", modelStartedAt: 0 });
  }

  const files = await Promise.all(
    plan.stages.map(async (st, i) => {
      const r = await fetch(glbs[i]);
      if (!r.ok) throw new Error(`could not fetch ${stageFile(i, st.stage)}: ${r.status}`);
      const data = Buffer.from(await r.arrayBuffer());
      // Checked here rather than trusted: a mis-typed mesh only shows up as a
      // failed upload in the portal, long after the workshop.
      if (!isGlb(data)) throw new Error(`${stageFile(i, st.stage)} came back as ${data.toString("ascii", 0, 4)}, not glTF. Press the button again.`);
      return { name: stageFile(i, st.stage), data };
    }),
  );
  await writeFile(ZIP, zipSync(files));
  await writeData(MIRIS_DIR, { zipReady: true });
}

const POLL_MS = 5000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let watching = false;

/** Follows the run in data.json until it is settled or has failed. One watcher
 *  per process; a second call while one is looping is a no-op. Every request
 *  it makes is short, which is the whole point: see growthQueue.mjs. */
async function watchRun(mode: string) {
  if (watching) return;
  watching = true;
  try {
    for (;;) {
      const data = await readData(MIRIS_DIR);
      const run = data.run as Run | null;
      if (!run) return;
      const key = falKey(mode);
      if (!key) {
        // The key left .env.local mid-run. Nothing to do but wait for it back.
        await sleep(POLL_MS);
        continue;
      }
      const result = await pollRun(fetch, run, key);
      const { patch, settle, output } = runPatch(result);
      if (settle) {
        try {
          await settleRun(output);
          await writeData(MIRIS_DIR, { run: null, runState: "", queuePosition: 0 });
        } catch (e) {
          // Whatever did land stays in the tray; only the in-flight marker is
          // cleared, so the form comes back with the reason.
          await writeData(MIRIS_DIR, { run: null, runState: "", queuePosition: 0, hatchedAt: 0, runError: (e as Error).message });
        }
        return;
      }
      if (Object.keys(patch).length) await writeData(MIRIS_DIR, patch);
      await sleep(POLL_MS);
    }
  } catch (e) {
    console.warn(`[miris] stopped watching the growth run: ${(e as Error).message}`);
  } finally {
    watching = false;
  }
}

/** On start: pick a queued run back up, or retire one the old streaming code
 *  left marked in flight with nothing to resume. */
async function resumeRun(mode: string) {
  const data = await readData(MIRIS_DIR);
  if (data.run) return watchRun(mode);
  if (Number(data.hatchedAt) > 0 && !data.zipReady && !offline(mode)) {
    await writeData(MIRIS_DIR, { hatchedAt: 0, runError: "The previous run was lost when the dev server stopped. Press Grow the series again." });
  }
}

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (error: string, status = 400): Reply => ({ status, body: { error } });

async function handle(action: string, body: any, mode: string): Promise<Reply> {
  switch (action) {
    /* The finished code through the end of one chapter, in place of whatever the
       attendee has. Code only: the viewer key in the file is kept, and
       specimens.json is not touched. */
    case "snapshot": {
      const chapter = String(body?.chapter ?? "").trim();
      if (!/^\d{1,2}$/.test(chapter)) return fail(`No such chapter: ${chapter}`);
      const [template, curriculum, current, stored] = await Promise.all([
        readFile(TEMPLATE, "utf8"),
        readFile(join(MIRIS_DIR, "curriculum.ts"), "utf8"),
        readFile(STAGE, "utf8"),
        readData(MIRIS_DIR),
      ]);
      const viewerKey = readViewerKey(current) || String(stored.viewerKey ?? "");
      await writeFile(STAGE, chapterSnapshot(template, curriculum, chapter, viewerKey));
      return ok({ ok: true, chapter });
    }

    case "save":
      return ok(await writeData(MIRIS_DIR, body.patch ?? {}));

    /* Every step back to the start: the stage returns to the template and the
       pointer to 1.1. The series, its uuids and the viewer key stay, so nothing
       has to be grown or uploaded again. */
    case "reset": {
      await writeFile(STAGE, starterStage(await readFile(TEMPLATE, "utf8")));
      const stored = await readData(MIRIS_DIR);
      await writeStageSpecimens(stored.viewerKey, normaliseBank(stored.specimens as any[]));
      return ok(await writeData(MIRIS_DIR, { step: "1.1", sub: "1.1", active: 0, finished: false }));
    }

    case "check": {
      const check = CHECKS[String(body.check ?? "")];
      // No check for this step is not a failure: it means nothing on disk
      // proves it, so the attendee's word is what we have.
      if (!check) return ok({ done: true });
      const problem = await check(mode);
      return ok({ done: !problem, problem });
    }

    case "hatch": {
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet.");
      const concept = String(body?.prompt ?? "").trim();
      if (!concept) return fail("Describe the creature first.");

      /* The recorded run, replayed. Whatever the attendee typed is still kept
         as the concept, so the tray reads back the way it would have. */
      if (offline(mode)) {
        const fx = await readFixtures();
        const bank = normaliseBank(stored.specimens as any[]);
        fx.stages.forEach((st, i) => {
          bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, status: "ready", imageUrl: "", glb: `offline:${stageFile(i, st.stage)}`, dossier: st.dossier ?? null, modelStartedAt: 0 };
        });
        await writeFixtureZip(fx.stages);
        await writeData(MIRIS_DIR, { concept, specimens: bank, zipReady: true, hatchedAt: Date.now() });
        return ok({ offline: true, stages: fx.stages.map((s2: any) => s2.stage), files: fx.stages.map((s2: any, i: number) => stageFile(i, s2.stage)) });
      }

      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");

      /* Written before the queue is asked, so the tray shows a run the moment it
         is paid for. The six slots are emptied now rather than when the plan
         lands: through the queue nothing lands until the very end, and the old
         series would otherwise sit in the tray reading "6 built" for twelve
         minutes. The uuids stay, as they always did, so the stage file keeps
         streaming whatever it streamed. */
      const bank = normaliseBank(stored.specimens as any[]).map((s) => ({ ...emptySpecimen(s.id), uuid: s.uuid }));
      await writeData(MIRIS_DIR, { concept, hatchedAt: Date.now(), zipReady: false, specimens: bank, run: null, runState: "", queuePosition: 0, runError: "" });
      let run: Run;
      try {
        run = await submitRun(fetch, { workflow: GROWTH_WORKFLOW, key: falKey(mode), input: { concept } });
      } catch (e) {
        await writeData(MIRIS_DIR, { hatchedAt: 0 });
        return fail((e as Error).message, 502);
      }
      /* The handle is what survives: a reload, a folded tray, even a restarted
         dev server all find the same run here and carry on watching it. */
      await writeData(MIRIS_DIR, { run, runState: "queued" });
      void watchRun(mode);
      return ok({ queued: true, id: run.id });
    }

    /* The whole run in one press: six stages named, six dossiers written, six
       capsules streaming. What the workshop takes two hours and twelve dollars
       to reach, for rehearsing everything downstream of it. */
    case "seed": {
      if (!offline(mode)) return fail("Seeding is offline only. Put MIRIS_OFFLINE=1 in .env.local.");
      const fx = await readFixtures();
      const stored = await readData(MIRIS_DIR);
      const bank = normaliseBank(stored.specimens as any[]);
      fx.stages.forEach((st: any, i: number) => {
        // Falls back to the demo asset, so this works before the six real
        // uuids have been captured, and sharpens once they have.
        const uuid = String(st.uuid || "").trim() || DEMO_UUID;
        bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, dossier: st.dossier ?? null, uuid, status: "live", imageUrl: "", glb: `offline:${stageFile(i, st.stage)}`, modelStartedAt: 0 };
      });
      await writeFixtureZip(fx.stages);
      await writeData(MIRIS_DIR, {
        track: stored.track || TRACKS[0].id,
        concept: fx.concept,
        specimens: bank,
        viewerKey: String(fx.viewerKey || "").trim() || stored.viewerKey || VIEWER_KEY,
        zipReady: true,
        hatchedAt: Date.now(),
        active: 0,
      });
      await writeStageSpecimens(
        String(fx.viewerKey || "").trim() || stored.viewerKey || VIEWER_KEY,
        bank.map((slot, i) => ({ uuid: slot.uuid, scale: fx.stages[i]?.scale })),
      );
      const real = fx.stages.filter((s2: any) => s2.uuid).length;
      return ok({ seeded: bank.length, realUuids: real, usingDemo: bank.length - real });
    }

    case "unseed": {
      if (!offline(mode)) return fail("Seeding is offline only. Put MIRIS_OFFLINE=1 in .env.local.");
      await writeData(MIRIS_DIR, { concept: "", specimens: emptyBank(), zipReady: false, hatchedAt: 0, active: 0, run: null, runState: "", queuePosition: 0, runError: "" });
      await writeFile(SPECIMENS, specimensJson(EMPTY_SPECIMENS));
      return ok({ ok: true });
    }

    default:
      return fail(`unknown action: ${action}`);
  }
}

const send = (res: ServerResponse, { status, body }: Reply) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });

/* Read per request rather than capturing at config time. loadEnv is a plain
 * file read, so an attendee who pastes their key into .env.local does not also
 * have to restart the dev server for it to count. */
const falKey = (mode: string) => loadEnv(mode, ROOT, "").FAL_KEY ?? "";

/* Offline replays a recorded run instead of calling fal, so the whole flow can
 * be rehearsed in seconds and for nothing. Read per request like the key, and
 * never inferred from a missing FAL_KEY: "FAL_KEY is not set" is a sentence an
 * attendee is meant to see, not one to silently paper over. */
const offline = (mode: string) => (loadEnv(mode, ROOT, "").MIRIS_OFFLINE ?? "") === "1";

const readFixtures = async (): Promise<{ concept: string; stages: any[]; viewerKey?: string }> =>
  JSON.parse(await readFile(FIXTURES, "utf8"));

/** Six cubes standing in for six creatures, so the download step still works. */
const writeFixtureZip = async (stages: any[]) =>
  writeFile(
    ZIP_OFFLINE,
    zipSync(stages.map((st, i) => ({ name: stageFile(i, st.stage), data: tinyGlb(0.6 + i * 0.3) }))),
  );

export function mirisDevApi(mode: string): Plugin {
  return {
    name: "miris-dev-api",
    // Dev only, by construction. There is no production counterpart.
    apply: "serve",

    /* Every change to app/stage.tsx reloads the page. Unconditionally, after
     * two rounds of being cleverer than this: a Fast Refresh of a mounted
     * <mirisStream> leaves the SDK's own scene objects behind (measured two
     * SparkRenderers in one scene, splats drawn twice, the model smearing as
     * the camera moves), and scoping the reload to "only when a stream was
     * mounted" still ghosted in Bolt on the stream's FIRST mount, through an
     * HMR path localhost never reproduced. A fresh boot is the only state
     * this SDK provably cannot double. The reload is cheap because everything
     * durable lives in data.json: the tray, its fold state, and an in-flight
     * mesh build all resume. */
    handleHotUpdate({ file, server }) {
      if (file === STAGE) {
        server.hot.send({ type: "full-reload" });
        return [];
      }
      // The finished lab follows the template, the snippets, the curriculum and
      // the recorded series, so it is regenerated whenever one of them changes.
      if (REFERENCE_SOURCES.has(file)) void writeReference(ROOT);
    },

    buildStart: () => writeReference(ROOT),

    configureServer(server) {
      auditProofs();
      resumeRun(mode).catch((e) => console.warn(`[miris] could not resume the growth run: ${e.message}`));
      server.middlewares.use("/api/miris", async (req, res, next) => {
        try {
          if (req.method === "GET") {
            // The six meshes leave as one file, so the same endpoint serves
            // either the workshop state or the archive, by query.
            if ((req.url ?? "").includes("download")) {
              let zip: Buffer;
              try {
                zip = await readFile(offline(mode) ? ZIP_OFFLINE : ZIP);
              } catch {
                return send(res, fail("No archive yet. Grow the series first.", 404));
              }
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/zip");
              res.setHeader("Content-Disposition", 'attachment; filename="specimens.zip"');
              res.setHeader("Content-Length", String(zip.length));
              return res.end(zip);
            }
            // The flag rides along with the state so the sidebar can show its
            // dev controls without a second request.
            return send(res, ok({ ...(await readData(MIRIS_DIR)), offline: offline(mode) }));
          }

          if (req.method === "POST") {
            let body: any;
            try {
              body = JSON.parse(await readBody(req));
            } catch {
              return send(res, fail("body must be JSON"));
            }
            return send(res, await handle(String(body.action ?? ""), body, mode));
          }

          next();
        } catch (e) {
          send(res, fail((e as Error).message, 500));
        }
      });
    },
  };
}
