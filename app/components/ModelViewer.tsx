"use client";

import {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import {
  ChromaticAberration,
  EffectComposer,
} from "@react-three/postprocessing";
import * as THREE from "three";

export type NdcPoint = {
  x: number;
  y: number;
};

/** Matches Canvas default camera in this file. */
const EMITTER_CAMERA_Z = 3.5;
const EMITTER_FOV_DEG = 38;
/**
 * Use a narrow aspect so horizontal bounds stay inside the frustum on portrait
 * viewports; vertical FOV is unchanged by aspect.
 */
const EMITTER_BOUNDS_MIN_ASPECT = 0.48;
/** World-space inset so scaled emitter + ray décor stay inside the canvas. */
const EMITTER_EDGE_PAD = 0.38;

/** Random position on each mount, kept inside the visible frustum slice at that depth. */
function randomEmitterOrigin(): [number, number, number] {
  const z = 0.28 + Math.random() * 0.62;
  const depth = EMITTER_CAMERA_Z - z;
  const tanHalfFov = Math.tan((EMITTER_FOV_DEG * Math.PI) / 360);
  const halfY = depth * tanHalfFov;
  const halfX = halfY * EMITTER_BOUNDS_MIN_ASPECT;
  const pad = EMITTER_EDGE_PAD;
  if (halfX <= pad || halfY <= pad) {
    return [0, 0, 0.55];
  }
  const xMin = -halfX + pad;
  const xMax = halfX - pad;
  const yMin = -halfY + pad;
  const yMax = halfY - pad;
  return [
    THREE.MathUtils.lerp(xMin, xMax, Math.random()),
    THREE.MathUtils.lerp(yMin, yMax, Math.random()),
    z,
  ];
}

/** Skip raycast on décor meshes so they do not intercept pointer events meant for HTML/UI. */
function noRaycast(
  _raycaster: THREE.Raycaster,
  _intersects: THREE.Intersection[],
) {}

type ModelViewerProps = {
  projectionTargetsNdc: NdcPoint[];
  onSceneReady?: () => void;
  /** Updated every frame: emitter projected into canvas pixel space (origin top-left), same box as the fullscreen shell. */
  orbShellPxRef?: MutableRefObject<{ x: number; y: number }>;
};

const PRISM_GLTF = "/prism/scene.gltf";

/** World scale for prism mesh (model units ~3m tall). */
const PRISM_BASE_SCALE = 0.055;

const PRISM_WHITE = 0xffffff;
/** Base white glow (no glTF textures). */
const PRISM_BASE_EMISSIVE_INTENSITY = 1.45;

function createPrismGlowMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: PRISM_WHITE,
    emissive: PRISM_WHITE,
    emissiveIntensity: PRISM_BASE_EMISSIVE_INTENSITY,
    metalness: 0.12,
    roughness: 0.38,
    envMapIntensity: 0.9,
  });
}

