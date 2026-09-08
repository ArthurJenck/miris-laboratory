import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { readMarker } from '../miris/markers.mjs';
import { SNIPPETS, EMPTY_BLOCKS, MARKER_FOR } from '../miris/snippets.mjs';
import { lessonsFrom, applyLesson, clearLesson, completedStage } from '../miris/lessonSource.mjs';

const starter = await readFile(new URL('../miris/stage.template.tsx', import.meta.url), 'utf8');
const curriculum = await readFile(new URL('../miris/curriculum.ts', import.meta.url), 'utf8');
const lessons = lessonsFrom(curriculum);

test('fresh clone contains only empty lesson blocks and equals the reset template', async () => {
  assert.equal(await readFile(new URL('../app/stage.tsx', import.meta.url), 'utf8'), starter);
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

test('adding File preserves the fitting code attendees already customized', () => {
  let stage = applyLesson(starter, 'fit').replace('0.08', '0.04');
  const fit = readMarker(stage, 'parts');
  stage = applyLesson(stage, 'file');
  assert.ok(readMarker(stage, 'parts').startsWith(fit.trimEnd()));
  assert.match(readMarker(stage, 'parts'), /0\.04/);
  assert.equal((readMarker(applyLesson(stage, 'file'), 'parts').match(/function File\(/g) || []).length, 1);
});

test('clearing dependencies removes their pedestal consumer', () => {
  const complete = completedStage(starter, curriculum);
  for (const id of ['fit', 'file', 'markup']) assert.equal(readMarker(clearLesson(complete, id), 'card').trim(), '');
  assert.match(readMarker(clearLesson(complete, 'walkway'), 'scene'), /VaultFloor/);
  assert.doesNotMatch(readMarker(clearLesson(complete, 'walkway'), 'scene'), /VaultWalkway/);
});

test('completed reference is generated from this starter and these curriculum steps', async () => {
  assert.equal(await readFile(new URL('../miris/stage.reference.tsx', import.meta.url), 'utf8'), completedStage(starter, curriculum));
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
  for (const id of ['fit', 'file', 'markup']) verify(clearLesson(stage, id), `clear ${id}`);
});
