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
  /** One thing to try for whoever finishes early. Shown under the card, never
   *  checked: a step is done when its check passes, stretch or not. */
  stretch?: string;
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
        stretch:
          "Open miris/devApi.ts and find falKey. The key is read on every request and never sent to the browser: watch the network tab while the series grows and it is not there.",
        body:
          "Sign in at fal.ai, open Keys, create one, and paste it into a file called .env.local at the top level of this project. Create the file if it is not there. Save it, then press Done: the server reads the key on every request, so there is nothing to restart.",
        code: "FAL_KEY=your-key-here",
        link: { href: FAL_KEYS_URL, label: "Open fal keys" },
        check: "falKey",
      },
      {
        num: "1.2",
        title: "Describe your {noun}",
        stretch:
          "Before you press Grow, guess the clade the planner will choose and the six stage names it will use. It weighs fur over leg count, so a six-legged fox plans as a mammal.",
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
        stretch:
          "Change floorMaps(14) to floorMaps(8) above the return in app/stage.tsx. The scanned floor tiles get larger without changing the size of the room.",
        body:
          "This branch includes the finished laboratory. These scene steps rebuild it a layer at a time. In app/stage.tsx, replace the contents of the miris:scene block with VaultFloor to start with the deck, enclosing shell, wall ribs and ceiling lights. Clear block removes that lesson layer; later scene steps clear back to the preceding layer.",
        fill: "floor",
        check: "floor",
        explain:
          "VaultFloor is the room shell supplied in miris/VaultRoom.tsx. It combines a scanned metal deck, an inward-facing wall, a ceiling and fog that fades from 12 to 32 metres. Normal maps give the deck grooves without adding geometry; the hemisphere and directional lights reveal the metal surfaces. Pale-blue light strips use basic materials so they remain bright independently of the room lighting. Repeated wall ribs and lights use StaticInstances: one geometry and material are drawn at many transforms, reducing draw calls while keeping the same visible hardware. The attendee composes these prepared parts in app/stage.tsx; their construction lives in the workshop machinery.",
      },
      {
        num: "2.2",
        title: "The walkway",
        stretch:
          "Change the walkway texture repeat from (6, 6) to (3, 3) above the return in app/stage.tsx. Compare the surface scale with the floor around it.",
        body:
          "Add VaultWalkway after VaultFloor in the miris:scene block. It supplies the circular deck, illuminated edges, panel seams and the straight approach to the pressure door.",
        fill: "walkway",
        check: "walkway",
        explain:
          "VaultWalkway combines a shallow platform with an annular walking surface. Thin torus rings and narrow boxes make the pale-blue edge lights without a bloom pass. Repeated seams and distance marks share instanced geometry. At the end of the approach, PressureDoor uses beveled shapes for a recessed frame and two solid door leaves, with inset handles and narrow lights. There are no text plaques or gear teeth. A modest point light and a soft floor glow connect the door to the path. All of this is prepared geometry in miris/VaultRoom.tsx, so the scene block stays readable.",
      },
      {
        num: "2.3",
        title: "The capsules",
        stretch:
          "Temporarily render specimens.slice(0, 3) in the VaultCapsule map. Half the tube housings disappear while the remaining ones keep their positions. Restore all six before continuing.",
        body:
          "Add the specimen map after the walkway. Each entry places one VaultCapsule at its index around the room; the specimens themselves are connected in the next step.",
        fill: "capsules",
        check: "capsules",
        explain:
          "VaultCapsule places index i at angle i times pi over three, using cosine for x and sine for z on a 4.2-metre ring. Each housing has metal caps, instanced bolts, rear supports, a lamp, glass and pale-blue light effects. The glass has 3.5 percent opacity, is drawn on both sides and does not write depth. Pulse is a second cylinder just inside it: a band travels through the tube on its own clock, softening when that capsule is selected. LightShaft uses an additive cone with a soft falloff, and FloorGlow is a textured plane. These inexpensive shapes suggest illuminated fluid and haze without a full volumetric pass. GlassOrder handles the ordering limitation between transparent glass and the SDK splats.",
      },
      {
        num: "2.4",
        title: "Wire the capsules",
        stretch:
          "Give one mirisStream a rotation prop. It is a scene node like the glass around it, so it turns like anything else.",
        body:
          "Add the stream map after the capsule housings. Each entry needs an asset id and viewer key; if those are not connected yet, the tube stays empty until section 3. The completed example on this branch already includes FitInGlass, which sizes and centers each stream.",
        fill: "streams",
        check: "streams",
        explain:
          "extend registers MirisStream as a JSX tag, so a stream accepts transforms like other three.js objects. Its coarse representation arrives first and gains detail as streaming continues. The six subscriptions share an adaptive splat budget, which spends detail according to the view. The stream map uses the same 4.2-metre circle as the housings. FitInGlass is a separate wrapper: it measures and centers the asset, then turns the centered group slowly. Keeping fitting and rotation outside the stream makes them ordinary scene behavior.",
      },
      {
        num: "2.5",
        title: "Fit the specimen",
        stretch:
          "Change 0.08 in the rotation line to 0.04 for one turn about every 157 seconds, or to 0.16 for about 39 seconds. Leave fill at 0.7 while comparing the motion.",
        body:
          "Replace FitInGlass in the miris:parts block with this version, or inspect the version already present in the completed example. It measures each arriving stream, fits it inside the glass and starts a slow turn once it has settled. Clearing this helper also removes the pedestal mounting so it cannot call a File component that is no longer present; section 4 adds it again.",
        fill: "fit",
        check: "fit",
        explain:
          "getBounds reports a world-space box with the current scale applied. FitInGlass scales toward the tighter of two limits: the glass height and the horizontal diagonal of that box. The diagonal matters because a wide specimen must clear the tube throughout a full rotation. The inner group moves toward the capsule center until its size settles within one percent; its center then receives a final correction. An outer group stays at the capsule center and rotates at 0.08 radians per second, about one turn every 79 seconds. Rotation uses the frame delta rather than a fixed amount per frame, and caps long deltas to avoid a jump after a stall. The fitting work stops once settled; the inexpensive rotation continues. fill controls how much of the available space the specimen uses.",
      },
      {
        num: "2.6",
        title: "Stand in the room",
        stretch:
          "Set position to [0, 6, 0] and fov to 90 and you are looking down on the ring from the ceiling. Then put it back: the walk to a capsule starts from eye height.",
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
        stretch:
          "Name the files with a number and the stage, 01-egg.glb. Step 3.3 orders by that number and labels each capsule from the word after it.",
        body:
          "Your six meshes need somewhere to live. Sign in at app.miris.com, or make an account if you did not while the series grew. Download the archive from the tray: six .glb files, numbered in growth order. Upload all six. Processing takes a few minutes; the next step needs it finished.",
        link: { href: PORTAL_URL, label: "Open Miris" },
      },
      {
        num: "3.2",
        title: "Scope a viewer key",
        stretch:
          "Make a second key scoped to only three of the six and try it at 3.3. The other three capsules stay empty, and that is the scope working.",
        body:
          "Back in the portal, check all six uploads have finished processing, then create a viewer key scoped to those six assets rather than one that can read everything in your account. That key is the only thing you need to copy: the six uuids come back with it.",
        link: { href: PORTAL_URL, label: "Open Miris" },
        explain:
          "A viewer key is not a password. It is what lets a browser read your assets with nobody logged in, which means it ships inside the page: anyone who opens your deployed lab can read it out of the source in a few seconds. That is fine, and it is the point, but it decides what the key should be allowed to reach. An account wide key hands every reader of your page the ability to fetch anything you ever upload, including work that has nothing to do with this workshop. A key scoped to these six assets can fetch exactly these six and nothing else, so the worst case is that someone streams the creature you just built on purpose. Scope is the thing you control here, not secrecy.",
      },
      {
        num: "3.3",
        title: "Fill the capsules",
        stretch:
          "Watch a capsule as it fills. The first thing to arrive is the whole creature at low detail, not the top half at full detail. That is a stream, not a download.",
        body:
          "Paste your scoped viewer key and press Find my specimens. The key already knows which assets it can read, so it fetches them, orders them by the number in each name, and shows you the order before anything is sealed. Check it reads egg first and adult last, then seal all six. The glass fills.",
        capsuleUuid: true,
        check: "capsuleUuid",
        explain:
          "This is the whole integration: one component, two strings. Nothing about your scene changed except where the geometry comes from. The glass, the rings, the walkway, the camera and the render loop are identical. Streaming is a delivery change, not a rendering change. You did not load a file that happened to be big. You subscribed to something that arrives at whatever detail the view justifies. Each specimen then sits itself: FitInGlass measures it as it arrives and scales it to the glass. MirisStream.getBounds reports in world space with the current scale already applied, which makes the correction proportional, measure, multiply, measure again, and stop resizing when it settles. Its outer group then keeps rotating slowly. Fitting to a reported box is only as good as the box, so how much of the glass a specimen takes is the fill prop on FitInGlass in app/stage.tsx, and one uses the full fitting allowance while keeping the horizontal diagonal inside the glass.",
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
        stretch:
          "Change the terminal header text in fileMarkup, then select a pedestal to see it painted into the scene. Keep the content within the fixed 640 by 400 pixel screen.",
        body:
          "The specimen file is plain HTML styled in miris/lab.css. Put this function in the miris:markup block above the return in app/stage.tsx. It lays out an identity panel, six-stage strip, stats, notes and terminal header and footer.",
        fill: "markup",
        check: "markup",
        explain:
          "The browser lays out the dossier with ordinary HTML and CSS before it becomes a texture. The prepared terminal uses pale-blue text on a dark background and a fixed 640 by 400 pixel layout, matching the pedestal and effect canvas at 16:10. Stat bars are elements with percentage widths, and the current growth stage gets its own class. The left column contains identity and stats; the right holds the notes. A fixed aspect ratio prevents the image from stretching when the CRT pass is selected. If you add content, check that the notes and footer still fit. The next step paints the layout; the one after puts it on the pedestal.",
      },
      {
        num: "4.2",
        title: "Paint it",
        stretch:
          "Swap meshBasicMaterial for meshStandardMaterial with the same map. The file now takes the room's light and reads dimmer for it, which is why basic and toneMapped false are the default.",
        body:
          "Now the part that gives the step its name. This goes under FitInGlass in the miris:parts block. It takes markup, hands it to a hook that paints it, and puts the result on a plane.",
        fill: "file",
        check: "file",
        renderPath: true,
        explain:
          "useHtmlTexture is the hinge between the two worlds. It lays the markup out offscreen, then paints the element into a canvas with drawElementImage, the HTML-in-Canvas API: one call turns a laid-out element into pixels. Where the browser does not have the API yet, the same markup goes through an SVG foreignObject and is painted the same way; the badge on this step says which path yours took. Back comes a three.js texture and the element's size in scene units, and from there it is the most ordinary thing in three: a plane with that texture on it. The plane is centred on its origin; the pedestal in the next step scales it to fit its screen. toneMapped off, because the pixels are already the colours the browser chose.",
      },
      {
        num: "4.3",
        title: "Put it on the pedestal",
        body:
          "Put these two lines in the miris:card block inside Canvas. Dossier enables selection. Pedestals places a metal CRT terminal in front of each tube and asks File to paint its dossier. Click a tube to approach the organism, click a screen to read it, or press Escape to return.",
        fill: "card",
        check: "cardOverlay",
        explain:
          "Each pedestal has a vented base, a beveled metal enclosure and a tilted 16:10 screen. Pedestals supplies the dossier and its place in the series to your File component, then scales the returned plane to the screen. Its geometry, click outline and camera target share the same screen transform, so the image stays aligned when you lean in. The current selection is the only lab state that rerenders the pedestal list; moving hover brackets does not rebuild all six terminals. The effect texture is used only while reading a selected screen. If the attendee markup throws mid-edit, that screen goes blank while the room keeps rendering.",
        stretch:
          "Open a capsule and scroll. The wheel zooms between 1.2 and 3.2 metres from the glass, and only there: standing in the room there is nothing two centimetres ahead worth zooming toward.",
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
        stretch:
          "Hover a capsule that is half off the edge of the screen. The brackets clip to it, because the box is the projected silhouette, and a capsule beside you has no box at all.",
        body:
          "One line adds the laboratory's own readout: the header, the capsule count, and four corner brackets on whichever capsule your pointer is over. It goes in the miris:hud block, at the bottom of the file outside the Canvas.",
        fill: "hud",
        check: "hud",
        explain:
          "Two things are happening here and only one is obvious. The brackets are DOM, a fixed element drawn over the canvas, positioned every frame from the outline of the glass as the camera sees it: its two silhouette edges, top and bottom, projected into screen space. Notice where the line goes: outside the Canvas, not in it. A fixed element rendered inside the canvas layer anchors to that layer's transform and ends up floating in the scene rather than pinned to the window, which is exactly what happened the first time this was built. Hover is decided from the pointer against those same projected boxes, so the glass you wrote never has to carry an event handler, and a capsule beside or behind you has no box at all.",
      },
      {
        num: "5.2",
        title: "Read the budget",
        body:
          "No code for this one. The readout you just added has a second line, bottom right: how many splats the six streams are drawing this frame, how many the budget allows, and the frame time. Drag the slider down to 40k and watch the capsules behind you go coarse before the one in front; drag it up and watch the frame time climb. Press Release and the controller starts again and finds its own level.",
        explain:
          "The adaptive controller adjusts the total splat budget using frame time, and the engine distributes detail according to the view. Pinning the slider stops that controller; Release starts a fresh one from 250k and lets it settle. The readout sums visible detail nodes and measures the render loop delta, because the SDK already owns the GPU timer query. The host room has its own costs too: repeated ribs, bolts and floor marks share instanced geometry, pedestal updates follow selection, and the CRT copy runs only while its screen is selected, at most 30 times per second. Floor anisotropy stays at four taps and the main canvas caps pixel ratio at 1.5. These keep the room inexpensive while the controller manages the more variable streaming load.",
        stretch:
          "Pin the budget at 40k, then click a capsule. Watch where the detail goes as the camera arrives, and where it comes from.",
      },
      {
        num: "5.3",
        title: "Wire the screen",
        stretch:
          "Comment the line out again and click a pedestal: the screen shows the file exactly as painted. Everything the next step adds is the difference.",
        body:
          "TSL cannot share a canvas with a stream, so the glitch gets a renderer of its own. Add this line at the bottom of app/stage.tsx, outside the Canvas, in the miris:effect block. Nothing changes until the next step hands it a graph.",
        fill: "effect",
        check: "overlay",
        explain:
          "The SDK splats use raw shader materials, while this TSL graph runs in a separate node renderer. ScreenFx draws one quad into an unseen 1024 by 640 canvas, then exposes that canvas as a normal texture to the main renderer. Only the selected pedestal screen uses the result. The copy runs at up to 30 updates per second while reading a terminal, and stops when you return to the room, select an organism or hide the browser tab. The other screens keep their original painted textures. This limits the cost of copying pixels between canvases while keeping the subtle CRT animation readable.",
      },
      {
        num: "5.4",
        title: "Write the glitch",
        stretch:
          "Lower 0.83 in the live line to 0.5 to allow tears on more ticks. Increase the shift multiplier from 0.014 to 0.03 to slide the rows further. Restore the subtle settings when you are done.",
        body:
          "Put this graph in the miris:field block above the return. It turns the painted terminal into a pale-blue CRT image with scanlines, soft edge darkening, restrained flicker and occasional horizontal signal tears.",
        fill: "field",
        check: "field",
        explain:
          "TSL functions build shader nodes rather than calculate pixels in JavaScript. useMemo keeps the graph stable between React renders. p is the pixel position on the file. tick advances every 1 / 0.55 seconds, about 1.8 seconds; hash keeps a random value constant within that tick. live allows a tear on roughly 17 percent of ticks for the first 5.5 percent of the tick. band selects a narrow strip of rows, and shift offsets their horizontal texture sample by 0.014. The sampled color is converted to luminance and tinted with vec3(0.48, 0.78, 1) for blue phosphor. scan adds faint horizontal lines, flicker changes brightness by less than one percent, edge darkens the perimeter and a neighboring sample supplies a soft glow. The CRT treatment remains visible between tears. The selected screen evaluates this graph at up to 30 frames per second.",
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
          "Press Publish, top right in Bolt, wait for your link, and send it to someone. What they load is not a model file, it is six specimens streaming to them at whatever detail their screen and connection justify. Leave the guide where it is: the published lab has no workshop API behind it, and without one the guide renders nothing. Then press Finish.",
        explain:
          "A published build has no dev server, so nothing in it can spend a fal key or rewrite a file, whatever the guide's buttons say. What it does have is a snapshot: miris/snapshot.ts freezes data.json into dist/api/miris at build time, so the stage's one fetch gets the same answer the dev server would have given, and the room renders exactly what you built. The file is deliberately extensionless with no content type. Response.json() parses on the body alone, so the stage is happy, while the guide decides whether the workshop API exists by content type, sees text and stays out of the way. One artefact, both readings right.",
        stretch:
          "Open your link on a phone. The same six streams arrive at a fraction of the detail, and the room is the same room.",
      },
    ],
  },
];
