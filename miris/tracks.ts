export interface Track {
  id: string;
  label: string;
  /** One line on the door: what you make, then what the label adds. */
  blurb: string;
  noun: string;
  /** Miris kit ramp, used as the panel accent. */
  accent: string;
  image: string;
  imageAlt: string;
  imageWidth: number;
  imageHeight: number;
  /** object-position for the door's crop, which is portrait. */
  focal: string;
  /** object-position for the sidebar strip, a much wider band. */
  focalStrip: string;
  /** Placeholder for the prompt field. */
  hint: string;
  /** Pool for the dice. Subject phrases only: the API prepends `style`, so a
   *  prompt naming its own lighting or backdrop fights the prefix. */
  prompts: string[];
  /** Prepended to the prompt before it reaches fal. */
  style: string;
}

/* One track now. The workshop is the laboratory: six capsules around a
   walkway, and every specimen in them is something an attendee described. */
export const TRACKS: Track[] = [
  {
    id: "laboratory",
    label: "Laboratory",
    blurb: "You grow a specimen. It gets a designation, a gene readout and handler notes.",
    noun: "specimen",
    accent: "#3BD6FE",
    image: "/tracks/laboratory-poster.jpg",
    imageAlt: "The workshop laboratory with blue-lit specimen capsules and research terminals",
    imageWidth: 1280,
    imageHeight: 720,
    focal: "50% 45%",
    focalStrip: "50% 55%",
    hint: "a plated deep-sea grazer with bioluminescent seams",
    prompts: [
      "a plated deep-sea grazer with bioluminescent seams",
      "a chitinous burrower with translucent segmented plating",
      "a six-limbed canopy glider with membrane wings",
      "a slow-moving mineral grazer crusted with quartz",
      "a coiled abyssal serpent with lantern nodes along its spine",
      "a moss-backed amphibian with glassy vestigial eyes",
      "a barbed reef crawler with iridescent shell banding",
      "a tufted tundra forager with dense insulating pelt",
      "a spined cave dweller with pale translucent skin",
      "a broad-shelled scavenger with fused armour plates",
      "a filament-finned drifter with a gas-filled bladder",
      "a horned salt-flat strider with cracked hide",
      "a lobed fungal symbiote with spore-bearing ridges",
      "a ridged thermal-vent crab with heat-blackened claws",
      "a whiskered silt feeder with a flattened plated skull",
      "an armoured root-grazer with interlocking scutes",
    ],
    style:
      "a preserved biological specimen for a research archive, matte organic surfaces, " +
      "clear readable silhouette, subdued desaturated colouring",
  },
];

export const trackById = (id: string | undefined) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

/** The laboratory holds six capsules, and every slot has the same shape. */
export const CAPSULES = 6;
