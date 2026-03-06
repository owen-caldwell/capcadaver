// components/ModelViewer.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { DotScreenShader } from "three/addons/shaders/DotScreenShader.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const ref = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.5; // rotate ~0.5 rad/s
    }
  });

  return <primitive ref={ref} object={scene} />;
}

function DitherPostprocessing() {
  const { gl, scene, camera, size } = useThree();

  const composer = useMemo(() => {
    const effectComposer = new EffectComposer(gl);
    effectComposer.addPass(new RenderPass(scene, camera));

    const dotScreenPass = new ShaderPass(DotScreenShader);
    dotScreenPass.uniforms["scale"].value = 4;
    effectComposer.addPass(dotScreenPass);

    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms["amount"].value = 0.0015;
    effectComposer.addPass(rgbShiftPass);

    effectComposer.addPass(new OutputPass());
    return effectComposer;
  }, [camera, gl, scene]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.height, size.width]);

  useEffect(() => {
    return () => {
      composer.dispose();
    };
  }, [composer]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
}

export default function ModelViewer() {
  return (
    <div className="h-[200px] w-[200px] md:h-[300px] md:w-[300px]">
      <Canvas style={{ width: "100%", height: "100%" }} camera={{ position: [0, 0, 3.5], fov: 38 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Model url="/models/skullBones.glb" />
        <DitherPostprocessing />
        <OrbitControls
          enableZoom={false} // disable scroll zoom
          enablePan={false} // disable drag-to-pan
          enableRotate={false} // disable rotation
          minPolarAngle={Math.PI / 4} // restrict vertical rotation
          maxPolarAngle={Math.PI / 1.5}
        />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
