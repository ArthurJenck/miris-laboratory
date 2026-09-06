const FLOOR = `      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color={0x0a0d11} roughness={0.85} metalness={0.2} />
      </mesh>
      <gridHelper args={[36, 36, 0x1d4c60, 0x123243]} position={[0, 0, 0]} />
      <mesh position={[0, 4.4, 0]}>
        <cylinderGeometry args={[16, 16, 9, 48, 1, true]} />
        <meshStandardMaterial color={0x1b2530} roughness={0.9} metalness={0.1} side={DoubleSide} />
      </mesh>`;

const WALKWAY = `      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.8, 5.6, 64]} />
        <meshStandardMaterial color={0x39454f} roughness={0.45} metalness={0.4} />
      </mesh>
      {[2.8, 5.6].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <torusGeometry args={[r, 0.022, 8, 128]} />
          <meshBasicMaterial color={0x3bd6fe} toneMapped={false} />
        </mesh>
      ))}`;

const CAPSULES_SNIPPET = `      {specimens.map((s, i) => {
        // Six capsules, evenly spaced around a circle of radius 4.2.
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * 4.2;
        const z = Math.sin(angle) * 4.2;
        return (
          <group key={s.id} position={[x, 0, z]}>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[1.05, 1.18, 0.36, 32]} />
              <meshStandardMaterial color={0x0b0d10} roughness={0.6} metalness={0.35} />
            </mesh>
            <mesh position={[0, 1.66, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 2.6, 40, 1, true]} />
              <meshStandardMaterial
                color={TINTS[i]}
                emissive={TINTS[i]}
                emissiveIntensity={0.5}
                transparent
                opacity={0.18}
                roughness={0.2}
                metalness={0.1}
                depthWrite={false}
                side={DoubleSide}
              />
            </mesh>
            {[0.36, 2.96].map((y) => (
              <mesh key={y} position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.9, 0.015, 8, 64]} />
                <meshBasicMaterial color={0x9ef4ff} toneMapped={false} />
              </mesh>
            ))}
          </group>
        );
      })}`;

const STREAMS = `      {specimens.map((s, i) => {
        if (!s.uuid) return null;
        const angle = (i / 6) * Math.PI * 2;
        return (
          <mirisStream
            key={s.id}
            position={[Math.cos(angle) * 4.2, 1.6, Math.sin(angle) * 4.2]}
            scale={0.15}
            args={[{ uuid: s.uuid, viewerKey: data.viewerKey || DEMO_KEY }]}
          />
        );
      })}`;


const CARD = `      {specimens.map((s, i) => {
        if (!s.dossier) return null;
        const angle = (i / 6) * Math.PI * 2;
        return (
          <Card
            key={s.id}
            card={s.dossier}
            position={[Math.cos(angle) * 4.2, 3.9, Math.sin(angle) * 4.2]}
          />
        );
      })}`;

const LABEL_HTML = `  // Painted by ctx.drawElementImage() in Chrome, an SVG foreignObject elsewhere.
  const active = data?.specimens?.[data?.active ?? 0];
  const label = useHtmlTexture(active?.dossier && dossierHtml(active.dossier));`;

const LABEL_MESH = `      {label.texture && (
        <Billboard position={[0, 3.9, 4.2]}>
          <mesh>
            <planeGeometry args={[label.width, label.height]} />
            <meshBasicMaterial map={label.texture} transparent toneMapped={false} />
          </mesh>
        </Billboard>
      )}`;

export const SNIPPETS = {
  floor: FLOOR,
  walkway: `${FLOOR}\n${WALKWAY}`,
  capsules: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}`,
  streams: `${FLOOR}\n${WALKWAY}\n${CAPSULES_SNIPPET}\n${STREAMS}`,
  card: CARD,
  labelHtml: LABEL_HTML,
  // Shares the `card` marker deliberately, so the plane replaces step 4.2's
  // overlay rather than adding a second dossier beside it.
  labelMesh: LABEL_MESH,
};

/* What each step actually adds. SNIPPETS is cumulative because the scene ones
   share a marker, so showing an attendee SNIPPETS.environment would show them
   the pedestal they already have. The Fill button writes the cumulative block;
   the card shows the part. */
export const PARTS = {
  floor: FLOOR,
  walkway: WALKWAY,
  capsules: CAPSULES_SNIPPET,
  streams: STREAMS,
  card: CARD,
  labelHtml: LABEL_HTML,
  labelMesh: LABEL_MESH,
};

/* Clearing a step puts the block back to the step before it, not to empty.
   Three steps share the `scene` marker because the snippets are cumulative, so
   a marker-wide clear at 2.2 took 2.1's pedestal with it. null means there is
   nothing before it and the block returns to the template's blank. */
export const CLEARS_TO = {
  floor: null,
  walkway: "floor",
  capsules: "walkway",
  streams: "capsules",
  card: null,
  labelHtml: null,
  labelMesh: "card",
};

export const MARKER_FOR = {
  floor: "scene",
  walkway: "scene",
  capsules: "scene",
  streams: "scene",
  card: "card",
  labelHtml: "label",
  labelMesh: "card",
};
