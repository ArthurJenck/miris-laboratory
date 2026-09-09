# Spatial Streaming

A two hour workshop. You describe an organism in one sentence, a model plans its
life cycle and builds six stages of it, you upload them to Miris, and they
stream inside six containment capsules in a laboratory you publish and share.

```
npm install
npm run dev
```

Then follow the guide on the right. The scene starts empty: add each lesson’s
code, run it, and try its variation. You can type, ask your agent, or use the
recovery button. Supplied room components handle the detailed geometry; you
compose them and write the dossier and the shader.

The welcome film and `/?view=reference` show the completed destination without
changing your code or saved specimens.

## Before you arrive

Five minutes now saves twenty in the room.

1. **A fal.ai account with billing on.** The series is generated on your own
   key, and a key without a card behind it stops at step 1.4. Sign up at
   fal.ai, add a payment method, redeem the coupon FAL-MIRIS on the Billing
   page, and create a key at fal.ai/dashboard/keys. You will paste it in step 1.3.
2. **A Miris account.** Sign up at app.miris.com. You upload six files to it
   in step 3.1, and the signup is quicker done at home than on conference wifi.
3. **Chrome, with one flag on.** Step 4.2 draws live HTML into the scene with
   `drawElementImage`, which Chrome ships behind
   `chrome://flags/#canvas-draw-element`. Turn it on and relaunch. There is no
   fallback: without the flag the pedestal screens stay dark.
4. **A charger.** Chrome caps rendering at 30fps once a laptop hits 20%
   battery, browser-wide, and the room will feel slow for no reason in the code.
5. **Node 20 or newer** if you run it locally. In Bolt nothing to install.

Total spend on your fal key is about twelve dollars: six images at a few cents
each and six meshes at about $1.40 apiece. Every attendee grows their own
series; there is no way past step 1.4 without one.

## What happens, in order

| Step | You | Running in the background |
|---|---|---|
| 01 Set up | Make a fal account, create a key, put it in .env.local. Describe a creature. | The series grows: about twelve minutes. |
| 02 Build the room | Add the room, platform, walkway and door. | Still growing. Make your Miris account if you have not. |
| 03 Add the streams | Download the archive, upload six files, tag them and a viewer key, add the six specimens and their streams, paste the ids, fit each creature. | Portal processing. |
| 04 The specimen file | Write HTML for the specimen's file, draw it into a canvas, put it on the screen. | |
| 05 The readout | Add the HUD, write a TSL field on a second canvas. | |
| 06 The controls | Add the toolbar: a specimen dropdown, next and previous, overview and read file, so the room works under a thumb. | |
| 07 Ship it | Publish, send the link. | |

The room is built while the meshes grow, which is the only reason two hours is
enough. Do not wait for the tray to finish before starting step 2.

## What it is

React, Vite, React Three Fiber and drei. Not Next: the App Router cannot run
in WebContainer, which is where most attendees run this.

- `app/stage.tsx` is your file. It imports the room's parts by their plain
  names from `../miris` (`Scene`, `Room`, `Platform`, `Walkway`, `Door`,
  `Specimen`, `Screen`, `Readout`, `ScreenFx`, `Controls`) and composes them; the camera, lights, controls and
  renderer settings live inside `Scene`, so the file carries none of it. The
  viewer key is one constant at the top, and the six specimens (asset id and
  scale) are `app/specimens.json`, imported beside it; step 3.6 fills both in
  by hand. Its lesson blocks start empty or with the small placeholders needed
  to compile.
  It ships with `miris:` markers and the guide writes between them when you
  press **Or paste it for me**. Everything outside the markers is yours and is
  never touched.
- `app/main.tsx` is one line: it mounts your stage inside `Workshop`, which
  adds the guide and hosts the reference view. Production hides the guide, so
  no closing edit is required.
- `miris/stage.template.tsx` is the identical clean starter.
  `miris/stage.reference.tsx` is generated from that template by applying the
  curriculum’s code lessons in order. Run `npm run reference` after changing
  the template or snippets; `npm test` detects drift.
- `miris/` is the workshop's machinery: the guide, the curriculum, the
  snippets, the dev API that proxies fal, and the room's own components.
  Nothing in it needs editing to finish the workshop.

### Money and time

