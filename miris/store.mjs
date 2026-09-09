import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emptyBank, normaliseBank } from "./specimens.mjs";

export const DEFAULT_DATA = {
  track: "",
  step: "1.1",
  viewerKey: "",
  // The one sentence the whole laboratory grows from.
  concept: "",
  // Epoch ms when the growth series was last started, 0 otherwise.
  hatchedAt: 0,
  // Whether miris/specimens.zip is on disk and matches the current series.
  zipReady: false,
  // Why the last run stopped short, in a sentence for the form. Written by the
  // dev server so it survives the page that pressed the button; cleared by the
  // next press of Grow the series.
  runError: "",
  // Which capsule the dossier and the uuid form are pointed at, 0-5.
  active: 0,
  // Whether the growth tray is folded to its handle. Persisted because every
  // Fill rewrites app/stage.tsx, which forces a full reload: kept in memory,
  // the popover sprang back open on top of the scene at every paste.
  traySmall: false,
  // Set by the last step's Finish button. The guide shows the closing pane
  // instead of the steps while it is true; Back to the steps clears it.
  finished: false,
  specimens: emptyBank(),
};

const file = (dir) => join(dir, "data.json");

export async function readData(dir) {
  let raw;
  try {
    raw = await readFile(file(dir), "utf8");
  } catch {
    return { ...DEFAULT_DATA };
  }
  try {
    const parsed = JSON.parse(raw);
    // The bank is merged slot by slot, never replaced wholesale: a short array
    // from an older file would otherwise leave capsules missing their fields.
    return { ...DEFAULT_DATA, ...parsed, specimens: normaliseBank(parsed.specimens) };
  } catch (e) {
    throw new Error(`data.json is corrupt and was not overwritten: ${e.message}`);
  }
}

// Writes are queued, because a read-modify-write races: pressing Fill chains a
// save while an in-flight image request completes, and the later rename would
// drop the other's field. The tmp path is unique so two overlapping writes can
// never tear the same file.
let queue = Promise.resolve();

export function writeData(dir, patch) {
  const run = queue.then(() => doWrite(dir, patch));
  queue = run.catch(() => undefined);
  return run;
}

async function doWrite(dir, patch) {
  const next = { ...(await readData(dir)), ...patch };
  const tmp = `${file(dir)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2));
  await rename(tmp, file(dir));
  return next;
}
