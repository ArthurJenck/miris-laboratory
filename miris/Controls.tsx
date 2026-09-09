import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import "./controls.css";
import { getSelected, getSelectedPart, labVersion, setSelected, subscribeLab } from "./labState";
import useLab from "./useLab";

type IconName = "previous" | "next" | "chevron" | "overview" | "file" | "check" | "specimen";

function Icon({ name }: { name: IconName }) {
  const paths = {
    previous: <path d="m12 5-7 7 7 7M5 12h15" />,
    next: <path d="m12 5 7 7-7 7M19 12H4" />,
    chevron: <path d="m7 10 5 5 5-5" />,
    overview: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
    file: <><path d="M14 3H6v18h12V7l-4-4Z" /><path d="M14 3v5h4M9 12h6m-6 4h6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    specimen: <><ellipse cx="12" cy="12" rx="6" ry="9" /><path d="M6 12h12M12 3v18" /></>,
  };
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

interface Entry {
  index: number;
  name: string;
  detail: string;
}

/** The dropdown: a real listbox, so arrow keys, Home, End and type-ahead work
 *  and a screen reader hears it as a choice of six rather than six buttons. */
function Picker({ entries, selected, onSelect }: { entries: Entry[]; selected: number; onSelect: (index: number) => void }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const current = entries.find((e) => e.index === selected) ?? entries[0];

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  const show = () => {
    setFocused(Math.max(0, entries.findIndex((e) => e.index === selected)));
    setOpen(true);
  };

  useEffect(() => {
    if (open) options.current[focused]?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setFocused(e.key === "Home" ? 0 : e.key === "End" ? entries.length - 1 : (focused + step + entries.length) % entries.length);
    } else if (e.key.length === 1 && e.key !== " ") {
      const starts = (entry: Entry) => entry.name.toLowerCase().startsWith(e.key.toLowerCase());
      const after = entries.findIndex((entry, i) => i > focused && starts(entry));
      const next = after >= 0 ? after : entries.findIndex(starts);
      if (next >= 0) {
        e.preventDefault();
        setFocused(next);
      }
    }
  };

  return (
    <div
      ref={root}
      className="mw-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        // Escape closes the list, and stops there: the room's own Escape
        // handler would otherwise walk the camera home at the same time.
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="mw-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className="mw-picker-mark"><Icon name={selected < 0 ? "overview" : "specimen"} /></span>
        <span className="mw-picker-text">
          <strong>{current.name}</strong>
          <span>{current.detail}</span>
        </span>
        <span className="mw-picker-chevron" data-open={open || undefined}><Icon name="chevron" /></span>
      </button>
      {open && (
        <div className="mw-picker-pop">
          <div id={id} role="listbox" aria-label="Specimens" className="mw-picker-list" onKeyDown={onListKey}>
            {entries.map((entry, i) => (
              <button
                key={entry.index}
                ref={(el) => {
                  options.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={entry.index === selected}
                tabIndex={focused === i ? 0 : -1}
                onFocus={() => setFocused(i)}
                onClick={() => {
                  onSelect(entry.index);
                  close(true);
                }}
              >
                <span className="mw-picker-num">{entry.index < 0 ? <Icon name="overview" /> : String(entry.index + 1).padStart(2, "0")}</span>
                <span className="mw-picker-text">
                  <strong>{entry.name}</strong>
                  <span>{entry.detail}</span>
                </span>
                {entry.index === selected && <Icon name="check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A toolbar at the foot of the room: pick a specimen, step through them, go
 *  back to the overview, or open the selected file. Lives OUTSIDE the canvas
 *  like the readout, and drives the same selection the tubes answer to. */
export default function Controls() {
  const { specimens, ready } = useLab();
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const selected = getSelected();
  const reading = selected >= 0 && getSelectedPart() === "pedestal";

  if (!ready) return null;

  // Only capsules with something streaming in them are worth walking to.
  const live: Entry[] = specimens
    .map((s: any, index: number) => ({
      index,
      uuid: s?.uuid,
      name: s?.dossier?.name || s?.stage || `Specimen ${String(index + 1).padStart(2, "0")}`,
      detail: `Capsule ${String(index + 1).padStart(2, "0")}${s?.stage ? ` · ${s.stage}` : ""}`,
    }))
    .filter((s) => s.uuid);
  const entries: Entry[] = [
    { index: -1, name: "Room overview", detail: live.length ? `${live.length} ${live.length === 1 ? "specimen" : "specimens"} in containment` : "Nothing streaming yet" },
    ...live,
  ];
  const at = live.findIndex((s) => s.index === selected);
  const step = (offset: number) => {
    if (!live.length) return;
    const next = at < 0 ? (offset > 0 ? 0 : live.length - 1) : (at + offset + live.length) % live.length;
    setSelected(live[next].index);
  };

  return (
    <nav className="mw-controls" aria-label="Explore the laboratory">
      <div className="mw-controls-bar">
        <Picker entries={entries} selected={selected} onSelect={(i) => setSelected(i)} />
        <div className="mw-controls-row">
          <button type="button" disabled={!live.length} onClick={() => step(-1)} aria-label="Previous specimen" title="Previous specimen"><Icon name="previous" /></button>
          <button type="button" disabled={!live.length} onClick={() => step(1)} aria-label="Next specimen" title="Next specimen"><Icon name="next" /></button>
          <button type="button" className="mw-controls-wide" disabled={selected < 0} onClick={() => setSelected(-1)}>
            <Icon name="overview" /><span>Overview</span>
          </button>
          <button type="button" className="mw-controls-wide mw-controls-read" disabled={at < 0} onClick={() => setSelected(selected, reading ? "organism" : "pedestal")}>
            <Icon name={reading ? "specimen" : "file"} /><span>{reading ? "Specimen" : "Read file"}</span>
          </button>
        </div>
      </div>
      <p className="mw-controls-hint">{selected < 0 ? "Drag to look around" : reading ? "Reading the file · scroll or pinch to zoom" : "Drag to orbit · scroll or pinch to zoom"}</p>
    </nav>
  );
}