/** 0–1 motion intensity multiplier (emitter décor). */
function PrismEmitter({ motionScale }: { motionScale: number }) {
  const { scene } = useGLTF(PRISM_GLTF);
  const wrapRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useLayoutEffect(() => {
    clone.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      mesh.raycast = noRaycast;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const replacement = mats.map((oldMat) => {
        oldMat.dispose();
        return createPrismGlowMaterial();
      });
      mesh.material = replacement.length === 1 ? replacement[0] : replacement;
    });
  }, [clone]);

  /**
   * Pivot spin/beams at the prism core: bbox center is in world space; `clone` lives under
   * `spinRef`, so subtracting world `getCenter` from local `position` was wrong (way off on X).
   * Convert world center → spin’s local space, then offset `clone.position`.
   */
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const spin = spinRef.current;
    if (!wrap || !spin) return;

    wrap.scale.setScalar(PRISM_BASE_SCALE);
    clone.rotation.set(0, 0, 0);
    clone.position.set(0, 0, 0);
    clone.rotation.x = Math.PI;

    wrap.updateWorldMatrix(true, true);
    spin.updateWorldMatrix(true, true);
    clone.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(clone);
    if (box.isEmpty()) return;

    const centerWorld = new THREE.Vector3();
    box.getCenter(centerWorld);
    const centerInSpin = centerWorld.clone();
    spin.worldToLocal(centerInSpin);
    clone.position.sub(centerInSpin);
  }, [clone]);

  useFrame((_, delta) => {
    const spin = spinRef.current;
    if (spin && motionScale > 0) {
      spin.rotation.y += delta * 1.05 * motionScale;
    }
  });

  return (
    <group ref={wrapRef}>
      <group ref={spinRef}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

useGLTF.preload(PRISM_GLTF);

/** Count / shell inspired by three.js webgl_raycaster_bvh.html ray visualization. */
const ORB_POINT_COUNT = 160;
const ORB_POINT_SHELL_RADIUS = 0.3;
const ORB_POINT_SIZE = 0.012;
/** Matches webgl_raycaster_bvh.html: ~0.001 rad/frame at 60fps → delta * 0.06; slightly boosted for readability. */
const ORB_POINT_SPIN_PER_SEC = 0.095;

function OrbRayPointField({ motionScale }: { motionScale: number }) {
  const instancedRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const shellGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 5), []);
  const shellMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x7cf1ff,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  );
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(ORB_POINT_COUNT * 2 * 3), 3),
    );
    return g;
  }, []);
  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x5ad8f0,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    [],
  );
  const tmp = useRef({
    pos: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    scale: new THREE.Vector3(),
    mat: new THREE.Matrix4(),
    axis: new THREE.Vector3(),
  });
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    const mesh = instancedRef.current;
    if (!mesh) return;
    const { pos, quat, scale, mat } = tmp.current;
    quat.identity();
    for (let i = 0; i < ORB_POINT_COUNT; i++) {
      pos.randomDirection().multiplyScalar(ORB_POINT_SHELL_RADIUS);
      scale.setScalar(ORB_POINT_SIZE);
      mat.compose(pos, quat, scale);
      mesh.setMatrixAt(i, mat);
    }
    mesh.instanceMatrix.needsUpdate = true;
    seededRef.current = true;
  }, []);

  useFrame((_, delta) => {
    const mesh = instancedRef.current;
    const lines = linesRef.current;
    if (!mesh || !seededRef.current) return;

    const lineAttr = lines?.geometry.attributes.position as
      | THREE.BufferAttribute
      | undefined;
    const { pos, quat, scale, mat, axis } = tmp.current;
    let lineVertex = 0;

    const offset = 1e-4 * performance.now();
    const spin = delta * ORB_POINT_SPIN_PER_SEC * motionScale;

    for (let i = 0; i < ORB_POINT_COUNT; i++) {
      mesh.getMatrixAt(i, mat);
      mat.decompose(pos, quat, scale);

      if (motionScale > 0) {
        axis
          .set(
            Math.sin(i * 100 + offset),
            Math.cos(-i * 10 + offset),
            Math.sin(i * 1 + offset),
          )
          .normalize();
        pos.applyAxisAngle(axis, spin);
        pos.normalize().multiplyScalar(ORB_POINT_SHELL_RADIUS);
      }

      scale.setScalar(ORB_POINT_SIZE);
      mat.compose(pos, quat, scale);
      mesh.setMatrixAt(i, mat);

      if (lineAttr) {
        lineAttr.setXYZ(lineVertex++, 0, 0, 0);
        lineAttr.setXYZ(lineVertex++, pos.x, pos.y, pos.z);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (lineAttr && lines) {
      lineAttr.needsUpdate = true;
      lines.geometry.setDrawRange(0, lineVertex);
    }
  });

  return (
    <group>
      <instancedMesh
        ref={instancedRef}
        args={[shellGeo, shellMat, ORB_POINT_COUNT]}
        frustumCulled={false}
        raycast={noRaycast}
      />
      <lineSegments
        ref={linesRef}
        geometry={lineGeo}
        material={lineMat}
        frustumCulled={false}
        raycast={noRaycast}
      />
    </group>
  );
}

function EmitterModel({
  emitterPosition,
}: {
  emitterPosition: [number, number, number];
}) {
  return (
    <group position={emitterPosition}>
      <Suspense fallback={null}>
        <PrismEmitter motionScale={1} />
      </Suspense>

      <OrbRayPointField motionScale={1} />
    </group>
  );
}

function cornerNdcToWorld(ndc: NdcPoint, camera: THREE.Camera, planeZ = 0) {
  const perspective = camera as THREE.PerspectiveCamera;
  const point = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(perspective);
  const direction = point.sub(perspective.position).normalize();
  const distance = (planeZ - perspective.position.z) / direction.z;
  return perspective.position.clone().add(direction.multiplyScalar(distance));
}

function ProjectionBeams({
  projectionTargetsNdc,
  emitterPosition,
}: {
  projectionTargetsNdc: NdcPoint[];
  emitterPosition: [number, number, number];
}) {
  const { camera } = useThree();
  const start = useMemo(
    () =>
      new THREE.Vector3(
        emitterPosition[0],
        emitterPosition[1],
        emitterPosition[2],
      ),
    [emitterPosition],
  );

  const beamPoints = useMemo(() => {
    return projectionTargetsNdc.map((corner) => {
      const target = cornerNdcToWorld(corner, camera, 0);
      return [start.clone(), target];
    });
  }, [camera, projectionTargetsNdc, start]);

  return (
    <group>
      {beamPoints.map((points, index) => (
        <Line
          key={`beam-${index}`}
          points={points}
          color="#ffffff"
          lineWidth={1}
          transparent
          opacity={0.72}
          raycast={noRaycast}
        />
      ))}
    </group>
  );
}

function HologramPostFx() {
  return (
    <EffectComposer multisampling={0}>
      <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} />
    </EffectComposer>
  );
}

