# Working in this repo

A two hour hands-on workshop: attendees describe an object, an agent builds it,
and they publish it streaming. React + Vite, not Next. The App Router cannot run
in WebContainer, which is where attendees run this, so the port is deliberate.

## The two halves

`app/` is the attendee's. `stage.tsx` is the file they edit all session, and the
sidebar writes into it between the `miris:` marker comments. It must stay
byte-identical to `miris/stage.template.tsx`, which the reset action restores
from. `main.tsx` they touch once, at step 5.5.

`miris/` is the workshop's machinery: the guide, curriculum copy, snippets, the
dev API, config. Nothing in it needs editing to complete the workshop.

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

The planner decides the clade before it names any stage, because it used to be
asked only for "six stages, earliest to most developed" and returned Larva,
Juvenile, Adolescent, Mature, Elder, Ancient for every creature alike: insect
and mammal terms in one series, no egg, and a last two stages that were only
bigger. It now emits `clade`, `development`, an `anatomy` anchor, and per stage
a `carry` (which identity features are visible yet) and a `change` (what
visibly differs from the stage before). Verified across five clades: a
six-legged furry fox plans as a placental mammal starting at fetus, a paper
heron as a bird starting at egg.

Limb count does not decide the clade. A "six-legged desert fox" was classified
as a holometabolous insect until the prompt was told that fur outranks leg
count and that a named familiar animal carries its own biology.

The renders run **in series, each editing the last** through
`openai/gpt-image-2/edit`, because six independent text renders of "the same
creature" are six different creatures. The meshes still run together, and each
starts the moment its own render lands rather than waiting for all six, so
chaining costs about five minutes rather than the twenty it would if the meshes
queued behind the whole chain.

`change` exists because an edit model left alone returns the reference nearly
untouched and the three adult stages came back identical.

`IMAGE_FRAMING` forbids substrate as well as props: an egg photographed on a
rock arrives in the capsule as a rock.

Dev flags on `hatch`: `imagesOnly: true` runs the chain and stops, six renders
costing cents rather than six meshes costing about twelve dollars. The `plan`
action returns the biology alone, for checking a clade before spending at all.

## Rehearsing without fal

`MIRIS_OFFLINE=1` in `.env.local` replays a recorded run from
`miris/fixtures.json` instead of calling fal: `hatch` and `label` return
instantly and for nothing, and a **Seed the lab** control appears bottom left
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
