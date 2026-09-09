import { FAL_CREDITS_URL, FAL_KEYS_URL, FAL_URL, PORTAL_URL } from "./config";

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
        title: "Create your fal account",
        body:
          "Sign up at fal.ai, or sign in if you already have an account, then press Done.",
        link: { href: FAL_URL, label: "Open fal" },
      },
      {
        num: "1.2",
        title: "Redeem the coupon",
        body:
          "Open the Credits & Tiers page of the fal dashboard, press Add credits, and paste the coupon code below. It seeds your account with the credits this workshop spends. Press Done once the balance shows.",
        code: "fal-miris",
        link: { href: FAL_CREDITS_URL, label: "Open Credits & Tiers" },
      },
      {
        num: "1.3",
        title: "Create an API key",
        body:
          "Open Keys in the fal dashboard and press Add key. Give it any name, then copy the key it shows you: fal shows it once. Keep it handy for the next step and press Done.",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
      },
      {
        num: "1.4",
        title: "Create .env.local",
        body:
          "Make a file called .env.local at the top of the project, beside package.json, and paste your key into it as the one line below. Save it and press Done; the server reads the file on every request, so there is nothing to restart.",
        code: "FAL_KEY=your-key-here",
        check: "falKey",
      },
      {
        num: "1.5",
        title: "Describe your {noun}",
        body:
          "Describe one {noun} in one sentence, or press the dice for a suggestion, then press Grow the series. The run takes about twelve minutes and spends some of your usage credits. As soon as the tray shows it has started, press Done and carry on; there is no need to wait for it.",
        panel: true,
        check: "series",
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
      },
      {
        num: "2.2",
        title: "Add the platform",
        body:
          "Add Platform after Room. It is the raised ring you are standing on, with its lit edges and the division's label.",
        fill: "platform",
        check: "platform",
      },
      {
        num: "2.3",
        title: "Add the walkway",
        body:
          "Add Walkway after Platform. It is the straight path from the platform to the far wall.",
        fill: "walkway",
        check: "walkway",
      },
      {
        num: "2.4",
        title: "Add the door",
        body:
          "Add Door after Walkway. It stands at the end of the path, straight ahead of you: drag to look around the room.",
        fill: "door",
        check: "door",
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
      },
      {
        num: "3.5",
        title: "Connect the streams",
        body:
          "Replace the specimen line with this version. Inside each Specimen goes a stream: the SDK's tag, given the entry's asset id and your viewer key, and the entry's scale. Both id and key are still empty, so the tubes stay dark until the next step.",
        fill: "streams",
        check: "streams",
      },
      {
        num: "3.6",
        title: "Fill in your ids",
        body:
          "Open each of your six assets in the portal and copy its id into app/specimens.json, in growth order, egg first. Paste your viewer key into viewerKey at the top of app/stage.tsx. Save, and the glass fills.",
        code: `{ "uuid": "9b1c2d3e-...", "scale": 1 }`,
        check: "ids",
      },
      {
        num: "3.7",
        title: "Fit each creature to its tube",
        body:
          "Each creature arrives at its own size. In app/specimens.json, set each entry's scale until it fits its glass: small for the egg and the hatchling, larger as the life cycle goes on, so the row reads as growth from left to right. Save, and the page reloads.",
        code: `{ "uuid": "9b1c2d3e-...", "scale": 0.4 }`,
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
      },
      {
        num: "4.2",
        title: "Draw it into a canvas",
        renderPath: true,
        body:
          "Replace the placeholder File in the miris:parts block with this. It puts your HTML inside a canvas, asks the browser to draw it in whenever it paints, and wears the canvas as a texture. Nothing shows until the next step puts it on a screen.",
        fill: "file",
        check: "file",
      },
      {
        num: "4.3",
        title: "Put it on the screen",
        body:
          "Replace the specimen line with this version. Screen goes inside each Specimen, with your File inside it. Click a tube to walk up to the creature, click a screen to read its file, and press Escape to come back.",
        fill: "screens",
        check: "screens",
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
      },
      {
        num: "5.2",
        title: "Add the screen effect",
        body:
          "Add this line under Readout in the miris:hud block. Nothing changes until the next step gives it a shader.",
        fill: "effect",
        check: "overlay",
      },
      {
        num: "5.3",
        title: "Write the glitch shader",
        body:
          "Replace the null glitch in the miris:field block with this. It gives the selected screen scanlines, a blue phosphor tint, a faint flicker and the occasional signal tear.",
        fill: "field",
        check: "field",
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
      },
    ],
  },
];
