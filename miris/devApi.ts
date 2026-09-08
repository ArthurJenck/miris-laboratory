import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { end as markerEnd, readMarker, replaceMarker, start as markerStart } from "./markers.mjs";
import { readData, writeData } from "./store.mjs";
import { CLEARS_TO, MARKER_FOR, SNIPPETS } from "./snippets.mjs";
import { emptyBank, normaliseBank } from "./specimens.mjs";
import { zipSync } from "./zip.mjs";
import { tinyGlb } from "./tinyGlb.mjs";
import { DEMO_UUID, STAGES, STATUSES, STAT_LABELS, IMAGE_FRAMING, IMAGE_MODEL, LABEL_LLM, LABEL_MODEL, MODEL_3D, VIEWER_KEY } from "./config";
import { TRACKS } from "./tracks";

/* Dev only, by construction: configureServer has no production counterpart, so
 * a built app has no endpoint to reach. */

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
const ZIP = join(ROOT, "miris", "specimens.zip");
/* Offline builds its own archive rather than overwriting the real one: the
   129MB of creature meshes from a paid run are not worth losing to a rehearsal. */
const ZIP_OFFLINE = join(MIRIS_DIR, "specimens.offline.zip");
const FIXTURES = join(MIRIS_DIR, "fixtures.json");
const TEMPLATE = join(MIRIS_DIR, "stage.template.tsx");

/* What each step's snippet must leave behind for its check to believe it. Kept
   in one table, and audited against the snippets when the server starts,
   because these drifted apart once: the floor check went looking for a
   gridHelper the snippet had stopped emitting, so pressing Fill and then Done
   told the attendee they had not done a step they had just done. A check that
   blames the person for the repo's own drift is worse than no check. */
const PROOF = {
  floor: "circleGeometry",
  walkway: "ringGeometry",
  capsules: "TINTS",
  streams: "mirisStream",
  hud: "LabHud",
  overlay: "EffectCanvas",
  field: "Fn(",
  cardOverlay: "Dossier",
  markup: "mw-dossier",
  fit: "getBounds",
  file: "useHtmlTexture",
};

/** Which snippet each proof has to appear in. */
const PROOF_IN: Record<keyof typeof PROOF, keyof typeof SNIPPETS> = {
  floor: "floor",
  walkway: "walkway",
  capsules: "capsules",
  streams: "streams",
  hud: "hud",
  overlay: "effect",
  field: "field",
  cardOverlay: "card",
  markup: "markup",
  fit: "fit",
  file: "file",
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

const MESHY_INPUT = {
  should_texture: true,
  enable_pbr: true,
  model_type: "standard",
  ultra_mode: true,
  topology: "triangle",
  target_polycount: 300000,
  symmetry_mode: "auto",
  enable_safety_checker: true,
};

/* One check per step that has something verifiable on disk. Each returns null
 * when the step is done, or the sentence the attendee needs to read. Steps that
 * happen elsewhere entirely, signing up or deploying, have no entry: the Done
 * button just moves them on rather than pretending to know. */
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

  async floor() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes(PROOF.floor)
      ? null
      : "The scene block in app/stage.tsx has no deck in it yet. Paste the snippet between the miris:scene comments, or let the step do it.";
  },

  async walkway() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes(PROOF.walkway)
      ? null
      : "No walkway in the scene block yet. Add it under the deck, or let the step do it.";
  },

  async capsules() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes(PROOF.capsules)
      ? null
      : "No capsules in the scene block yet. Add them under the walkway, or let the step do it.";
  },

  async streams() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes(PROOF.streams)
      ? null
      : "Nothing is streaming into the capsules yet. Add the block under the capsules, or let the step do it.";
  },

  async capsuleUuid() {
    const { specimens, active, viewerKey } = await readData(MIRIS_DIR);
    const slot = (specimens as any[])?.[Number(active) || 0];
    const uuid = slot?.uuid ?? "";
    if (!uuid) return "The capsules are not sealed yet. Paste your scoped viewer key above and press Find my specimens.";
    if (!UUID_RE.test(uuid))
      return `That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`;
    if (uuid === DEMO_UUID)
      return "That capsule still holds the demo specimen. Paste your own asset id from the portal.";
    // The key is checked here rather than at 3.1 because 3.1 happens in the
    // portal, where there is nothing on disk to look at. A capsule reading
    // through the demo key streams the demo, whatever uuid is next to it.
    if (!viewerKey)
      return "No viewer key yet. Paste the key you scoped to your six assets; every capsule reads through it.";
    if (viewerKey === VIEWER_KEY)
      return "That is still the workshop's demo viewer key, which cannot read your assets. Paste the one you scoped to your six.";
    return null;
  },

  async hud() {
    const block = readMarker(await readFile(STAGE, "utf8"), "hud");
    return block.includes(PROOF.hud)
      ? null
      : "No LabHud in the miris:hud block yet. Add the line, or let the step do it.";
  },

  async overlay() {
    const block = readMarker(await readFile(STAGE, "utf8"), "effect");
    return block.includes(PROOF.overlay)
      ? null
      : "No EffectCanvas in the miris:effect block yet. Add the line, or let the step do it.";
  },

  async field() {
    const src = await readFile(STAGE, "utf8");
    if (!readMarker(src, "effect").includes("EffectCanvas"))
      return "No EffectCanvas yet. Step 5.3 puts it there.";
    return readMarker(src, "field").includes(PROOF.field)
      ? null
      : "The overlay is mounted but the field is still null. Write the TSL, or let the step do it.";
  },

  async fit() {
    const block = readMarker(await readFile(STAGE, "utf8"), "parts");
    return block.includes(PROOF.fit)
      ? null
      : "FitInGlass does not measure anything yet. Replace the placeholder in the miris:parts block, or let the step do it.";
  },

  async file() {
    const block = readMarker(await readFile(STAGE, "utf8"), "parts");
    return block.includes(PROOF.file)
      ? null
      : "No File component yet. Add it under FitInGlass in the miris:parts block, or let the step do it.";
  },

  async markup() {
    const block = readMarker(await readFile(STAGE, "utf8"), "markup");
    return block.includes(PROOF.markup)
      ? null
      : "No file markup yet. Put fileMarkup in the miris:markup block near the top of app/stage.tsx, or let the step do it.";
  },

  async cardOverlay() {
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    return block.includes(PROOF.cardOverlay)
      ? null
      : "Nothing in the miris:card block yet. Add the two lines inside the Canvas, or let the step do it.";
  },

};

