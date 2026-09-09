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
    title: "Setup",
    subs: [
      {
        num: "1.1",
        title: "Add your fal key",
        body:
          "Sign in at fal.ai and redeem the coupon code FAL-MIRIS on the Billing page of the dashboard; it seeds your account with the credits this workshop spends. Then create an API key and paste it into a file called .env.local at the top of the project. Save it and press Done; the server reads the key on every request, so there is nothing to restart.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
        check: "falKey",
      },
      {
        num: "1.2",
        title: "Describe your {noun}",
        body:
          "Describe one {noun} in one sentence, or press the dice for a suggestion, then press Grow the series. It takes about twelve minutes and costs real money, and the room is built while it runs, so press Done and move on as soon as the tray shows it has started.",
        panel: true,
        check: "series",
        explain:
          "A model first decides what kind of animal this is and how it develops, then plans six life stages and renders each one from the one before it. All six meshes build at the same time, so the whole run takes about as long as one.",
      },
    ],
  },
  {
    num: "02",
    title: "Build the room",
    subs: [
      {
        num: "2.1",
        title: "Add the room",
        body:
          "Add Room between the miris:scene comments in app/stage.tsx. It gives you the deck, the walls, the ceiling and the fog.",
        fill: "room",
        check: "room",
        explain:
          "Everything you add here goes inside Scene, which owns the canvas, the lights and the camera. Room is in miris/lab-components/Room.tsx: a scanned metal deck, an inward-facing wall and a ceiling, with the repeated ribs and lamps drawn as instances so they cost one draw call each.",
      },
      {
        num: "2.2",
        title: "Add the platform",
        body:
          "Add Platform after Room. It is the raised ring you are standing on, with its lit edges and the division's label.",
        fill: "platform",
        check: "platform",
        explain:
          "The edge lights are thin rings and boxes with basic materials, so they stay bright without a bloom pass. The seams and distance marks round the ring share one geometry each.",
      },
      {
        num: "2.3",
        title: "Add the walkway",
        body:
          "Add Walkway after Platform. It is the straight path from the platform to the far wall.",
        fill: "walkway",
        check: "walkway",
        explain:
          "A path is one long box with a light strip down each edge and a seam every half metre. Its texture is the same painted canvas the platform uses.",
      },
      {
        num: "2.4",
        title: "Add the door",
        body:
          "Add Door after Walkway. It stands at the end of the path, straight ahead of you: drag to look around the room.",
        fill: "door",
        check: "door",
        explain:
          "The door is built from bevelled shapes in miris/lab-components/Door.tsx, with a light that spills onto the path. You are standing in the middle of the room at eye height, and dragging turns you on the spot rather than flying you around; Scene puts the camera there and aims it two centimetres ahead, which is the whole trick.",
      },
    ],
  },
  {
    num: "03",
    title: "Add the streams",
    subs: [
      {
        num: "3.1",
        title: "Upload your meshes",
        body:
          "Download the archive from the tray, then sign in at app.miris.com and upload all six .glb files. Wait for processing to finish before the next step.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "3.2",
        title: "Create a viewer key",
        body:
          "In the portal, create a viewer key and give it the tag workshop. The tag is how the key knows which assets it may read; the next step puts the same tag on your six meshes. Copy the key somewhere handy: it goes into your file in step 3.6.",
        link: { href: PORTAL_URL, label: "Open Miris" },
        explain:
          "A viewer key ships inside your page, so anyone who opens it can read it. Tying it to a tag means the worst anyone can do is stream the assets you tagged, which is the point.",
      },
      {
        num: "3.3",
        title: "Tag your assets",
        body:
          "Back in the assets list, tick the six meshes you uploaded. Press Edit Tags, then Add Tags, type workshop, and press Add Tags to Asset. The key and the assets now share a tag, so the key can read exactly these six.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "3.4",
        title: "Add the specimens",
        body:
          "Your meshes exist now, so the room can have somewhere to put them. Add the specimen map after Door in the miris:scene block. It walks app/specimens.json and places one Specimen per entry around the ring: a capsule, and the pedestal in front of it. Nothing stands in the glass yet.",
        fill: "specimens",
        check: "specimens",
        explain:
          "Specimen takes no props. Scene numbers the Specimens it finds inside it, first to sixth. The first stands just right of the door as you face it, and each one after it is sixty degrees further round a 4.2 metre ring, so the series runs round the room and ends beside the door on the left. The glass is almost clear, and the glow inside it is a second cylinder with its own shader.",
      },
      {
        num: "3.5",
        title: "Connect the streams",
        body:
          "Replace the specimen line with this version. Inside each Specimen goes a stream: the SDK's tag, given the entry's asset id and your viewer key, and the entry's scale. Both id and key are still empty, so the tubes stay dark until the next step.",
        fill: "streams",
        check: "streams",
        explain:
          "mirisStream is a scene node like the glass around it, so scale works on it the way it works on any object. Specimen stands whatever is inside it in the middle of the glass, and leaves out a stream that has no id yet. A low-detail version arrives first and sharpens as more data streams in.",
      },
      {
        num: "3.6",
        title: "Fill in your ids",
        body:
          "Open each of your six assets in the portal and copy its id into app/specimens.json, in growth order, egg first. Paste your viewer key into viewerKey at the top of app/stage.tsx. Save, and the glass fills.",
        code: `{ "uuid": "9b1c2d3e-...", "scale": 1 }`,
        check: "ids",
        explain:
          "The id says which asset; the key says you may read it. Nothing in your scene changes except where the geometry comes from. You did not load a file that happened to be big: you subscribed to something that arrives at whatever detail the view justifies.",
      },
      {
        num: "3.7",
        title: "Fit each creature to its tube",
        body:
          "Each creature arrives at its own size. In app/specimens.json, set each entry's scale until it fits its glass: small for the egg and the hatchling, larger as the life cycle goes on, so the row reads as growth from left to right. Save, and the page reloads.",
        code: `{ "uuid": "9b1c2d3e-...", "scale": 0.4 }`,
        explain:
          "scale multiplies the mesh's own size. The glass is 1.8 metres across and 2.6 tall, so a creature that arrives three metres tall wants a scale near 0.6. Let the last stage fill its glass and the first sit small in it, and the series tells its story before anyone reads a file.",
      },
    ],
  },
  {
    num: "04",
    title: "The specimen file",
    subs: [
      {
        num: "4.1",
        title: "Write the file in HTML",
        body:
          "Replace the empty fileMarkup in the miris:markup block at the top of app/stage.tsx. It builds the specimen's file as plain HTML from its dossier, styled by miris/lab.css.",
        fill: "markup",
        check: "markup",
        explain:
          "This is ordinary HTML that the browser will lay out like any web page, so the stat bars are just elements with widths. The layout is a fixed 640 by 400 pixels to match the pedestal screen.",
      },
      {
        num: "4.2",
        title: "Draw it into a canvas",
        renderPath: true,
        body:
          "Replace the placeholder File in the miris:parts block with this. It puts your HTML inside a canvas, asks the browser to draw it in whenever it paints, and wears the canvas as a texture. Nothing shows until the next step puts it on a screen.",
        fill: "file",
        check: "file",
        explain:
          "Three things from the HTML-in-Canvas spec. layoutsubtree makes a canvas lay its children out like normal elements, invisible until drawn. requestPaint asks the browser to paint them, and the canvas fires paint once it has, again whenever a child's rendering changes, so drawing there keeps the texture current. drawElementImage copies the painted element into the canvas with the current transform, doubled here so the texture stays crisp up close. The canvas sits on the page under the room, because only what the browser paints can be copied. From there it is ordinary three: CanvasTexture reads the canvas, and a plane wears it.",
      },
      {
        num: "4.3",
        title: "Put it on the screen",
        body:
          "Replace the specimen line with this version. Screen goes inside each Specimen, with your File inside it. Click a tube to walk up to the creature, click a screen to read its file, and press Escape to come back.",
        fill: "screens",
        check: "screens",
        explain:
          "Screen is the pedestal's face. It hands whatever is inside it this specimen's dossier, with its place in the series, as the dossier prop, and scales the plane it gets back to fit. Clicks are tested against projected outlines, so none of your meshes needs a handler.",
      },
    ],
  },
  {
    num: "05",
    title: "The readout",
    subs: [
      {
        num: "5.1",
        title: "Add the readout",
        body:
          "Add this line in the miris:hud block, after Scene. It adds the header, the specimen count, and brackets around whatever your pointer is over.",
        fill: "hud",
        check: "hud",
        explain:
          "The brackets are plain HTML positioned from the capsule outlines projected to the screen each frame. It has to sit outside Scene, or it would float in the room instead of staying pinned to the window.",
      },
      {
        num: "5.2",
        title: "Add the screen effect",
        body:
          "Add this line under Readout in the miris:hud block. Nothing changes until the next step gives it a shader.",
        fill: "effect",
        check: "overlay",
        explain:
          "TSL cannot run in the same canvas as the streams, so ScreenFx draws the effect in a hidden canvas of its own and copies it onto the selected pedestal screen. The other screens keep their plain texture, so the copy costs one screen, not six.",
      },
      {
        num: "5.3",
        title: "Write the glitch shader",
        body:
          "Replace the null glitch in the miris:field block with this. It gives the selected screen scanlines, a blue phosphor tint, a faint flicker and the occasional signal tear.",
        fill: "field",
        check: "field",
        explain:
          "Each call here builds a node in a shader graph instead of computing a pixel, and the graph runs on the GPU for every pixel of the screen. hash turns the clock into a value that holds still for a moment, which is how a tear can stay in one place while it lasts.",
      },
    ],
  },
  {
    num: "06",
    title: "The controls",
    subs: [
      {
        num: "6.1",
        title: "Add the controls",
        body:
          "Add this line under ScreenFx in the miris:hud block. It puts a toolbar at the bottom of the room: a dropdown that lists your six specimens, arrows to step between them, a button back to the overview and one that opens the selected file. On a phone there is nothing to hover and not much to click, so this is how anyone else gets round your room.",
        fill: "controls",
        check: "controls",
        explain:
          "Controls sits outside Scene like the readout and drives the same selection the tubes and screens answer to, so choosing a specimen walks the camera over exactly as a click does. The dropdown is a real listbox: arrow keys, Home, End and typing a letter all work, and every target is at least 44 pixels tall for a thumb. On a narrow screen it steps aside while the guide is open, since the guide is a bottom sheet there.",
      },
    ],
  },
  {
    num: "07",
    title: "Ship it",
    subs: [
      {
        num: "7.1",
        title: "Publish it",
        body:
          "Press Publish in Bolt, wait for your link, and send it to someone. Open it on a phone, pick a specimen from the dropdown, read its file, then press Finish.",
        explain:
          "The published build has no dev server, so it reads a snapshot of your scene data written at build time. Everything else is the code you wrote in app/stage.tsx.",
      },
    ],
  },
];
