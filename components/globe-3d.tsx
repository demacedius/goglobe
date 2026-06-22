"use client";

import { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ─── Constants ───────────────────────────────────────────────────────────────

const GOLD = "#C4B000";
const GLOBE_BG = "#0a0a06";
const MIN_DIST = 1.25;
const MAX_DIST = 9;
const INITIAL_DIST = 2.6;

// Camera distance thresholds for city label tiers
const TIER2_DIST = 2.3; // cities appear when closer than this
const TIER3_DIST = 1.75;

// ─── Atmosphere shader ───────────────────────────────────────────────────────

const atmVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmFragment = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.58 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
    gl_FragColor = vec4(0.12, 0.42, 1.0, 1.0) * intensity;
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function latLonToVec3(lat: number, lon: number, r = 1.01): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function getSunDirection(): THREE.Vector3 {
  const now = new Date();
  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(now.getUTCFullYear(), 0, 0)) /
      86400000
  );
  const decl = 23.45 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);
  const lon = (utcHour - 12) * -15;
  return latLonToVec3(decl, lon, 10);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Atmosphere() {
  return (
    <mesh scale={[1.04, 1.04, 1.04]}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={atmVertex}
        fragmentShader={atmFragment}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function EarthFallback() {
  return (
    <mesh>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial color={GLOBE_BG} roughness={1} />
    </mesh>
  );
}

function Earth() {
  const [colorMap, bumpMap, specularMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-bump.png",
    "/textures/earth-water.png",
  ]);
  const { gl, camera } = useThree();
  const matRef = useRef<THREE.MeshPhongMaterial>(null);

  // Apply anisotropic filtering once after texture load
  useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    for (const t of [colorMap, bumpMap, specularMap]) {
      t.anisotropy = maxAniso;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
    }
  }, [colorMap, bumpMap, specularMap, gl]);

  // Dynamic bump: more relief visible when close
  useFrame(() => {
    if (!matRef.current) return;
    const dist = camera.position.length();
    // 0.04 at max zoom-out (9) → 0.25 at min zoom-in (1.25)
    matRef.current.bumpScale = THREE.MathUtils.mapLinear(dist, 9, 1.25, 0.04, 0.22);
  });

  return (
    <mesh>
      <sphereGeometry args={[1, 128, 128]} />
      <meshPhongMaterial
        ref={matRef}
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.06}
        specularMap={specularMap}
        specular={new THREE.Color(0x1a1a2e)}
        shininess={18}
      />
    </mesh>
  );
}

// ─── Smooth zoom (replaces OrbitControls built-in zoom) ──────────────────────

