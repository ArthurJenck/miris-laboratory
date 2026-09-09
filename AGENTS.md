# Working in this repo

A two hour hands-on workshop: attendees describe an object, an agent builds it,
and they publish it streaming. React + Vite, not Next. The App Router cannot run
in WebContainer, which is where attendees run this, so the port is deliberate.

## The two halves

`app/` is the attendee's. `stage.tsx` is the file they edit all session, and the
sidebar can write into it between the `miris:` marker comments, though the
paste-it-for-me and clear buttons are hidden until the wand in the guide's
header is on (remembered per browser in `localStorage` as `mw-assist`);
`specimens.json` beside it holds their six ids and scales. It must stay
byte-identical to `miris/stage.template.tsx`, which the reset action restores
from. It imports everything it names from `../miris` (the barrel in
`miris/index.tsx`) and is deliberately free of numbers: the camera, lights,
controls, renderer settings, guards and data loading are all inside `Scene`,
and each part of the room (`Room`, `Platform`, `Walkway`, `Door`,
`Specimen`) takes no props, as do the two things on the page outside the canvas,
`Readout` and `Controls`. `Controls` is the toolbar at the foot of the room
(a specimen dropdown, next and previous, overview, read file) that drives the
same selection in `miris/labState.ts` a click on a tube does; on a phone it is
the only way round. Shared positions live once, in `miris/layout.ts`.
`main.tsx` they need not touch: it mounts the stage in `Workshop`, and the
guide renders nothing in a published build, so removing it is an option the
closing pane offers, not a step.

`miris/` is the workshop's machinery: the guide, curriculum copy, snippets, the
dev API, config. Nothing in it needs editing to complete the workshop.

`miris/lab-components/` is the part of it attendees are walked through: the
four room parts step 2 adds (`Room`, `Platform`, `Walkway`, `Door`) and the
parts bin they are assembled from (`hardware.tsx` for the colours, `Ring`,
`Label` and `radial`; `StaticInstances.tsx` for repeated hardware in one draw
call). Each room part's default export reads as a list of named sub-parts
defined below it in the same file, so the names carry the explanation and the
comments stay short. `Specimen` uses the same parts bin from outside the folder.

The committed starter has empty lesson blocks. The finished lab lives at
`/?view=reference`, using `miris/stage.reference.tsx`. Generate it with
`npm run reference`; never copy the finished scene back into the starter.
`npm test` verifies that the curriculum's ordered snippets produce that
reference and that every intermediate lesson compiles. The function the
attendee writes, `File`, is replaced by name inside the `parts` block rather
than by rewriting the block, so anything else they put there survives.

The six asset ids and scales are `app/specimens.json`, imported by the stage;
the viewer key is one constant in the stage, found by name. Nothing is fetched
for them. The dev API's seed and reset actions write both through
`mergeSpecimens` and `withViewerKey`, which change only the values named so a
scale tuned by hand survives a reseal; the reference gets the fixture ids and
scales the same way into `miris/specimens.json`. The file is the truth for what
streams: the fill-in-your-ids check reads the JSON and the key line, accepts
ids typed in by hand, and copies them into `data.json`, which still carries
them for the readout's count and the tray.

`Specimen` takes no props. `Scene` numbers the `Specimen` elements it finds in
its children, in order, and each one provides its slot through a context.
Whatever is inside a `Specimen` stands in the middle of its glass; `Screen`
inside it portals its child onto the pedestal, handing that child the slot's
dossier as `dossier`. A `mirisStream` with an empty id is left out, so the SDK
is never asked for nothing. A slot whose stage is named but whose dossier the
registrar has not written yet gets a pending record with the same shape, so the
attendee's `File` paints something rather than a black screen; a dossiers node
that answers badly is dropped by the parser, and this is where that used to
become invisible.

Attendees read these files by hand, so keep comments to roughly one line per
file. The curriculum's WHY texts already explain the concepts; a comment
repeating one is noise in front of the code it explains.

