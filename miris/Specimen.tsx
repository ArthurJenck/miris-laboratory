import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Children, isValidElement, memo, type ReactNode, useMemo, useRef, useSyncExternalStore } from "react";
import { DoubleSide, Group, type Texture } from "three";
import { FloorGlow, LightShaft, Pulse } from "./CapsuleFx";
import { Label, Ring, blue, enamel, radial, steel } from "./hardware";
import { getSelected, getSelectedPart, subscribeLab } from "./labState";
import { CAPSULES, GLASS, GLASS_CENTRE, GLASS_TOP, HEAD, SCREEN, capsulePlacement, pedestalPlacement } from "./layout";
import { getScreenOutput, setScreenSource } from "./ScreenFx";
import { SpecimenContext } from "./specimenContext";
import StaticInstances from "./StaticInstances";
import useLab from "./useLab";

/* One capsule is a glass tube standing on the ring, with a cap at each end,
   two posts behind it, a lamp above it and a label on the front. The glass
   sets the size; the other parts are placed relative to it. In front of it
   stands the pedestal whose screen shows the specimen's file. */
const CAP = { radiusTop: 1.08, radiusBottom: 1.16, thickness: 0.32 };
const BOLT = { radius: 0.045, height: 0.04 };
const POST = { offset: 0.74, width: 0.13, height: 2.8, depth: 0.19, behind: 0.7 };
const STRIP = { width: 0.035, height: 2.35, depth: 0.025, behind: 0.59 };
const LAMP = { y: 4.98, radiusTop: 0.45, radiusBottom: 0.58, thickness: 0.16, faceRadius: 0.42, stemRadius: 0.08, stemHeight: 0.6 };
const LABEL = { standoff: 1.1, width: 0.95, height: 0.15 };
const BODY = { w: 0.9, h: 0.6, d: 0.42 };

const SMOOTH = 48; // segments for anything round that is seen up close
const COARSE = 32; // segments for the lamp, which is far overhead

const COLOR = { bolt: "#172932", lampFace: "#d2ebff", glassTint: "#a4dcff", glow: 0x94cfff, shaft: 0xa4dcff };

const capBolts = radial(12, 1, 0.18).map(({ position }) => ({ position }));

/** What a screen shows for a stage the registrar has not filed yet: the same
 *  shape as a real dossier, saying so, with no invented biology in it. */
const pendingRecord = (stage: string) => ({
  designation: "PENDING",
  series: "UNFILED",
  name: stage.toUpperCase(),
  classification: "Record not yet filed",
  status: "DORMANT",
  stats: [],
  notes: "The registrar has not filed this specimen. Its record arrives with the rest of the series, and this screen repaints on its own when it does.",
});

export interface SpecimenProps {
  /** Which of the six slots round the ring this one stands in. Scene fills it
   *  in from the order the Specimens appear, so it is rarely written. */
  index?: number;
  /** What stands in the glass, usually one stream, and a Screen for the pedestal. */
  children?: ReactNode;
}

/** One containment capsule and the pedestal in front of it. Whatever is put
 *  inside stands in the middle of the glass; a Screen inside lands on the
 *  pedestal instead. */
