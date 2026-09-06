import { FAL_KEYS_URL, PORTAL_URL } from "./config";

export interface Sub {
  num: string;
  /** {noun} is replaced with the track's own word: creature, product,
   *  artifact. The same substitution runs over `body`. */
  title: string;
  body: string;
  code?: string;
  /** A snippet id from miris/snippets.mjs. Typed loosely on purpose: the
   *  snippets live in a plain .mjs file, so there is no exported union to
   *  narrow against. */
  fill?: string;
  /** Required whenever `fill` is set. What the button wrote, and why. */
  explain?: string;
  /** Renders an outbound link as a button, for steps that send you somewhere
   *  else to fetch something. Opens in a new tab: losing the guide mid-step
   *  would cost more than the link saves. */
  link?: { href: string; label: string };
  /** Renders the fal panel opener. */
  panel?: boolean;
  /** Renders the uuid and viewer key form for the active capsule. */
  capsuleUuid?: boolean;
  /** Renders the Write the label button. */
  label?: boolean;
  /** A check id from the CHECKS map in miris/devApi.ts. Done verifies it before
   *  moving on. Steps whose work happens outside the project, signing up or
   *  deploying, deliberately have none. */
  check?: string;
  /** Renders the html-in-canvas path badge. */
  renderPath?: boolean;
}

export interface Step {
  num: string;
  title: string;
  subs: Sub[];
}