function SmoothZoom() {
  const { camera, gl } = useThree();
  const targetDist = useRef(INITIAL_DIST);
  const pinchRef = useRef<{ dist: number; camDist: number } | null>(null);

  useEffect(() => {
    const canvas = gl.domElement;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Normalize across deltaMode (pixel vs line vs page)
      const raw = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      const factor = raw * 0.0012;
      targetDist.current = THREE.MathUtils.clamp(
        targetDist.current * (1 + factor),
        MIN_DIST,
        MAX_DIST
      );
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          dist: Math.hypot(dx, dy),
          camDist: camera.position.length(),
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const newDist = Math.hypot(dx, dy);
        const scale = pinchRef.current.dist / newDist;
        targetDist.current = THREE.MathUtils.clamp(
          pinchRef.current.camDist * scale,
          MIN_DIST,
          MAX_DIST
        );
      }
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
    };

    // capture:true ensures we intercept before OrbitControls
    canvas.addEventListener("wheel", onWheel, { passive: false, capture: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener("wheel", onWheel, {
        capture: true,
      } as EventListenerOptions);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [camera, gl.domElement]);

  useFrame(() => {
    const curr = camera.position.length();
    const next = THREE.MathUtils.lerp(curr, targetDist.current, 0.1);
    if (Math.abs(curr - next) > 0.0001) {
      camera.position.setLength(next);
    }
  });

  return null;
}

// ─── Pin & city position tracker ─────────────────────────────────────────────

interface GlobeDestination {
  name: string;
  lat: number;
  lon: number;
}

interface CityMarker {
  name: string;
  lat: number;
  lon: number;
  tier: 2 | 3;
}

function PinTracker({
  destinations,
  cityMarkers,
}: {
  destinations: GlobeDestination[];
  cityMarkers: CityMarker[];
}) {
  const { camera, size } = useThree();
  const vec = new THREE.Vector3();
  const pos = new THREE.Vector3();

  useFrame(() => {
    const camDist = camera.position.length();

    const projectPin = (lat: number, lon: number) => {
      pos.copy(latLonToVec3(lat, lon));
      // Cull points on the back hemisphere (facing away from camera)
      // Correct sphere occlusion: point is visible if angle from sub-camera < arccos(1/D)
      // Equivalent to: C·P > |P|   (not just > 0)
      const facing = camera.position.dot(pos) > pos.length();
      if (!facing) return null;
      vec.copy(pos).project(camera);
      if (Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) return null;
      return {
        x: ((vec.x + 1) / 2) * size.width,
        y: ((-vec.y + 1) / 2) * size.height,
      };
    };

    // Tier-1 destination pins (always visible, clickable)
    for (const d of destinations) {
      const btn = document.getElementById(`pin-btn-${d.name}`);
      const dot = document.getElementById(`pin-dot-${d.name}`);
      if (!btn || !dot) continue;

      const proj = projectPin(d.lat, d.lon);
      if (!proj) {
        btn.style.display = "none";
        dot.style.display = "none";
        continue;
      }
      btn.style.display = "flex";
      btn.style.left = `${proj.x}px`;
      btn.style.top = `${proj.y}px`;
      dot.style.display = "block";
      dot.style.left = `${proj.x}px`;
      dot.style.top = `${proj.y}px`;
    }

    // Tier-2 / tier-3 city labels (zoom-dependent)
    for (const d of cityMarkers) {
      const el = document.getElementById(`city-${d.name}`);
      if (!el) continue;

      const tierVisible =
        (d.tier === 2 && camDist < TIER2_DIST) ||
        (d.tier === 3 && camDist < TIER3_DIST);

      if (!tierVisible) {
        el.style.display = "none";
        continue;
      }

      const proj = projectPin(d.lat, d.lon);
      if (!proj) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "block";
      el.style.left = `${proj.x}px`;
      el.style.top = `${proj.y}px`;
    }
  });

  return null;
}

// ─── Scene ───────────────────────────────────────────────────────────────────

interface SceneProps {
  destinations: GlobeDestination[];
  cityMarkers: CityMarker[];
}

function Scene({ destinations, cityMarkers }: SceneProps) {
  const sun = getSunDirection();

  return (
    <>
      <color attach="background" args={[GLOBE_BG]} />

      <ambientLight intensity={0.08} />
      <directionalLight position={[sun.x, sun.y, sun.z]} intensity={2.2} color="#fff5e8" />
      <pointLight position={[-8, -4, -8]} intensity={0.18} color="#2244aa" />

      <Stars radius={300} depth={60} count={5000} factor={3} saturation={0} fade speed={0.3} />

      <Suspense fallback={<EarthFallback />}>
        <Earth />
        <Atmosphere />
      </Suspense>

      <PinTracker destinations={destinations} cityMarkers={cityMarkers} />
      <SmoothZoom />

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.45}
        makeDefault
      />
    </>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

export interface Globe3DProps {
  destinations: GlobeDestination[];
  cityMarkers?: CityMarker[];
  selected: { name: string } | null;
  onSelect: (name: string) => void;
  className?: string;
}

export function Globe3D({
  destinations,
  cityMarkers = [],
  selected,
  onSelect,
  className = "",
}: Globe3DProps) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  return (
    <div className={`relative ${className}`}>
      {/* WebGL Canvas */}
      <Canvas
        className="absolute inset-0 w-full h-full"
        camera={{ position: [0, 0, INITIAL_DIST], fov: 42 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.8,
        }}
      >
        <Scene destinations={destinations} cityMarkers={cityMarkers} />
      </Canvas>

      {/* ── Tier-1 destination pin buttons (outside canvas → no OrbitControls conflict) */}
      {destinations.map((d) => {
        const isActive = selected?.name === d.name;
        const isHovered = hoveredPin === d.name;
        const show = isActive || isHovered;

        return (
          <div key={d.name}>
            {/* Invisible hit area */}
            <button
              id={`pin-btn-${d.name}`}
              aria-label={d.name}
              onClick={() => onSelect(d.name)}
              onMouseEnter={() => setHoveredPin(d.name)}
              onMouseLeave={() => setHoveredPin(null)}
              style={{
                display: "none",
                position: "absolute",
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            />

            {/* Visual dot + label */}
            <div
              id={`pin-dot-${d.name}`}
              style={{
                display: "none",
                position: "absolute",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 9,
              }}
            >
              {show && (
                <span
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 7px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: GOLD,
                    color: GLOBE_BG,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 10px",
                    borderRadius: 999,
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.name}
                </span>
              )}
              <span
                style={{
                  display: "block",
                  width: show ? 14 : 9,
                  height: show ? 14 : 9,
                  backgroundColor: GOLD,
                  borderRadius: "50%",
                  transition: "all 0.2s",
                  boxShadow: show
                    ? `0 0 16px 6px rgba(196,176,0,0.65)`
                    : `0 0 6px 2px rgba(196,176,0,0.38)`,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* ── Tier-2/3 city labels (label-only, appear on zoom) */}
      {cityMarkers.map((d) => (
        <div
          key={`city-${d.name}`}
          id={`city-${d.name}`}
          style={{
            display: "none",
            position: "absolute",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 8,
          }}
        >
          {/* Dot */}
          <span
            style={{
              display: "block",
              width: d.tier === 2 ? 5 : 3,
              height: d.tier === 2 ? 5 : 3,
              backgroundColor: d.tier === 2
                ? "rgba(196,176,0,0.75)"
                : "rgba(196,176,0,0.55)",
              borderRadius: "50%",
              boxShadow: "0 0 4px 1px rgba(196,176,0,0.3)",
              margin: "0 auto",
            }}
          />
          {/* Label */}
          <span
            style={{
              display: "block",
              marginTop: 3,
              color: d.tier === 2
                ? "rgba(220,200,80,0.85)"
                : "rgba(196,176,0,0.6)",
              fontSize: d.tier === 2 ? 10 : 8,
              fontWeight: 500,
              whiteSpace: "nowrap",
              textShadow: "0 1px 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)",
              letterSpacing: "0.04em",
              textAlign: "center",
            }}
          >
            {d.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export type { GlobeDestination, CityMarker };