export default function Specimen({ index = 0, children }: SpecimenProps) {
  const { position, facing } = capsulePlacement(index);
  const selected = useSyncExternalStore(subscribeLab, getSelected, getSelected);
  const label = `SPECIMEN / ${String(index + 1).padStart(2, "0")}`;

  // The workshop's dossier for this slot, with the stage and where it sits in
  // the series, held stable so the screen does not repaint every frame. A
  // stage that is named but not yet filed gets a pending record, so the screen
  // shows the attendee's own File rather than nothing.
  const { specimens: records } = useLab();
  const record = records[index];
  const dossier = useMemo(() => {
    if (!record?.dossier && !record?.stage) return null;
    const filed = record.dossier ?? pendingRecord(record.stage);
    return { ...filed, stage: record.stage ?? "", index, stages: records.map((each: any) => each?.stage ?? "") };
  }, [record, records, index]);
  const screenTarget = useMemo(() => new Group(), []);
  const slot = useMemo(() => ({ index, dossier, screenTarget }), [index, dossier, screenTarget]);

  // A stream with no asset id yet is left out, so nothing is asked for that
  // cannot be answered.
  const inGlass = Children.map(children, (child) =>
    isValidElement(child) && child.type === "mirisStream" && !(child.props as any)?.args?.[0]?.uuid ? null : child,
  );

  return (
    <SpecimenContext.Provider value={slot}>
      <group position={position} rotation={[0, facing, 0]}>
        <EndCap y={GLASS.bottom - CAP.thickness / 2} />
        <EndCap y={GLASS_TOP + CAP.thickness / 2} />

        <RearPost side={-1} />
        <RearPost side={1} />

        <Glass index={index} />
        <Ring radius={GLASS.radius + 0.02} y={GLASS.bottom} tube={0.024} lit />
        <Ring radius={GLASS.radius + 0.02} y={GLASS_TOP} tube={0.024} lit />

        <Pulse color={COLOR.glow} seed={index / CAPSULES} />
        <FloorGlow color={COLOR.glow} opacity={0.32} radius={1.75} />
        <LightShaft color={COLOR.shaft} radius={1.1} strength={0.2} />

        <Lamp />

        <group position={[0, GLASS_TOP + CAP.thickness / 2, LABEL.standoff]}>
          <Label text={label} width={LABEL.width} height={LABEL.height} />
        </group>
      </group>

      {/* The middle of the glass, in world axes, so a stream's own scale and
          position mean what they say. */}
      <group position={[position[0], GLASS_CENTRE, position[2]]}>{inGlass}</group>

      <Pedestal index={index} active={selected === index} screenTarget={screenTarget} />
    </SpecimenContext.Provider>
  );
}

/** The enamel disc that closes one end of the tube, with a lit ring on its
 *  face, a steel ring round its edge and twelve bolts. */
function EndCap({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[CAP.radiusTop, CAP.radiusBottom, CAP.thickness, SMOOTH]} />
        <meshStandardMaterial color={enamel} metalness={0.55} roughness={0.48} />
      </mesh>
      <Ring radius={CAP.radiusBottom - 0.02} y={0.02} tube={0.018} lit />
      <Ring radius={CAP.radiusBottom - 0.01} y={-0.1} tube={0.025} color={steel} />
      <StaticInstances transforms={capBolts}>
        <cylinderGeometry args={[BOLT.radius, BOLT.radius, BOLT.height, 6]} />
        <meshStandardMaterial color={COLOR.bolt} metalness={0.8} roughness={0.4} />
      </StaticInstances>
    </group>
  );
}

/** A steel upright behind the glass, with a thin blue light strip on its face.
 *  `side` is -1 for the left post and 1 for the right. */
function RearPost({ side }: { side: -1 | 1 }) {
  const x = side * POST.offset;
  return (
    <group>
      <mesh position={[x, GLASS_CENTRE, -POST.behind]}>
        <boxGeometry args={[POST.width, POST.height, POST.depth]} />
        <meshStandardMaterial color={steel} metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[x, GLASS_CENTRE, -STRIP.behind]}>
        <boxGeometry args={[STRIP.width, STRIP.height, STRIP.depth]} />
        <meshBasicMaterial color={blue} />
      </mesh>
    </group>
  );
}

/** The tube itself: almost clear, drawn on both sides, and named so GlassOrder
 *  can decide its draw order against the splats each frame. */
