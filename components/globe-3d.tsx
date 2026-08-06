"use client";

import { useRef, useState, Suspense, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture, Line } from "@react-three/drei";
import * as THREE from "three";

// ─── Constants ───────────────────────────────────────────────────────────────

const GOLD = "#C4B000";
const GLOBE_BG = "#0a0a06";
const MIN_DIST = 1.25;
const MAX_DIST = 9;
const INITIAL_DIST = 4.0;

// Well-separated so each tier gets real scroll room instead of the user
// blowing through 2-3 tiers in a couple of wheel notches. Tier 1 spans
// [TIER2_DIST, MAX_DIST] — deliberately wide since it's the "just selected,
// haven't zoomed yet" resting state — down to a narrower tier 3 sliver near
// MIN_DIST, matching how zooming toward a sphere naturally decelerates
// perceptually as you approach the surface.
const TIER2_DIST = 2.6;
const TIER3_DIST = 1.6;

// City satellite map starts fading in as soon as a destination is selected
// (tier 1) and keeps sharpening in opacity through tier 2 and tier 3, so it
// reads as "getting more precise" as the user zooms in, instead of popping
// in abruptly at the closest zoom only.
const SATELLITE_FADE_START = 3.4;

// The map itself grows and sharpens across the same three tiers as the hotel
// star reveal: a wide/coarse ESRI fetch far out, tightening to a close/sharp
// fetch at the closest zoom, while the drawn patch grows to match — so the
// city map visibly "zooms in" alongside the hotel list instead of being a
// single static image. fetchKm is the real-world bbox requested from ESRI
// (smaller = sharper detail per pixel); patchKm is how large that image is
// drawn on the globe (larger than its true footprint so it stays legible).
const SATELLITE_TIERS = [
  { fetchKm: 30, patchKm: 480 }, // tier 1 — first zoom, 5★ only
  { fetchKm: 14, patchKm: 700 }, // tier 2 — 3-4★
  { fetchKm: 6, patchKm: 950 },  // tier 3 — closest, 2★+
] as const;

function satelliteTierIndex(camDist: number): 0 | 1 | 2 {
  if (camDist > TIER2_DIST) return 0;
  if (camDist > TIER3_DIST) return 1;
  return 2;
}

