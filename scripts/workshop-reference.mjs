import { readFile, writeFile } from 'node:fs/promises';
import { completedStage } from '../miris/lessonSource.mjs';

const starter = await readFile(new URL('../miris/stage.template.tsx', import.meta.url), 'utf8');
const curriculum = await readFile(new URL('../miris/curriculum.ts', import.meta.url), 'utf8');
await writeFile(new URL('../miris/stage.reference.tsx', import.meta.url), completedStage(starter, curriculum));
console.log('Generated completed reference from the starter and curriculum.');
