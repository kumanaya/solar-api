"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef, useState, useCallback } from "react";
import {
  useGLTF,
  Environment,
  OrbitControls,
  Bounds,
  Loader,
} from "@react-three/drei";

// Componente do modelo 3D, com rotação automática
function SpinningCity({
  url,
  autoRotate,
}: {
  url: string;
  autoRotate: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const { scene } = useGLTF(url);

  useFrame(() => {
    if (autoRotate && ref.current) {
      ref.current.rotation.y += 0.0035;
    }
  });

  // Bounds vai ajustar a escala/posição automaticamente
  return <primitive ref={ref} object={scene} />;
}

export function Hero3D() {
  const [autoRotate, setAutoRotate] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = useCallback(() => {
    setAutoRotate(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleEnd = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setAutoRotate(true), 4000);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[20, 50, 10]} intensity={2} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <SpinningCity url="/models/city_test.glb" autoRotate={autoRotate} />
          </Bounds>
          <Environment preset="sunset" />
          <OrbitControls
            enableZoom
            enablePan
            minDistance={10}
            maxDistance={500}
            onStart={handleStart}
            onEnd={handleEnd}
            onChange={handleStart}
            makeDefault
            maxPolarAngle={Math.PI / 2}
            minPolarAngle={0}
          />
        </Suspense>
      </Canvas>
      <Loader />{" "}
      {/* Loader do drei, aparece durante o carregamento do modelo */}
    </div>
  );
}
