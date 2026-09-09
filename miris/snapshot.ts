import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { readData } from './store.mjs';
import { writeReference } from './lessonSource.mjs';

// Static hosts get a JSON file; the dev middleware is never part of a published lab.
export function mirisSnapshot(): Plugin {
  let outDir = resolve(process.cwd(), 'dist');
  return {
    name: 'miris-snapshot',
    apply: 'build',
    // The reference is part of the bundle, so it is brought up to date first.
    buildStart: () => writeReference(process.cwd()),
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const data = await readData(join(process.cwd(), 'miris'));
      const snapshot = { track:data.track, concept:data.concept, viewerKey:data.viewerKey,
        specimens:data.specimens.map(({id,stage,uuid,dossier})=>({id,stage,uuid,dossier})) };
      await mkdir(join(outDir, 'api'), { recursive:true });
      await writeFile(join(outDir, 'miris-scene.json'), JSON.stringify(snapshot));
      await writeFile(join(outDir, 'api', 'miris'), JSON.stringify(snapshot));
      if (!data.track) console.warn('miris: this build has no workshop data. Run the workshop before publishing.');
    },
  };
}
