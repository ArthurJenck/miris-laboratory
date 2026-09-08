export interface Stat {
  label: string;
  value: number;
}

export interface CardData {
  designation: string;
  series: string;
  name: string;
  classification: string;
  status: string;
  generation: number;
  viability: number;
  stats: Stat[];
  traits: string[];
  notes: string;
}

/** The designed dossier markup, kept as the reference the workshop's own
 *  snippet is cut down from. */
export function dossierHtml(d: Partial<CardData>): string {
  // Written by a model and then by an agent editing data.json, so nothing here
  // is trusted: a string where an array belongs used to blank the whole canvas.
  const stats = Array.isArray(d?.stats) ? d.stats : [];
  const traits = Array.isArray(d?.traits) ? d.traits : [];
  const esc = (v: unknown) =>
    String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<div class="mw-dossier">
    <p class="mw-d-code">${esc(d?.designation ?? "SP-00")} / ${esc(d?.series ?? "ARC")}</p>
    <h3>${esc(d?.name ?? "UNNAMED")}</h3>
    <p class="mw-d-class">${esc(d?.classification ?? "")}</p>
    <p class="mw-d-state">
      <b data-status="${esc(d?.status ?? "STABLE")}">${esc(d?.status ?? "STABLE")}</b>
      <span>GEN ${String(d?.generation ?? 1).padStart(2, "0")}</span>
      <span>VIA <em>${esc(d?.viability ?? 0)}%</em></span>
    </p>
    <ul class="mw-d-stats">${stats
      .map(
        (s) =>
          `<li><span>${esc(s?.label)}</span><i><b style="width:${Math.max(0, Math.min(100, Number(s?.value) || 0))}%"></b></i><span>${esc(s?.value)}</span></li>`,
      )
      .join("")}</ul>
    <p class="mw-d-head">Expressed traits</p>
    <p class="mw-d-traits">${traits.map((t) => `<span>${esc(t)}</span>`).join("")}</p>
    <p class="mw-d-head">Handler notes</p>
    <p class="mw-d-notes">${esc(d?.notes ?? "")}</p>
  </div>`;
}
