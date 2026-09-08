import { useFrame } from "@react-three/fiber";
import { Component, type ReactNode, useRef, useSyncExternalStore } from "react";
import { Object3D, Vector3 } from "three";
import { TINTS } from "./config";
import { getSelected, labVersion, subscribeLab } from "./labState";
import { getScreenOutput, setScreenSource } from "./ScreenFx";

/* A lectern in front of each tube, on the walkway between the middle of the
   room and the glass, its top tilted toward whoever stands in the middle. The
   top is a screen; what it shows is the child's business. */
export const PEDESTAL_RING = 3.2;
/* Short enough that the tilted head's near edge (0.8 minus half its depth
   times sin 30, about 0.64) clears the top of it; taller, the body poked
   through the screen as a dark band. */
const BODY = { w: 0.9, h: 0.6, d: 0.42 };
const HEAD_Y = 0.8;
const TILT = 0.52; // about thirty degrees toward the middle of the room
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
  const at = (x: number, z: number) => head.localToWorld(new Vector3(x, 0.03, z));
  const center = at(0, 0);
  const normal = head.localToWorld(new Vector3(0, 1.03, 0)).sub(center).normalize();
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
  useSyncExternalStore(subscribeLab, labVersion, labVersion);
  const selected = getSelected();
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

function Pedestal({ i, specimen, specimens, active, children }: { i: number; specimen: any; specimens: any[]; active: boolean; children: (d: any) => ReactNode }) {
  const a = (i / 6) * Math.PI * 2;
  const screenGroup = useRef<any>(null);
  const painted = useRef<any>(null);

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
    if (mat.map && mat.map !== out) painted.current = mat.map;
    const want = active && out && painted.current ? out : painted.current;
    if (active && painted.current) setScreenSource(painted.current);
    if (want && mat.map !== want) {
      mat.map = want;
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
        <meshStandardMaterial color={0x0b0f14} roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, BODY.d / 2 + 0.002]}>
        <boxGeometry args={[BODY.w - 0.06, 0.012, 0.004]} />
        <meshBasicMaterial color={TINTS[i]} toneMapped={false} />
      </mesh>
      <group position={[0, HEAD_Y, 0.05]} rotation={[TILT, 0, 0]}>
        <mesh>
          <boxGeometry args={[SCREEN.w + 0.08, 0.05, SCREEN.h + 0.08]} />
          <meshStandardMaterial color={0x080b0f} roughness={0.5} metalness={0.5} />
        </mesh>
        {/* A plane faces +Z; laid flat here its normal is the head's up, and the
            top of the picture points away from the reader, as a page does. */}
        <group ref={screenGroup} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Quietly>{children(file)}</Quietly>
        </group>
      </group>
    </group>
  );
}

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
