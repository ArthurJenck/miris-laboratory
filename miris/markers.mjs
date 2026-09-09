// Markers in plain code take // form, since a JSX comment there is a syntax
// error. Everything inside the returned JSX keeps the JSX comment form.
const JS_MARKERS = new Set(["imports", "setup", "field", "markup", "parts"]);
export const start = (m) => (JS_MARKERS.has(m) ? `// miris:${m}-start` : `{/* miris:${m}-start */}`);
export const end = (m) => (JS_MARKERS.has(m) ? `// miris:${m}-end` : `{/* miris:${m}-end */}`);

export function replaceMarker(source, marker, body) {
  const a = source.indexOf(start(marker));
  const b = source.indexOf(end(marker));
  if (a === -1 || b === -1 || b < a) throw new Error(`marker not found: ${marker}`);
  const head = source.slice(0, a + start(marker).length);
  // The whitespace before the closing marker belongs to the marker's own line,
  // not to the body, so it has to be put back or the marker slides to column 0.
  const lineStart = source.lastIndexOf("\n", b) + 1;
  const indent = /^[ \t]*$/.test(source.slice(lineStart, b)) ? source.slice(lineStart, b) : "";
  const tail = source.slice(b);
  return `${head}\n${body}\n${indent}${tail}`;
}

/** The attendee's own code for one marker, so a check reads their block rather
 *  than the whole file and cannot be fooled by an import or a comment. */
export function readMarker(source, marker) {
  const a = source.indexOf(start(marker));
  const b = source.indexOf(end(marker));
  if (a === -1 || b === -1 || b < a) return "";
  return source.slice(a + start(marker).length, b);
}

/** The same source with every marker comment removed and the blank lines they
 *  leave tidied: what the attendee's file and the reference actually look like.
 *  The markers stay in the template, where the generator needs them. */
export function stripMarkers(source) {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/ miris:[a-z]+-(start|end)|\{\/\* miris:[a-z]+-(start|end) \*\/\})\s*$/.test(line))
    .join("\n")
    .replace(/\n[ \t]*\n([ \t]*\n)+/g, "\n\n")
    .replace(/(<Scene>)\n[ \t]*\n/g, "$1\n")
    .replace(/\n[ \t]*\n([ \t]*<\/(Scene|>)>?)/g, (m, close) => `\n${close}`);
}