function VesselSphere() {
  const meshRef = useRef<THREE.Mesh>(null);

  const gridTexture = useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    const major = 64;
    const minor = 16;
    for (let x = 0; x <= size; x += minor) {
      ctx.strokeStyle =
        x % major === 0
          ? "rgba(255, 255, 255, 0.45)"
          : "rgba(205, 205, 205, 0.16)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += minor) {
      ctx.strokeStyle =
        y % major === 0
          ? "rgba(255, 255, 255, 0.45)"
          : "rgba(205, 205, 205, 0.16)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(7, 4);
    texture.needsUpdate = true;
    return texture;
  }, []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    meshRef.current.rotation.y += delta * 0.14;
    meshRef.current.rotation.z += delta * 0.05;
  });

  if (!gridTexture) return null;

  return (
    <mesh ref={meshRef} raycast={noRaycast}>
      <sphereGeometry args={[10, 48, 48]} />
      <meshBasicMaterial
        map={gridTexture}
        color="#ffffff"
        side={THREE.BackSide}
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function SceneReadySignal({ onSceneReady }: { onSceneReady?: () => void }) {
  const hasNotifiedRef = useRef(false);

  useFrame(() => {
    if (!onSceneReady || hasNotifiedRef.current) return;
    hasNotifiedRef.current = true;
    onSceneReady();
  }, 1000);

  return null;
}

function EmitterShellProjection({
  emitterPosition,
  targetRef,
}: {
  emitterPosition: [number, number, number];
  targetRef: MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());

  useFrame(() => {
    v.current.set(emitterPosition[0], emitterPosition[1], emitterPosition[2]);
    v.current.project(camera);
    targetRef.current.x = (v.current.x * 0.5 + 0.5) * size.width;
    targetRef.current.y = (-v.current.y * 0.5 + 0.5) * size.height;
  });

  return null;
}

export default function ModelViewer({
  projectionTargetsNdc,
  onSceneReady,
  orbShellPxRef,
}: ModelViewerProps) {
  const emitterPosition = useMemo(() => randomEmitterOrigin(), []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop="always"
      camera={{ position: [0, 0, 3.5], fov: 38 }}
    >
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 8, 4]} intensity={0.55} />
      {orbShellPxRef ? (
        <EmitterShellProjection
          emitterPosition={emitterPosition}
          targetRef={orbShellPxRef}
        />
      ) : null}
      <VesselSphere />
      <EmitterModel emitterPosition={emitterPosition} />
      <ProjectionBeams
        projectionTargetsNdc={projectionTargetsNdc}
        emitterPosition={emitterPosition}
      />
      <HologramPostFx />
      <SceneReadySignal onSceneReady={onSceneReady} />
    </Canvas>
  );
}
