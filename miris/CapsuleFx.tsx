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

/* Bubbles rising through the fluid. Three sparse layers on a cylinder just
   inside the glass: each cell either holds a bubble or does not, and the whole
   grid slides upward, so nothing has to be simulated or stored. */
const BUBBLE_FRAG = `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uCircum;
  uniform float uHeight;

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

    // Round means round in world units, not in cell counts. This tube's
    // circumference is a little over twice its height, so a cell is wider
    // than it is tall; correcting by cols/rows instead over-corrected by
    // about half again and stretched every bubble into a vertical oval.
    float aspect = (uCircum / cols) / (uHeight / rows);
    vec2 d2 = f * vec2(aspect, 1.0);
    float r = 0.10 + 0.10 * fract(h * 41.0);
    float d = length(d2);

    // A bubble is a shell: bright where the eye looks through its edge, almost
    // clear through the middle, with one small highlight off to a side. Filling
    // the whole disc is what made these read as sparks rather than air.
    float shell = smoothstep(r, r * 0.82, d) * smoothstep(r * 0.5, r * 0.78, d);
    float fill = smoothstep(r, r * 0.2, d) * 0.10;
    float spec = smoothstep(r * 0.34, 0.0, length(d2 - vec2(-0.30, 0.34) * r));
    return present * (shell * 0.55 + fill + spec * 0.5);
  }

  void main() {
    float a = layer(vUv, 9.0, 5.0, 0.030, 0.0);

    // The far wall of the tube is seen through the fluid, so it gets the one
    // coarse layer at a third strength while the near wall gets the detail.
    // This mesh is double sided, so that is half the fragments in the pass for
    // nothing anyone can point at, and it also stops the two walls' bubbles
    // reading as one crowded field crossing through itself.
    if (gl_FrontFacing) {
      a += layer(vUv, 15.0, 9.0, 0.052, 7.3);
    } else {
      a *= 0.35;
    }

    // Thin out at the very top and bottom so bubbles do not pop at the seams.
    a *= smoothstep(0.0, 0.10, vUv.y) * (1.0 - smoothstep(0.90, 1.0, vUv.y));
    a = clamp(a, 0.0, 1.0) * 0.85;
    // Mostly water, faintly the capsule's colour.
    vec3 col = mix(vec3(0.85, 0.95, 1.0), uColor, 0.35) * a;

    // The glass rim rides along in this pass rather than getting a mesh of its
    // own. Glass is near invisible face on and bright where you look along its
    // curve, and that band at the silhouette is the whole reason the eye reads
    // a round tube instead of a flat tinted panel. Six more transparent
    // cylinders is the one thing this room cannot afford, and the fluid
    // already draws one four centimetres inside the glass.
    float facing = abs(dot(normalize(vNormalV), normalize(-vPosV)));
    float rim = pow(1.0 - facing, 3.0) * 0.55;
    col += uColor * rim;

    gl_FragColor = vec4(col, clamp(a + rim, 0.0, 1.0));
  }
`;

export function Bubbles({ radius = 0.86, height = 2.5, color = 0xd8f2ff }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: BUBBLE_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: [0, 0, 0] },
          // What the shader needs to keep a bubble round: the tube's real
          // proportions, so changing the radius or height here cannot silently
          // go back to stretching them.
          uCircum: { value: 2 * Math.PI * radius },
          uHeight: { value: height },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [radius, height],
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
      <cylinderGeometry args={[radius, radius, height, 28, 1, true]} />
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
