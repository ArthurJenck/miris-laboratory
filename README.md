# Spatial Streaming

A two hour workshop. You describe an organism, it becomes a 3D model, you upload
it to Miris, and it streams inside a containment capsule in a laboratory you
publish and share.

```
npm install
npm run dev
```

Then follow the guide on the right. It writes most of the code for you, and
explains what it wrote.

You need a fal.ai key in `.env.local` before step 1.2:

```
FAL_KEY=your-key-here
```

Restart the dev server after creating that file. Environment variables are only
read at boot.

## What costs money

The image is fractions of a cent. The 3D model is about $1.40 and takes four to
five minutes, on your own fal key. Rerolling the image is cheap, so get the
image right before you submit it for 3D.

---

## For presenters

### Tracks

Three: Summon (creatures), Atelier (crafted goods), Reliquary (museum holdings).

The choice is a **gate, not a setting**. `miris/Start.tsx` takes the whole
viewport before anything else runs, and until a track is picked the sidebar does
not render and the Miris engine does not boot. That last part matters: booting
costs six to nine seconds on a cold JWKS, and there is no reason to spend it
behind a screen nobody has acted on yet.

The choice is stored as `track` in `data.json` and drives four things: the
accent, the prompt placeholder, the style phrase the route prepends before the
prompt reaches fal, and what the curator writes.

Adding a fourth is one entry in `miris/tracks.ts`.

### Visual design

Built on the Miris kit rather than an invented palette: Geist and Geist Mono,
and the mono ramp from `tokens.css`. Each track takes a ramp from its own world:
Summon `analog-500 #FF3500` (ember), Atelier `monitor-500 #FF9500` (brass and
walnut), Reliquary `scanner-500 #00D5FF` (vitrine glass). The accent is a single
CSS variable, so a track change recolours the gate, the sidebar and the
generator overlay together.

Atelier started as `mono-200` bone, on the reasoning that materials should carry
that track rather than colour. It was the better idea and the worse interface:
bone as an accent is indistinguishable from body text, so the "you make a piece"
line and every button read as unstyled. Legibility won.

The gate is three full-bleed columns, not cards in a list. The whole column is
the control, content is vertically centred, and each column carries a rail that
is a hairline at rest and resolves into four filling blocks on hover or focus.
That is the same level-of-detail language the step rail uses, at hero scale, and
it is the one place the design spends any boldness.

Mono carries the utility layer (step ids, meters, timings, code), Geist carries
prose. The step rail is a four-block level-of-detail meter: one block ahead,
partially filled at the current step, four when done. The chrome renders
progressive detail because that is what the workshop is about.

Both waits show an elapsed clock rather than a spinner, and the four minute one
adds a stage list, because a spinner tells you nothing across minutes.

### The shape of it

`app/` holds the two files attendees touch. Everything else is `miris/`.

- `app/stage.tsx` is the attendee's file. It ships with marker comments and the
  sidebar writes between them. The `extend({ MirisStream })` at the top is what
  makes `<mirisStream>` an ordinary scene node; step 2.4 explains it.
- `app/main.tsx` mounts the stage and the guide. Attendees edit it once, at
  step 6.1, to remove the guide.
- `miris/devApi.ts` is the only server code: it writes files, proxies
  fal, and owns `data.json`. The fal key never reaches the browser.
- `miris/StageBoundary.tsx` keeps a runtime error in the stage from taking the
  guide down with it. Without it, one typo blanks the page — instructions
  included.
- `miris/miris.d.ts` types the `<mirisStream>` tag for React Three Fiber. It is
  the only reason the tag typechecks, and it is not worth reading.
- `miris/` also holds the guide, the curriculum copy, the snippets, the store
  and the config. Nothing in it needs editing.

### Removing the guide

Comment out `<MirisGuide />` in `app/main.tsx`. That is step 6.1, and it is
the only line the guide adds to the app. Verified: the production build is clean
with it commented out.

`miris/` itself is **not** deletable. `stage.tsx` imports `miris/config` and
`miris/Card`, and the route handler imports `markers`, `store`, `snippets` and
`config`. Removing the folder fails the build with six unresolved imports. The
guide *component* is what comes out in one line, not the folder.

### The SDK pin is not negotiable

```
@miris-inc/core   0.0.8-1238406
@miris-inc/three  0.0.8-1238406
```

Earlier builds fail under Next entirely, in both bundlers, with
`TypeError: Failed to construct 'URL': Invalid URL`. The engine resolves its
WASM loader from `import.meta.url`, and Next never gives a bundled module a real
HTTP one: webpack's is literally `webpack-internal:///(app-pages-browser)/...`.
This build makes the loader bundler-analyzable instead, and the WASM arrives as
`/_next/static/media/AquaApi.<hash>.wasm`.

