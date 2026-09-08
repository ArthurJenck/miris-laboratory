import { useEffect, useSyncExternalStore } from "react";
import { VIEWER_KEY as DEMO_KEY } from "./config";

/* The room's data: which specimens exist and the viewer key that reads them.
   Fetched once, from the dev API in the workshop and from the build's snapshot
   once published, and shared by everything that asks. */
let data: any = null;
let started = false;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const get = () => data;
const emit = () => subs.forEach((f) => f());

/** Hands the room its data directly instead of fetching: the reference view. */
export function seedLab(next: any) {
  started = true;
  data = next;
  emit();
}

function load() {
  if (started) return;
  started = true;
  fetch(import.meta.env.PROD ? "/miris-scene.json" : "/api/miris")
    .then((r) => r.json())
    .then((d) => {
      data = d;
      emit();
    })
    .catch(() => {
      data = {};
      emit();
    });
}

export interface Lab {
  /** Six slots, in growth order. Empty until the data arrives. */
  specimens: any[];
  /** One key reads every capsule. */
  viewerKey: string;
  /** True once there is a room to draw. */
  ready: boolean;
}

/** The specimens and the key that reads them. */
export default function useLab(): Lab {
  const d = useSyncExternalStore(subscribe, get, get);
  useEffect(load, []);
  return { specimens: d?.specimens ?? [], viewerKey: d?.viewerKey || DEMO_KEY, ready: Boolean(d?.track) };
}