The whole run is one fal workflow, `workflows/dexhonsa/miris-growth-series-v2`.
The image renders cost cents. Each mesh is about $1.40 and four to five
minutes on fal's `meshy/v7/image-to-3d`; the six renders run in series, each
one editing the last so the creature stays the same creature, and each mesh
starts the moment its render lands. Wall clock is about twelve minutes and
the tray keeps a stage list and a running total while it works.

The workshop's dev server reads `FAL_KEY` from `.env.local` on every request,
so there is nothing to restart when you add it.

## For presenters

### Rehearsing without spending

`MIRIS_OFFLINE=1` in `.env.local` replays a recorded run from
`miris/fixtures.json` instead of calling fal. `hatch` returns instantly, and a
**Seed the lab** control appears bottom left that fills all
six capsules with the recorded specimen in one press. Everything after the
twelve minute wait can be rehearsed in seconds. The archive it writes is
`miris/specimens.offline.zip`, six tiny synthetic cubes, so a rehearsal can
never overwrite a paid run.

Offline is never inferred from a missing key: "FAL_KEY is not set" is a
sentence attendees are meant to see.

### The SDK is vendored, and the pin is not negotiable

```
@miris-inc/core   0.0.9-budget-lab.bd3d02d
@miris-inc/three  0.0.9-budget-lab.bd3d02d
```

Both tarballs are in `vendor/` and `package.json` installs from there. This is
an unreleased build carrying the adaptive splat budget, which six streams at
once need. A clone without `vendor/` fails `npm install` outright, and a
machine with them in its npm cache can hide that, so test with
`npm install --cache $(mktemp -d)`. `three` is pinned to `0.185.0`, the
version the SDK was built against; the SDK bundles its own copy too, so the
console warns about multiple instances, which is expected.

Three small components in `miris/` exist to make the SDK behave inside an
ordinary three.js scene, and `AGENTS.md` records what each one fixes:
`HdrGuard` (everything that is not a splat went dark), `BudgetGuard` (the
adaptive budget does not start itself), `GlassOrder` (glass and splats cannot
be depth sorted against each other). If the SDK fixes these, the guards go.

### Renderer settings that are not style choices

`alpha: true`, `antialias: true`, `NoToneMapping`, `dpr` capped at 1.5,
`powerPreference: "high-performance"`. Splats are fill-rate bound and the SDK's
composite depends on the first two. Tone mapping is off because the SDK's HDR
pass, not the curve, was what darkened the room; `HdrGuard` switches that pass
off and ACES could come back.

### Publishing

The dev API is Vite middleware, so a built site has no endpoint behind it:
nothing there can spend a fal key or rewrite a file. `miris/snapshot.ts` freezes
`data.json` into `dist/miris-scene.json` at build time, including only the
scene’s specimen IDs, dossier content and scoped viewer key. The production
stage reads this JSON file, and the guide renders nothing in production.
A legacy `dist/api/miris` copy is also emitted. Check the public link on a phone
in portrait and landscape, including a streamed specimen and its pedestal.

### Known risks

**Miris endpoint latency.** `app.miris.com/.well-known/jwks.json` cold-starts
at six to nine seconds and the engine's own fetch gives up during one. Forty
people starting at once on conference wifi is exactly that condition. Rehearse
under load.

**fal per-key concurrency is unverified on a fresh account.** The chain runs
six meshy jobs in parallel. If a new key serialises them, twelve minutes
becomes thirty and the arc does not fit.

**Per-attendee Miris signup, upload and processing at scale is untested.**
It is scheduled inside the twelve minute grow, which is the only reason it
fits. Anyone whose upload stalls can still seal their capsules: the stream
fills in on its own once processing finishes.

**Laptops on battery drop to 30fps.** Say so out loud at the start.

### Testing

`npm test` checks the empty starter, curriculum/snippet coverage, preservation
of customized fitting code when File is added, clear-block dependencies, and
type-checks every intermediate lesson. It also verifies that the completed
reference is exactly the cumulative lesson result. `npm run build` checks the
production bundle.

Additional browser verification lives outside this repo so a fork carries no Playwright:
see `verify-stage.mjs` and `measure-seat.mjs` in the sibling `miris-atelier`
checkout. `AGENTS.md` carries the measurement method for frame costs.
