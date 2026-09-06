import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin } from "vite";
import { end as markerEnd, readMarker, replaceMarker, start as markerStart } from "./markers.mjs";
import { readData, writeData } from "./store.mjs";
import { CLEARS_TO, MARKER_FOR, SNIPPETS } from "./snippets.mjs";
import { normaliseBank } from "./specimens.mjs";
import { DEMO_UUID, STATUSES, STAT_LABELS, IMAGE_FRAMING, IMAGE_MODEL, LABEL_LLM, LABEL_MODEL, MODEL_3D, VIEWER_KEY } from "./config";
import { TRACKS } from "./tracks";

/* Dev only, by construction: configureServer has no production counterpart, so
 * a built app has no endpoint to reach. */

const ROOT = process.cwd();
const MIRIS_DIR = join(ROOT, "miris");
const STAGE = join(ROOT, "app", "stage.tsx");
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

  async image() {
    const { specimens, active } = await readData(MIRIS_DIR);
    const slot = (specimens as any[])?.[Number(active) || 0];
    return slot?.imageUrl ? null : "No render yet. Write a prompt at step 1.2 and grow one.";
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
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet.");
      const bank = normaliseBank(stored.specimens as any[]);
      const i = Number(stored.active) || 0;
      if (!bank[i]?.prompt) return fail("This capsule has no prompt yet. Step 1.2 is where it comes from.");
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

    case "image": {
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const out: any = await falRun(IMAGE_MODEL, {
        prompt: `${track.style}: ${body.prompt}. ${IMAGE_FRAMING}`,
        image_size: "square_hd",
        num_images: 1,
        quality: "medium",
      });
      const url = out?.images?.[0]?.url;
      if (!url) return fail("fal returned no image", 502);
      const bank = normaliseBank(stored.specimens as any[]);
      const i = Number(stored.active) || 0;
      // A new render invalidates the mesh and the record that described the old one.
      bank[i] = { ...bank[i], prompt: body.prompt, imageUrl: url, status: "drawn", glb: "", uuid: "", dossier: null };
      await writeData(MIRIS_DIR, { specimens: bank });
      return ok({ url });
    }

    case "model": {
      if (!falKey(mode)) return fail("FAL_KEY is not set in .env.local");
      const stored = await readData(MIRIS_DIR);
      const track = TRACKS.find((t) => t.id === stored.track);
      if (!track) return fail("No track chosen yet. Pick one on the chooser first.");
      const i = Number(stored.active) || 0;

      const mark = async (patch: Record<string, unknown>) => {
        const fresh = await readData(MIRIS_DIR);
        const b2 = normaliseBank(fresh.specimens as any[]);
        b2[i] = { ...b2[i], ...patch };
        await writeData(MIRIS_DIR, { specimens: b2 });
      };

      await mark({ status: "building", modelStartedAt: Date.now() });
      let out: any;
      try {
        out = await falRun(MODEL_3D, {
          image_url: body.imageUrl,
          // Styled the same way the render was; the texture pass reads this.
          texture_prompt: `${track.style}: ${body.prompt ?? ""}`,
          ...MESHY_INPUT,
        });
      } catch (e) {
        // The browser that asked may be gone: clearing the clock is how a
        // resumed client learns the job died rather than waiting forever.
        await mark({ status: "drawn", modelStartedAt: 0 });
        throw e;
      }
      const url = out?.model_glb?.url;
      if (!url) {
        await mark({ status: "drawn", modelStartedAt: 0 });
        return fail("fal returned no mesh", 502);
      }
      await mark({ glb: url, status: "ready", modelStartedAt: 0 });
      return ok({ url });
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
          if (req.method === "GET") return send(res, ok(await readData(MIRIS_DIR)));

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
