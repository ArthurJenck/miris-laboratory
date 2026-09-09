import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { readMarker } from '../miris/markers.mjs';
import { SNIPPETS, EMPTY_BLOCKS, EMPTY_SPECIMENS, MARKER_FOR } from '../miris/snippets.mjs';
import { lessonsFrom, applyLesson, clearLesson, completedStage, mergeSpecimens, readViewerKey, referenceStage, specimensJson, withViewerKey } from '../miris/lessonSource.mjs';

const starter = await readFile(new URL('../miris/stage.template.tsx', import.meta.url), 'utf8');
const curriculum = await readFile(new URL('../miris/curriculum.ts', import.meta.url), 'utf8');
const fixtures = JSON.parse(await readFile(new URL('../miris/fixtures.json', import.meta.url), 'utf8'));
const lessons = lessonsFrom(curriculum);

test('fresh clone contains only empty lesson blocks and equals the reset template', async () => {
  assert.equal(await readFile(new URL('../app/stage.tsx', import.meta.url), 'utf8'), starter);
  assert.equal(await readFile(new URL('../app/specimens.json', import.meta.url), 'utf8'), specimensJson(EMPTY_SPECIMENS));
  assert.equal(readViewerKey(starter), '');
  for (const [marker, body] of Object.entries(EMPTY_BLOCKS)) assert.equal(readMarker(starter, marker).trim(), body.trim(), marker);
});

test('curriculum and snippets describe exactly the same ordered build', () => {
  assert.deepEqual(new Set(lessons.map(s => s.fill)), new Set(Object.keys(SNIPPETS)));
  assert.ok(lessons.every(s => s.check && s.body));
  let stage = starter;
  for (const lesson of lessons) {
    const before = readMarker(stage, MARKER_FOR[lesson.fill]);
    stage = applyLesson(stage, lesson.fill);
    assert.notEqual(readMarker(stage, MARKER_FOR[lesson.fill]), before, `${lesson.num} must add something`);
  }
});

test('File lands by name, once, and leaves the rest of the parts block alone', () => {
  const stage = applyLesson(starter.replace('// miris:parts-start\n', '// miris:parts-start\nconst mine = 1;\n'), 'file');
  assert.match(readMarker(stage, 'parts'), /const mine = 1;/);
  assert.match(readMarker(stage, 'parts'), /drawElementImage/);
  assert.equal((readMarker(applyLesson(stage, 'file'), 'parts').match(/function File\(/g) || []).length, 1);
});

test('clearing a step puts back the step before it and nothing else', () => {
  const complete = completedStage(starter, curriculum);
  assert.match(readMarker(clearLesson(complete, 'platform'), 'scene'), /<Room/);
  assert.doesNotMatch(readMarker(clearLesson(complete, 'platform'), 'scene'), /<Platform/);
  assert.match(readMarker(clearLesson(complete, 'file'), 'parts'), /return null/);
  assert.doesNotMatch(readMarker(clearLesson(complete, 'file'), 'parts'), /drawElementImage/);
  assert.match(readMarker(clearLesson(complete, 'effect'), 'hud'), /Readout/);
  assert.doesNotMatch(readMarker(clearLesson(complete, 'effect'), 'hud'), /ScreenFx/);
});

test('sealing sets the key in the stage and lays ids over specimens.json, keeping a tuned scale', () => {
  const keyed = withViewerKey(starter, 'key-1');
  assert.match(keyed, /const viewerKey = "key-1";/);
  assert.equal(readViewerKey(keyed), 'key-1');
  assert.equal(withViewerKey(keyed, 'key-1'), keyed, 'no change writes nothing');
  const tuned = mergeSpecimens(EMPTY_SPECIMENS, [{ scale: 0.5 }]);
  const sealed = mergeSpecimens(tuned, [{ uuid: 'a' }, { uuid: 'b', scale: 2 }]);
  assert.deepEqual(sealed[0], { uuid: 'a', scale: 0.5 });
  assert.deepEqual(sealed[1], { uuid: 'b', scale: 2 });
  assert.deepEqual(sealed[5], { uuid: '', scale: 1 });
  assert.equal(sealed.length, 6);
});

test('completed reference is generated from this starter and these curriculum steps', async () => {
  const reference = referenceStage(starter, curriculum, fixtures);
  assert.equal(await readFile(new URL('../miris/stage.reference.tsx', import.meta.url), 'utf8'), reference.stage);
  assert.equal(await readFile(new URL('../miris/specimens.json', import.meta.url), 'utf8'), reference.specimens);
});

test('starter, every lesson checkpoint, and cleared dependencies type-check', { timeout: 120000 }, () => {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists);
  const config = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, process.cwd());
  const stagePath = `${process.cwd()}/app/stage.tsx`;
  let oldProgram;
  const verify = (source, label) => {
    const host = ts.createCompilerHost(config.options);
    const read = host.readFile;
    host.readFile = file => file === stagePath ? source : read(file);
    const program = ts.createProgram(config.fileNames, config.options, host, oldProgram);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, label + ': ' + ts.formatDiagnosticsWithColorAndContext(diagnostics, {getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));
    oldProgram = program;
  };
  let stage = starter;
  verify(stage, 'starter');
  for (const lesson of lessons) { stage = applyLesson(stage, lesson.fill); verify(stage, lesson.num); }
  for (const id of ['file', 'markup']) verify(clearLesson(stage, id), `clear ${id}`);
  verify(referenceStage(starter, curriculum, fixtures).stage, 'reference');
});
