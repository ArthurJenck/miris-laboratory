import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { Fn, float, hash, step, texture, time, uv, vec2, vec3, vec4 } from "three/tsl";
import {
  Scene,
  Floor,
  Platform,
  Walkway,
  Door,
  Specimen,
  Screen,
  Readout,
  ScreenFx,
  screenTexture,
} from "../miris";
import specimens from "./specimens.json" with { type: "json" };

// The viewer key you scoped to your six assets. Every stream reads through it.
const viewerKey = "R3vFSusdceQ4yNjYfiZ66_yxZGpM3UN2RtoPXzlv_nw";

// miris:markup-start
const fileMarkup = (dossier: any) => "";
// miris:markup-end

// miris:parts-start
function File({ dossier }: any) {
  return null;
}
// miris:parts-end

// Your file. Each step's code goes between the miris: comments.
export default function Stage() {
  // miris:field-start
  const glitch = null;
  // miris:field-end

  return (
    <>
      <Scene>
        {/* miris:scene-start */}
        <Floor />
        <Platform />
        <Walkway />
        <Door />
        {specimens.map((specimen, index) => (
          <Specimen key={index}>
            <mirisStream args={[{ uuid: specimen.uuid, viewerKey }]} scale={specimen.scale} />
          </Specimen>
        ))}
        {/* miris:scene-end */}
      </Scene>

      {/* miris:hud-start */}
      <Readout />
      <ScreenFx node={glitch} />
      {/* miris:hud-end */}
    </>
  );
}
