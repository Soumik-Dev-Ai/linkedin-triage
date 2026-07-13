'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Mouse Tracker ─── */
function MouseTracker({ mouseRef }: { mouseRef: React.MutableRefObject<THREE.Vector2> }) {
  const { viewport } = useThree();
  useFrame(({ pointer }) => {
    // Smoothly interpolate mouse position
    mouseRef.current.x = THREE.MathUtils.lerp(mouseRef.current.x, (pointer.x * viewport.width) / 2, 0.05);
    mouseRef.current.y = THREE.MathUtils.lerp(mouseRef.current.y, (pointer.y * viewport.height) / 2, 0.05);
  });
  return null;
}

/* ─── Slowly Rotating Wireframe Icosahedron ─── */
function WireframeShape({ mouseRef }: { mouseRef: React.MutableRefObject<THREE.Vector2> }) {
  const meshRef = useRef<THREE.Group>(null!);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(2.5, 2), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.08;
      meshRef.current.rotation.x += delta * 0.04;
      
      // Parallax effect reacting to mouse
      meshRef.current.position.x = mouseRef.current.x * 0.1;
      meshRef.current.position.y = mouseRef.current.y * 0.1;
    }
  });

  return (
    <group ref={meshRef}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          color="#9d4edd" /* Purple tint */
          transparent
          opacity={0.3}
          linewidth={1.5}
        />
      </lineSegments>
      {/* Inner iridescent fill */}
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color="#240046"
          emissive="#3c096c"
          emissiveIntensity={0.2}
          transparent
          opacity={0.15}
          roughness={0.1}
          metalness={0.8}
          clearcoat={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/* ─── Floating Particle Network ─── */
function ParticleNetwork({ mouseRef }: { mouseRef: React.MutableRefObject<THREE.Vector2> }) {
  const groupRef = useRef<THREE.Group>(null!);

  const { pointsGeometry, linesGeometry } = useMemo(() => {
    const count = 120;
    const spread = 12;
    const positions = new Float32Array(count * 3);

    let seed = 42;
    const rng = () => { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * spread;
      positions[i * 3 + 1] = (rng() - 0.5) * spread;
      positions[i * 3 + 2] = (rng() - 0.5) * spread;
    }

    // Create connections between nearby particles
    const lines: number[] = [];
    const connectionThreshold = 2.5;

    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < connectionThreshold) {
          lines.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          );
        }
      }
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const lGeo = new THREE.BufferGeometry();
    if (lines.length > 0) {
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lines), 3));
    }

    return { pointsGeometry: pGeo, linesGeometry: lGeo };
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.03;
      groupRef.current.rotation.x += delta * 0.01;
      
      // Inverse parallax for depth
      groupRef.current.position.x = mouseRef.current.x * -0.05;
      groupRef.current.position.y = mouseRef.current.y * -0.05;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, -3]}>
      {/* Particles */}
      <points geometry={pointsGeometry}>
        <pointsMaterial
          color="#c77dff" /* Bright purple dots */
          size={0.035}
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>

      {/* Connection Lines */}
      <lineSegments geometry={linesGeometry}>
        <lineBasicMaterial
          color="#5a189a"
          transparent
          opacity={0.15}
        />
      </lineSegments>
    </group>
  );
}

/* ─── Secondary Wireframe Ring ─── */
function WireframeRing({ mouseRef }: { mouseRef: React.MutableRefObject<THREE.Vector2> }) {
  const meshRef = useRef<THREE.Mesh>(null!);

  const geometry = useMemo(() => new THREE.TorusGeometry(4.5, 0.02, 16, 100), []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.05;
      meshRef.current.rotation.z += delta * 0.025;
      
      meshRef.current.position.x = mouseRef.current.x * 0.08;
      meshRef.current.position.y = mouseRef.current.y * 0.08;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color="#7b2cbf"
        transparent
        opacity={0.25}
        wireframe
      />
    </mesh>
  );
}

/* ─── Main Background Component ─── */
export default function ThreeBackground() {
  const mouseRef = useRef(new THREE.Vector2(0, 0));

  return (
    <div className="fixed inset-0 z-0" style={{ pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 2]} /* Better resolution for premium feel */
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <MouseTracker mouseRef={mouseRef} />
        
        {/* Richer Lighting */}
        <ambientLight intensity={0.4} color="#e0aaff" />
        <directionalLight position={[10, 10, 10]} intensity={0.8} color="#c77dff" />
        <directionalLight position={[-10, -5, 5]} intensity={0.5} color="#5a189a" />
        
        {/* Spotlight following the mouse somewhat */}
        <pointLight position={[0, 0, 5]} intensity={1.5} color="#9d4edd" distance={15} decay={2} />

        <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.5} floatingRange={[-0.2, 0.2]}>
          <WireframeShape mouseRef={mouseRef} />
        </Float>

        <WireframeRing mouseRef={mouseRef} />
        <ParticleNetwork mouseRef={mouseRef} />
      </Canvas>
    </div>
  );
}
