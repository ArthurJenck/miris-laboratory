import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

/* The SDK's SporkHdrPass renders the whole scene into an fp16 target and
   composites it back with a shader that assumes every texel is already
   sRGB-encoded. That is true of the splats, whose own shader pre-encodes, and
   false of everything three draws: three writes linear into any render target
   that is not an XR target, whatever the target is tagged. So with a stream in
   the scene the glass, the rings, the deck and the door all came back with no
   transfer curve applied: uniformly dark, while the specimen looked right. One
   stream or six, the same.

   The pass has a switch. `suspended` makes bypassed() true, the bind stops
   redirecting the render, the composite stops writing, and three draws to the
   canvas as normal. What is given up is fp16 headroom on very bright splats,
   which these are not. Found by walking the scene for the meshes that carry
   the pass; they arrive once the first stream does. */
export default function HdrGuard() {
  const done = useRef(false);
  useFrame(({ scene }) => {
    if (done.current) return;
    scene.traverse((o: any) => {
      const pass = o?.pass;
      if (pass && typeof pass === "object" && "suspended" in pass && pass.suspended !== true) {
        pass.suspended = true;
        done.current = true;
      }
    });
  });
  return null;
}
