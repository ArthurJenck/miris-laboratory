import { useEffect, useRef, useState } from "react";
import { TRACKS } from "./tracks";
import "./start.css";

/* The film of the finished laboratory. It plays on its own where the visitor
   has not asked for less motion or less data; the poster stands in otherwise. */
function LaboratoryReel() {
  const video = useRef<HTMLVideoElement>(null);
  const [preferences, setPreferences] = useState({ reduced: true, saveData: true });
  const [visible, setVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const load = !preferences.reduced && !preferences.saveData;
  const play = visible && load;

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }
    ).connection;
    const update = () =>
      setPreferences({ reduced: motion.matches, saveData: connection?.saveData === true });
    const visibility = () => setVisible(!document.hidden);
    update();
    visibility();
    motion.addEventListener("change", update);
    connection?.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      motion.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (play) void element.play().catch(() => undefined);
    else element.pause();
  }, [load, play, failed]);

  return (
    <figure className="mw-reel">
      <div className="mw-reel-picture">
        <img
          src="/tracks/laboratory-poster.jpg"
          width="1280"
          height="720"
          alt="The workshop laboratory: blue-lit specimen capsules, steel walkway and research terminals."
          fetchPriority="high"
          decoding="async"
        />
        {load && !failed && (
          <video
            ref={video}
            src="/tracks/laboratory-reel.mp4"
            muted
            loop
            playsInline
            preload="metadata"
            aria-label="Four camera views of the completed laboratory"
            onError={() => setFailed(true)}
            onTimeUpdate={(event) => setSeconds(event.currentTarget.currentTime)}
          />
        )}
        <div className="mw-reel-progress" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (seconds / 24) * 100)}%` }} />
        </div>
      </div>
    </figure>
  );
}

export default function Start({
  onChoose,
  note,
}: {
  onChoose: (id: string) => void | Promise<void>;
  note?: string;
}) {
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");
  const enter = async () => {
    if (entering) return;
    setEntering(true);
    setError("");
    try {
      await onChoose(TRACKS[0].id);
    } catch {
      setError("The laboratory could not open. Please try again.");
    } finally {
      setEntering(false);
    }
  };
  return (
    <main className="mw-welcome">
      <header className="mw-welcome-header">
        <img src="/kit/assets/miris-logo-white.svg" alt="Miris" width="84" height="28" />
      </header>
      <div className="mw-welcome-main">
        <section className="mw-welcome-intro" aria-labelledby="mw-welcome-title">
          <p className="mw-welcome-location">Welcome to Sublevel 7</p>
          <h1 id="mw-welcome-title">Build a living laboratory.</h1>
          <p className="mw-welcome-description">
            Start with an empty scene. Build the laboratory in code, connect six life stages through
            Miris, then add an HTML screen and a TSL shader.
          </p>
          <button type="button" className="mw-welcome-enter" onClick={enter} disabled={entering}>
            {entering ? "Opening the laboratory…" : "Enter the laboratory"}
            <span aria-hidden="true">↗</span>
          </button>
          {(error || note) && (
            <p className="mw-welcome-note" role="status">
              {error || note}
            </p>
          )}
        </section>
        <LaboratoryReel />
      </div>
    </main>
  );
}
