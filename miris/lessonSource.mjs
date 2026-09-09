import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ts from 'typescript';
import { readMarker, replaceMarker, stripMarkers } from './markers.mjs';
import { SNIPPETS, MARKER_FOR, EMPTY_SPECIMENS, IMPORTS, PART_NAME } from './snippets.mjs';

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

/** Adds import statements to the imports block, one statement per module:
 *  named imports are merged and deduplicated, a default import and any import
 *  attributes are kept, packages come before relative paths. Idempotent. */
export function withImports(source, statements) {
  if (!statements.length) return source;
  const block = readMarker(source, 'imports');
  const parsed = ts.createSourceFile('imports.ts', `${block}\n${statements.join('\n')}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const modules = new Map();
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.text;
    const entry = modules.get(specifier) ?? { defaultName: '', names: new Map(), attributes: '' };
    const clause = statement.importClause;
    if (clause?.name) entry.defaultName = clause.name.text;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const name = element.getText(parsed).replace(/^type\s+/, '');
        if (!entry.names.has(name)) entry.names.set(name, element.isTypeOnly);
      }
    }
    const attributes = statement.attributes ?? statement.assertClause;
    if (attributes) entry.attributes = ` ${attributes.getText(parsed)}`;
    modules.set(specifier, entry);
  }
  const line = ([specifier, entry]) => {
    const parts = [];
    if (entry.defaultName) parts.push(entry.defaultName);
    if (entry.names.size) parts.push(`{ ${[...entry.names].map(([name, typeOnly]) => (typeOnly ? `type ${name}` : name)).join(', ')} }`);
    return `import ${parts.join(', ')} from "${specifier}"${entry.attributes};`;
  };
  const ordered = [...modules].sort(([a], [b]) => Number(a.startsWith('.')) - Number(b.startsWith('.')));
  return replaceMarker(source, 'imports', ordered.map(line).join('\n'));
}

export function applyLesson(source, id) {
  if (!Object.hasOwn(SNIPPETS, id)) throw new Error(`Unknown lesson: ${id}`);
  const next = PART_NAME[id] ? withPart(source, PART_NAME[id], SNIPPETS[id]) : replaceMarker(source, MARKER_FOR[id], SNIPPETS[id]);
  return withImports(next, IMPORTS[id] ?? []);
}

/** The stage as it stands at the end of chapter `chapter`: the starter with
 *  every lesson up to there applied, the attendee's own viewer key kept, and
 *  no marker comments, which the attendee's file never carries. */
export function chapterSnapshot(starter, curriculum, chapter, viewerKey = '') {
  const lessons = lessonsFrom(curriculum).filter(lesson => Number(lesson.num.split('.')[0]) <= Number(chapter));
  return stripMarkers(withViewerKey(lessons.reduce((stage, lesson) => applyLesson(stage, lesson.fill), starter), viewerKey));
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
 *  Only the values named change, so a scale tuned by hand survives a reseal.
 *  life_stage is the slot's position in growth order, 1 to 6, and is filled in
 *  wherever a slot lacks it so a file written before the field existed gains it
 *  on its next write. */
export function mergeSpecimens(current, entries) {
  const list = Array.isArray(current) ? current.map(each => ({ ...each })) : [];
  entries.forEach((entry, i) => {
    if (!entry) return;
    list[i] ??= { uuid: '', scale: 1 };
    if (entry.uuid !== undefined) list[i].uuid = entry.uuid;
    if (entry.scale !== undefined) list[i].scale = entry.scale;
  });
  list.forEach((slot, i) => { slot.life_stage ??= i + 1; });
  return list;
}

export const specimensJson = list => JSON.stringify(list, null, 2) + '\n';

/** The finished lab: every lesson applied and the recorded series' key in the
 *  stage, with its ids and scales as the specimens.json beside it. */
export function referenceStage(starter, curriculum, fixtures) {
  const entries = (fixtures.stages ?? []).map(stage => ({ uuid: stage.uuid || '', scale: stage.scale ?? 1 }));
  return {
    stage: stripMarkers(withViewerKey(completedStage(starter, curriculum), fixtures.viewerKey || '')),
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

/** The file a fresh clone starts from: the template without its markers. */
export const starterStage = (template) => stripMarkers(template);
