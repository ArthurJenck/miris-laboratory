import ts from 'typescript';
import { readMarker, replaceMarker } from './markers.mjs';
import { SNIPPETS, PARTS, MARKER_FOR, CLEARS_TO, EMPTY_BLOCKS } from './snippets.mjs';

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

export function applyLesson(source, id) {
  if (!Object.hasOwn(SNIPPETS, id)) throw new Error(`Unknown lesson: ${id}`);
  if (id === 'file') {
    const block = readMarker(source, 'parts');
    const parsed = ts.createSourceFile('parts.tsx', block, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const previous = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'File');
    const next = previous ? block.slice(0, previous.getFullStart()) + '\n\n' + PARTS.file + block.slice(previous.end)
      : block.trimEnd() + '\n\n' + PARTS.file;
    return replaceMarker(source, 'parts', next.trim());
  }
  return replaceMarker(source, MARKER_FOR[id], SNIPPETS[id]);
}

export function clearLesson(source, id) {
  const marker = MARKER_FOR[id];
  if (!marker) throw new Error(`Unknown lesson: ${id}`);
  const back = CLEARS_TO[id];
  let next = replaceMarker(source, marker, back ? SNIPPETS[back] : EMPTY_BLOCKS[marker]);
  if (['fit', 'file', 'markup'].includes(id)) next = replaceMarker(next, 'card', EMPTY_BLOCKS.card);
  return next;
}

export function completedStage(starter, curriculum) {
  return lessonsFrom(curriculum).reduce((stage, lesson) => applyLesson(stage, lesson.fill), starter);
}
