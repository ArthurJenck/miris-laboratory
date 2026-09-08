import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Component, memo, type ReactNode, useRef, useSyncExternalStore } from "react";
import { Object3D, Vector3, type Texture } from "three";
import { VaultLabel } from "./VaultRoom";
import { getSelected, getSelectedPart, subscribeLab } from "./labState";
import { getScreenOutput, setScreenSource } from "./ScreenFx";

// The focus camera and hit boxes share the exact screen transform below.
export const PEDESTAL_RING = 3.2;
const BODY = { w: 0.9, h: 0.6, d: 0.42 };
const HEAD_Y = 0.95;
const TILT = 0.65;
export const SCREEN = { w: 0.9, h: 0.5625 };

const yawOf = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a));

export interface ScreenFrame {
  center: Vector3;
  normal: Vector3;
  corners: Vector3[];
}

/** Where pedestal i's screen is in the world: centre, normal and corners, for
 *  the camera that reads it and the readout that brackets it. */
const frames = new Map<number, ScreenFrame>();
export function screenFrame(i: number): ScreenFrame {
  const known = frames.get(i);
  if (known) return known;
  const a = (i / 6) * Math.PI * 2;
  const root = new Object3D();
  root.position.set(Math.cos(a) * PEDESTAL_RING, 0, Math.sin(a) * PEDESTAL_RING);
  root.rotation.y = yawOf(a);
  const head = new Object3D();
  head.position.set(0, HEAD_Y, 0.05);
  head.rotation.x = TILT;
  root.add(head);
  root.updateMatrixWorld(true);
  const at = (x: number, z: number) => head.localToWorld(new Vector3(x, 0.108, z));
  const center = at(0, 0);
  const normal = head.localToWorld(new Vector3(0, 1.108, 0)).sub(center).normalize();
  const hw = SCREEN.w / 2;
  const hh = SCREEN.h / 2;
  const f = { center, normal, corners: [at(-hw, -hh), at(hw, -hh), at(hw, hh), at(-hw, hh)] };
  frames.set(i, f);
  return f;
}

/** Six pedestals, one per specimen with a file. The child paints a file from
 *  the dossier it is handed and returns a plane; the pedestal scales that
 *  plane to its screen. The selected pedestal's screen shows the glitch pass,
 *  when there is one; the others show the file as painted. */
export default function Pedestals({ specimens = [] as any[], children }: { specimens?: any[]; children: (d: any) => ReactNode }) {
  const selected = useSyncExternalStore(subscribeLab, getSelected, getSelected);
  return (
    <>
      {specimens.map((s, i) =>
        s?.dossier ? (
          <Pedestal key={s.id ?? i} i={i} specimen={s} specimens={specimens} active={selected === i}>
            {children}
          </Pedestal>
        ) : null,
      )}
    </>
  );
}

const Pedestal = memo(function Pedestal({ i, specimen, specimens, active, children }: { i: number; specimen: any; specimens: any[]; active: boolean; children: (d: any) => ReactNode }) {
  const a = (i / 6) * Math.PI * 2;
  const screenGroup = useRef<any>(null);
  const painted = useRef<Texture | null>(null);
  const appliedEffect = useRef<Texture | null>(null);

  useFrame(() => {
    const g = screenGroup.current;
    if (!g) return;
    let plane: any = null;
    g.traverse((o: any) => {
      if (!plane && o.isMesh && o.geometry?.type === "PlaneGeometry") plane = o;
    });
    if (!plane?.material) return;
    const { width: w, height: h } = plane.geometry.parameters;
    g.scale.setScalar(Math.min(SCREEN.w / w, SCREEN.h / h));
    const mat = plane.material;
    const out = getScreenOutput();
    // Remember the painted texture, whatever the glitch pass swaps in.
    if (mat.map && mat.map !== appliedEffect.current) painted.current = mat.map;
    const want = active && getSelectedPart() === "pedestal" && out && painted.current ? out : painted.current;
    if (active && painted.current) setScreenSource(painted.current, i);
    if (want && mat.map !== want) {
      mat.map = want;
      appliedEffect.current = want === out ? out : null;
      mat.needsUpdate = true;
    }
  });

  // One object for the child: the dossier, plus where this specimen sits in
  // the series, since a file that cannot say which stage it is fails at its job.
  const file = { ...specimen.dossier, stage: specimen.stage ?? "", index: i, stages: specimens.map((x: any) => x?.stage ?? "") };

  return (
    <group position={[Math.cos(a) * PEDESTAL_RING, 0, Math.sin(a) * PEDESTAL_RING]} rotation={[0, yawOf(a), 0]}>
      <mesh position={[0, BODY.h / 2, 0]}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
        <meshStandardMaterial color={0x657d87} roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, BODY.d / 2 + 0.002]}>
        <boxGeometry args={[BODY.w - 0.06, 0.012, 0.004]} />
        <meshBasicMaterial color={active ? 0xc9ebff : 0x729fb7} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.07, 0]}><boxGeometry args={[1.05, 0.14, 0.66]} /><meshStandardMaterial color="#253b49" metalness={0.65} roughness={0.5} /></mesh>
      <mesh position={[0, 0.55, -0.08]}><boxGeometry args={[0.6, 0.5, 0.32]} /><meshStandardMaterial color="#445e6b" metalness={0.5} roughness={0.5} /></mesh>
      {[0, 1, 2, 3, 4].map(n => <mesh key={n} position={[0, 0.22 + n * 0.045, BODY.d / 2 + 0.004]}><boxGeometry args={[0.55, 0.015, 0.012]} /><meshStandardMaterial color="#172c38" /></mesh>)}
      <group position={[0, 0.48, BODY.d / 2 + 0.008]}><VaultLabel text={"BIO / " + String(i + 1).padStart(2, "0")} width={0.46} height={0.075} /></group>
      <group position={[0, HEAD_Y, 0.05]} rotation={[TILT, 0, 0]}>
        <RoundedBox args={[SCREEN.w + 0.22, 0.18, SCREEN.h + 0.25]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color={0x83969a} roughness={0.5} metalness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.095, 0]}><boxGeometry args={[SCREEN.w + 0.045, 0.015, SCREEN.h + 0.04]} /><meshStandardMaterial color="#101f2a" roughness={0.4} /></mesh>
        {[-0.47, 0.47].map(x => <mesh key={x} position={[x, 0.098, 0.345]}><cylinderGeometry args={[0.026, 0.026, 0.015, 12]} /><meshStandardMaterial color="#233e4f" metalness={0.7} roughness={0.4} /></mesh>)}
        <mesh position={[0.36, 0.101, 0.345]}><sphereGeometry args={[0.013, 8, 8]} /><meshBasicMaterial color={active ? "#cbecff" : "#6893ae"} /></mesh>
        {/* A plane faces +Z; laid flat here its normal is the head's up, and the
            top of the picture points away from the reader, as a page does. */}
        <group ref={screenGroup} position={[0, 0.108, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Quietly>{children(file)}</Quietly>
        </group>
      </group>
    </group>
  );
});

/* The child is the attendee's code mid-edit. A throw there should cost the
   screen, not the room. */
class Quietly extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("The file's markup or paint threw; showing no screen until it is fixed.", e);
  }
  componentDidUpdate(prev: { children: ReactNode }) {
    if (this.state.failed && prev.children !== this.props.children) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
