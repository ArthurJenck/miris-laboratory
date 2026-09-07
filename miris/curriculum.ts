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
          "One creature, in one sentence. Everything in the room grows out of this: a model works out what kind of animal it is and how that kind actually develops, then plans six points in its life and renders each one from the one before it. About twelve minutes, and it costs real money, so if you already have a series uploaded you can skip straight to it. Or press the dice.",
        panel: true,
        check: "series",
        explain:
          "Six meshes in series would be half an hour, which is why this used to be one specimen and five empty capsules. They run together instead, so the wall clock is one mesh build and change. What the model is asked for is a growth series rather than six variations: same animal, changed by growth, ordered from earliest to most developed. That is the difference between a row of six creatures and a life cycle you can read left to right.",
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
          "Sublevel 7 starts as a plated deck running out into fog, and the dark shell around it. Open app/stage.tsx, find the block between the two miris:scene comments, and put this inside it. Everything you write outside those comments is left alone.",
        fill: "floor",
        check: "floor",
        explain:
          "Three nodes and nothing clever. A circle lying flat for the deck, wearing a scanned floor with its normal and roughness maps so the grooves catch the light; a fog that takes the far edge of it to black; and one closed cylinder turned inside out for the shell. The shell earns its place: without something behind them, the capsules sit against pure black, and dark glass over black is invisible. The room is deliberately almost black. Nearly everything you are about to see is emissive geometry rather than lit surfaces, which is why the lights above the scene block are so restrained: a hemisphere for the faintest sense of up and down, one directional to put a gradient across the deck so it is not flat, and a single cyan point at ankle height under the walkway.",
      },
      {
        num: "2.2",
        title: "The walkway",
        body:
          "A ring you stand on with a lit edge on each side, and a path off it toward a door at the far end. Add it under the deck, inside the same miris:scene block.",
        fill: "walkway",
        check: "walkway",
        explain:
          "ringGeometry is an annulus: an inner radius, an outer radius and nothing in the middle. That is the walkway. The two glowing edges are torus rings laid flat at those same radii, and their material is meshBasicMaterial with toneMapped false. Basic means it ignores every light in the scene, and toneMapped false keeps it out of any tone curve, so it stays at full brightness instead of being rolled off with the rest of the image. That pairing is how you fake a light strip without a bloom pass, and the path's edge lines are the same trick stretched into boxes. The door is a dark frame with a lit panel, a point light spilling back down the path, and a radial glow lying on the deck where that light lands, so the beam has somewhere to end.",
      },
      {
        num: "2.3",
        title: "The capsules",
        body:
          "Six containment capsules, evenly spaced around a circle. Add them under the walkway.",
        fill: "capsules",
        check: "capsules",
        explain:
          "The circle is three lines of trigonometry, written out rather than hidden in a helper, because it is the one bit of maths worth reading: an angle of i over six turns, then cosine for x and sine for z. Each capsule is a plinth, a glass cylinder, a cone of light, a pulse in the fluid, a pool of light on the deck and two rings. The cone is the cheapest volumetric there is: an open cone drawn on both sides with additive blending, so wherever it overlaps itself it brightens, falling off along its length so the beam has no visible end. It writes no depth, which keeps it from cutting a hole in the glass behind it. The cylinder is open-ended and drawn on both sides, which is what makes you see the far wall of the glass through the near one. The glass is a standard material at eighteen percent opacity with a faint emissive of its own, and depthWrite is off so the near wall never hides the far one. That last prop is the one people miss: without it, transparent surfaces punch holes in each other depending on the order they happen to be drawn. Pulse is a second cylinder just inside the glass: every few seconds a band of the capsule's colour climbs through it and is gone, on its own clock, so the six never fire together.",
      },
      {
        num: "2.4",
        title: "Wire the capsules",
        body:
          "Add this last, under the capsules. It connects each capsule to a stream, but nothing appears yet: a stream needs an asset id and a viewer key, and those come in the next section. For now the room is finished and the glass is empty.",
        fill: "streams",
        check: "streams",
        explain:
          "A stream is not a file you load, it is a subscription. What appears first is a coarse version of the whole specimen, and it sharpens as more arrives, so there is never a moment where you wait on a download. The extend call at the top of app/stage.tsx is what buys you that: it registers MirisStream as a JSX tag, so a stream takes position and scale like any other three.js object and React Three Fiber draws it in the same pass as the glass around it. FitInGlass around it measures whatever arrives and scales it to the glass, because a generated mesh comes out at whatever size the generator chose. Six capsules means six subscriptions, each arriving at whatever detail its distance from the camera justifies. That is the part worth noticing: the far capsules cost less than the near ones without you doing anything about it.",
      },
      {
        num: "2.5",
        title: "Stand in the room",
        body:
          "No button for this one. You are in the middle of the laboratory: dragging turns you on the spot rather than flying you around the ring, and clicking a capsule walks you over to it. Open app/stage.tsx and find the camera prop on Canvas. The middle number of position is your eye height, so 1.7 is standing and 0.9 is crouched beside the plinths. fov is how much you see at once: raise it to 70 and the room wraps around you, drop it to 35 and you are looking down a lens at one capsule.",
        code: "camera={{ position: [0, 1.7, 0.02], fov: 55 }}",
        explain:
          "The camera sits at the origin and OrbitControls is aimed two centimetres in front of it. That is the whole trick: orbiting a target that close rotates the view in place instead of swinging it around the room, which is why panning and zooming are switched off and why rotateSpeed is negative. Drag left and you look left, the way you would expect standing in a room rather than holding a model in your hand.",
      },
    ],
  },
  {
    num: "03",
    title: "Go live",
    subs: [
      {
        num: "3.1",
        title: "Upload the series",
        body:
          "Your six meshes need somewhere to live. Sign in at app.miris.com, or make an account if you did not while the series grew. Download the archive from the tray: six .glb files, numbered in growth order. Upload all six. Processing takes a few minutes; the next step needs it finished.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "3.2",
        title: "Scope a viewer key",
        body:
          "Back in the portal, check all six uploads have finished processing, then create a viewer key scoped to those six assets rather than one that can read everything in your account. That key is the only thing you need to copy: the six uuids come back with it.",
        link: { href: PORTAL_URL, label: "Open Miris" },
        explain:
          "A viewer key is not a password. It is what lets a browser read your assets with nobody logged in, which means it ships inside the page: anyone who opens your deployed lab can read it out of the source in a few seconds. That is fine, and it is the point, but it decides what the key should be allowed to reach. An account wide key hands every reader of your page the ability to fetch anything you ever upload, including work that has nothing to do with this workshop. A key scoped to these six assets can fetch exactly these six and nothing else, so the worst case is that someone streams the creature you just built on purpose. Scope is the thing you control here, not secrecy.",
      },
      {
        num: "3.3",
        title: "Fill the capsules",
        body:
          "Paste your scoped viewer key and press Find my specimens. The key already knows which assets it can read, so it fetches them, orders them by the number in each name, and shows you the order before anything is sealed. Check it reads egg first and adult last, then seal all six. The glass fills.",
        capsuleUuid: true,
        check: "capsuleUuid",
        explain:
          "This is the whole integration: one component, two strings. Nothing about your scene changed except where the geometry comes from. The glass, the rings, the walkway, the camera and the render loop are identical. Streaming is a delivery change, not a rendering change. You did not load a file that happened to be big. You subscribed to something that arrives at whatever detail the view justifies. Each specimen then sits itself: FitInGlass measures it as it arrives and scales it to the glass. MirisStream.getBounds reports in world space with the current scale already applied, which makes the correction proportional, measure, multiply, measure again, and stop when it stops moving. Fitting to a reported box is only as good as the box, so how much of the glass a specimen takes is the fill prop on FitInGlass in app/stage.tsx, and one is the whole capsule.",
      },
    ],
  },
  {
    num: "04",
    title: "The dossier",
    subs: [
      {
        num: "4.1",
        title: "Write the file's markup",
        body:
          "The specimen's file is plain HTML: a few elements with classes the guide already styles. Put this in the miris:markup block near the top of app/stage.tsx, above the return. It is a function that takes one dossier and returns markup, and nothing about it is 3D yet.",
        fill: "markup",
        check: "markup",
        explain:
          "This is the HTML-in-Canvas idea, in two halves, and this is the first. It is ordinary markup laid out by the browser with ordinary CSS, so anything you can do on a web page you can do here: each stat bar is a b element with a width, the cyan comes from a class in lab.css, the text wraps because text wraps. The browser is doing the layout work that a 3D text library would make you do by hand, which is the whole point of the API. The next step paints the result into a canvas and hangs it in the room. Change a word, add a line, or give the notes a class of your own in lab.css, save, and click the capsule again: the file repaints from your markup. If your function throws mid-edit, the designed file shows instead, so you cannot break the room while you experiment.",
      },
      {
        num: "4.2",
        title: "Hang it beside the glass",
        body:
          "Two lines, in the miris:card block inside the Canvas. The first makes the capsules clickable. The second takes your markup, paints it, and stands it beside whichever capsule is open. Click a capsule: the camera walks over and the file is there in the room. Click away, or press Escape, to come back.",
        fill: "card",
        check: "cardOverlay",
        renderPath: true,
        explain:
          "The second half. DossierCard calls your fileMarkup, lays the result out offscreen, and paints it into a canvas with drawElementImage, the HTML-in-Canvas API: one call turns a laid-out element into pixels. Where the browser does not have the API yet, the same markup goes through an SVG foreignObject and paints the same way; the badge on this step says which path yours took. The canvas is then a texture on a plane, and a plane is a thing in the room: it stands to the right of the glass, hinged on its inner edge and angled toward you, it recedes with everything else, and you can orbit around it. It is drawn opaque and depth-writing on purpose, so the specimen sits in front of it when it should. Clicking is decided from the pointer against the capsules' projected outlines, so your glass never carries a click handler, and the same click hands the camera a destination it eases toward over about a second.",
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
          "Two things are happening here and only one is obvious. The brackets are DOM, a fixed element drawn over the canvas, positioned every frame from the outline of the glass as the camera sees it: its two silhouette edges, top and bottom, projected into screen space. Notice where the line goes: outside the Canvas, not in it. A fixed element rendered inside the canvas layer anchors to that layer's transform and ends up floating in the scene rather than pinned to the window, which is exactly what happened the first time this was built. Hover is decided from the pointer against those same projected boxes, so the glass you wrote never has to carry an event handler, and a capsule beside or behind you has no box at all.",
      },
      {
        num: "5.2",
        title: "Add the overlay",
        body:
          "TSL cannot share a canvas with a stream, so the containment field gets its own. Add this line at the bottom of app/stage.tsx, outside the Canvas, in the miris:effect block. Nothing shows until the next step hands it a graph.",
        fill: "effect",
        check: "overlay",
        explain:
          "Splats render through raw GLSL shader materials the SDK builds itself. TSL compiles through a node builder that cannot read those, so putting both in one canvas gives you no splats and a console full of compile errors. A second transparent canvas sidesteps it entirely: the field is screen space, so it never needed the room's depth buffer in the first place. It sits on top, ignores pointer events, and is sized to the stage, so it shrinks when the guide is open. It draws whatever node graph you hand it, one full-screen quad, and nothing at all until you do.",
      },
      {
        num: "5.3",
        title: "Write the field",
        body:
          "Now the shader. This goes in the miris:field block near the top of app/stage.tsx, above the return. It is JavaScript that builds a shader graph, not a string of shader source, and it reads top to bottom: where the pixel is, the lines, the vignette, the colour.",
        fill: "field",
        check: "field",
        explain:
          "TSL is three.js's node shading language. uv(), time, mul and sin are nodes, not values: nothing is computed when this code runs. It builds a graph, the graph compiles once to GLSL on this backend, and then it runs per pixel per frame on the GPU. That is why it sits in useMemo: rebuild the graph on every render and the renderer rebuilds with it. Read it in order. p is the pixel's position from the centre of the screen, corrected for the screen's shape so a circle stays a circle. wave is a sine of the pixel's height, moved along by time, and scan squashes it to three percent so the lines read as texture rather than stripes. edge is the distance from the middle pushed through smoothstep: nothing until 0.8, darkest at 1.6. The vec4 is colour and alpha: the lines are cyan light, the vignette is black with alpha, and black at any alpha darkens what is behind it. Now change things and save. 220 is how many lines fit the screen and 1.4 is how fast they drift. Swap .sin() for .fract() and the lines turn hard-edged. Replace p.length() with p.x.abs() and the vignette becomes two dark bands at the sides. Every one of those is a different graph, compiled fresh when you save.",
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
          "The last step does two things, because the first one makes this panel disappear. Comment out the MirisGuide line in app/main.tsx: the guide goes, your laboratory stays exactly as you built it, and the Miris styling stays too, since index.html loads it. Then press Publish, top right in Bolt, wait for your link, and send it to someone. What they load is not a model file, it is six specimens streaming to them at whatever detail their screen and connection justify.",
        code: "{/* <MirisGuide /> */}",
      },
    ],
  },
];
