import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, DoubleSide, ShaderMaterial } from "three";
import { glowTexture } from "./textures";

/* Two small shaders the capsules wear. Raw GLSL rather than TSL, deliberately:
   TSL needs its own renderer and the splats already own this canvas. */

const VERT = `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPosV = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

/* A cone of light. A flat basic material with tone mapping off clips to a hard
   white wedge; this falls off along its length and at the silhouette instead,
   which is what the eye reads as soft, and it stays inside the tone curve. */
const SHAFT_FRAG = `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main() {
    // Brightest at the lamp and thinning all the way down, the way a beam in
    // haze actually falls off. It never reaches full dark at the tube, so no
    // edge is visible where the cone ends.
    float body = smoothstep(0.0, 0.85, vUv.y);
    // Take the very apex down a little, or the cone's point is a hot spike.
    body *= 1.0 - smoothstep(0.93, 1.0, vUv.y) * 0.65;

    // Edge-on to the camera is where a hard outline would show, so lose it there.
    float facing = abs(dot(normalize(vNormalV), normalize(-vPosV)));
    float rim = smoothstep(0.0, 0.6, facing);

    // Slow drifting motes, so the shaft is never a flat wash.
    float dust = 0.86 + 0.14 * hash(floor(vec2(vUv.x * 60.0, vUv.y * 26.0 - uTime * 0.35)));

    float a = body * rim * dust * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/* `base` is where the cone meets the top of the glass; the apex is the lamp. */
export function LightShaft({
  radius = 1.7,
  height = 2.0,
  base = 2.9,
  color = 0xbcd9ea,
  strength = 0.62,
}) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: SHAFT_FRAG,
        uniforms: {
          uColor: { value: [0, 0, 0] },
          uTime: { value: 0 },
          uStrength: { value: strength },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [strength],
  );
  useMemo(() => {
    const c = color;
    mat.uniforms.uColor.value = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }, [mat, color]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
  });
  return (
    <mesh position={[0, base + height / 2, 0]} material={mat}>
      <coneGeometry args={[radius, height, 40, 1, true]} />
    </mesh>
  );
}

/* Bubbles rising through the fluid. Three sparse layers on a cylinder just
   inside the glass: each cell either holds a bubble or does not, and the whole
   grid slides upward, so nothing has to be simulated or stored. */
const BUBBLE_FRAG = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float layer(vec2 uv, float cols, float rows, float speed, float seed) {
    vec2 g = vec2(uv.x * cols, (uv.y - uTime * speed) * rows);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id + seed);
    // Most cells stay empty, so the fluid reads as still water with the odd bubble.
    float present = step(0.78, h);
    // Wobble, because a bubble does not rise in a straight line.
    f.x += sin(uTime * 1.7 + h * 30.0) * 0.16;
    float r = 0.055 + 0.075 * fract(h * 41.0);
    float d = length(f * vec2(cols / rows, 1.0));
    float body = smoothstep(r, r * 0.25, d);
    // A brighter crescent on one side reads as a highlight on a sphere.
    float lit = smoothstep(r * 1.1, r * 0.2, length((f - vec2(0.22, 0.24) * r * 6.0) * vec2(cols / rows, 1.0)));
    return present * (body * 0.55 + lit * 0.45);
  }

  void main() {
    float a = layer(vUv, 9.0, 5.0, 0.030, 0.0)
            + layer(vUv, 14.0, 8.0, 0.048, 7.3)
            + layer(vUv, 20.0, 12.0, 0.070, 19.1);
    // Thin out at the very top and bottom so bubbles do not pop at the seams.
    a *= smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.90, 1.0, vUv.y));
    a = clamp(a, 0.0, 1.0) * 0.85;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function Bubbles({ radius = 0.86, height = 2.5, color = 0xd8f2ff }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: BUBBLE_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: [0, 0, 0] } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [],
  );
  useMemo(() => {
    const c = color;
    mat.uniforms.uColor.value = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }, [mat, color]);
  const started = useRef(Math.random() * 40);
  useFrame((_, dt) => {
    started.current += dt;
    mat.uniforms.uTime.value = started.current;
  });
  return (
    <mesh position={[0, 1.66, 0]} material={mat}>
      <cylinderGeometry args={[radius, radius, height, 36, 1, true]} />
    </mesh>
  );
}

/* Where the beam lands. A radial decal just above the deck, so the light has
   somewhere to end instead of stopping in mid air at the base of the cone. */
export function FloorGlow({ radius = 2.1, color = 0x8fd4ef, opacity = 0.5 }) {
  const map = useMemo(() => glowTexture(), []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshBasicMaterial
        map={map}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
