import { createContext } from "react";
import type { Group } from "three";

/** What a Specimen tells the things inside it: which slot it is, the dossier
 *  for that slot with its place in the series, and the group on the pedestal
 *  that Screen draws into. */
export interface SpecimenSlot {
  index: number;
  dossier: any | null;
  screenTarget: Group;
}

export const SpecimenContext = createContext<SpecimenSlot | null>(null);