## Publishing is a filtered push, and `origin` is not it

`origin` is the **private** repo. The public one attendees clone,
`dex-honsa-miris/miris-workshop-starter-public`, is deliberately **not** a
configured remote, so that no one can `git push public` and get it wrong.

Publishing rewrites history to strip internal files, then force-pushes:

```sh
git clone --single-branch -b <branch> . /tmp/pub && cd /tmp/pub
git filter-repo --force --invert-paths \
  --path docs --path miris-web-kit --path miris/kit --path dist \
  --path-glob '*SKILL.md' --path-glob '*voice.md'
git remote add pub https://github.com/dex-honsa-miris/miris-workshop-starter-public.git
git push --force pub <branch>:main
```

Two reasons it has to be this and not a plain push. `docs/miris-web-kit/` holds
internal brand docs naming an employee; it is gitignored now, but older commits
in this history still contain it, so a clean tip is not enough. And filtering by
directory alone is not enough either: those files have lived at `public/kit/`,
`miris/kit/` and `docs/miris-web-kit/`, so a `--path docs` filter leaves the
earlier copies behind. Filter by filename too, and verify against every commit
before pushing, not just `HEAD`.

## The growth pipeline

The series is grown by one fal workflow, `workflows/dexhonsa/miris-growth-series-v2`
(https://fal.ai/workflows/dexhonsa/miris-growth-series-v2): a plan node, a
dossiers node, six prompt nodes, six chained renders and six meshes, with an
output map of `plan`, `dossiers`, `image_1..6` and `model_1..6`. Its prompts and
model settings live on fal, not in this repo; `GROWTH_WORKFLOW` in
`miris/config.ts` names it. To change what the creatures look like, edit the
workflow.

`hatch` in `miris/devApi.ts` streams the run from `fal.run/<workflow>/stream`
and patches `data.json` as each node reports (the events arrive separated by
CRLF, which a parser looking for a bare `\n\n` never sees): the plan names the six stages,
the dossiers node files all six at once, each render sets an image, each mesh
a glb. The output map at the end is the record and fills any gap the events
left, then the six glbs are fetched, checked for the glTF magic and zipped.
If the stream cannot be opened the same run is queued instead and lands all at
once; a stream that drops midway is never resubmitted, because a run costs
about twelve dollars, so the tray clears and the button says press again.

The plan node answers in plain lines, `Clade:`, `Development:`, `Anatomy:`
and `Stage N: name | body: ... | carry: ... | change: ...`; `parsePlanText`
reads them. The dossiers node answers with one JSON array of six;
`parseDossiers` normalises each to the pinned shape (four stats, in order).

Why the workflow's prompts say what they say, kept here because it took a
run to learn each one: the planner decides the clade before naming any stage,
because asked only for "six stages" it returned Larva, Juvenile, Adolescent,
Mature, Elder, Ancient for every creature alike. Limb count does not decide
the clade; fur outranks leg count, and a named familiar animal carries its own
biology. The renders run in series, each editing the last, because six
independent renders of "the same creature" are six different creatures.
`change` exists because an edit model left alone returns the reference nearly
untouched. The framing rules forbid substrate as well as props: an egg
photographed on a rock arrives in the capsule as a rock. Live-bearing clades
start at the newborn, never a fetus or embryo: asked for a placental mammal's
first stage the image model draws a human fetus in an amniotic sac, and the
plan forbids anything human outright. The framing rules also forbid any
enclosure round the subject (sac, membrane, shell, capsule, glass) unless the
stage is itself a bare egg, and the chained stage prompts say the enclosure is
gone: an edit model otherwise carries the sac from the first render through the
next three, and the mesh step turns it into a shell with a window cut in it.

## Rehearsing without fal

`MIRIS_OFFLINE=1` in `.env.local` replays a recorded run from
`miris/fixtures.json` instead of calling fal: `hatch` returns instantly and
for nothing, and a **Seed the lab** control appears bottom left
that fills all six capsules, dossiers and uuids in one press. `unseed` empties
it again. The whole flow downstream of the twelve minute wait can then be
rehearsed in seconds.

It is never inferred from a missing `FAL_KEY`. "FAL_KEY is not set" is a
sentence attendees are meant to see, so offline has to be asked for explicitly.

Two deliberate separations. Offline writes `miris/specimens.offline.zip` rather
than `specimens.zip`, because overwriting 129MB of paid creature meshes with
cubes during a rehearsal is not recoverable. And the archive holds six
synthetic cubes from `miris/tinyGlb.mjs`, not real meshes, so nothing large
lands in the repo; they are valid glTF and parse in three's GLTFLoader.

`fixtures.json` carries stages, prompts, dossiers and a `uuid` per stage. An
empty `uuid` falls back to `DEMO_UUID`, so seeding works before the six real
assets have been uploaded to the portal and sharpens once they have.

## Other things that have bitten

The dev API (`miris/devApi.ts`) is a Vite `configureServer` middleware, so it
exists only under `npm run dev`. A built preview answers `/api/miris` with the
SPA fallback: **200 and `text/html`**, not a 404. Detect it by content type.

The SDK is **vendored, not installed from npm**. `package.json` points at
`file:vendor/*.tgz` for `0.0.9-budget-lab.bd3d02d`, an unreleased build from
aqua PR #5982, because it carries the adaptive splat budget and six streams at
once need it. Those two tarballs are committed on purpose: `vendor/` holds the
only copy, so a clone without them fails `npm install` outright with `ENOENT`.
It can appear to work anyway on a machine that has them in its npm cache, which
makes the breakage invisible locally — test with `npm install --cache $(mktemp -d)`.
Re-pin to a registry version once this build ships to npm.

`@miris-inc/core` is a peer dependency of `@miris-inc/three`. Nothing imports it
directly, so it looks removable from `package.json`. It is not.

WebContainer keeps binary files on GitHub import. This note used to say the
opposite, and blamed missing chooser artwork and fonts on the platform. Measured
in bolt on 2026-09-07 against `budget-lab-test`: all six Geist `.woff2` faces and
both SDK tarballs (5MB and 10MB) arrived byte-identical, and `npm install`
resolved the vendored SDK. If artwork goes missing in bolt, the cause is
somewhere else — do not write it off as the platform.

**With a stream in the scene, everything that is not a splat goes dark.** The
SDK's `SporkHdrPass` renders the whole scene into an fp16 target and
composites it back through a shader that assumes every texel is already
sRGB-encoded. The splats are, because their shader pre-encodes; nothing three
draws is, because three writes linear into any render target that is not an XR
target, whatever the target is tagged. So the glass, rings, deck and door come
back with no transfer curve applied, uniformly dim, while the specimen looks
right. One stream or six, the same. It is not tone mapping (measured off), not
colour space (unchanged), not `<Canvas linear>` (tested), and not splat scale
(tested tiny). `miris/HdrGuard.tsx` sets `pass.suspended = true` on the pass,
found through the `.pass` field on the bind and composite meshes the SDK adds
to the scene. Cost: fp16 headroom on very bright splats. Worth filing against
the SDK; if it is fixed, the guard can go.

**The vendored SDK's adaptive splat budget does not start itself.** The build
is vendored for the controller from aqua PR 5982, but the only caller of
`Miris._startAdaptiveBudget(scene)` is the SDK's own lab page, so here every
stream drew at the engine's default heuristic and focusing a capsule fell from
ninety frames a second to under twenty, and stayed there after Escape.
`miris/BudgetGuard.tsx` starts it. The controller wants a `MirisScene` with
`coreScene` and `miris` on it; the stage is a plain R3F scene, which the SDK
pairs with a core scene (keyed on the three scene) when the first stream is
added, so the guard adds those two getters and starts the controller then.
`Miris._instance._adaptiveBudgetStatus` in the console shows it working.
Worth filing against the SDK; if it starts the controller itself, the guard
can go.

The readout's slider (`miris/budget.ts`) pins the budget by hand; no step asks for it, it is there for anyone curious.
Pinning has to stop the controller first, because it re-applies its own
number every 250ms tick and would win; Release calls `_startAdaptiveBudget`
again, which builds a new controller at its default 250k rather than resuming. Frame time in
the readout is the render loop's own delta, smoothed: the SDK holds the one
GPU timer query open, so there is no second one.

Step 1.4 has no way round it: every attendee describes a creature and grows
their own series. The only shortcut is the offline seed, for presenters
rehearsing, and it exists only under `MIRIS_OFFLINE=1`.

**Glass and splats cannot be depth-sorted against each other.** The SDK draws
all six specimens as one splat mesh with no depth write, so a tube's glass is
either over every creature or under every creature. Under, a tube's own near
wall never tinted the creature behind it; over, a tube across the room tinted a
creature in front of it. `miris/GlassOrder.tsx` decides per tube per frame from
the readout's screen boxes: over, unless a nearer capsule overlaps it on
screen. It finds the glass by the `glass-N` name `Specimen` gives it.

**TSL reaches the pedestal screens by copy, not by sharing a canvas.** The
glitch graph renders in `miris/ScreenFx.tsx`, a second renderer drawing one
quad into an unseen canvas with the painted file as input; the pedestal in
`Specimen.tsx` swaps that canvas in as the selected screen's texture each frame.
One screen is one upload a frame; six would be too many, so the other five
show the file as painted. `screenTexture` is one CanvasTexture whose canvas is
swapped to the active file's, and re-uploaded only when that file's texture
version moves, so the attendee's graph can name it.

**HTML reaches the screens natively, with no fallback.** The attendee's `File`
is the whole implementation, in `app/stage.tsx`: a `<canvas layoutsubtree>`
parked off screen with the markup inside it, `drawElementImage` in the canvas's
`paint` handler at a 2x transform, and a `CanvasTexture` on a 16:10 plane.
The old SVG `foreignObject` fallback and the render-path store went with
`htmlInCanvas.ts` and `htmlTexture.ts`; without
`chrome://flags/#canvas-draw-element` the screens stay dark and the badge on
4.2 says so. The two primitives are typed in `miris/miris.d.ts`.

**What the room costs, measured.** With the splat budget pinned and the canvas
at six times its size so nothing sits at the frame cap, every category of
scene object was shown alone: glass, shafts, pulses, glows, rings, door, the
effect canvas and 150k splats each added nothing measurable over an empty
frame. The deck added 8.4ms at that size, and 7.8ms of that was anisotropy 8
across its five maps; at 4 it is 0.6ms. At a real retina canvas the whole
host scene is well under a millisecond, so anything that feels slow is the
splat side, and the controller above is the lever. Method, for next time:
`scene.__r3f.root.getState().gl` from the R3F scene, `_setSplatCountBudgetOverride`
to pin the load, `setPixelRatio(6)`, median frame time over two seconds, best
of two. GPU timer queries do not work here; the SDK holds one open.

`optimizeDeps.include` in `vite.config.ts` is load-bearing, not tidying. The SDK
is in `optimizeDeps.exclude` so esbuild leaves its WASM paths alone, but that
also means Vite cannot scan its imports and meets them for the first time as the
browser asks. It then re-optimizes and reloads, and during that window the page
holds two copies of `@react-three/fiber`: drei reads a different React context
than `<Canvas>` wrote, and every drei hook throws **"R3F: Hooks can only be used
within the Canvas component!"** from a component that is plainly inside the
Canvas. The stack blames drei and the error is a red herring. Anything the SDK
pulls in, plus `three/webgpu` and `three/tsl`, has to be named in `include`.