`three` is pinned to `0.185.0`, the version the SDK was built against. The SDK
also bundles its own copy, so the console warns about multiple instances. That
is expected.

### Placement numbers are measured, and version-specific

`FIT_OVERRIDES` in `miris/config.ts` carries a scale and a floor per asset. Both
were measured on screen against `0.0.8-1238406` on 2026-08-28.

They are needed because the SDK's reported bounds are the octree cell holding
the asset, not the asset. For the demo asset it reads as a uniform 11.59 cube
whatever is inside it, so a box-derived scale always renders content small, and
the box floor is nowhere near where the content starts. Measured content floor
is -1.017 here; on `0.0.8-dc2d7ec` the same asset measured -1.24.

**If the SDK pin changes, re-measure.** Step 3.3 turns this into a lesson rather
than hiding it: attendees nudge two numbers and watch their asset sit down.

### Renderer settings that are not style choices

`alpha: true`, `antialias: false`, `linear` output, ACES tone mapping. This is
the pairing the SDK's own `<miris-scene>` ships. Changing any of them shifts or
breaks the splat composite. Linear output darkens everything non-splat, which is
why the HDR sits at 1.6 intensity instead of the 0.62 a normal scene wants.

`dpr` is capped at 1.5 and `powerPreference` is `high-performance`: splats are
fill-rate bound.

`devIndicators` is off. The SDK logs engine-level console errors attendees
cannot act on, and Next's dev overlay covers the entire stage when it sees them.

The engine is booted once per page load at module scope and never disposed. That
is deliberate: every Fill rewrites `stage.tsx`, so Fast Refresh remounts the
stage, and constructing a scene per mount leaked engine-registered scenes that
kept streaming. Disposing them in effect cleanup is worse, because it runs while
the scene still has children and fails three engine assertions.

### The API is development-only, and the build freezes its last answer

`/api/miris` is Vite dev middleware, so a published build has no endpoint
behind it: nothing there can spend a fal key or rewrite a file, whether or not
the guide is commented out. That is the security property, and it holds.

What a published build *does* answer with is a static snapshot. The stage gates
on `data.track`, which only ever arrived from that endpoint, so without one a
deployed lab sat on `StageSkeleton` forever — the shared link showed nothing.
`miris/snapshot.ts` runs at build time and freezes `data.json` into
`dist/api/miris`, so the published lab renders exactly what the attendee built.

The file is deliberately extensionless with no content-type rule.
`Response.json()` parses on body alone, so the stage is happy; the guide
decides "is the dev API here?" on content-type, so it still correctly reports
that the workshop API is not running. One artifact, both readings right.

Measured on a real bolt.host deploy: a missing path returns **200 and
`text/html`** (the SPA fallback, not a 403 — that is what made `res.json()`
throw), and the snapshot returns 200 with `text/plain` and a real body.

### Known risks

**Miris endpoint latency is the biggest one.** Measured 2026-08-28:
`app.miris.com/.well-known/jwks.json` cold-starts at 6 to 9 seconds, then
serves in 0.3s once warm, and the engine's own fetch gives up during a cold
start. `content.app.miris.com` served a 42KB thumbnail in 13.2 seconds during
the same window, and streaming failed in two independent harnesses at once.
Forty people starting simultaneously on conference wifi is exactly this
condition. Rehearse it under load.

**Per-attendee Miris signup is untested at scale.** Signup, upload, processing,
then finding a viewer key in a portal none of them have seen. It is scheduled
inside the four minute model wait, which is the only reason it fits.

**Everything after step 4 depends on their upload having processed.** Anyone
whose upload stalls can still put their asset id into the mirisStream args at
4.2 anyway: the check only reads the file, and the stream fills in on its own
once processing finishes.

**Laptops on battery drop to 30fps.** Chrome's Energy Saver caps rendering at
30fps once the battery hits 20%, browser-wide, and a room without enough power
strips is exactly where that happens. The stage and every animation suddenly
look janky and nothing in the app is wrong. Diagnosed 2026-09-01: a blank tab
frame-timed at the same 33ms as the app. Tell attendees to plug in, or expect
"the demo feels slow" reports that track battery level.

### Testing

Browser verification lives outside this repo so a fork carries no Playwright:
see `verify-stage.mjs` and `measure-seat.mjs` in the sibling `miris-atelier`
checkout.
