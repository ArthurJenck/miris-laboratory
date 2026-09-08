import { useFrame, useThree } from "@react-three/fiber";
import { Miris } from "@miris-inc/three";
import { useEffect, useRef } from "react";
import { getBudget, reportBudget } from "./budget";

/* This SDK build carries an adaptive splat budget, the reason it is vendored:
   six streams at once and a camera that walks up to one need the budget to
   give as the frame rate does. But nothing in the build starts it. The
   controller is owned by the Miris singleton behind an internal
   _startAdaptiveBudget(scene), and only the SDK's own lab page calls it, so
   here every stream drew at the engine's default and focusing a capsule fell
   from ninety frames a second to under twenty and stayed there.

   The controller expects a MirisScene, with `coreScene` and `miris` on it.
   The stage is a plain R3F scene, which the SDK pairs with a core scene the
   moment the first stream is added, keyed on the three scene. The two getters
   are added here so the plain scene passes for one. Measured: focus holds
   above eighty frames a second with this, under twenty without.

   The readout's slider pins the budget. Pinned, the controller is stopped and
   the override set by hand, because the controller re-applies its own number
   every tick and would win; released, it starts again from where it was.

   Worth filing against the SDK: start the controller when the first stream
   connects. If it does, this guard can go. */
export default function BudgetGuard() {
  const scene = useThree((s) => s.scene);
  const miris = useRef<any>(null);
  const started = useRef(false);
  const pinned = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    // instance() is on the core class, which the three typings do not surface.
    (Miris as any).instance().then((m: any) => {
      if (live) miris.current = m;
    });
    return () => {
      live = false;
      if (started.current) miris.current?._stopAdaptiveBudget?.();
    };
  }, []);

  useFrame(() => {
    const m = miris.current;
    if (!m) return;
    if (!started.current) {
      // The core scene appears with the first stream, not before.
      const core = [...(m.scenes ?? [])].find((c: any) => c.key === scene);
      if (!core) return;
      Object.defineProperty(scene, "coreScene", { get: () => core, configurable: true });
      Object.defineProperty(scene, "miris", { get: () => m, configurable: true });
      m._startAdaptiveBudget(scene);
      started.current = true;
    }

    const want = getBudget().pinned;
    if (want !== pinned.current) {
      if (want === null) {
        m._startAdaptiveBudget(scene);
      } else {
        m._stopAdaptiveBudget?.();
        m._setSplatCountBudgetOverride?.(want);
      }
      pinned.current = want;
    }

    const status = m._adaptiveBudgetStatus;
    reportBudget({
      live: !!status?.running || want !== null,
      budget: want ?? status?.budget ?? m._splatCountBudget ?? 0,
    });
  });

  return null;
}
