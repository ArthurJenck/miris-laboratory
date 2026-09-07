import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mirisDevApi } from "./miris/devApi";
import { mirisSnapshot } from "./miris/snapshot";

export default defineConfig(({ mode }) => {
  return {
    // The dev API reads FAL_KEY itself, per request, so it never reaches the
    // client and a key added mid-session needs no restart.
    plugins: [react(), mirisDevApi(mode), mirisSnapshot()],
    server: {
      port: 3000,
      // strictPort so the workshop's own instructions stay true: if 3000 is
      // taken, fail loudly rather than silently moving to 3001.
      strictPort: true,
      // host so the dev server binds beyond localhost. In a WebContainer
      // (bolt.new, StackBlitz) the preview is proxied from outside the
      // process, and a localhost-only bind leaves it stuck on "Waiting for
      // preview to load" while the terminal happily reports Vite as ready.
      host: true,
    },
    preview: { port: 3000, strictPort: true, host: true },
    optimizeDeps: {
      // The SDK ships prebuilt ESM with WASM alongside it. Leaving it out of
      // dependency pre-bundling keeps esbuild from rewriting the WASM fetch paths.
      exclude: ["@miris-inc/core", "@miris-inc/three"],
      // Everything the excluded SDK imports, plus the WebGPU/TSL entrypoints,
      // has to be named here. Vite cannot scan inside an excluded package, so
      // it meets these imports for the first time as the browser asks for
      // them, re-optimizes, and reloads. During that window the page holds two
      // copies of @react-three/fiber: drei then reads a different React
      // context than <Canvas> wrote, and every drei hook throws "R3F: Hooks
      // can only be used within the Canvas component!" from inside the Canvas.
      include: [
        "three",
        "three/tsl",
        "three/webgpu",
        "three/addons/loaders/GLTFLoader.js",
        "three/addons/loaders/DRACOLoader.js",
        "three/addons/loaders/HDRLoader.js",
        "@react-three/fiber",
        "@react-three/drei",
      ],
    },
  };
});