/* The register that used to live in miris/skills/curator.md, when writing the
 * label meant pasting that file into a coding agent. Same rules, smaller
 * ceremony: one button, one model call on the attendee's own fal key. */
/* The register that turns one sentence into an archive record. Everything the
   dossier panel draws comes from here, which is why the shape is pinned: four
   stats and nothing else can be laid out as bars. */
const REGISTRAR =
  "You are the registrar of a genetics laboratory, writing the file for one specimen. " +
  "Reply with ONLY a JSON object, no code fences, no commentary: " +
  '{"designation": "two letters, a dash, two digits", "series": "one word in caps", ' +
  '"name": "one invented word, caps", "classification": "two or three latinate words, sentence case", ' +
  '"status": "one of STABLE, DORMANT, VOLATILE, BREACHED", "generation": 1-12, "viability": 0-100 with one decimal, ' +
  '"stats": [{"label": "VITALITY", "value": 0-100}, {"label": "AGGRESSION", "value": 0-100}, ' +
  '{"label": "BIOELECTRIC", "value": 0-100}, {"label": "COHESION", "value": 0-100}], ' +
  '"traits": ["three entries, two or three words each"], ' +
  '"notes": "three or four sentences of handler observation"}. ' +
  "The four stats appear in exactly that order. The notes read as a working scientist's file: " +
  "specific incidents, a containment detail, a behaviour under a named condition. " +
  "Write as though the specimen has always existed. Never mention that it was generated, " +
  "never use the word digital, and use no em dashes.";

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

const parseDossier = (raw: unknown) => {
  if (typeof raw !== "string") return null;
  // Models fence JSON out of habit however firmly they are told not to.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const d = JSON.parse(text);
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
  } catch {
    return null;
  }
};

/* One concept becomes six bodies. The model is asked for a growth series
   rather than six variations, because the capsules read left to right as a
   life cycle and six unrelated creatures would say nothing. */
/* The planner. It used to be asked only for "six stages, earliest to most
   developed", which produced Larva, Juvenile, Adolescent, Mature, Elder,
   Ancient for every creature alike: insect terms and mammal terms in one
   series, no egg, and a last two stages that were just bigger. Deciding the
   clade first, and naming stages from that clade's real life cycle, is what
   keeps an egg layer starting as an egg and a mammal starting as a fetus. */
