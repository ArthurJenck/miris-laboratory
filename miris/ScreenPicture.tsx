import { useEffect, useState } from "react";
import { SRGBColorSpace, type Texture, TextureLoader } from "three";
import { screenImagePath } from "./renderPath";

/** A screen for browsers that cannot draw HTML into a canvas: the picture of
 *  this slot's file that the workshop captured, on the same plane the File
 *  would have used, so the pedestal scales it and the glitch reads it exactly
 *  as it would the live canvas. */
export default function ScreenPicture({ index }: { index: number }) {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    let live = true;
    const loaded = new TextureLoader().load(
      screenImagePath(index),
      (t) => {
        t.colorSpace = SRGBColorSpace;
        if (live) setTexture(t);
      },
      undefined,
      () => console.warn(`[miris] no captured screen for specimen ${index + 1}. Open the room in Chrome with the flag on and it is saved for you.`),
    );
    return () => {
      live = false;
      loaded.dispose();
      setTexture(null);
    };
  }, [index]);

  if (!texture) return null;
  // 1280 by 800, as the File's canvas is, so the picture lands where the live screen would.
  return (
    <mesh>
      <planeGeometry args={[1.6, 1]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
