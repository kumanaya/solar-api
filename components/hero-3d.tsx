/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef, useState, useCallback, Suspense } from "react";
import { useGLTF, Environment, OrbitControls } from "@react-three/drei";

function SpinningCity({
  url,
  autoRotate,
}: {
  url: string;
  autoRotate: boolean;
}) {
  const ref = useRef<any>(null);
  const { scene } = useGLTF(url);

  // Gira só se autoRotate estiver true
  useFrame(() => {
    if (autoRotate && ref.current) {
      ref.current.rotation.y += 0.0035;
    }
  });

  return <primitive ref={ref} object={scene} scale={2.1} />;
}

export function Hero3D() {
  const [autoRotate, setAutoRotate] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Chama quando o usuário interage
  const handleStart = useCallback(() => {
    setAutoRotate(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Chama quando o usuário para de interagir
  const handleEnd = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Depois de 4 segundos sem mexer, volta a girar
    timeoutRef.current = setTimeout(() => setAutoRotate(true), 4000);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas camera={{ position: [0, 50, 20], fov: 130 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <Suspense fallback={null}>
          <SpinningCity url="/models/city_model.glb" autoRotate={autoRotate} />
          <Environment preset="sunset" />
          <OrbitControls
            enableZoom={true}
            enablePan={true}
            minDistance={10}
            maxDistance={120}
            onStart={handleStart}
            onEnd={handleEnd}
            // O usuário também pode interagir via scroll, então:
            onChange={handleStart} // Opcional: pausa também ao mexer na câmera
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
