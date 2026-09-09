import { useLayoutEffect, useRef, type ReactNode } from "react";
import { InstancedMesh, Object3D } from "three";

export interface InstanceTransform {
  position: [number, number, number];
  rotation?: [number, number, number];
}

// Repeated hardware shares one geometry, material, and draw call.
export default function StaticInstances({ transforms, children }: { transforms: InstanceTransform[]; children: ReactNode }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const item = new Object3D();
    transforms.forEach(({ position, rotation = [0, 0, 0] }, i) => {
      item.position.fromArray(position);
      item.rotation.set(...rotation);
      item.updateMatrix();
      target.setMatrixAt(i, item.matrix);
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingBox();
    target.computeBoundingSphere();
  }, [transforms]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, transforms.length]}>{children}</instancedMesh>;
}
