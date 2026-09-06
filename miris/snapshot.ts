import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Plugin } from "vite";
import { readData } from "./store.mjs";

/* The stage fetches /api/miris, and that endpoint is dev middleware with no
 * counterpart in a static deploy: the request comes back as HTML, res.json()
 * throws, and the stage renders its skeleton forever. Attendees publish from
 * bolt at step 5.5, so that skeleton is what the link they share would show.
 *
 * Freezing data.json into dist/api/miris at build time gives the deployed lab
 * the same reply the dev server would have made. The file is left extensionless
 * and without a content-type rule on purpose: Response.json() parses on body
 * alone, so the stage is happy, while the guide decides "is the dev API here?"
 * on content-type and so still correctly says the workshop API is not running.
 * One artifact, both readings right. */
export function mirisSnapshot(): Plugin {
  let outDir = resolve(process.cwd(), "dist");

  return {
    name: "miris-snapshot",
    apply: "build",

    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },

    async closeBundle() {
      const data = await readData(join(process.cwd(), "miris"));
      await mkdir(join(outDir, "api"), { recursive: true });
      await writeFile(join(outDir, "api", "miris"), JSON.stringify(data));

      // An empty track means nobody has run the workshop in this checkout, so
      // the built site would be a skeleton however it is served. Worth saying
      // out loud at the moment of publishing rather than after sharing a link.
      if (!data.track) {
        console.warn(
          "\n  miris: built with an empty data.json, so the published lab will have nothing in it." +
            "\n  Run the workshop with npm run dev first, then build.\n",
        );
      }
    },
  };
}
