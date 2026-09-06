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
          "Three nodes and nothing clever. A circle lying flat for the deck, gridHelper, which is three.js's built-in ruled grid, and one open-ended cylinder turned inside out for the wall. The wall earns its place: without something behind them, the near capsules sit against pure black, and dark glass over black is invisible: it exists to give a dark room a sense of scale, and here it is doing the same job as the faint floor lines in a film set. The room is deliberately almost black. Nearly everything you are about to see is emissive geometry rather than lit surfaces, which is why the lighting above the scene block is so dim.",
      },
      {
        num: "2.2",
        title: "The walkway",
        body:
          "A ring you stand on, with a lit edge on each side. Add it under the deck, inside the same miris:scene block.",
        fill: "walkway",
        check: "walkway",
        explain:
          "ringGeometry is an annulus: an inner radius, an outer radius and nothing in the middle. That is the walkway. The two glowing edges are torus rings laid flat at those same radii, and their material is meshBasicMaterial with toneMapped false. Basic means it ignores every light in the scene, and toneMapped false keeps it out of the ACES curve, so it stays at full brightness instead of being rolled off with the rest of the image. That pairing is how you fake a light strip without a bloom pass.",
      },
      {
        num: "2.3",
        title: "The capsules",
        body:
          "Six containment capsules, evenly spaced around a circle. Add them under the walkway.",
        fill: "capsules",
        check: "capsules",
        explain:
          "The circle is three lines of trigonometry, written out rather than hidden in a helper, because it is the one bit of maths worth reading: an angle of i over six turns, then cosine for x and sine for z. Each capsule is a plinth, a glass cylinder and two rings. The cylinder is open-ended and drawn on both sides, which is what makes you see the far wall of the glass through the near one. The glass is a standard material at sixteen percent opacity with a faint emissive of its own, and depthWrite is off so the near wall never hides the far one. That last prop is the one people miss: without it, transparent surfaces punch holes in each other depending on the order they happen to be drawn.",
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
        title: "Walk the room",
        body:
          "No button for this one. Open app/stage.tsx and find the camera prop on Canvas. position is [x, y, z] in world units and the capsules stand on a circle of radius 4.2, so [0, 4.2, 12.5] is outside the ring looking in. Try [0, 1.6, 0] to stand in the middle of the walkway with capsules all around you, or drop fov from 42 to 30 for a longer lens. Save and the page reloads with your change; your progress is kept.",
        code: "camera={{ position: [0, 4.2, 12.5], fov: 42 }}",
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
        title: "Float it over the canvas",
        body:
          "The obvious way to label a 3D thing: absolutely-position a DOM element over the canvas and move it with the camera. Add this to the miris:card block and orbit until a capsule passes in front of the card.",
        fill: "card",
        check: "cardOverlay",
        explain:
          "drei's Html helper does the positioning: it projects a scene position into screen space every frame and moves a real DOM element to match. Notice what it cannot do: the card is OVER the canvas, not in it, so a capsule can never pass in front of it, it never refracts through the glass, and it vanishes from screenshots of the canvas. That is the ceiling of the overlay approach, and the next two steps go through it.",
      },
      {
        num: "4.3",
        title: "Paint it into the canvas",
        body:
          "Now the real thing. This goes in the miris:label block near the top of app/stage.tsx, above the return: write the dossier as plain HTML, and useHtmlTexture hands back a texture.",
        fill: "labelHtml",
        renderPath: true,
        check: "labelHtml",
        explain:
          "HTML-in-Canvas is the new browser capability this step exists to teach: ctx.drawElementImage() draws a laid-out DOM element straight into a 2D canvas, pixels and all. Chrome ships it behind chrome://flags/#canvas-draw-element. Everywhere else, the same markup is serialised into an SVG foreignObject and drawn as an image, which is the fallback the badge below reports. Either way the canvas becomes an ordinary three.js CanvasTexture, and that is the whole trick: anything HTML can lay out, the scene can wear. A dossier with bars and chips is a much better argument for it than a name and a line of text.",
      },
      {
        num: "4.4",
        title: "Hang it on the glass",
        body:
          "Swap the overlay in the miris:card block for a plane that wears the texture, inside a Billboard so it turns to face you. Orbit again: the capsules now pass in front of the dossier, because the dossier is geometry.",
        fill: "labelMesh",
        renderPath: true,
        check: "labelMesh",
        explain:
          "A plane with a meshBasicMaterial, nothing exotic. Billboard turns it to the camera every frame, the way every game nameplate works: without it, a plane is invisible edge-on and gone entirely from behind, because single-sided geometry culls its back face. transparent honours the rounded corners, toneMapped keeps the text out of the ACES curve, and label.width and height arrive already in scene units. Your HTML is now a surface in the world: occluded by the glass, screenshotted and streamed like everything else. Then try to select the text. You cannot, and that is the trade. HTML-in-Canvas normally keeps a drawn element selectable and readable by a screen reader, because the canvas showing it is the same canvas holding it. A Billboard gives it nothing to map: the plane turns to face you, hides behind a capsule and moves whenever you orbit. Step 4.2 was the other end of the same trade. Neither one is the right answer for every label.",
      },
    ],
  },
  {
    num: "05",
    title: "Ship it",
    subs: [
      {
        num: "5.1",
        title: "Ship it",
        body:
          "The last step does two things, because the first one makes this panel disappear. Comment out the MirisGuide line in app/main.tsx: the guide goes, your laboratory stays exactly as you built it, and the Miris styling stays too, since index.html loads it. Then press Deploy in Bolt, wait for your link, and send it to someone. What they load is not a model file, it is six specimens streaming to them at whatever detail their screen and connection justify.",
        code: "{/* <MirisGuide /> */}",
      },
    ],
  },
];
