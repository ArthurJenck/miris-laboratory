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
    const { specimens, zipReady } = await readData(MIRIS_DIR);
    const grown = (specimens as any[])?.filter((s) => s.glb).length ?? 0;
    if (grown === 0) return "Nothing grown yet. Describe your creature and press Grow the series.";
    if (grown < STAGES) return `${grown} of ${STAGES} stages are built. The rest are still running in the tray.`;
    return zipReady ? null : "All six are built but the archive is still being packed.";
  },

  async floor() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("gridHelper")
      ? null
      : "The scene block in app/stage.tsx has no deck in it yet. Paste the snippet between the miris:scene comments, or let the step do it.";
  },

  async walkway() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("ringGeometry")
      ? null
      : "No walkway in the scene block yet. Add it under the deck, or let the step do it.";
  },

  async capsules() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("TINTS")
      ? null
      : "No capsules in the scene block yet. Add them under the walkway, or let the step do it.";
  },

  async streams() {
    const block = readMarker(await readFile(STAGE, "utf8"), "scene");
    return block.includes("mirisStream")
      ? null
      : "Nothing is streaming into the capsules yet. Add the block under the capsules, or let the step do it.";
  },

  async capsuleUuid() {
    const { specimens, active } = await readData(MIRIS_DIR);
    const slot = (specimens as any[])?.[Number(active) || 0];
    const uuid = slot?.uuid ?? "";
    if (!uuid) return "That capsule has no asset id yet. Paste your uuid and viewer key above.";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid))
      return `That uuid does not look like one: "${uuid}". Copy just the id from the asset page.`;
    if (uuid === DEMO_UUID)
      return "That capsule still holds the demo specimen. Paste your own asset id from the portal.";
    return null;
  },

  async dossier() {
    const { specimens, active } = await readData(MIRIS_DIR);
    const d = (specimens as any[])?.[Number(active) || 0]?.dossier;
    return d && typeof d === "object" && d.name
      ? null
      : "This capsule has no dossier yet. Press Write the dossier.";
  },

  async hud() {
    const block = readMarker(await readFile(STAGE, "utf8"), "hud");
    return block.includes("LabHud")
      ? null
      : "No LabHud in the miris:hud block yet. Add the line, or let the step do it.";
  },

  async overlay() {
    const block = readMarker(await readFile(STAGE, "utf8"), "effect");
    return block.includes("EffectCanvas")
      ? null
      : "No EffectCanvas in the miris:effect block yet. Add the line, or let the step do it.";
  },

  async field() {
    const src = await readFile(STAGE, "utf8");
    if (!readMarker(src, "effect").includes("EffectCanvas"))
      return "No EffectCanvas yet. Step 5.2 puts it there.";
    return readMarker(src, "field").includes("Fn(")
      ? null
      : "The overlay is mounted but the field is still null. Write the TSL, or let the step do it.";
  },

  async cardOverlay() {
    const block = readMarker(await readFile(STAGE, "utf8"), "card");
    return block.includes("Dossier")
      ? null
      : "No Dossier in the miris:card block yet. Add the line, or let the step do it.";
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
const EMBRYOLOGIST =
  "You plan the growth series of a single organism for a laboratory archive. " +
  "Reply with ONLY a JSON array of exactly " + STAGES + " objects, no code fences, no commentary: " +
  '[{"stage": "one or two words naming this point in its life", ' +
  '"prompt": "one clause describing the whole body at this stage"}]. ' +
  "Order them from earliest to most developed. Each prompt describes the same creature, " +
  "changed by growth: proportions, plating, limbs, size and colour may all shift, but it stays " +
  "recognisably the same animal. Do not mention other stages, ages, numbers or the word stage " +
  "inside a prompt. Use no em dashes.";

const parseStages = (raw: unknown) => {
  if (typeof raw !== "string") return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const list = JSON.parse(text);
    if (!Array.isArray(list) || list.length !== STAGES) return null;
    const out = list.map((x: any) => ({
      stage: String(x?.stage ?? "").trim().slice(0, 24),
      prompt: String(x?.prompt ?? "").trim(),
    }));
    return out.some((x) => !x.stage || !x.prompt) ? null : out;
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

    case "label": {
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet.");
      const bank = normaliseBank(stored.specimens as any[]);
      const i = Number(stored.active) || 0;
      if (!bank[i]?.prompt) return fail("This capsule has no prompt yet. Step 1.2 is where it comes from.");

      if (offline(mode)) {
        const fx = await readFixtures();
        const dossier = fx.stages[i]?.dossier;
        if (!dossier) return fail(`No recorded dossier for capsule ${i + 1}. Capture the fixtures with FAL_KEY set first.`);
        bank[i] = { ...bank[i], dossier };
        await writeData(MIRIS_DIR, { specimens: bank });
        return ok({ dossier, offline: true });
      }

      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const out: any = await falRun(LABEL_MODEL, {
        model: LABEL_LLM,
        system_prompt: REGISTRAR,
        prompt: `The specimen: ${bank[i].prompt}.`,
        temperature: 0.9,
      });
      const dossier = parseDossier(out?.output);
      if (!dossier) return fail("The model wrote something that is not a dossier. Press the button again.", 502);
      bank[i] = { ...bank[i], dossier };
      await writeData(MIRIS_DIR, { specimens: bank });
      return ok({ dossier });
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
          bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, status: "ready", imageUrl: "", glb: `offline:${stageFile(i, st.stage)}`, dossier: null, modelStartedAt: 0 };
        });
        await writeFixtureZip(fx.stages);
        await writeData(MIRIS_DIR, { concept, specimens: bank, zipReady: true, hatchedAt: Date.now() });
        return ok({ offline: true, stages: fx.stages.map((s2: any) => s2.stage), files: fx.stages.map((s2: any, i: number) => stageFile(i, s2.stage)) });
      }

      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");

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
      });
      const stages = parseStages(plan?.output);
      if (!stages) return fail("The model did not return six stages. Press the button again.", 502);

      const fresh = await readData(MIRIS_DIR);
      const bank = normaliseBank(fresh.specimens as any[]);
      stages.forEach((st, i) => {
        bank[i] = { ...bank[i], stage: st.stage, prompt: st.prompt, status: "named", imageUrl: "", glb: "", dossier: null };
      });
      await writeData(MIRIS_DIR, { concept, specimens: bank, zipReady: false, hatchedAt: Date.now() });

      /* Six renders and six meshes, all in flight at once. Run in series this
         is half an hour; run together it is one mesh build plus change, which
         is the only reason six stages fit a two hour session. */
      const glbs = await Promise.all(
        stages.map(async (st, i) => {
          const shot: any = await falRun(IMAGE_MODEL, {
            prompt: `${track.style}: ${st.prompt}. ${IMAGE_FRAMING}`,
            image_size: "square_hd",
            num_images: 1,
            quality: "medium",
          });
          const imageUrl = shot?.images?.[0]?.url;
          if (!imageUrl) throw new Error(`fal returned no render for ${st.stage}`);
          await patchSlot(i, { imageUrl, status: "building", modelStartedAt: Date.now() });

          const mesh: any = await falRun(MODEL_3D, {
            image_url: imageUrl,
            texture_prompt: `${track.style}: ${st.prompt}`,
            ...MESHY_INPUT,
          });
          const glb = findGlb(mesh);
          if (!glb) throw new Error(`fal returned no glb for ${st.stage}. It sometimes answers with fbx only; press the button again.`);
          await patchSlot(i, { glb, status: "ready", modelStartedAt: 0 });
          return { name: stageFile(i, st.stage), url: glb };
        }),
      );

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
        viewerKey: stored.viewerKey || VIEWER_KEY,
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

const readFixtures = async (): Promise<{ concept: string; stages: any[] }> =>
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
