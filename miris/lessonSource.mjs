import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { readMarker, replaceMarker } from './markers.mjs';
import { SNIPPETS, MARKER_FOR, CLEARS_TO, EMPTY_BLOCKS, EMPTY_SPECIMENS, PART_NAME, PLACEHOLDERS } from './snippets.mjs';

// The curriculum determines the reference build order; the dev API uses the same edits.
export function lessonsFrom(curriculum) {
  const source = ts.createSourceFile('curriculum.ts', curriculum, ts.ScriptTarget.Latest, true);
  const lessons = [];
  const visit = node => {
    if (ts.isObjectLiteralExpression(node)) {
      const values = Object.fromEntries(node.properties.filter(p => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)).map(p => [p.name.getText(source), p.initializer.text]));
      if (values.fill) lessons.push(values);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return lessons;
}

/** Replaces the function called `name` in the parts block, or appends it if the
 *  attendee deleted it, leaving everything else in the block as they left it. */
function withPart(source, name, body) {
  const block = readMarker(source, 'parts');
  const parsed = ts.createSourceFile('parts.tsx', block, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const previous = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const next = previous
    ? block.slice(0, previous.getFullStart()) + '\n\n' + body + block.slice(previous.end)
    : block.trimEnd() + '\n\n' + body;
  return replaceMarker(source, 'parts', next.trim());
}

export function applyLesson(source, id) {
  if (!Object.hasOwn(SNIPPETS, id)) throw new Error(`Unknown lesson: ${id}`);
  if (PART_NAME[id]) return withPart(source, PART_NAME[id], SNIPPETS[id]);
  return replaceMarker(source, MARKER_FOR[id], SNIPPETS[id]);
}

export function clearLesson(source, id) {
  const marker = MARKER_FOR[id];
  if (!marker) throw new Error(`Unknown lesson: ${id}`);
  if (PART_NAME[id]) return withPart(source, PART_NAME[id], PLACEHOLDERS[id]);
  const back = CLEARS_TO[id];
  return replaceMarker(source, marker, back ? SNIPPETS[back] : EMPTY_BLOCKS[marker]);
}

export function completedStage(starter, curriculum) {
  return lessonsFrom(curriculum).reduce((stage, lesson) => applyLesson(stage, lesson.fill), starter);
}

/** The top-level `const viewerKey = "..."` in the stage, found by name rather
 *  than by a marker so the file needs no fence round one line. */
function viewerKeyLiteral(source) {
  const parsed = ts.createSourceFile('stage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(parsed) === 'viewerKey' && declaration.initializer && ts.isStringLiteral(declaration.initializer)) return declaration.initializer;
    }
  }
  return null;
}

/** The stage with its viewer key set. Unchanged if the line is gone. */
export function withViewerKey(source, viewerKey) {
  const literal = viewerKeyLiteral(source);
  if (!literal || literal.text === viewerKey) return source;
  return source.slice(0, literal.getStart()) + JSON.stringify(viewerKey) + source.slice(literal.end);
}

export function readViewerKey(source) {
  return viewerKeyLiteral(source)?.text ?? '';
}

/** app/specimens.json with the given ids and scales laid over it, slot by slot.
 *  Only the values named change, so a scale tuned by hand survives a reseal. */
export function mergeSpecimens(current, entries) {
  const list = Array.isArray(current) ? current.map(each => ({ ...each })) : [];
  entries.forEach((entry, i) => {
    if (!entry) return;
    list[i] ??= { uuid: '', scale: 1 };
    if (entry.uuid !== undefined) list[i].uuid = entry.uuid;
    if (entry.scale !== undefined) list[i].scale = entry.scale;
  });
  return list;
}

export const specimensJson = list => JSON.stringify(list, null, 2) + '\n';

/** The finished lab: every lesson applied and the recorded series' key in the
 *  stage, with its ids and scales as the specimens.json beside it. */
export function referenceStage(starter, curriculum, fixtures) {
  const entries = (fixtures.stages ?? []).map(stage => ({ uuid: stage.uuid || '', scale: stage.scale ?? 1 }));
  return {
    stage: withViewerKey(completedStage(starter, curriculum), fixtures.viewerKey || ''),
    specimens: specimensJson(mergeSpecimens(EMPTY_SPECIMENS, entries)),
  };
}

/** Writes miris/stage.reference.tsx and miris/specimens.json from the template,
 *  the curriculum and the fixtures, touching them only when they would change.
 *  Called when the dev server or a build starts, so the reference cannot drift. */
export async function writeReference(root) {
  const dir = join(root, 'miris');
  const [starter, curriculum, fixtures] = await Promise.all([
    readFile(join(dir, 'stage.template.tsx'), 'utf8'),
    readFile(join(dir, 'curriculum.ts'), 'utf8'),
    readFile(join(dir, 'fixtures.json'), 'utf8'),
  ]);
  const { stage, specimens } = referenceStage(starter, curriculum, JSON.parse(fixtures));
  for (const [file, next] of [['stage.reference.tsx', stage], ['specimens.json', specimens]]) {
    const path = join(dir, file);
    if ((await readFile(path, 'utf8').catch(() => '')) !== next) await writeFile(path, next);
  }
}
