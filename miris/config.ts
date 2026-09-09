export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

/* The growth series is one fal workflow: the plan, six dossiers, six chained
   renders and six meshes. Its prompts and model settings live there, not here.
   https://fal.ai/workflows/dexhonsa/miris-growth-series-v3 */
export const GROWTH_WORKFLOW = "workflows/dexhonsa/miris-growth-series-v3";
export const PORTAL_URL = "https://app.miris.com";

export const FAL_URL = "https://fal.ai";
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";
export const FAL_CREDITS_URL = "https://fal.ai/dashboard/usage-billing/credits";
export const VERCEL_URL = "https://vercel.com";

/* The dossier's closed vocabulary. A status outside this set would break the
   colour of the dot beside it, and stats of varying length cannot be laid out. */
export const STATUSES = ["STABLE", "DORMANT", "VOLATILE", "BREACHED"] as const;
export const STAT_LABELS = ["VITALITY", "AGGRESSION", "BIOELECTRIC", "COHESION"] as const;

/* One creature, six stages. The names are the model's to invent, but the count
   is fixed: six capsules, six stages, and a card that cannot be laid out if the
   count moves. */
export const STAGES = 6;
