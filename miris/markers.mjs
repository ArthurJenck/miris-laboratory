// The label marker lives in the function body, where a JSX comment is a syntax
// error, so it takes plain // form. Everything inside the returned JSX keeps
// the JSX comment form.
const JS_MARKERS = new Set(["label", "field", "markup", "parts"]);
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