const EMBRYOLOGIST =
  "You are a developmental biologist planning the growth series of one organism for a laboratory archive. " +
  "Work in this order. First decide what kind of animal the description implies: its clade, and how animals " +
  "of that kind actually reproduce and develop. Then name the " + STAGES + " stages that kind of animal really " +
  "passes through, using that clade's own terminology. Only then describe each body. " +
  "Reply with ONLY a JSON object, no code fences, no commentary: " +
  '{"clade": "", "development": "", "anatomy": "", "stages": [{"stage": "", "prompt": "", "carry": "", "change": ""}]} ' +
  "with exactly " + STAGES + " stages. " +
  "clade: what kind of animal this is, three to six words. " +
  "development: its real developmental mode, a few words. " +
  "anatomy: the adult body plan in one clause, covering limb count, segmentation, plating, markings and " +
  "colour signature. This is what makes every stage the same species. " +
  "stage: one or two words, the correct name for that point in this clade's life cycle. " +
  "prompt: one or two clauses describing the whole body at that stage. " +
  "carry: which anatomy features are already visible at this stage, or \"none\" for an egg or embryo. " +
  "change: what visibly differs from the stage before, in a few words, naming something a viewer could point " +
  "at such as plate thickness, limb length, seam brightness, wear or proportion. Use \"none\" for the first " +
  "stage. Consecutive adult stages must still differ visibly, never repeat the previous body. " +
  "Follow the real sequence for the clade you chose. " +
  "Holometabolous insect: egg, larva, pupa, callow adult, mature adult, senescent adult. " +
  "Hemimetabolous insect: egg, early nymph, late nymph, subimago, adult, senescent adult. " +
  "Bird: egg, hatchling, nestling, fledgling, juvenile, adult. " +
  "Placental mammal: fetus, neonate, nursing infant, juvenile, subadult, adult. " +
  "Marsupial: embryo, pouch young, furred joey, weanling, subadult, adult. " +
  "Reptile: egg, hatchling, juvenile, subadult, adult, old adult. " +
  "Amphibian: egg mass, tadpole, limbed larva, metamorph, juvenile, adult. " +
  "Bony fish: egg, yolk sac larva, fry, fingerling, juvenile, adult. " +
  "Cephalopod: egg, paralarva, juvenile, subadult, adult, senescent adult. " +
  "Crustacean: egg, nauplius, zoea, megalopa, juvenile, adult. " +
  "Arachnid: egg sac, postembryo, early instar, late instar, subadult, adult. " +
  "Choosing the clade: limb count, wing count, size and ornament never decide it on their own. Fur, whiskers " +
  "or live young mean mammal even with six legs; feathers and a beak mean bird; chitin, compound eyes and a " +
  "segmented exoskeleton mean arthropod; scales and claws mean reptile. When the description names a familiar " +
  "animal, such as a fox, a moth or a turtle, follow that animal's real biology and treat everything else in " +
  "the description as variation on it. " +
  "The first stage is however this animal actually begins: egg layers begin as an egg, placental mammals " +
  "begin as a fetus and never as an egg. " +
  "The last two stages are variations on the adult, mature then aged, gravid or senescent. They are not " +
  "simply larger. Never make the final stages colossal, geological or encrusted ruins. " +
  "Every stage after the first is the same individual grown: proportions, plating and colour deepen, and the " +
  "body plan changes only where that clade's real metamorphosis changes it. " +
  "Do not mention other stages, ages, numbers or the word stage inside a prompt. Use no em dashes.";

type Plan = {
  clade: string;
  development: string;
  anatomy: string;
  stages: { stage: string; prompt: string; carry: string; change: string }[];
};

const parsePlan = (raw: unknown): Plan | null => {
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const obj = JSON.parse(text);
    const list = obj?.stages;
    if (!Array.isArray(list) || list.length !== STAGES) return null;
    const stages = list.map((x: any) => ({
      stage: String(x?.stage ?? "").trim().slice(0, 24),
      prompt: String(x?.prompt ?? "").trim(),
      carry: String(x?.carry ?? "").trim(),
      change: String(x?.change ?? "").trim(),
    }));
    if (stages.some((x) => !x.stage || !x.prompt)) return null;
    return {
      clade: String(obj?.clade ?? "").trim(),
      development: String(obj?.development ?? "").trim(),
      // The anchor is what stops stage four drifting into a different animal,
      // so a plan without one is not worth running six meshes on.
      anatomy: String(obj?.anatomy ?? "").trim(),
      stages,
    };
  } catch {
    return null;
  }
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