const EARTH_RADIUS_KM = 6371;

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

  useMemo(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    for (const t of [colorMap, bumpMap, specularMap]) {
      t.anisotropy = maxAniso;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
    }
  }, [colorMap, bumpMap, specularMap, gl]);

  useFrame(() => {
    if (!matRef.current) return;
    const dist = camera.position.length();
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

// ─── Smooth zoom ─────────────────────────────────────────────────────────────

function SmoothZoom({
  containerRef,
  targetDistRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  targetDistRef: React.RefObject<number>;
}) {
  const { camera, gl } = useThree();
  const targetDist = targetDistRef;
  const pinchRef = useRef<{ dist: number; camDist: number } | null>(null);

  useEffect(() => {
    // Listen on the outer container (not the canvas, and not just its direct
    // parent — R3F wraps the canvas in its own internal divs) so scrolling
    // over sibling overlays — destination pin buttons, city labels — still
    // zooms; those elements sit on top of the canvas but aren't inside it,
    // so a canvas-only listener never sees events that start on them.
    const canvas: HTMLElement = containerRef.current ?? gl.domElement;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const raw = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      // Slower than a naive 1:1 mapping so a single mouse-wheel notch doesn't
      // blow through 2-3 star tiers at once — this gives ~12-15 notches to
      // travel the full INITIAL_DIST → MIN_DIST range, enough to actually
      // perceive each tier instead of skipping over it.
      const factor = raw * 0.0009;
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
        pinchRef.current = { dist: Math.hypot(dx, dy), camDist: camera.position.length() };
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

    const onTouchEnd = () => { pinchRef.current = null; };

    canvas.addEventListener("wheel", onWheel, { passive: false, capture: true });
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [camera, gl.domElement, containerRef]);

  useFrame(() => {
    const curr = camera.position.length();
    const next = THREE.MathUtils.lerp(curr, targetDist.current, 0.1);
    if (Math.abs(curr - next) > 0.0001) camera.position.setLength(next);
  });

  return null;
}

// ─── Fly to selection (rotate to face the pin on click) ──────────────────────

function FlyToSelection({
  target,
}: {
  target: { lat: number; lon: number } | undefined;
}) {
  const { camera } = useThree();
  const lastKey = useRef<string | null>(null);
  const anim = useRef<{ from: THREE.Vector3; to: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!target) {
      lastKey.current = null;
      return;
    }
    const key = `${target.lat},${target.lon}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    anim.current = {
      from: camera.position.clone().normalize(),
      to: latLonToVec3(target.lat, target.lon, 1).normalize(),
      t: 0,
    };
    // Rotation only — the first click should still land on the tier-1 (5-star)
    // view. Zoom stays entirely under the user's control via scroll/pinch, and
    // the city satellite patch reveals itself once they zoom in to tier 3.
  }, [target, camera]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a) return;
    a.t = Math.min(a.t + delta / 1.1, 1);
    const ease = 1 - Math.pow(1 - a.t, 3);
    const dir = a.from.clone().lerp(a.to, ease).normalize();
    // Only steer direction here — SmoothZoom independently lerps the radius
    // toward targetDistRef each frame, so preserving the current length and
    // letting it own magnitude keeps the two animations from fighting.
    camera.position.copy(dir.multiplyScalar(camera.position.length()));
    if (a.t >= 1) anim.current = null;
  });

  return null;
}

// ─── Camera distance reporter ────────────────────────────────────────────────

function CamDistReporter({ onCamDist }: { onCamDist?: (d: number) => void }) {
  const { camera } = useThree();
  const lastD = useRef(INITIAL_DIST);
  useFrame(() => {
    const d = camera.position.length();
    if (Math.abs(d - lastD.current) > 0.08) {
      lastD.current = d;
      onCamDist?.(d);
    }
  });
  return null;
}

// ─── User position marker (blue pulsing dot) ─────────────────────────────────

function UserMarker({ lat, lon }: { lat: number; lon: number }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = clock.elapsedTime;
    const pulse = (Math.sin(t * 3) + 1) / 2;
    ringRef.current.scale.setScalar(1 + 0.4 * pulse);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 - 0.4 * pulse;
  });

  const pos = latLonToVec3(lat, lon, 1.015);

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshBasicMaterial color="#5599ff" />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.008, 0.012, 16]} />
        <meshBasicMaterial color="#5599ff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Flight arc + animated plane ─────────────────────────────────────────────

function FlightArc({
  fromLat, fromLon, toLat, toLon,
}: {
  fromLat: number; fromLon: number; toLat: number; toLon: number;
}) {
  const planeRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  const { arcPoints, getPoint } = useMemo(() => {
    const from = latLonToVec3(fromLat, fromLon).normalize();
    const to = latLonToVec3(toLat, toLon).normalize();
    const ARC_H = 0.26;

    const getPoint = (t: number): THREE.Vector3 => {
      const p = from.clone().lerp(to, t).normalize();
      p.multiplyScalar(1.02 + ARC_H * Math.sin(Math.PI * t));
      return p;
    };

    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 90; i++) {
      arcPoints.push(getPoint(i / 90));
    }

    return { arcPoints, getPoint };
  }, [fromLat, fromLon, toLat, toLon]);

  useFrame((_, delta) => {
    if (!planeRef.current) return;
    progress.current = (progress.current + delta * 0.1) % 1;
    const pos = getPoint(progress.current);
    const next = getPoint(Math.min(progress.current + 0.015, 0.999));
    const dir = next.clone().sub(pos).normalize();
    planeRef.current.position.copy(pos);
    planeRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  });

  return (
    <>
      <Line
        points={arcPoints}
        color={GOLD}
        lineWidth={1.5}
        dashed
        dashSize={0.04}
        gapSize={0.025}
        opacity={0.75}
        transparent
      />
      {/* Animated plane (gold cone) */}
      <mesh ref={planeRef}>
        <coneGeometry args={[0.004, 0.013, 6]} />
        <meshBasicMaterial color={GOLD} />
      </mesh>
    </>
  );
}

// ─── City satellite patch (ESRI World Imagery, tangent to the globe) ────────

function tangentBasisAt(lat: number, lon: number): { normal: THREE.Vector3; north: THREE.Vector3; east: THREE.Vector3 } {
  const normal = latLonToVec3(lat, lon, 1).normalize();
  const north = latLonToVec3(lat + 0.5, lon, 1).sub(latLonToVec3(lat - 0.5, lon, 1)).normalize();
  const east = latLonToVec3(lat, lon + 0.5, 1).sub(latLonToVec3(lat, lon - 0.5, 1)).normalize();
  return { normal, north, east };
}

// Builds the satellite patch as a grid wrapped onto the sphere (each vertex
// offset in the local tangent plane, then re-normalized back onto the
// sphere) instead of one flat quad. A flat quad tangent at a single point
// visibly floats off the sphere's curvature at the patch's edges once it
// gets large (worst at the closest zoom tier, ~950km wide) — this keeps it
// flush with the globe at every tier.
function buildCurvedPatchGeometry(
  normal: THREE.Vector3,
  north: THREE.Vector3,
  east: THREE.Vector3,
  sizeWorld: number,
  segments = 14
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();

  for (let j = 0; j <= segments; j++) {
    const v = (j / segments - 0.5) * sizeWorld;
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments - 0.5) * sizeWorld;
      p.copy(normal).addScaledVector(east, u).addScaledVector(north, v);
      p.normalize().multiplyScalar(1.004);
      positions.push(p.x, p.y, p.z);
      // v must increase toward north (matches texture.flipY default: uv.y=1
      // samples the top row of the source image, which ESRI's bbox export
      // always puts at max-latitude/north) — flip it here and the map
      // renders upside down (south where north should be).
      uvs.push(i / segments, j / segments);
    }
  }
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * (segments + 1) + i;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      // east × north = outward normal (right-handed ENU frame), so this
      // winding is the one that faces outward/toward the camera.
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Soft radial falloff so the patch fades into the surrounding globe texture
// instead of ending in a hard rectangle — generated once and reused for
// every city/tier.
let softEdgeAlphaTexture: THREE.Texture | null = null;
function getSoftEdgeAlphaTexture(): THREE.Texture {
  if (softEdgeAlphaTexture) return softEdgeAlphaTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.72, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  softEdgeAlphaTexture = new THREE.CanvasTexture(canvas);
  return softEdgeAlphaTexture;
}

function CitySatellitePatch({ lat, lon }: { lat: number; lon: number }) {
  const { camera } = useThree();
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const [tierIdx, setTierIdx] = useState<0 | 1 | 2>(0);
  const lastTierRef = useRef<0 | 1 | 2>(0);
  // Keeps every tier's texture once loaded (not just the current one) so the
  // patch can keep showing the previous, coarser image while a sharper fetch
  // for the new tier is still in flight, instead of flashing blank.
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>([null, null, null]);

  useFrame(() => {
    const idx = satelliteTierIndex(camera.position.length());
    if (idx !== lastTierRef.current) {
      lastTierRef.current = idx;
      setTierIdx(idx);
    }
  });

  useEffect(() => {
    let cancelled = false;
    const { fetchKm } = SATELLITE_TIERS[tierIdx];
    const latSpan = fetchKm / 111.32;
    const lonSpan = fetchKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.15));
    const bbox = [lon - lonSpan / 2, lat - latSpan / 2, lon + lonSpan / 2, lat + latSpan / 2].join(",");
    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=768,768&format=jpg&f=image`;

    new THREE.TextureLoader().load(
      url,
      (tex) => {
        if (cancelled) return;
        tex.colorSpace = THREE.SRGBColorSpace;
        setTextures((prev) => {
          const next = [...prev];
          next[tierIdx] = tex;
          return next;
        });
      },
      undefined,
      () => {} // silently ignore load failure — falls back to another loaded tier, or stays hidden
    );

    return () => { cancelled = true; };
  }, [lat, lon, tierIdx]);

  const { normal, north, east } = useMemo(() => tangentBasisAt(lat, lon), [lat, lon]);

  const texture = textures[tierIdx] ?? textures.find((t) => t) ?? null;
  const size = SATELLITE_TIERS[tierIdx].patchKm / EARTH_RADIUS_KM;
  const geometry = useMemo(
    () => buildCurvedPatchGeometry(normal, north, east, size),
    [normal, north, east, size]
  );
  const alphaMap = useMemo(() => getSoftEdgeAlphaTexture(), []);

  useFrame(() => {
    if (!matRef.current) return;
    const dist = camera.position.length();
    matRef.current.opacity = texture
      ? THREE.MathUtils.clamp(THREE.MathUtils.mapLinear(dist, SATELLITE_FADE_START, MIN_DIST + 0.05, 0, 1), 0, 1)
      : 0;
  });

  if (!texture) return null;

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        alphaMap={alphaMap}
        transparent
        opacity={0}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── Pin & city tracker ───────────────────────────────────────────────────────

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

interface HotelMarker {
  name: string;
  lat: number;
  lon: number;
  rating: number;
  address?: string;
  website?: string;
  mapsUrl: string;
  bookingUrl: string;
}

function PinTracker({
  destinations,
  cityMarkers,
  hotelMarkers,
  hotelCenter,
}: {
  destinations: GlobeDestination[];
  cityMarkers: CityMarker[];
  hotelMarkers: HotelMarker[];
  hotelCenter?: { lat: number; lon: number };
}) {
  const { camera, size } = useThree();
  const vec = new THREE.Vector3();
  const pos = new THREE.Vector3();

  useFrame(() => {
    const camDist = camera.position.length();

    const projectPoint = (p: THREE.Vector3) => {
      const facing = camera.position.dot(p) > p.length();
      if (!facing) return null;
      vec.copy(p).project(camera);
      if (Math.abs(vec.x) > 1 || Math.abs(vec.y) > 1) return null;
      return {
        x: ((vec.x + 1) / 2) * size.width,
        y: ((-vec.y + 1) / 2) * size.height,
      };
    };

    const projectPin = (lat: number, lon: number) => {
      pos.copy(latLonToVec3(lat, lon));
      return projectPoint(pos);
    };

    // Hotels are real-world coordinates, but the satellite patch is drawn
    // much larger than its true footprint to stay legible (see
    // SATELLITE_TIERS). Project hotels the same exaggerated way — as an
    // offset from the selected city, scaled up by the current tier's factor —
    // so they land on the patch instead of clustering at their true (tiny)
    // spacing, and stay aligned with the patch as it grows across tiers.
    const projectHotel = (lat: number, lon: number) => {
      if (!hotelCenter) return null;
      const { fetchKm, patchKm } = SATELLITE_TIERS[satelliteTierIndex(camDist)];
      const { normal, north, east } = tangentBasisAt(hotelCenter.lat, hotelCenter.lon);
      const dxKm = (lon - hotelCenter.lon) * 111.32 * Math.cos((hotelCenter.lat * Math.PI) / 180);
      const dyKm = (lat - hotelCenter.lat) * 111.32;
      const kmToOffset = (patchKm / EARTH_RADIUS_KM) / fetchKm;
      pos.copy(normal).multiplyScalar(1.004);
      pos.addScaledVector(east, dxKm * kmToOffset);
      pos.addScaledVector(north, dyKm * kmToOffset);
      return projectPoint(pos);
    };

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

    for (const d of cityMarkers) {
      const el = document.getElementById(`city-${d.name}`);
      if (!el) continue;
      const tierVisible =
        (d.tier === 2 && camDist < TIER2_DIST) ||
        (d.tier === 3 && camDist < TIER3_DIST);
      if (!tierVisible) { el.style.display = "none"; continue; }
      const proj = projectPin(d.lat, d.lon);
      if (!proj) { el.style.display = "none"; continue; }
      el.style.display = "block";
      el.style.left = `${proj.x}px`;
      el.style.top = `${proj.y}px`;
    }

    for (const h of hotelMarkers) {
      const el = document.getElementById(`hotel-${h.name}`);
      if (!el) continue;
      const proj = projectHotel(h.lat, h.lon);
      if (!proj) { el.style.display = "none"; continue; }
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
  hotelMarkers: HotelMarker[];
  onCamDist?: (d: number) => void;
  userLatLon?: { lat: number; lon: number };
  targetLatLon?: { lat: number; lon: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function Scene({ destinations, cityMarkers, hotelMarkers, onCamDist, userLatLon, targetLatLon, containerRef }: SceneProps) {
  const targetDistRef = useRef(INITIAL_DIST);

  return (
    <>
      <color attach="background" args={[GLOBE_BG]} />

      {/* Uniformly lit everywhere — no day/night shadow */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 3, 4]} intensity={0.2} color="#fff8f0" />

      <Stars radius={300} depth={60} count={5000} factor={3} saturation={0} fade speed={0.3} />

      <Suspense fallback={<EarthFallback />}>
        <Earth />
        <Atmosphere />
      </Suspense>

      {/* User position marker */}
      {userLatLon && <UserMarker lat={userLatLon.lat} lon={userLatLon.lon} />}

      {/* High-res satellite patch over the selected city, fades in on deep zoom.
          Keyed by city so tier/texture cache resets cleanly on selection change. */}
      {targetLatLon && (
        <CitySatellitePatch
          key={`${targetLatLon.lat},${targetLatLon.lon}`}
          lat={targetLatLon.lat}
          lon={targetLatLon.lon}
        />
      )}

      {/* Flight arc + animated plane */}
      {userLatLon && targetLatLon && (
        <FlightArc
          fromLat={userLatLon.lat}
          fromLon={userLatLon.lon}
          toLat={targetLatLon.lat}
          toLon={targetLatLon.lon}
        />
      )}

      <PinTracker destinations={destinations} cityMarkers={cityMarkers} hotelMarkers={hotelMarkers} hotelCenter={targetLatLon} />
      <SmoothZoom containerRef={containerRef} targetDistRef={targetDistRef} />
      <FlyToSelection target={targetLatLon} />
      <CamDistReporter onCamDist={onCamDist} />

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
  hotelMarkers?: HotelMarker[];
  selected: { name: string; lat: number; lon: number } | null;
  onSelect: (name: string) => void;
  onCamDist?: (d: number) => void;
  userLatLon?: { lat: number; lon: number };
  className?: string;
}

export function Globe3D({
  destinations,
  cityMarkers = [],
  hotelMarkers = [],
  selected,
  onSelect,
  onCamDist,
  userLatLon,
  className = "",
}: Globe3DProps) {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [activeHotel, setActiveHotel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hotel cards open on hover for mouse/trackpad users, and on tap for touch
  // devices — matchMedia is the standard way to tell the two apart, since a
  // touchscreen never truly satisfies "hover: hover" + "pointer: fine".
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(!window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const targetLatLon = selected
    ? { lat: selected.lat, lon: selected.lon }
    : undefined;

  useEffect(() => {
    setActiveHotel(null);
  }, [selected?.name]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
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
        <Scene
          destinations={destinations}
          cityMarkers={cityMarkers}
          hotelMarkers={hotelMarkers}
          onCamDist={onCamDist}
          userLatLon={userLatLon}
          targetLatLon={targetLatLon}
          containerRef={containerRef}
        />
      </Canvas>

      {/* Tier-1 destination pins */}
      {destinations.map((d) => {
        const isActive = selected?.name === d.name;
        const isHovered = hoveredPin === d.name;
        const show = isActive || isHovered;

        return (
          <div key={d.name}>
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

      {/* Tier-2/3 city labels */}
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
          <span
            style={{
              display: "block",
              width: d.tier === 2 ? 5 : 3,
              height: d.tier === 2 ? 5 : 3,
              backgroundColor: d.tier === 2 ? "rgba(196,176,0,0.75)" : "rgba(196,176,0,0.55)",
              borderRadius: "50%",
              boxShadow: "0 0 4px 1px rgba(196,176,0,0.3)",
              margin: "0 auto",
            }}
          />
          <span
            style={{
              display: "block",
              marginTop: 3,
              color: d.tier === 2 ? "rgba(220,200,80,0.85)" : "rgba(196,176,0,0.6)",
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

      {/* Hotel markers for the selected city, revealed progressively by star tier */}
      {hotelMarkers.map((h) => {
        const isActive = activeHotel === h.name;
        const primaryUrl = h.website ?? h.mapsUrl;
        return (
          <div
            key={`hotel-${h.name}`}
            id={`hotel-${h.name}`}
            style={{
              display: "none",
              position: "absolute",
              transform: "translate(-50%, -50%)",
              zIndex: isActive ? 20 : 7,
            }}
            onMouseEnter={() => { if (!isTouch) setActiveHotel(h.name); }}
            onMouseLeave={() => { if (!isTouch) setActiveHotel(null); }}
          >
            <button
              aria-label={h.name}
              title={`${h.name} — ${h.rating}★`}
              onClick={() => { if (isTouch) setActiveHotel(isActive ? null : h.name); }}
              style={{
                display: "block",
                width: isActive ? 13 : 9,
                height: isActive ? 13 : 9,
                borderRadius: "50%",
                backgroundColor: "#f5f0e6",
                border: "1px solid rgba(10,10,6,0.6)",
                boxShadow: isActive
                  ? "0 0 8px 3px rgba(245,240,230,0.85)"
                  : "0 0 5px 1px rgba(245,240,230,0.55)",
                cursor: "pointer",
                padding: 0,
              }}
            />
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "min(220px, 78vw)",
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: "rgba(10,10,6,0.95)",
                  border: "1px solid rgba(196,176,0,0.3)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  cursor: "default",
                }}
              >
                <button
                  aria-label="Fermer"
                  onClick={() => setActiveHotel(null)}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 8,
                    background: "none",
                    border: "none",
                    color: "rgba(245,240,230,0.5)",
                    fontSize: 14,
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  ×
                </button>
                <p style={{ color: "#f5f0e6", fontSize: 13, fontWeight: 600, marginRight: 14, marginBottom: 2 }}>
                  {h.name}
                </p>
                <p style={{ color: GOLD, fontSize: 11, marginBottom: h.address ? 2 : 8 }}>
                  {"★".repeat(h.rating)}
                </p>
                {h.address && (
                  <p style={{ color: "rgba(245,240,230,0.55)", fontSize: 10, marginBottom: 8 }}>
                    {h.address}
                  </p>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <a
                    href={primaryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "6px 4px",
                      borderRadius: 8,
                      backgroundColor: GOLD,
                      color: GLOBE_BG,
                    }}
                  >
                    {h.website ? "Site officiel" : "Voir sur Maps"}
                  </a>
                  <a
                    href={h.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "6px 4px",
                      borderRadius: 8,
                      border: `1px solid ${GOLD}`,
                      color: GOLD,
                    }}
                  >
                    Booking.com
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type { GlobeDestination, CityMarker, HotelMarker };
