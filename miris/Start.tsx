import { useEffect, useRef, useState } from "react";
import { STEPS } from "./curriculum";
import { TRACKS } from "./tracks";
import "./start.css";

const SHOTS = ["Inside Sublevel 7", "Along the walkway", "Life in containment", "The specimen archive"];

function LaboratoryReel() {
  const video = useRef<HTMLVideoElement>(null);
  const [preferences, setPreferences] = useState({ reduced: true, saveData: true });
  const [visible, setVisible] = useState(true);
  const [requested, setRequested] = useState<boolean | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const load = requested === true || (!preferences.reduced && !preferences.saveData);
  const play = visible && (requested ?? load);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const update = () => setPreferences({ reduced: motion.matches, saveData: connection?.saveData === true });
    const visibility = () => setVisible(!document.hidden);
    update(); visibility();
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
    if (play) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [load, play, failed]);

  return (
    <figure className="mw-reel">
      <div className="mw-reel-picture">
        <img src="/tracks/laboratory-poster.jpg" width="1280" height="720"
          alt="The actual workshop laboratory: blue-lit specimen capsules, steel walkway and research terminals."
          fetchPriority="high" decoding="async" />
        {load && !failed && <video ref={video} src="/tracks/laboratory-reel.mp4" muted loop playsInline
          preload="metadata" aria-label="Four camera views of the completed laboratory" aria-describedby="mw-reel-caption"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onError={() => { setFailed(true); setPlaying(false); }}
          onTimeUpdate={event => setSeconds(event.currentTarget.currentTime)} />}
        <div className="mw-reel-controls">
          <span>{SHOTS[Math.min(3, Math.floor(seconds / 6))]}</span>
          {!failed && <button type="button" aria-label={playing ? "Pause lab film" : "Play lab film"}
            onClick={() => {
              setRequested(!playing);
              if (playing) video.current?.pause();
              else void video.current?.play().catch(() => setPlaying(false));
            }}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              {playing ? <path d="M5 4h3v12H5zm7 0h3v12h-3z" /> : <path d="m6 3 11 7-11 7z" />}
            </svg>
            {playing ? "Pause" : "Play film"}
          </button>}
        </div>
        <div className="mw-reel-progress" aria-hidden="true"><i style={{ width: `${Math.min(100, seconds / 24 * 100)}%` }} /></div>
      </div>
      <figcaption id="mw-reel-caption"><span>This is what you’ll build.</span><span>Captured in the workshop · 24-second film</span></figcaption>
    </figure>
  );
}

export default function Start({ onChoose, note }: { onChoose: (id: string) => void | Promise<void>; note?: string }) {
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");
  const enter = async () => {
    if (entering) return;
    setEntering(true); setError("");
    try { await onChoose(TRACKS[0].id); }
    catch { setError("The laboratory could not open. Please try again."); }
    finally { setEntering(false); }
  };
  return (
    <main className="mw-welcome">
      <header className="mw-welcome-header">
        <img src="/kit/assets/miris-logo-white.svg" alt="Miris" width="84" height="28" />
        <span>Spatial streaming workshop <i aria-hidden="true">/</i> 2 hours</span>
      </header>
      <div className="mw-welcome-main">
        <section className="mw-welcome-intro" aria-labelledby="mw-welcome-title">
          <p className="mw-welcome-location">Welcome to Sublevel 7</p>
          <h1 id="mw-welcome-title">Build a living laboratory.</h1>
          <p className="mw-welcome-description">Start with an empty scene. Build the laboratory in code, connect six life stages through Miris, then add an HTML screen and a TSL shader.</p>
          <button type="button" className="mw-welcome-enter" onClick={enter} disabled={entering}>
            {entering ? "Opening the laboratory…" : "Enter the laboratory"}<span aria-hidden="true">↗</span>
          </button>
          <p className="mw-welcome-detail">The film shows the finished example. Your build starts without it.</p>
          <a className="mw-reference-link" href="/?view=reference" target="_blank" rel="noopener noreferrer">Explore the completed reference ↗</a>
          {(error || note) && <p className="mw-welcome-note" role="status">{error || note}</p>}
        </section>
        <LaboratoryReel />
      </div>
      <footer className="mw-welcome-footer">
        <p>A world from start to stream.</p>
        <ol aria-label="Workshop chapters">{STEPS.map(step => <li key={step.num}><span>{step.num}</span>{step.title}</li>)}</ol>
      </footer>
    </main>
  );
}
