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
      <coneGeometry args={[radius, height, 24, 1, true]} />
    </mesh>
  );
}

/* The fluid pulses. Every few seconds a band of the capsule's own colour
   rises through it, ripples slightly on its way up, and is gone; between
   pulses the tube barely breathes. Each capsule runs on its own clock so the
   six never fire together. Additive, so it reads as light in the fluid rather
   than paint on the glass. */
const PULSE_FRAG = `
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSeed;

  void main() {
    // Period differs per capsule, so the room does not blink in unison.
    float period = 4.5 + uSeed * 3.0;
    float t = mod(uTime + uSeed * 17.0, period);
    float travel = 1.6;
    float live = 1.0 - step(travel, t);
    float pos = t / travel;

    // The band ripples around the tube as it climbs, so it reads as a wave in
    // fluid rather than a scanner line on glass.
    float ripple = sin(vUv.x * 6.2832 * 3.0 + t * 5.0) * 0.035;
    float d = vUv.y - pos + ripple;
    float band = exp(-d * d * 90.0);
    // Softer trail behind the crest than ahead of it.
    float trail = exp(-max(d, 0.0) * 14.0) * 0.35;
    float pulse = live * (band + trail);
    // Ease in as it leaves the floor and out as it reaches the rim.
    pulse *= smoothstep(0.0, 0.15, pos) * (1.0 - smoothstep(0.85, 1.0, pos));

    // Faint idle breathing so the fluid never looks switched off.
    float idle = 0.035 + 0.025 * sin(uTime * 0.9 + vUv.y * 4.0 + uSeed * 6.2832);

    float a = (pulse * 0.85 + idle);
    a *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function Pulse({ radius = 0.86, height = 2.5, color = 0xd8f2ff, seed = Math.random() }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: PULSE_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: [0, 0, 0] }, uSeed: { value: seed } },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useMemo(() => {
    const c = color;
    mat.uniforms.uColor.value = [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }, [mat, color]);
  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt;
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
  // Shared between all six capsules, so no need to memoise per instance.
  const map = glowTexture();
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
