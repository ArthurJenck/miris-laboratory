import { readFile, writeFile } from 'node:fs/promises';
import { referenceStage } from '../miris/lessonSource.mjs';

const starter = await readFile(new URL('../miris/stage.template.tsx', import.meta.url), 'utf8');
const curriculum = await readFile(new URL('../miris/curriculum.ts', import.meta.url), 'utf8');
const fixtures = JSON.parse(await readFile(new URL('../miris/fixtures.json', import.meta.url), 'utf8'));
const { stage, specimens } = referenceStage(starter, curriculum, fixtures);
await writeFile(new URL('../miris/stage.reference.tsx', import.meta.url), stage);
await writeFile(new URL('../miris/specimens.json', import.meta.url), specimens);
console.log('Generated the completed reference and its specimens.json from the starter, the curriculum and the recorded series.');
