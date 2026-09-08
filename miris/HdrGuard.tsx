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
  useFrame(({ scene, gl }) => {
    /* The second thing the SDK's renderer leaves behind: it sets the GL
       unpack-flip flag itself, and three only re-sends that flag when its own
       cached value changes. So whether a texture uploaded the right way up
       depended on what the SDK had left in the register, which is why the
       painted file came out mirrored some of the time and the glitch copy
       flipped from one load to the next. Make the cache and the register agree
       at the top of every frame; three then sends the flag whenever a texture
       wants the other value. */
    const ctx = gl.getContext();
    ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, 0);
    (gl.state as any).pixelStorei?.(ctx.UNPACK_FLIP_Y_WEBGL, false);
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
