import { createRoot } from "react-dom/client";
import Stage from "./stage";
import MirisGuide from "../miris/Guide";
import StageBoundary from "../miris/StageBoundary";
import ReferenceStage from "../miris/stage.reference";
import { referenceData } from "../miris/referenceData";

const reference = new URLSearchParams(location.search).get('view') === 'reference';

createRoot(document.getElementById("root")!).render(
  <>
    <StageBoundary>
      {reference ? <ReferenceStage initialData={referenceData} /> : <Stage />}
    </StageBoundary>
    {reference ? <a className="mw-reference-return" href="/">Completed reference · Back to my build</a> : <MirisGuide />}
  </>,
);
