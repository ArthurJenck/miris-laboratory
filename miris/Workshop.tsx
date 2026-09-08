import { type ComponentType, lazy, Suspense } from "react";
import MirisGuide from "./Guide";
import { referenceData } from "./referenceData";
import { StageSkeleton } from "./Skeleton";
import StageBoundary from "./StageBoundary";
import { seedLab } from "./useLab";

// The finished lab, at /?view=reference, drawn from recorded data.
const ReferenceStage = lazy(() => import("./stage.reference"));
const reference = new URLSearchParams(location.search).get("view") === "reference";
if (reference) seedLab(referenceData);

/** Mounts your stage beside the guide. The guide renders nothing in a
 *  published build, so `guide={false}` is a choice, not a step. */
export default function Workshop({ stage: Stage, guide = true }: { stage: ComponentType; guide?: boolean }) {
  return (
    <>
      <StageBoundary>
        {reference ? (
          <Suspense fallback={<StageSkeleton />}>
            <ReferenceStage />
          </Suspense>
        ) : (
          <Stage />
        )}
      </StageBoundary>
      {reference ? (
        <a className="mw-reference-return" href="/">Completed reference · Back to my build</a>
      ) : guide ? (
        <MirisGuide />
      ) : null}
    </>
  );
}