function Glass({ index }: { index: number }) {
  return (
    <mesh position={[0, GLASS_CENTRE, 0]} name={`glass-${index}`}>
      <cylinderGeometry args={[GLASS.radius, GLASS.radius, GLASS.height, SMOOTH, 1, true]} />
      <meshStandardMaterial color={COLOR.glassTint} transparent opacity={0.035} roughness={0.22} metalness={0.1} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

/** The lamp above the tube: a steel housing with a lit face underneath, and
 *  the stem that hangs it from the ceiling. */
function Lamp() {
  return (
    <group position={[0, LAMP.y, 0]}>
      <mesh>
        <cylinderGeometry args={[LAMP.radiusTop, LAMP.radiusBottom, LAMP.thickness, COARSE]} />
        <meshStandardMaterial color={steel} metalness={0.65} roughness={0.4} />
      </mesh>
      <mesh position={[0, -LAMP.thickness / 2 - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[LAMP.faceRadius, COARSE]} />
        <meshBasicMaterial color={COLOR.lampFace} />
      </mesh>
      <mesh position={[0, LAMP.stemHeight / 2 + 0.02, 0]}>
        <cylinderGeometry args={[LAMP.stemRadius, LAMP.stemRadius, LAMP.stemHeight, 12]} />
        <meshStandardMaterial color={steel} />
      </mesh>
    </group>
  );
}

/** The terminal in front of a capsule. Whatever Screen draws into its target
 *  is scaled to fit the face; while this pedestal is the one being read, the
 *  face shows the glitch pass instead, when there is one. */
const Pedestal = memo(function Pedestal({ index, active, screenTarget }: { index: number; active: boolean; screenTarget: Group }) {
  const { position, facing } = pedestalPlacement(index);
  const painted = useRef<Texture | null>(null);
  const appliedEffect = useRef<Texture | null>(null);

  useFrame(() => {
    let plane: any = null;
    screenTarget.traverse((object: any) => {
      if (!plane && object.isMesh && object.geometry?.type === "PlaneGeometry") plane = object;
    });
    if (!plane?.material) return;
    const { width, height } = plane.geometry.parameters;
    screenTarget.scale.setScalar(Math.min(SCREEN.w / width, SCREEN.h / height));
    const material = plane.material;
    const effect = getScreenOutput();
    // Remember the painted texture, whatever the glitch pass swaps in.
    if (material.map && material.map !== appliedEffect.current) painted.current = material.map;
    const want = active && getSelectedPart() === "pedestal" && effect && painted.current ? effect : painted.current;
    if (active && painted.current) setScreenSource(painted.current, index);
    if (want && material.map !== want) {
      material.map = want;
      appliedEffect.current = want === effect ? effect : null;
      material.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={[0, facing, 0]}>
      <mesh position={[0, BODY.h / 2, 0]}>
        <boxGeometry args={[BODY.w, BODY.h, BODY.d]} />
        <meshStandardMaterial color={0x657d87} roughness={0.55} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, BODY.d / 2 + 0.002]}>
        <boxGeometry args={[BODY.w - 0.06, 0.012, 0.004]} />
        <meshBasicMaterial color={active ? 0xc9ebff : 0x729fb7} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <boxGeometry args={[1.05, 0.14, 0.66]} />
        <meshStandardMaterial color="#253b49" metalness={0.65} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.55, -0.08]}>
        <boxGeometry args={[0.6, 0.5, 0.32]} />
        <meshStandardMaterial color="#445e6b" metalness={0.5} roughness={0.5} />
      </mesh>
      {[0, 1, 2, 3, 4].map((vent) => (
        <mesh key={vent} position={[0, 0.22 + vent * 0.045, BODY.d / 2 + 0.004]}>
          <boxGeometry args={[0.55, 0.015, 0.012]} />
          <meshStandardMaterial color="#172c38" />
        </mesh>
      ))}
      <group position={[0, 0.48, BODY.d / 2 + 0.008]}>
        <Label text={`BIO / ${String(index + 1).padStart(2, "0")}`} width={0.46} height={0.075} />
      </group>
      <group position={[0, HEAD.y, HEAD.forward]} rotation={[HEAD.tilt, 0, 0]}>
        <RoundedBox args={[SCREEN.w + 0.22, 0.18, SCREEN.h + 0.25]} radius={0.045} smoothness={3}>
          <meshStandardMaterial color={0x83969a} roughness={0.5} metalness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.095, 0]}>
          <boxGeometry args={[SCREEN.w + 0.045, 0.015, SCREEN.h + 0.04]} />
          <meshStandardMaterial color="#101f2a" roughness={0.4} />
        </mesh>
        {[-0.47, 0.47].map((x) => (
          <mesh key={x} position={[x, 0.098, 0.345]}>
            <cylinderGeometry args={[0.026, 0.026, 0.015, 12]} />
            <meshStandardMaterial color="#233e4f" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0.36, 0.101, 0.345]}>
          <sphereGeometry args={[0.013, 8, 8]} />
          <meshBasicMaterial color={active ? "#cbecff" : "#6893ae"} />
        </mesh>
        {/* A plane faces +Z; laid flat here its normal is the head's up, and the
            top of the picture points away from the reader, as a page does. */}
        <group position={[0, HEAD.face, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={screenTarget} />
        </group>
      </group>
    </group>
  );
});
