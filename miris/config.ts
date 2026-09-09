export const VIEWER_KEY = "4YIGMPUj5-fL8n0jkp1kQpJktss_UaBDMW9jwJb08f4";
export const DEMO_UUID = "2b21e89f-ef5d-4175-bbdf-03e8649bcb76";

/* The growth series is one fal workflow: the plan, six dossiers, six chained
   renders and six meshes. Its prompts and model settings live there, not here.
   https://fal.ai/workflows/dexhonsa/miris-growth-series-v2 */
export const GROWTH_WORKFLOW = "workflows/dexhonsa/miris-growth-series-v2";
export const PORTAL_URL = "https://app.miris.com";

/* Viewer keys the presenters scoped to series grown in advance, one per line.
   Offered under "I already have a series" at step 1.2, so anyone whose fal
   account is blocked or whose run failed is streaming in a minute. Public by
   design: a viewer key ships in every published lab anyway. Empty hides the
   buttons. */
export const FALLBACK_KEYS: { label: string; key: string }[] = [];
export const FAL_KEYS_URL = "https://fal.ai/dashboard/keys";

/* The dossier's closed vocabulary. A status outside this set would break the
   colour of the dot beside it, and stats of varying length cannot be laid out. */
export const STATUSES = ["STABLE", "DORMANT", "VOLATILE", "BREACHED"] as const;
export const STAT_LABELS = ["VITALITY", "AGGRESSION", "BIOELECTRIC", "COHESION"] as const;

/* One creature, six stages. The names are the model's to invent, but the count
   is fixed: six capsules, six stages, and a card that cannot be laid out if the
   count moves. */
export const STAGES = 6;
