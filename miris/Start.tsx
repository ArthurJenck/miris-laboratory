import { STEPS } from "./curriculum";
import { TRACKS } from "./tracks";

export default function Start({
  onChoose,
  note,
}: {
  onChoose: (id: string) => void;
  /* Failures during track selection used to be invisible here: the guide's note
   * bar lives inside the panel, which does not exist until a track is picked, so
   * a tap that failed produced no output at all. */
  note?: string;
}) {
  return (
    <div className="mw-start">
      <header>
        <span>Miris · Spatial Streaming</span>
      </header>

      <div className="mw-ask">
        <h1>Sublevel 7 is yours.</h1>
        <p>
          Six containment capsules stand empty around the walkway. Describe what grows in them, watch it get
          built, then publish the whole laboratory streaming to anyone with the link.
        </p>
      </div>

      {note && (
        <p className="mw-start-note l12" role="status">
          {note}
        </p>
      )}

      <div className="mw-doors mw-doors-one">
        {TRACKS.map((track, i) => (
          <button
            key={track.id}
            className="mw-door"
            style={{ ["--a" as string]: track.accent, ["--i" as string]: i, ["--focal" as string]: track.focal } as React.CSSProperties}
            onClick={() => onChoose(track.id)}
          >
            {/* The renders are on a pure black ground with no alpha, so the CSS
                screen-blends them: the artwork's black resolves to the page's
                own ground and the subject reads as lit by the same room. */}
            <span className="mw-specimen">
              <img
                src={track.image}
                alt={track.imageAlt}
                width={track.imageWidth}
                height={track.imageHeight}
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </span>

            <span className="mw-rail" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>

            <span className="mw-door-body">
              <b>{track.label}</b>
              <p>{track.blurb}</p>
              <span className="mw-begin">Enter the {track.label} &rarr;</span>
            </span>
          </button>
        ))}
      </div>

      <footer>
        {STEPS.map((step) => (
          <span key={step.num}>
            <code>{step.num}</code> {step.title}
          </span>
        ))}
      </footer>
    </div>
  );
}