type Reply = { status: number; body: unknown };
const ok = (body: unknown): Reply => ({ status: 200, body });
const fail = (error: string, status = 400): Reply => ({ status, body: { error } });

async function handle(action: string, body: any, mode: string): Promise<Reply> {
  const falHeaders = () => ({
    Authorization: `Key ${falKey(mode)}`,
    "Content-Type": "application/json",
  });

  async function falRun(model: string, input: unknown, recordIn?: string) {
    const submit = await fetch(`https://queue.fal.run/${model}`, {
      method: "POST",
      headers: falHeaders(),
      body: JSON.stringify(input),
    });
    if (!submit.ok) throw new Error(`fal submit ${submit.status}: ${await submit.text()}`);
    const job = await submit.json();

    // Recorded before the wait, so a dev server killed mid-generation costs
    // nothing: the job is still findable on fal.
    if (recordIn) await writeData(recordIn, { falRequestId: job.request_id ?? "", modelStartedAt: Date.now() });

    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(job.status_url, { headers: falHeaders() });
      if (!poll.ok) throw new Error(`fal status ${poll.status}: ${(await poll.text()).slice(0, 200)}`);
      const status = await poll.json();
      if (status.status === "FAILED" || status.status === "ERROR") throw new Error("fal reported failure");
      if (status.status === "COMPLETED") {
        const done = await fetch(job.response_url, { headers: falHeaders() });
        if (!done.ok) throw new Error(`fal result ${done.status}: ${(await done.text()).slice(0, 200)}`);
        return done.json();
      }
    }
    throw new Error("fal timed out after 25 minutes");
  }

  switch (action) {
    case "fill": {
      const snippet = SNIPPETS[body.snippetId as keyof typeof SNIPPETS];
      const marker = MARKER_FOR[body.snippetId as keyof typeof MARKER_FOR];
      if (!snippet) return fail(`unknown snippet: ${body.snippetId}`);
      const source = await readFile(STAGE, "utf8");
      await writeFile(STAGE, replaceMarker(source, marker, snippet));
      return ok({ ok: true, marker });
    }

    case "clear": {
      const id = String(body.snippetId ?? "");
      const marker = MARKER_FOR[id as keyof typeof MARKER_FOR];
      if (!marker) return fail(`unknown snippet: ${id}`);

      // One step back, not the whole marker.
      const back = CLEARS_TO[id as keyof typeof CLEARS_TO];
      let body_: string;
      if (back) {
        body_ = SNIPPETS[back as keyof typeof SNIPPETS];
      } else {
        const template = await readFile(TEMPLATE, "utf8");
        // From markers.mjs, never rebuilt here: the label marker is a //-style
        // comment, and a hardcoded JSX form made clearing it fail as unknown.
        const open = markerStart(marker);
        const close = markerEnd(marker);
        const a = template.indexOf(open);
        const b = template.indexOf(close);
        if (a === -1 || b === -1) return fail(`unknown marker: ${marker}`);
        // Leading newlines and all trailing space, but not the leading indent:
        // the template's block carries the six columns that line its comment up
        // with the JSX, and trim() restored it at column 0. With this, a Clear
        // puts stage.tsx back byte-identical to the template.
        body_ = template.slice(a + open.length, b).replace(/^\n+/, "").replace(/\s+$/, "");
      }

      const source = await readFile(STAGE, "utf8");
      await writeFile(STAGE, replaceMarker(source, marker, body_));
      return ok({ ok: true, marker, back: back ?? null });
    }

    case "save":
      return ok(await writeData(MIRIS_DIR, body.patch ?? {}));

    case "check": {
      const check = CHECKS[String(body.check ?? "")];
      // No check for this step is not a failure: it means nothing on disk
      // proves it, so the attendee's word is what we have.
      if (!check) return ok({ done: true });
      const problem = await check(mode);
      return ok({ done: !problem, problem });
    }

    case "capsule": {
      const stored = await readData(MIRIS_DIR);
      const bank = normaliseBank(stored.specimens as any[]);
      const i = Number(body?.index);
      if (!Number.isInteger(i) || i < 0 || i >= bank.length) return fail(`No such capsule: ${body?.index}`);
      const uuid = String(body?.uuid ?? "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))
        return fail(`That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`);
      bank[i] = { ...bank[i], uuid, status: "live" };
      const patch: Record<string, unknown> = { specimens: bank };
      // One key reads every capsule, so it lives beside the bank, not inside it.
      const key = String(body?.viewerKey ?? "").trim();
      if (key) patch.viewerKey = key;
      await writeData(MIRIS_DIR, patch);
      return ok({ ok: true, index: i });
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

      /* The run is written to disk before the planner is called, not after it
         returns. Nothing was recorded for the first ten to twenty seconds
         otherwise, so the page could not tell a run had started: the tray
         stayed hidden and the step gate said nothing had grown, both while
         six meshes were being paid for. Cleared again if the run falls over,
         or the app would think it was still growing forever. */
      await writeData(MIRIS_DIR, { concept, hatchedAt: Date.now(), zipReady: false });
      const abandon = async (e: unknown) => {
        await writeData(MIRIS_DIR, { hatchedAt: 0 });
        throw e;
      };

      try {

        /* Each slot is patched on its own, read-modify-write inside the store's
           queue, so six concurrent stages cannot clobber one another. */
        const patchSlot = async (i: number, patch: Record<string, unknown>) => {
          const fresh = await readData(MIRIS_DIR);
          const bank = normaliseBank(fresh.specimens as any[]);
          bank[i] = { ...bank[i], ...patch };
          await writeData(MIRIS_DIR, { specimens: bank });
        };

        const plan: any = await falRun(LABEL_MODEL, {
          model: LABEL_LLM,
          system_prompt: EMBRYOLOGIST,
          prompt: `The creature: ${concept}.`,
          temperature: 0.9,
        }).catch(abandon);
        const plan2 = parsePlan(plan?.output);
        if (!plan2) {
          await writeData(MIRIS_DIR, { hatchedAt: 0 });
          return fail("The model did not return a usable growth plan. Press the button again.", 502);
        }
        const { anatomy, stages } = plan2;

        const fresh = await readData(MIRIS_DIR);
        const bank = normaliseBank(fresh.specimens as any[]);
        stages.forEach((st, i) => {
          bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, status: "named", imageUrl: "", glb: "", dossier: null };
        });
        await writeData(MIRIS_DIR, {
          concept,
          clade: plan2.clade,
          development: plan2.development,
          anatomy,
          specimens: bank,
          zipReady: false,
          hatchedAt: Date.now(),
        });

        /* The dossiers are written here, beside the plan, rather than by a button
         the attendee presses six times later. They come from the same sentence
         and the same clade the planner just decided, they cost one cheap model
         call each next to twelve dollars of meshes, and a specimen whose file
         appears only after a manual step is a specimen that looks unfinished
         for no reason. Failures are swallowed: a missing dossier costs a panel,
         and is not worth losing six meshes over. */
      await Promise.all(
        stages.map(async (st, i) => {
          try {
            const out: any = await falRun(LABEL_MODEL, {
              model: LABEL_LLM,
              system_prompt: REGISTRAR,
              prompt: `The specimen: ${st.prompt} It is the ${st.stage} stage of ${concept}, a ${plan2.clade}.`,
              temperature: 0.9,
            });
            const dossier = parseDossier(out?.output);
            if (dossier) await patchSlot(i, { dossier });
          } catch {
            /* keep going: the meshes matter more than the paperwork */
          }
        }),
      );

      /* The renders run in series, each one editing the last, because six
           independent text renders of "the same creature" are six different
           creatures: the recorded run drifted from a translucent larva to a
           barnacled boulder. The meshes still run together, and each one starts
           the moment its own render lands rather than waiting for all six, so
           chaining costs about two minutes rather than the twenty it would if
           the meshes queued behind the whole chain. */
        const meshes: Promise<{ name: string; url: string }>[] = [];
        let previous = "";
        // Dev flag: six renders cost cents, six meshes cost about twelve dollars,
        // so the chain can be judged on its own while its prompts are tuned.
        const imagesOnly = body?.imagesOnly === true;

        for (let i = 0; i < stages.length; i++) {
          const st = stages[i];
          const identity = st.carry && !/^none\b/i.test(st.carry) ? ` Visible identity: ${st.carry}.` : "";
          // Stated outright, because an edit model left to itself returns the
          // reference almost unchanged and three adult stages come back identical.
          const delta = st.change && !/^none\b/i.test(st.change) ? ` Clearly show this change from the reference: ${st.change}.` : "";
          let shot: any;

          if (!previous) {
            shot = await falRun(IMAGE_MODEL, {
              prompt: `${track.style}: ${st.prompt}.${identity} ${IMAGE_FRAMING}`,
              image_size: "square_hd",
              num_images: 1,
              quality: "medium",
            });
          } else {
            shot = await falRun(`${IMAGE_MODEL}/edit`, {
              image_urls: [previous],
              prompt:
                `The same individual organism as the reference image, the same species with the same markings ` +
                `and colour signature, now developed into its next form: ${st.prompt}.${identity}${delta} ` +
                `Species identity: ${anatomy}. ${track.style}. ${IMAGE_FRAMING}`,
              image_size: "square_hd",
              num_images: 1,
              quality: "medium",
            });
          }

          const imageUrl = shot?.images?.[0]?.url;
          if (!imageUrl) throw new Error(`fal returned no render for ${st.stage}`);
          previous = imageUrl;
          await patchSlot(i, { imageUrl, status: "building", modelStartedAt: Date.now() });

          if (imagesOnly) continue;

          meshes.push(
            (async () => {
              const mesh: any = await falRun(MODEL_3D, {
                image_url: imageUrl,
                texture_prompt: `${track.style}: ${st.prompt}`,
                ...MESHY_INPUT,
              });
              const glb = findGlb(mesh);
              if (!glb) throw new Error(`fal returned no glb for ${st.stage}. It sometimes answers with fbx only; press the button again.`);
              await patchSlot(i, { glb, status: "ready", modelStartedAt: 0 });
              return { name: stageFile(i, st.stage), url: glb };
            })(),
          );
        }

        if (imagesOnly) {
          // A probe, not a run: leaving the marker set would strand the tray
          // in a growth that never finishes.
          await writeData(MIRIS_DIR, { hatchedAt: 0 });
          const shots = (await readData(MIRIS_DIR)).specimens as any[];
          return ok({
            imagesOnly: true,
            clade: plan2.clade,
            anatomy,
            stages: stages.map((st, i) => ({ stage: st.stage, image: shots[i]?.imageUrl ?? "" })),
          });
        }

        const glbs = await Promise.all(meshes);

        const files = await Promise.all(
          glbs.map(async (g) => {
            const r = await fetch(g.url);
            if (!r.ok) throw new Error(`could not fetch ${g.name}: ${r.status}`);
            const data = Buffer.from(await r.arrayBuffer());
            // Checked here rather than trusted: a mis-typed mesh only shows up
            // as a failed upload in the portal, long after the workshop.
            if (!isGlb(data)) throw new Error(`${g.name} came back as ${data.toString("ascii", 0, 4)}, not glTF. Press the button again.`);
            return { name: g.name, data };
          }),
        );
        await writeFile(ZIP, zipSync(files));
        await writeData(MIRIS_DIR, { zipReady: true });
        return ok({ stages: stages.map((s2) => s2.stage), files: files.map((f) => f.name) });
      } catch (e) {
        // Any failure past this point leaves a run marked as in flight, and
        // the tray would grow forever. Clear the marker, then rethrow.
        await writeData(MIRIS_DIR, { hatchedAt: 0 });
        throw e;
      }
    }

    /* The growth plan on its own, written nowhere. Six meshes cost about twelve
       dollars and twelve minutes, so being able to read the biology first, and
       press again if the clade is wrong, is worth one cheap model call. */
    case "plan": {
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const concept = String(body?.prompt ?? "").trim();
      if (!concept) return fail("Describe the creature first.");
      const out: any = await falRun(LABEL_MODEL, {
        model: LABEL_LLM,
        system_prompt: EMBRYOLOGIST,
        prompt: `The creature: ${concept}.`,
        temperature: 0.9,
      });
      const p = parsePlan(out?.output);
      if (!p) return fail("The model did not return a usable growth plan. Press the button again.", 502);
      return ok(p);
    }

    /* Skip the generation. Assets already uploaded, with a key already scoped
       to them, is the state the twelve minutes exist to reach, so anyone
       rehearsing what comes after should be able to start from it. Unlike
       seeding this is not offline only: the capsules stream the real assets,
       nothing is replayed. */
    case "adopt": {
      const key = String(body?.viewerKey ?? "").trim();
      if (!key) return fail("Paste the viewer key you scoped to your assets.");
      if (key === VIEWER_KEY) return fail("That is the workshop's demo key, which cannot read your assets.");
      const given = Array.isArray(body?.uuids)
        ? body.uuids.map((u: any) => String(u).trim()).filter(Boolean)
        : [];
      // The asset's own name, so a series that is not the recorded one still
      // gets its own labels: "01-egg" reads as "egg".
      const names = Array.isArray(body?.names) ? body.names.map((n: any) => String(n)) : [];
      const nameAt = (i: number) =>
        String(names[i] ?? "")
          .replace(/\.[a-z0-9]+$/i, "")
          .replace(/^\s*\d+\s*[-_. ]\s*/, "")
          .replace(/[-_]+/g, " ")
          .trim();
      const bad = given.find((u: string) => !UUID_RE.test(u));
      if (bad) return fail(`That does not look like a uuid: "${bad}". Copy just the id from the asset page.`);

      const fx = await readFixtures().catch(() => null as any);
      const stored = await readData(MIRIS_DIR);
      const bank = normaliseBank(stored.specimens as any[]);
      bank.forEach((slot, i) => {
        // Fewer ids than capsules cycles them, so one asset can fill the room
        // while only some of the six have been uploaded.
        const uuid = given.length ? given[i % given.length] : slot.uuid || DEMO_UUID;
        /* Only borrow the recording's stage names, prompts and files when this
           really is the recorded specimen. Matching by position alone put the
           crustacean's paperwork on whatever anyone else had uploaded. */
        const f = fx?.stages?.[i];
        const same = !!f && String(f.uuid || "").trim() === uuid;
        /* A capsule given a different asset is a different specimen: its old
           name and file go with the old one rather than sitting on top of the
           new one. */
        const swapped = String(slot.uuid || "") !== uuid;
        const keep = <T,>(v: T) => (swapped ? undefined : v);
        bank[i] = {
          ...slot,
          stage: keep(slot.stage) || (same ? f!.stage : "") || nameAt(i) || `Stage ${i + 1}`,
          prompt: keep(slot.prompt) || (same ? f!.prompt : "") || "",
          dossier: keep(slot.dossier) || (same ? f!.dossier : null) || null,
          uuid,
          status: "live",
          modelStartedAt: 0,
          // The archive is not what was skipped, the generating of it was.
          glb: slot.glb || `adopted:${String(i + 1).padStart(2, "0")}`,
        };
      });
      await writeData(MIRIS_DIR, {
        track: stored.track || TRACKS[0].id,
        concept: stored.concept || fx?.concept || "",
        specimens: bank,
        viewerKey: key,
        zipReady: true,
        hatchedAt: Date.now(),
      });

      /* Remembered, so a later seed brings the same assets back, but only when
         these are the assets the recording already describes or it has none
         yet. Writing any adopted uuid back put someone else's ids next to the
         recorded stage names and dossiers, and the next adopt then believed
         they matched. */
      const claimable =
        !!fx &&
        fx.stages.every((st: any, i: number) => {
          const had = String(st.uuid || "").trim();
          return !had || had === bank[i].uuid;
        });
      if (fx && claimable) {
        fx.viewerKey = key;
        fx.stages = fx.stages.map((st: any, i: number) => ({ ...st, uuid: bank[i].uuid }));
        await writeFile(FIXTURES, JSON.stringify(fx, null, 2) + "\n");
      }
      return ok({ adopted: bank.length, distinct: new Set(bank.map((b) => b.uuid)).size });
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
      const real = fx.stages.filter((s2: any) => s2.uuid).length;
      return ok({ seeded: bank.length, realUuids: real, usingDemo: bank.length - real });
    }

    case "unseed": {
      if (!offline(mode)) return fail("Seeding is offline only. Put MIRIS_OFFLINE=1 in .env.local.");
      await writeData(MIRIS_DIR, { concept: "", specimens: emptyBank(), zipReady: false, hatchedAt: 0, active: 0 });
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
    },

    configureServer(server) {
      auditProofs();
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
