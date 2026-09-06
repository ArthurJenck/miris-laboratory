/* One capsule's worth of state. Six of these hang off data.json, and both the
   store and the dev API build slots from this so the shape cannot drift. */
export const CAPSULES = 6;

export const emptySpecimen = (id) => ({
  id,
  // empty -> drawn -> building -> ready -> live. `live` means a uuid is in the
  // stage file and the capsule is actually streaming.
  status: "empty",
  prompt: "",
  imageUrl: "",
  falRequestId: "",
  // Epoch ms while a mesh build is in flight, 0 otherwise, so a reloaded page
  // resumes the building state instead of re-offering the review.
  modelStartedAt: 0,
  glb: "",
  uuid: "",
  dossier: null,
});

export const emptyBank = () =>
  Array.from({ length: CAPSULES }, (_, i) => emptySpecimen(String(i + 1).padStart(2, "0")));

/** Merges stored slots over fresh ones, so a short or corrupt array still
 *  yields exactly six capsules with every field present. */
export const normaliseBank = (stored) => {
  const bank = emptyBank();
  if (!Array.isArray(stored)) return bank;
  return bank.map((slot, i) => (stored[i] && typeof stored[i] === "object" ? { ...slot, ...stored[i], id: slot.id } : slot));
};
