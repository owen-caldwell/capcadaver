"use client";

import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, useGLTF } from "@react-three/drei";
import { ChromaticAberration, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";

export type NdcPoint = {
  x: number;
  y: number;
};

const EMITTER_ORIGIN: [number, number, number] = [-1.2, -0.8, 0.5];

type ModelViewerProps = {
  projectionTargetsNdc: NdcPoint[];
  emitterType: "orb" | "pyramid";
  reducedMotion: boolean;
  onSceneReady?: () => void;
};

const CORE_PARTICLE_GLTF = "/core-particle/scene.gltf";

/** Skip raycasting so the camera-inside vessel shell and beams don't block orb hover. */
function noopRaycast(
  _raycaster: THREE.Raycaster,
  _intersects: THREE.Intersection[],
) {}

const ORB_AXIS_TILT = THREE.MathUtils.degToRad(15);
const ORB_BASE_SPIN = 0.45;
const ORB_SLOW_DURATION = 2.6;
const ORB_ACCEL = 4.2;
const ORB_DECEL = 2.4;
const ORB_BASE_SCALE = .2;
const ORB_HOVER_SCALE_MULT = 2;
const ORB_HOVER_EMISSIVE_MULT = 2.35;

type MatSnapshot = {
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
  emissiveIntensity: number;
};

function CoreParticleOrb({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(CORE_PARTICLE_GLTF);
  const axisRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const wrapRef = useRef<THREE.Group>(null);
  const hoverRef = useRef(false);
  const hoverElapsedRef = useRef(0);
  const spinSpeedRef = useRef(ORB_BASE_SPIN);
  const hoverVisualRef = useRef(0);

  const { clone, materialSnapshots } = useMemo(() => {
    const c = scene.clone(true);
    const snaps: MatSnapshot[] = [];
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.raycast = noopRaycast;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const raw of mats) {
        if (
          raw &&
          (raw.type === "MeshStandardMaterial" ||
            raw.type === "MeshPhysicalMaterial")
        ) {
          const m = raw as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
          snaps.push({
            mat: m,
            emissiveIntensity: m.emissiveIntensity ?? 1,
          });
        }
      }
    });
    return { clone: c, materialSnapshots: snaps };
  }, [scene]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    wrap.scale.setScalar(ORB_BASE_SCALE);
  }, [clone]);

  useFrame((_, delta) => {
    const spin = spinRef.current;
    const wrap = wrapRef.current;
    if (!spin || !wrap) return;

    if (reducedMotion) {
      spin.rotation.y += delta * 0.12;
      hoverVisualRef.current = THREE.MathUtils.lerp(
        hoverVisualRef.current,
        0,
        1 - Math.exp(-6 * delta),
      );
      wrap.scale.setScalar(ORB_BASE_SCALE);
      for (const { mat, emissiveIntensity } of materialSnapshots) {
        mat.emissiveIntensity = emissiveIntensity;
      }
      return;
    }

    if (hoverRef.current) {
      hoverElapsedRef.current += delta;
    } else {
      hoverElapsedRef.current = 0;
    }

    const slowT = Math.min(1, hoverElapsedRef.current / ORB_SLOW_DURATION);
    const targetSpin = hoverRef.current
      ? ORB_BASE_SPIN * (1 - slowT)
      : ORB_BASE_SPIN;
    const lerpK = hoverRef.current ? ORB_DECEL : ORB_ACCEL;
    spinSpeedRef.current = THREE.MathUtils.lerp(
      spinSpeedRef.current,
      targetSpin,
      1 - Math.exp(-lerpK * delta),
    );
    spin.rotation.y += spinSpeedRef.current * delta;

    const hoverTarget = hoverRef.current ? 1 : 0;
    hoverVisualRef.current = THREE.MathUtils.lerp(
      hoverVisualRef.current,
      hoverTarget,
      1 - Math.exp(-5.5 * delta),
    );
    const hv = hoverVisualRef.current;
    wrap.scale.setScalar(
      THREE.MathUtils.lerp(
        ORB_BASE_SCALE,
        ORB_BASE_SCALE * ORB_HOVER_SCALE_MULT,
        hv,
      ),
    );
    for (const { mat, emissiveIntensity } of materialSnapshots) {
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        emissiveIntensity,
        emissiveIntensity * ORB_HOVER_EMISSIVE_MULT,
        hv,
      );
    }
  });

  return (
    <group ref={axisRef} rotation={[ORB_AXIS_TILT, 0, 0]}>
      <group ref={spinRef}>
        <group ref={wrapRef}>
          <primitive object={clone} />
        </group>
        <mesh
          onPointerEnter={(e) => {
            e.stopPropagation();
            hoverRef.current = true;
          }}
          onPointerLeave={(e) => {
            e.stopPropagation();
            hoverRef.current = false;
          }}
        >
          <sphereGeometry args={[0.38, 28, 28]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

useGLTF.preload(CORE_PARTICLE_GLTF);

function EmitterModel({
  emitterType,
  reducedMotion,
}: {
  emitterType: "orb" | "pyramid";
  reducedMotion: boolean;
}) {
  return (
    <group position={EMITTER_ORIGIN}>
      <Suspense fallback={null}>
        <CoreParticleOrb reducedMotion={reducedMotion} />
      </Suspense>

      <mesh rotation={[0, Math.PI / 4, 0]} scale={0.9} raycast={noopRaycast}>
        <tetrahedronGeometry args={[0.6]} />
        <meshStandardMaterial
          color={emitterType === "pyramid" ? "#f28cff" : "#5f89ff"}
          emissive={emitterType === "pyramid" ? "#de33ff" : "#1b43ff"}
          emissiveIntensity={emitterType === "pyramid" ? 1.4 : 0.8}
          transparent
          opacity={emitterType === "pyramid" ? 0.38 : 0.15}
          wireframe
        />
      </mesh>
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
  reducedMotion,
}: {
  projectionTargetsNdc: NdcPoint[];
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const start = useMemo(
    () =>
      new THREE.Vector3(
        EMITTER_ORIGIN[0],
        EMITTER_ORIGIN[1],
        EMITTER_ORIGIN[2],
      ),
    [],
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
          color={"cyan"}
          lineWidth={1}
          transparent
          opacity={reducedMotion ? 0.45 : 0.72}
          raycast={noopRaycast}
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

function VesselSphere({ reducedMotion }: { reducedMotion: boolean }) {
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
          ? "rgba(124, 241, 255, 0.45)"
          : "rgba(124, 241, 255, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += minor) {
      ctx.strokeStyle =
        y % major === 0
          ? "rgba(124, 241, 255, 0.45)"
          : "rgba(124, 241, 255, 0.16)";
      ctx.lineWidth = 1;
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

    const speedScale = reducedMotion ? 0.25 : 1;
    meshRef.current.rotation.y += delta * 0.14 * speedScale;
    meshRef.current.rotation.z += delta * 0.05 * speedScale;
  });

  if (!gridTexture) return null;

  return (
    <mesh ref={meshRef} raycast={noopRaycast}>
      <sphereGeometry args={[10, 48, 48]} />
      <meshBasicMaterial
        map={gridTexture}
        color="#7cf1ff"
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

export default function ModelViewer({
  projectionTargetsNdc,
  emitterType,
  reducedMotion,
  onSceneReady,
}: ModelViewerProps) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 3.5], fov: 38 }}>
      <color attach="background" args={["#000000"]} />
      <VesselSphere reducedMotion={reducedMotion} />
      <EmitterModel emitterType={emitterType} reducedMotion={reducedMotion} />
      <ProjectionBeams
        projectionTargetsNdc={projectionTargetsNdc}
        reducedMotion={reducedMotion}
      />
      <HologramPostFx />
      <SceneReadySignal onSceneReady={onSceneReady} />
    </Canvas>
  );
}