export const STEPS: Step[] = [
  {
    num: "01",
    title: "Set up",
    subs: [
      {
        num: "1.1",
        title: "Your fal key",
        body:
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Save it, then press Done: the server reads the key on every request, so there is nothing to restart.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
        check: "falKey",
      },
      {
        num: "1.2",
        title: "Describe your {noun}",
        body:
          "One organism, whole body, on a plain backdrop. This is what grows in your first capsule. Or press the dice.",
        panel: true,
        check: "image",
      },
    ],
  },
  {
    num: "02",
    title: "The laboratory",
    subs: [
      {
        num: "2.1",
        title: "The deck",
        body:
          "Sublevel 7 starts as a dark disc, a grid and the wall around them. Open app/stage.tsx, find the block between the two miris:scene comments, and put this inside it. Everything you write outside those comments is left alone.",
        fill: "floor",
        check: "floor",
        explain:
          "Four nodes and nothing clever. A circle lying flat for the deck, gridHelper, which is three.js's built-in ruled grid, one open-ended cylinder turned inside out for the wall, and six lit panels set into it. The wall earns its place: without something behind them, the capsules sit against pure black, and dark glass over black is invisible. The panels sit between the capsules rather than behind them, on the half-step of the same circle, so the gaps you look through read as a room: it exists to give a dark room a sense of scale, and here it is doing the same job as the faint floor lines in a film set. The room is deliberately almost black. Nearly everything you are about to see is emissive geometry rather than lit surfaces, which is why the lighting above the scene block is so dim.",
      },
      {
        num: "2.2",
        title: "The walkway",
        body:
          "A ring you stand on, with a lit edge on each side and a strip of light down the middle. Add it under the deck, inside the same miris:scene block.",
        fill: "walkway",
        check: "walkway",
        explain:
          "ringGeometry is an annulus: an inner radius, an outer radius and nothing in the middle. That is the walkway. The two glowing edges are torus rings laid flat at those same radii, and their material is meshBasicMaterial with toneMapped false. Basic means it ignores every light in the scene, and toneMapped false keeps it out of the ACES curve, so it stays at full brightness instead of being rolled off with the rest of the image. That pairing is how you fake a light strip without a bloom pass, and the white band down the centre of the walkway is the same trick at eighty-five percent opacity.",
      },
      {
        num: "2.3",
        title: "The capsules",
        body:
          "Six containment capsules, evenly spaced around a circle. Add them under the walkway.",
        fill: "capsules",
        check: "capsules",
        explain:
          "The circle is three lines of trigonometry, written out rather than hidden in a helper, because it is the one bit of maths worth reading: an angle of i over six turns, then cosine for x and sine for z. Each capsule is a plinth, a glass cylinder, a cone of light and two rings. The cone is the cheapest volumetric there is: an open cone, drawn on both sides at four percent opacity with additive blending, so wherever it overlaps itself it brightens. It writes no depth, which keeps it from cutting a hole in the glass behind it. The cylinder is open-ended and drawn on both sides, which is what makes you see the far wall of the glass through the near one. The glass is a standard material at sixteen percent opacity with a faint emissive of its own, and depthWrite is off so the near wall never hides the far one. That last prop is the one people miss: without it, transparent surfaces punch holes in each other depending on the order they happen to be drawn.",
      },
      {
        num: "2.4",
        title: "Make your Miris account",
        body:
          "You are one step from streaming, and streaming needs an account. Sign up at app.miris.com now, while the mesh builds; when the tray says Model ready, download the .glb and upload it there. Processing takes a few minutes of its own, so the earlier it starts the better. You need two things from the portal afterwards, at step 3.1: the asset uuid and a viewer key.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "2.5",
        title: "Fill the capsules",
        body:
          "Add this last, under the capsules. Any capsule with a uuid starts streaming; the rest stay empty until you fill them.",
        fill: "streams",
        check: "streams",
        explain:
          "A stream is not a file you load, it is a subscription. What appears first is a coarse version of the whole specimen, and it sharpens as more arrives, so there is never a moment where you wait on a download. The extend call at the top of app/stage.tsx is what buys you that: it registers MirisStream as a JSX tag, so a stream takes position and scale like any other three.js object and React Three Fiber draws it in the same pass as the glass around it. Six capsules means six subscriptions, each arriving at whatever detail its distance from the camera justifies. That is the part worth noticing: the far capsules cost less than the near ones without you doing anything about it.",
      },
    ],
  },
  {
    num: "03",
    title: "Go live",
    subs: [
      {
        num: "3.1",
        title: "Upload your specimen",
        body:
          "You started this at step 2.4. Back in the Miris portal, check your upload has finished processing, then copy two values: the asset uuid from the asset page, and a viewer key from your account settings. The viewer key is what lets a browser read your asset without logging anyone in.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "3.2",
        title: "Put it in the glass",
        body:
          "Press the button and paste your asset uuid and viewer key. It goes into the capsule you are working on, and that capsule starts streaming your specimen instead of the demo.",
        capsuleUuid: true,
        check: "capsuleUuid",
        explain:
          "This is the whole integration: one component, two strings. Nothing about your scene changed except where the geometry comes from. The glass, the rings, the walkway, the camera and the render loop are identical. Streaming is a delivery change, not a rendering change. You did not load a file that happened to be big. You subscribed to something that arrives at whatever detail the view justifies.",
      },
      {
        num: "3.3",
        title: "Sit it in the capsule",
        body:
          "Yours will not land where the demo did. Open app/stage.tsx and find the mirisStream you added at step 2.5. The middle number of position is the height inside the glass, and scale decides whether it fills the capsule or floats in the middle of it. Change scale first, then the height. The capsule floor is at y 0.36 and its rim is at y 2.96.",
        code: "position={[Math.cos(angle) * 4.2, 1.6, Math.sin(angle) * 4.2]} scale={0.15}",
        explain:
          "You are doing this by eye because there is nothing better to compute it from. The SDK will report a bounding box, but it describes the octree cell holding your asset rather than the asset itself, so its floor is not where your model starts. Two numbers you can see the effect of beat a fit that is right for some specimens and quietly wrong for others.",
      },
      {
        num: "3.4",
        title: "Stand in the room",
        body:
          "No button for this one. You are in the middle of the laboratory and you stay there: dragging turns you on the spot rather than flying you around the ring. Open app/stage.tsx and find the camera prop on Canvas. The middle number of position is your eye height, so 1.7 is standing and 0.9 is crouched beside the plinths. fov is how much you see at once: raise it to 70 and the room wraps around you, drop it to 35 and you are looking down a lens at one capsule.",
        code: "camera={{ position: [0, 1.7, 0.02], fov: 55 }}",
        explain:
          "The camera sits at the origin and OrbitControls is aimed two centimetres in front of it. That is the whole trick: orbiting a target that close rotates the view in place instead of swinging it around the room, which is why panning and zooming are switched off and why rotateSpeed is negative. Drag left and you look left, the way you would expect standing in a room rather than holding a model in your hand.",
      },
    ],
  },
  {
    num: "04",
    title: "The dossier",
    subs: [
      {
        num: "4.1",
        title: "Write the dossier",
        body:
          "Press the button and a model on your fal key turns your prompt into a specimen record: a designation, a classification, a gene readout, expressed traits and handler notes.",
        label: true,
        check: "dossier",
        explain:
          "The register that makes a room of shapes read as an archive. Everything on the card is derived from the one sentence you wrote at step 1.2, which is why the numbers feel like they belong to your specimen rather than to a template. Note what the model is being asked for: not prose, but a structure with a closed status set and exactly four stats. A card that sometimes has three bars and sometimes five cannot be laid out.",
      },
      {
        num: "4.2",
        title: "Open it on click",
        body:
          "One line puts the file on screen. Add it in the miris:card block, at the bottom of app/stage.tsx outside the Canvas, then click a capsule.",
        fill: "card",
        check: "cardOverlay",
        explain:
          "The dossier is HTML over the canvas rather than geometry in it, and that is a deliberate choice rather than the lazy one. A card standing in the scene turns edge-on as you look around, hides behind its own glass and gets clipped by the top of the frame, which is exactly what it did in the first version of this room. Anchored to the window it stays readable from every angle. What you give up is that it can never be occluded by the specimen, never streamed, and never appears in a screenshot of the canvas alone. Clicking is decided the same way hover is, from the pointer against the projected capsule boxes, so nothing in the scene needs a click handler.",
      },
    ],
  },
  {
    num: "05",
    title: "The readout",
    subs: [
      {
        num: "5.1",
        title: "Wake the instruments",
        body:
          "One line adds the laboratory's own readout: the header, the capsule count, and four corner brackets on whichever capsule your pointer is over. It goes in the miris:hud block, at the bottom of the file outside the Canvas.",
        fill: "hud",
        check: "hud",
        explain:
          "Two things are happening here and only one is obvious. The brackets are DOM, drawn over the canvas by drei's fullscreen Html layer, positioned from the eight corners of a capsule's bounds projected into screen space every frame. Projecting the centre alone would give a point with no size to bracket, which is why it is eight corners and not one. Notice where the line goes: outside the Canvas, not in it. A fixed element rendered inside the canvas layer anchors to that layer's transform and ends up floating in the scene rather than pinned to the window, which is exactly what happened the first time this was built. Hover is decided from the pointer against those same projected boxes, so the glass you wrote never has to carry an event handler.",
      },
      {
        num: "5.2",
        title: "Add the overlay",
        body:
          "TSL cannot share a canvas with a stream, so the containment field gets its own. Add this line at the bottom of app/stage.tsx, outside the Canvas, in the miris:effect block.",
        fill: "effect",
        check: "overlay",
        explain:
          "Splats render through raw GLSL shader materials the SDK builds itself. TSL compiles through a node builder that cannot read those, so putting both in one canvas gives you no splats and a console full of compile errors. A second transparent canvas sidesteps it entirely: the field is screen space, so it never needed the room's depth buffer in the first place. It sits on top, ignores pointer events, and the main canvas feeds it one thing, where the hovered capsule is on screen.",
      },
      {
        num: "5.3",
        title: "Write the field",
        body:
          "Now the shader. This goes in the miris:field block near the top of app/stage.tsx, above the return. It is JavaScript that builds a shader graph, not a string of shader source.",
        fill: "field",
        check: "field",
        explain:
          "TSL is three.js's node shading language. Every call here is a node, not a value: uv() is the pixel's position, time counts up on its own, and sub, mul and length build a graph rather than doing arithmetic now. The whole graph compiles once, to GLSL on this backend, and then runs per pixel per frame. That is also why it is wrapped in useMemo: build it again on every render and you rebuild the renderer with it. Two things are drawn. A halo that follows the capsule under your pointer, and scanlines drifting up the screen. Change the numbers and save: smoothstep's two edges are where the halo ends and where it is strongest, 220 is how many scanlines fit the screen, and the vec3 is the colour of the whole field.",
      },
    ],
  },
  {
    num: "06",
    title: "Ship it",
    subs: [
      {
        num: "6.1",
        title: "Ship it",
        body:
          "The last step does two things, because the first one makes this panel disappear. Comment out the MirisGuide line in app/main.tsx: the guide goes, your laboratory stays exactly as you built it, and the Miris styling stays too, since index.html loads it. Then press Deploy in Bolt, wait for your link, and send it to someone. What they load is not a model file, it is six specimens streaming to them at whatever detail their screen and connection justify.",
        code: "{/* <MirisGuide /> */}",
      },
    ],
  },
];
