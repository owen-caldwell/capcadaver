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

/** Fixed in front of the camera so the prism stays visually centered on screen. */
const CENTER_EMITTER_ORIGIN: [number, number, number] = [0, 0, 0.45];

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
  /** When false, prism→panel beams are not drawn (e.g. until HologramPage windows spawn). */
  showProjectionBeams?: boolean;
  /**
   * Stops the render loop (prism, vessel sphere, postprocessing) — e.g. user idle / skelly screen.
   */
  pauseAnimation?: boolean;
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
   * Pivot spin at the prism core: bbox center is in world space; `clone` lives under
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
  showProjectionBeams = true,
  pauseAnimation = false,
}: ModelViewerProps) {
  const emitterPosition = CENTER_EMITTER_ORIGIN;

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={pauseAnimation ? "never" : "always"}
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
      {showProjectionBeams ? (
        <ProjectionBeams
          projectionTargetsNdc={projectionTargetsNdc}
          emitterPosition={emitterPosition}
        />
      ) : null}
      <HologramPostFx />
      <SceneReadySignal onSceneReady={onSceneReady} />
    </Canvas>
  );
}
