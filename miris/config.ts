export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

export const IMAGE_MODEL = "openai/gpt-image-2";
/* Meshy reconstructs everything in frame, so the render must be the asset and
 * nothing else. GPT Image 2 reads "fantasy creature" as an invitation to
 * concept-sheet furniture: palette swatches, a scale-figure silhouette, a
 * side-view thumbnail, all of which end up in the mesh. Refuse each by name. */
export const IMAGE_FRAMING =
  "Render exactly one subject, whole body centered and fully in frame, on a plain seamless studio backdrop. " +
  "No text, no labels, no color palette swatches, no scale-reference silhouettes or human figures, " +
  "no alternate views or thumbnails, no props. " +
  // Whatever the subject rests on is photographed as part of it and becomes
  // part of the mesh: an egg on a rock arrives in the capsule as a rock.
  "The subject alone, with nothing beneath or behind it: no rock, substrate, nest, branch, perch, ground " +
  "plane or mound. A single clean reference render, not a concept sheet.";
export const MODEL_3D = "meshy/v7/image-to-3d";
export const LABEL_MODEL = "openrouter/router";
export const LABEL_LLM = "google/gemini-2.5-flash";
export const PORTAL_URL = "https://app.miris.com";

/* Viewer keys the presenters scoped to series grown in advance, one per line.
   Offered under "I already have a series" at step 1.2, so anyone whose fal
   account is blocked or whose run failed is streaming in a minute. Public by
   design: a viewer key ships in every published lab anyway. Empty hides the
   buttons. */
export const FALLBACK_KEYS: { label: string; key: string }[] = [];
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";

// Authorises every stream. Cold start is 6 to 9s; warming it early does not help.
export const JWKS_URL = "https://app.miris.com/.well-known/jwks.json";

/* One tint per capsule, sampled from the reference: mostly cool, with two warm
   outliers so the ring of six does not read as a single colour. */
export const TINTS = [0x3bd6fe, 0x2fc0aa, 0x5f7fd0, 0xc4443f, 0x3bd6fe, 0x7f68c0];

/* The dossier's closed vocabulary. A status outside this set would break the
   colour of the dot beside it, and stats of varying length cannot be laid out. */
export const STATUSES = ["STABLE", "DORMANT", "VOLATILE", "BREACHED"] as const;
export const STAT_LABELS = ["VITALITY", "AGGRESSION", "BIOELECTRIC", "COHESION"] as const;

/* One creature, six stages. The names are the model's to invent, but the count
   is fixed: six capsules, six stages, and a card that cannot be laid out if the
   count moves. */
export const STAGES = 6;
